/**
 * AgentAd Trust 정책 엔진 (규칙 기반, 순수 함수)
 *
 * 계약에 등록된 집계 정책(policies/*.json)을 읽어 이벤트 기록을 판정한다. LLM에 집계를 묻지 않으며,
 * 같은 데이터·같은 정책이면 언제나 같은 결과와 같은 verificationHash가 나온다.
 *
 * 판정 단위 = 광고 수신 1건 (campaignId, offerId, runId) → 해당 실행의 AI 답변(responseId)과 연결
 * 정산 집계 단위 = policy.deduplicationKey (기본: campaignId + offerId + responseId)
 *
 * 유효한 광고 표시 1건의 인정 조건 (AGENTAD-PRESENTED-V1)
 *  ① 유효한 광고 계약     : 활성 계약 기간 + 등록된 스폰서 제안
 *  ② 광고 수신           : 광고 API 수신 기록과 AI 실행(runId) 연결
 *  ③ 유료 추천 포함       : offerId가 연결된 구조화된 추천 (상품명 일치만으로는 불인정)
 *  ④ 화면 렌더링         : 프론트엔드 표시 이벤트 + 화면 증빙 해시 일치
 *  ⑤ 중복·무효 여부       : 동일 응답 중복, 자동 테스트, 비정상 실행 필터링
 *  ⑥ 증빙 확인           : 로그·식별자·해시 일치 (증빙 무결성)
 *
 * 판정 결과: VALID(승인 가능) · INVALID(제외) · INCONCLUSIVE(검증 불가, 정산 보류) · DUPLICATE(제외)
 */
import type { Hex } from "viem";
import { hashCanonical } from "@/lib/core/canonical";
import { ENGINE_VERSION } from "@/lib/campaigns/terms";
import { policyHash, type AggregationPolicy } from "@/lib/policy/policies";
import {
  buildManifest,
  computeEvidenceHash,
  computePresentationHash,
  type AdEventRecord,
  type AdEventType,
  type DataMode,
  type ManifestEntry,
} from "@/lib/events/spec";

export const VERIFICATION_SPEC_VERSION = "agentad-trust/verification@2";

export type Verdict = "VALID" | "INVALID" | "INCONCLUSIVE" | "DUPLICATE";
export type UnitVerdict = Exclude<Verdict, "DUPLICATE">;

export const VERDICT_LABEL: Record<Verdict, string> = {
  VALID: "인정 조건 충족 · 승인 가능",
  INVALID: "인정 조건 불충족 · 제외",
  INCONCLUSIVE: "증빙 부족 · 정산 보류",
  DUPLICATE: "중복 이벤트 · 제외",
};

export type ReasonCode =
  | "ALL_CONDITIONS_MET"
  | "NOT_RECOMMENDED"
  | "NOT_PRESENTED"
  | "EVIDENCE_MISSING"
  | "EVIDENCE_MISMATCH"
  | "EVIDENCE_CONFLICT"
  | "DISCLOSURE_VIOLATION"
  | "NOT_VIEWABLE"
  | "TEST_TRAFFIC"
  | "CONTRACT_INACTIVE"
  | "UNKNOWN_OFFER"
  | "WRONG_CAMPAIGN"
  | "UNLINKED_RECOMMENDATION"
  | "MALFORMED"
  | "NO_RECEIPT"
  | "NO_RECOMMENDATION"
  | "OUT_OF_ORDER"
  | "DUPLICATE_EVENT"
  | "TAMPERED_ADDED"
  | "TAMPERED_MODIFIED";

export const REASON_LABEL: Record<ReasonCode, string> = {
  ALL_CONDITIONS_MET: "모든 인정 조건 충족",
  NOT_RECOMMENDED: "수신만 하고 미추천 (수신 통계만 기록)",
  NOT_PRESENTED: "추천 후 화면 미표시 확인",
  EVIDENCE_MISSING: "최종 화면 증빙 누락 (검증 불가)",
  EVIDENCE_MISMATCH: "화면 증빙이 등록된 광고 제안과 불일치",
  EVIDENCE_CONFLICT: "표시·미표시 기록이 동시에 존재 (검증 불가)",
  DISCLOSURE_VIOLATION: "광고 관계 공개 누락 (준수 위반)",
  NOT_VIEWABLE: "가시성 기준 미충족",
  TEST_TRAFFIC: "자동 테스트 실행 (실적 제외)",
  CONTRACT_INACTIVE: "활성 계약 기간 외 기록",
  UNKNOWN_OFFER: "등록되지 않은 광고 제안",
  WRONG_CAMPAIGN: "다른 캠페인의 기록",
  UNLINKED_RECOMMENDATION: "유료 제안과 구조적으로 연결되지 않은 추천",
  MALFORMED: "필수 식별자 누락·형식 오류",
  NO_RECEIPT: "수신 기록 없는 추천",
  NO_RECOMMENDATION: "추천 기록 없는 화면 이벤트",
  OUT_OF_ORDER: "단계 순서 역전 (시각 불일치)",
  DUPLICATE_EVENT: "동일 광고 이벤트 중복",
  TAMPERED_ADDED: "제출 이후 추가된 이벤트 (증빙 변조)",
  TAMPERED_MODIFIED: "제출 이후 내용이 바뀐 이벤트 (증빙 변조)",
};

export interface EngineCampaign {
  campaignId: string;
  startAt: string;
  endAt: string;
  /** 광고 매체가 계약을 수락해 활성화된 시점 (없으면 기간 시작부터) */
  activatedAt: string | null;
  offers: { offerId: string; productName: string }[];
  policy: AggregationPolicy;
  /** DB에 저장된 계약 조건으로 다시 계산한 해시 */
  termsHash: string;
  /** 블록체인에 확정된 계약 조건 해시 (조회 불가 시 null) */
  anchoredTermsHash: string | null;
}

export interface EngineReport {
  reportId: string;
  reportedCount: number;
  periodStart: string;
  periodEnd: string;
  manifest: ManifestEntry[];
  evidenceHash: string;
  onChainEvidenceHash: string | null;
}

export interface VerificationInput {
  campaign: EngineCampaign;
  report: EngineReport;
  events: AdEventRecord[];
}

export interface EventExclusion {
  eventId: string;
  eventType: AdEventType;
  verdict: "INVALID" | "DUPLICATE";
  reason: ReasonCode;
  detail: string | null;
}

export interface UnitResult {
  unitKey: string; // policy.deduplicationKey 값 (응답이 없으면 campaignId|offerId|runId)
  campaignId: string;
  offerId: string;
  runId: string;
  responseId: string | null;
  dataMode: DataMode;
  receivedEventId: string;
  recommendedEventId: string | null;
  presentedEventId: string | null;
  notPresentedEventId: string | null;
  viewableEventId: string | null;
  verdict: UnitVerdict;
  reason: ReasonCode;
}

export interface StageCounts {
  received: number;
  recommended: number;
  presented: number;
  viewable: number;
}

export interface EventAnalysis {
  stageCounts: StageCounts;
  stageCountsByMode: Record<DataMode, StageCounts>;
  units: UnitResult[];
  excludedEvents: EventExclusion[];
  verdictCounts: Record<Verdict, number>;
  billableCount: number; // VALID
  heldCount: number; // INCONCLUSIVE (정산 보류)
  compliance: { disclosureViolations: string[] };
}

export interface IntegrityResult {
  intact: boolean;
  anchor: "ONCHAIN" | "DATABASE";
  evidence: {
    intact: boolean;
    anchoredHash: string;
    computedHash: string;
    storedManifestHash: string;
    addedEventIds: string[];
    modifiedEventIds: string[];
    missingEventIds: string[];
  };
  terms: {
    intact: boolean;
    computedHash: string;
    anchoredHash: string | null;
  };
}

export interface VerificationResult extends EventAnalysis {
  spec: typeof VERIFICATION_SPEC_VERSION;
  engine: typeof ENGINE_VERSION;
  reportId: string;
  campaignId: string;
  policy: { policyId: string; version: string; policyHash: string; billingMetric: string };
  period: { start: string; end: string };
  reportedCount: number;
  verifiedCount: number; // = billableCount
  gap: {
    total: number; // reported - verified
    byReason: Partial<Record<ReasonCode, number>>;
    unsupportedByEvidence: number; // 수신 기록으로 뒷받침되지 않는 보고분
    underReported: number;
  };
  integrity: IntegrityResult;
}

const byEventId = (a: { eventId: string }, b: { eventId: string }) =>
  a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0;
const sameHash = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();
const time = (iso: string) => Date.parse(iso);

const emptyCounts = (): StageCounts => ({ received: 0, recommended: 0, presented: 0, viewable: 0 });

function fieldValue(e: AdEventRecord, field: string): string {
  return String((e as unknown as Record<string, unknown>)[field] ?? "");
}

/**
 * 이벤트 목록을 계약 정책으로 판정한다 (증빙 무결성 검사 제외).
 * 대시보드의 실시간 집계와 보고서 검증이 같은 함수를 쓴다.
 */
export function analyzeEvents(
  campaign: Pick<EngineCampaign, "campaignId" | "startAt" | "endAt" | "activatedAt" | "offers" | "policy">,
  events: AdEventRecord[],
  preExcluded: EventExclusion[] = [],
): EventAnalysis {
  const { policy } = campaign;
  const excluded: EventExclusion[] = [...preExcluded];
  const exclude = (e: AdEventRecord, reason: ReasonCode, detail: string | null = null, verdict: "INVALID" | "DUPLICATE" = "INVALID") =>
    excluded.push({ eventId: e.eventId, eventType: e.eventType, verdict, reason, detail });

  const productNameOf = new Map(campaign.offers.map((o) => [o.offerId, o.productName]));
  const activeFrom = Math.max(time(campaign.startAt), campaign.activatedAt ? time(campaign.activatedAt) : -Infinity);
  const activeUntil = time(campaign.endAt);

  // 1) 이벤트 유효성: ① 계약·제안, 식별자, ③ 구조화된 추천 연결
  const valid: AdEventRecord[] = [];
  for (const e of [...events].sort(byEventId)) {
    const ts = time(e.timestamp);
    if (e.campaignId !== campaign.campaignId) exclude(e, "WRONG_CAMPAIGN", e.campaignId);
    else if (policy.requireSponsoredOffer && !productNameOf.has(e.offerId)) exclude(e, "UNKNOWN_OFFER", e.offerId);
    else if (!Number.isFinite(ts) || ts < activeFrom || ts > activeUntil) exclude(e, "CONTRACT_INACTIVE", e.timestamp);
    else if (!e.runId || (e.eventType !== "AD_RECEIVED" && !e.responseId)) exclude(e, "MALFORMED", "runId/responseId 누락");
    else if (e.eventType === "AD_RECOMMENDED" && e.payload?.linkedOfferId !== e.offerId)
      exclude(e, "UNLINKED_RECOMMENDATION", "구조화된 추천에 offerId 연결 없음");
    else valid.push(e);
  }

  // 2) 중복 제거 (onDuplicate: EXCLUDE): 수신은 실행 단위, 나머지는 정책의 중복 집계 키 단위
  const firstByKey = new Map<string, AdEventRecord>();
  const deduped: AdEventRecord[] = [];
  const ordered = [...valid].sort((a, b) => time(a.timestamp) - time(b.timestamp) || byEventId(a, b));
  for (const e of ordered) {
    const fields = e.eventType === "AD_RECEIVED" ? ["campaignId", "offerId", "runId"] : policy.deduplicationKey;
    const key = `${e.eventType}|${fields.map((f) => fieldValue(e, f)).join("|")}`;
    const first = firstByKey.get(key);
    if (first) exclude(e, "DUPLICATE_EVENT", `${first.eventId}와 같은 집계 단위`, "DUPLICATE");
    else {
      firstByKey.set(key, e);
      deduped.push(e);
    }
  }

  // 3) 단계 연결: 수신(runId) → 추천(responseId) → 화면 이벤트(responseId)
  const runKey = (e: AdEventRecord) => `${e.campaignId}|${e.offerId}|${e.runId}`;
  const unitKeyOf = (e: AdEventRecord) => policy.deduplicationKey.map((f) => fieldValue(e, f)).join("|");
  const ofType = (t: AdEventType) => deduped.filter((x) => x.eventType === t).sort(byEventId);

  const received = new Map<string, AdEventRecord>();
  for (const e of ofType("AD_RECEIVED")) received.set(runKey(e), e);

  const recommendedByRun = new Map<string, AdEventRecord>();
  const recommendedByUnit = new Map<string, AdEventRecord>();
  for (const e of ofType("AD_RECOMMENDED")) {
    const r = received.get(runKey(e));
    if (!r) exclude(e, "NO_RECEIPT", `${e.runId}/${e.offerId} 수신 기록 없음`);
    else if (time(e.timestamp) < time(r.timestamp)) exclude(e, "OUT_OF_ORDER", `수신(${r.eventId})보다 이른 추천`);
    else if (recommendedByRun.has(runKey(e))) exclude(e, "MALFORMED", "한 실행에 최종 추천 응답은 1건");
    else {
      recommendedByRun.set(runKey(e), e);
      recommendedByUnit.set(unitKeyOf(e), e);
    }
  }

  const screen: Record<"AD_PRESENTED" | "AD_NOT_PRESENTED" | "AD_VIEWABLE", Map<string, AdEventRecord>> = {
    AD_PRESENTED: new Map(),
    AD_NOT_PRESENTED: new Map(),
    AD_VIEWABLE: new Map(),
  };
  for (const type of ["AD_PRESENTED", "AD_NOT_PRESENTED", "AD_VIEWABLE"] as const) {
    for (const e of ofType(type)) {
      const c = recommendedByUnit.get(unitKeyOf(e));
      if (!c) exclude(e, "NO_RECOMMENDATION", `${e.responseId ?? "-"}에 연결된 추천 없음`);
      else if (time(e.timestamp) < time(c.timestamp)) exclude(e, "OUT_OF_ORDER", `추천(${c.eventId})보다 이른 화면 이벤트`);
      else screen[type].set(unitKeyOf(e), e);
    }
  }

  // 4) 수신 단위별 판정
  const disclosureViolations: string[] = [];
  const units: UnitResult[] = [...received.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, r]) => {
      const c = recommendedByRun.get(key) ?? null;
      const ukey = c ? unitKeyOf(c) : key;
      const presented = c ? screen.AD_PRESENTED.get(ukey) ?? null : null;
      const notPresented = c ? screen.AD_NOT_PRESENTED.get(ukey) ?? null : null;
      const viewable = c ? screen.AD_VIEWABLE.get(ukey) ?? null : null;

      let verdict: UnitVerdict;
      let reason: ReasonCode;
      if (policy.excludeTestTraffic && r.dataMode === "TEST") [verdict, reason] = ["INVALID", "TEST_TRAFFIC"];
      else if (!c) [verdict, reason] = ["INVALID", "NOT_RECOMMENDED"];
      else if (presented && notPresented) [verdict, reason] = ["INCONCLUSIVE", "EVIDENCE_CONFLICT"];
      else if (presented) [verdict, reason] = judgePresentation(presented, productNameOf.get(r.offerId) ?? "", viewable, policy);
      else if (notPresented) [verdict, reason] = ["INVALID", "NOT_PRESENTED"];
      else [verdict, reason] = [policy.onMissingEvidence, "EVIDENCE_MISSING"];

      if (reason === "DISCLOSURE_VIOLATION") disclosureViolations.push(ukey);
      return {
        unitKey: ukey,
        campaignId: r.campaignId,
        offerId: r.offerId,
        runId: r.runId,
        responseId: c?.responseId ?? null,
        dataMode: r.dataMode,
        receivedEventId: r.eventId,
        recommendedEventId: c?.eventId ?? null,
        presentedEventId: presented?.eventId ?? null,
        notPresentedEventId: notPresented?.eventId ?? null,
        viewableEventId: viewable?.eventId ?? null,
        verdict,
        reason,
      };
    });

  // 5) 통계 (보조 지표 포함, 판정과 무관하게 단계별로 센다)
  const stageCounts = emptyCounts();
  const stageCountsByMode: Record<DataMode, StageCounts> = { LIVE: emptyCounts(), TEST: emptyCounts() };
  for (const u of units) {
    for (const bucket of [stageCounts, stageCountsByMode[u.dataMode]]) {
      bucket.received += 1;
      if (u.recommendedEventId) bucket.recommended += 1;
      if (u.presentedEventId) bucket.presented += 1;
      if (u.viewableEventId) bucket.viewable += 1;
    }
  }

  const verdictCounts: Record<Verdict, number> = {
    VALID: units.filter((u) => u.verdict === "VALID").length,
    INVALID: units.filter((u) => u.verdict === "INVALID").length,
    INCONCLUSIVE: units.filter((u) => u.verdict === "INCONCLUSIVE").length,
    DUPLICATE: excluded.filter((e) => e.verdict === "DUPLICATE").length,
  };

  return {
    stageCounts,
    stageCountsByMode,
    units,
    excludedEvents: excluded.sort(byEventId),
    verdictCounts,
    billableCount: verdictCounts.VALID,
    heldCount: verdictCounts.INCONCLUSIVE,
    compliance: { disclosureViolations: disclosureViolations.sort() },
  };
}

/** ④ 화면 렌더링 + ⑥ 증빙: 화면 증빙 해시, 광고 관계 공개, (정책에 따라) 가시성 */
function judgePresentation(
  presented: AdEventRecord,
  productName: string,
  viewable: AdEventRecord | null,
  policy: AggregationPolicy,
): [UnitVerdict, ReasonCode] {
  if (policy.requireEvidence) {
    const contentHash = presented.payload?.contentHash;
    if (typeof contentHash !== "string" || !contentHash) return [policy.onMissingEvidence, "EVIDENCE_MISSING"];
    const expected = computePresentationHash({
      responseId: presented.responseId ?? "",
      offerId: presented.offerId,
      productName,
    });
    if (!sameHash(contentHash, expected)) return ["INVALID", "EVIDENCE_MISMATCH"];
  }
  if (policy.disclosure.required) {
    const text = String(presented.payload?.disclosureText ?? "");
    if (presented.payload?.disclosureVisible !== true || !text.includes(policy.disclosure.label)) {
      return [policy.onDisclosureViolation, "DISCLOSURE_VIOLATION"];
    }
  }
  if (policy.billingMetric === "AD_VIEWABLE") {
    if (!viewable) return [policy.onMissingEvidence, "EVIDENCE_MISSING"];
    const ratio = Number(viewable.payload?.visibleRatio);
    const ms = Number(viewable.payload?.visibleMs);
    if (!(ratio >= policy.viewability.minVisibleRatio && ms >= policy.viewability.minVisibleMs)) {
      return ["INVALID", "NOT_VIEWABLE"];
    }
  }
  return ["VALID", "ALL_CONDITIONS_MET"];
}

/** 매체 보고서 검증: 증빙 무결성(⑥) → 정책 판정(①~⑤) → 보고 실적과의 차이 설명 */
export function runVerification(input: VerificationInput): VerificationResult {
  const { campaign, report } = input;
  const events = [...input.events].sort(byEventId);

  // 증빙 무결성: 현재 DB 원본으로 증빙 해시를 다시 계산해 블록체인 기록과 대조
  const currentManifest = buildManifest(events);
  const bundleBase = { campaignId: campaign.campaignId, periodStart: report.periodStart, periodEnd: report.periodEnd };
  const computedHash = computeEvidenceHash({ ...bundleBase, events: currentManifest });
  const storedManifestHash = computeEvidenceHash({ ...bundleBase, events: report.manifest });
  const anchor = report.onChainEvidenceHash ? "ONCHAIN" : "DATABASE";
  const anchoredHash = report.onChainEvidenceHash ?? report.evidenceHash;

  const submitted = new Map(report.manifest.map((m) => [m.eventId, m.hash.toLowerCase()]));
  const current = new Map(currentManifest.map((m) => [m.eventId, m.hash.toLowerCase()]));
  const addedEventIds = currentManifest.filter((m) => !submitted.has(m.eventId)).map((m) => m.eventId);
  const missingEventIds = report.manifest.filter((m) => !current.has(m.eventId)).map((m) => m.eventId).sort();
  const modifiedEventIds = currentManifest
    .filter((m) => submitted.has(m.eventId) && submitted.get(m.eventId) !== m.hash.toLowerCase())
    .map((m) => m.eventId);

  const evidenceIntact = sameHash(computedHash, anchoredHash) && sameHash(storedManifestHash, anchoredHash);
  const termsIntact = campaign.anchoredTermsHash === null || sameHash(campaign.termsHash, campaign.anchoredTermsHash);

  // 변조된 이벤트는 집계에서 제외하고, 제출 당시 그대로인 이벤트만 판정
  const added = new Set(addedEventIds);
  const tampered = new Set([...addedEventIds, ...modifiedEventIds]);
  const preExcluded: EventExclusion[] = events
    .filter((e) => tampered.has(e.eventId))
    .map((e) => ({
      eventId: e.eventId,
      eventType: e.eventType,
      verdict: "INVALID",
      reason: added.has(e.eventId) ? "TAMPERED_ADDED" : "TAMPERED_MODIFIED",
      detail: "현재 원본 해시가 제출된 증빙과 다름",
    }));
  const analysis = analyzeEvents(campaign, events.filter((e) => !tampered.has(e.eventId)), preExcluded);

  const byReason: Partial<Record<ReasonCode, number>> = {};
  for (const u of analysis.units) {
    if (u.verdict !== "VALID") byReason[u.reason] = (byReason[u.reason] ?? 0) + 1;
  }
  const evidenced = analysis.units.length;

  return {
    spec: VERIFICATION_SPEC_VERSION,
    engine: ENGINE_VERSION,
    reportId: report.reportId,
    campaignId: campaign.campaignId,
    policy: {
      policyId: campaign.policy.policyId,
      version: campaign.policy.version,
      policyHash: policyHash(campaign.policy),
      billingMetric: campaign.policy.billingMetric,
    },
    period: { start: report.periodStart, end: report.periodEnd },
    reportedCount: report.reportedCount,
    verifiedCount: analysis.billableCount,
    gap: {
      total: report.reportedCount - analysis.billableCount,
      byReason,
      unsupportedByEvidence: Math.max(0, report.reportedCount - evidenced),
      underReported: Math.max(0, evidenced - report.reportedCount),
    },
    integrity: {
      intact: evidenceIntact && termsIntact,
      anchor,
      evidence: {
        intact: evidenceIntact,
        anchoredHash,
        computedHash,
        storedManifestHash,
        addedEventIds,
        modifiedEventIds,
        missingEventIds,
      },
      terms: { intact: termsIntact, computedHash: campaign.termsHash, anchoredHash: campaign.anchoredTermsHash },
    },
    ...analysis,
  };
}

/** 검증 결과 해시 - 검증기관이 블록체인에 제출하고, 누구나 재계산으로 재현할 수 있다 */
export function computeVerificationHash(result: VerificationResult): Hex {
  return hashCanonical(result);
}
