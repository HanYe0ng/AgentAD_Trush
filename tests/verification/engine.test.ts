import { describe, expect, it } from "vitest";
import { getPolicy, type AggregationPolicy } from "@/lib/policy/policies";
import {
  buildManifest,
  computeEventHash,
  computeEvidenceHash,
  computePresentationHash,
  type AdEventRecord,
} from "@/lib/events/spec";
import { computeVerificationHash, runVerification, type EngineCampaign, type VerificationInput } from "@/lib/verification/engine";

const CAMPAIGN_ID = "CAM-001-TEST";
const PERIOD = { start: "2026-11-01T00:00:00.000Z", end: "2026-12-31T23:59:59.000Z" };
const TERMS_HASH = "0x" + "11".repeat(32);
const PRODUCT = "울트라런 7";
const PRODUCTION = getPolicy("AGENTAD-PRESENTED-V1");
const SANDBOX = getPolicy("AGENTAD-PRESENTED-V1-SANDBOX");

let seq = 0;
const at = (minute: number, second = 0) => new Date(Date.UTC(2026, 10, 26, 2, minute, second)).toISOString();

type Kind = "AD_RECEIVED" | "AD_RECOMMENDED" | "AD_PRESENTED" | "AD_NOT_PRESENTED" | "AD_VIEWABLE";
const SECOND: Record<Kind, number> = { AD_RECEIVED: 0, AD_RECOMMENDED: 5, AD_PRESENTED: 10, AD_NOT_PRESENTED: 10, AD_VIEWABLE: 12 };

function event(type: Kind, runId: string, minute: number, extra: Partial<AdEventRecord> = {}): AdEventRecord {
  seq += 1;
  const n = runId.replace("RUN-", "");
  const responseId = type === "AD_RECEIVED" ? null : `RES-${n}`;
  const payload: Record<string, unknown> =
    type === "AD_RECOMMENDED"
      ? { linkedOfferId: "AD-001", rank: 1 }
      : type === "AD_PRESENTED"
        ? {
            contentHash: computePresentationHash({ responseId: responseId!, offerId: "AD-001", productName: PRODUCT }),
            disclosureText: "광고 · 스폰서",
            disclosureVisible: true,
          }
        : type === "AD_NOT_PRESENTED"
          ? { reason: "CLIENT_SUPPRESSED" }
          : type === "AD_VIEWABLE"
            ? { visibleRatio: 1, visibleMs: 1200 }
            : {};
  return {
    eventId: `EVT-${String(seq).padStart(6, "0")}`,
    campaignId: CAMPAIGN_ID,
    offerId: "AD-001",
    runId,
    responseId,
    eventType: type,
    timestamp: at(minute, SECOND[type]),
    source: type === "AD_RECEIVED" || type === "AD_RECOMMENDED" ? "AI_BACKEND" : "CONSUMER_FRONTEND",
    dataMode: "LIVE",
    payload,
    ...extra,
  };
}

/** 정책 문서의 검증 예시: 수신 5 · 유료 추천 3 · 표시 확인 2 (미추천 2, 추천 후 미표시 1) */
function scenario532(mode: "LIVE" | "TEST" = "LIVE"): AdEventRecord[] {
  seq = 0;
  const m = { dataMode: mode } as const;
  return [
    event("AD_RECEIVED", "RUN-0001", 1, m),
    event("AD_RECEIVED", "RUN-0002", 2, m),
    event("AD_RECEIVED", "RUN-0003", 3, m),
    event("AD_RECOMMENDED", "RUN-0003", 3, m),
    event("AD_NOT_PRESENTED", "RUN-0003", 3, m),
    event("AD_RECEIVED", "RUN-0004", 4, m),
    event("AD_RECOMMENDED", "RUN-0004", 4, m),
    event("AD_PRESENTED", "RUN-0004", 4, m),
    event("AD_RECEIVED", "RUN-0005", 5, m),
    event("AD_RECOMMENDED", "RUN-0005", 5, m),
    event("AD_PRESENTED", "RUN-0005", 5, m),
  ];
}

function campaign(policy: AggregationPolicy = PRODUCTION, overrides: Partial<EngineCampaign> = {}): EngineCampaign {
  return {
    campaignId: CAMPAIGN_ID,
    startAt: PERIOD.start,
    endAt: PERIOD.end,
    activatedAt: PERIOD.start,
    offers: [{ offerId: "AD-001", productName: PRODUCT }],
    policy,
    termsHash: TERMS_HASH,
    anchoredTermsHash: TERMS_HASH,
    ...overrides,
  };
}

function input(events: AdEventRecord[], opts: { policy?: AggregationPolicy; reported?: number } = {}): VerificationInput {
  const manifest = buildManifest(events);
  const evidenceHash = computeEvidenceHash({ campaignId: CAMPAIGN_ID, periodStart: PERIOD.start, periodEnd: PERIOD.end, events: manifest });
  return {
    campaign: campaign(opts.policy),
    report: {
      reportId: "RPT-001-TEST",
      reportedCount: opts.reported ?? 5,
      periodStart: PERIOD.start,
      periodEnd: PERIOD.end,
      manifest,
      evidenceHash,
      onChainEvidenceHash: evidenceHash,
    },
    events,
  };
}

const reasonOf = (r: ReturnType<typeof runVerification>, runId: string) => r.units.find((u) => u.runId === runId)?.reason;

describe("AGENTAD-PRESENTED-V1: 기본 정산 지표 AD_PRESENTED", () => {
  it("매체 보고 5건 → 검증 실적 2건, 제외 3건 = 미추천 2 + 추천 후 미표시 1", () => {
    const r = runVerification(input(scenario532()));
    expect(r.stageCounts).toMatchObject({ received: 5, recommended: 3, presented: 2 });
    expect(r.verifiedCount).toBe(2);
    expect(r.verdictCounts).toEqual({ VALID: 2, INVALID: 3, INCONCLUSIVE: 0, DUPLICATE: 0 });
    expect(r.gap).toMatchObject({ total: 3, byReason: { NOT_RECOMMENDED: 2, NOT_PRESENTED: 1 }, unsupportedByEvidence: 0 });
    expect(r.integrity.intact).toBe(true);
  });

  it("‘검증 불가’와 ‘미표시 확인’을 구분한다: 표시·미표시 기록이 모두 없으면 INCONCLUSIVE(정산 보류)", () => {
    const events = scenario532().filter((e) => !(e.eventType === "AD_NOT_PRESENTED" && e.runId === "RUN-0003"));
    const r = runVerification(input(events));
    expect(reasonOf(r, "RUN-0003")).toBe("EVIDENCE_MISSING");
    expect(r.verdictCounts.INCONCLUSIVE).toBe(1);
    expect(r.heldCount).toBe(1);
    expect(r.verifiedCount).toBe(2);
  });

  it("화면 증빙 해시가 없으면 검증 불가, 다른 상품 내용이면 INVALID", () => {
    const events = scenario532();
    const p4 = events.find((e) => e.eventType === "AD_PRESENTED" && e.runId === "RUN-0004")!;
    const p5 = events.find((e) => e.eventType === "AD_PRESENTED" && e.runId === "RUN-0005")!;
    p4.payload = { ...p4.payload, contentHash: undefined };
    p5.payload = {
      ...p5.payload,
      contentHash: computePresentationHash({ responseId: "RES-0005", offerId: "AD-001", productName: "다른 상품" }),
    };
    const r = runVerification(input(events));
    expect(reasonOf(r, "RUN-0004")).toBe("EVIDENCE_MISSING");
    expect(reasonOf(r, "RUN-0005")).toBe("EVIDENCE_MISMATCH");
    expect(r.verifiedCount).toBe(0);
  });

  it("광고 관계 공개(‘광고’ 표기)가 없으면 준수 위반으로 기록하고 정산을 보류한다", () => {
    const events = scenario532();
    const p = events.find((e) => e.eventType === "AD_PRESENTED")!;
    p.payload = { ...p.payload, disclosureVisible: false };
    const r = runVerification(input(events));
    expect(r.verdictCounts.INCONCLUSIVE).toBe(1);
    expect(r.compliance.disclosureViolations).toHaveLength(1);
    expect(r.verifiedCount).toBe(1);
  });

  it("offerId가 구조적으로 연결되지 않은 추천(상품명만 일치)은 유료 광고 실적이 아니다", () => {
    const events = scenario532();
    const rec = events.find((e) => e.eventType === "AD_RECOMMENDED" && e.runId === "RUN-0004")!;
    rec.payload = { rank: 1, mentionedName: PRODUCT };
    const r = runVerification(input(events));
    expect(r.excludedEvents.find((e) => e.eventId === rec.eventId)?.reason).toBe("UNLINKED_RECOMMENDATION");
    expect(reasonOf(r, "RUN-0004")).toBe("NOT_RECOMMENDED");
    expect(r.verifiedCount).toBe(1);
  });

  it("가시성(AD_VIEWABLE)은 보조 지표로 집계되며 정산 건수에는 영향을 주지 않는다", () => {
    const events = scenario532();
    events.push(event("AD_VIEWABLE", "RUN-0004", 4));
    const r = runVerification(input(events));
    expect(r.stageCounts.viewable).toBe(1);
    expect(r.verifiedCount).toBe(2);
  });
});

describe("중복·무효 처리", () => {
  it("같은 응답·같은 광고의 표시 이벤트가 재전송되면 1건만 인정하고 DUPLICATE로 제외한다", () => {
    const events = scenario532();
    events.push(event("AD_PRESENTED", "RUN-0005", 6));
    const r = runVerification(input(events));
    expect(r.verifiedCount).toBe(2);
    expect(r.verdictCounts.DUPLICATE).toBe(1);
    expect(r.excludedEvents[0]).toMatchObject({ verdict: "DUPLICATE", reason: "DUPLICATE_EVENT" });
  });

  it("새 질문으로 받은 새 응답은 별도의 집계 대상이다", () => {
    const events = scenario532();
    events.push(event("AD_RECEIVED", "RUN-0006", 7), event("AD_RECOMMENDED", "RUN-0006", 7), event("AD_PRESENTED", "RUN-0006", 7));
    expect(runVerification(input(events, { reported: 6 })).verifiedCount).toBe(3);
  });

  it("자동 테스트 실행은 실제 광고 집행 실적에서 제외한다 (excludeTestTraffic)", () => {
    const r = runVerification(input(scenario532("TEST")));
    expect(r.verifiedCount).toBe(0);
    expect(r.gap.byReason).toEqual({ TEST_TRAFFIC: 5 });
    expect(r.stageCounts.presented).toBe(2); // 통계에는 남는다
  });

  it("시연용 샌드박스 정책은 테스트 트래픽에도 같은 인정 조건을 적용한다", () => {
    const r = runVerification(input(scenario532("TEST"), { policy: SANDBOX }));
    expect(r.verifiedCount).toBe(2);
    expect(r.gap.byReason).toEqual({ NOT_RECOMMENDED: 2, NOT_PRESENTED: 1 });
  });

  it("활성 계약 기간 밖의 기록, 등록되지 않은 제안, 연결되지 않은 기록은 제외한다", () => {
    const events = scenario532();
    events.push(event("AD_RECEIVED", "RUN-0020", 1, { timestamp: "2027-01-05T00:00:00.000Z" }));
    events.push(event("AD_RECEIVED", "RUN-0021", 1, { offerId: "AD-999" }));
    events.push(event("AD_PRESENTED", "RUN-0022", 1));
    const r = runVerification(input(events));
    expect(r.stageCounts.received).toBe(5);
    expect(r.excludedEvents.map((e) => e.reason).sort()).toEqual(["CONTRACT_INACTIVE", "NO_RECOMMENDATION", "UNKNOWN_OFFER"]);
  });

  it("이벤트 기록으로 뒷받침되지 않는 보고분을 구분한다", () => {
    const r = runVerification(input(scenario532(), { reported: 7 }));
    expect(r.gap).toMatchObject({ total: 5, unsupportedByEvidence: 2 });
  });
});

describe("증빙 무결성 (원본 증빙과 해시 불일치 → 검증 실패)", () => {
  it("제출 이후 표시 이벤트를 몰래 추가하면 해시 불일치로 탐지하고 집계에서 제외한다", () => {
    const events = scenario532();
    const base = input(events);
    const forged = event("AD_PRESENTED", "RUN-0003", 3);
    const r = runVerification({ ...base, events: [...events, forged] });
    expect(r.integrity.intact).toBe(false);
    expect(r.integrity.evidence.addedEventIds).toEqual([forged.eventId]);
    expect(r.verifiedCount).toBe(2);
    expect(r.excludedEvents.find((e) => e.eventId === forged.eventId)?.reason).toBe("TAMPERED_ADDED");
  });

  it("제출 이후 이벤트 내용을 바꾸면 수정된 이벤트로 탐지한다", () => {
    const events = scenario532();
    const base = input(events);
    const tampered = events.map((e) => (e.eventId === "EVT-000003" ? { ...e, timestamp: at(9) } : e));
    const r = runVerification({ ...base, events: tampered });
    expect(r.integrity.evidence.modifiedEventIds).toEqual(["EVT-000003"]);
    expect(r.integrity.intact).toBe(false);
  });

  it("DB의 제출 목록과 해시까지 바꿔도 블록체인에 기록된 해시와 달라 탐지된다", () => {
    const events = scenario532();
    const base = input(events);
    const forged = event("AD_PRESENTED", "RUN-0003", 3);
    const forgedManifest = buildManifest([...events, forged]);
    const forgedHash = computeEvidenceHash({ campaignId: CAMPAIGN_ID, periodStart: PERIOD.start, periodEnd: PERIOD.end, events: forgedManifest });
    const r = runVerification({
      ...base,
      events: [...events, forged],
      report: { ...base.report, manifest: forgedManifest, evidenceHash: forgedHash },
    });
    expect(r.integrity.anchor).toBe("ONCHAIN");
    expect(r.integrity.intact).toBe(false);
  });

  it("DB의 계약 조건이 블록체인에 확정된 조건과 다르면 무결성 실패", () => {
    const base = input(scenario532());
    const r = runVerification({ ...base, campaign: { ...base.campaign, termsHash: "0x" + "22".repeat(32) } });
    expect(r.integrity.terms.intact).toBe(false);
    expect(r.integrity.intact).toBe(false);
  });

  it("이벤트 해시는 내용이 한 글자만 달라도 바뀐다", () => {
    const [e] = scenario532();
    expect(computeEventHash(e)).not.toBe(computeEventHash({ ...e, offerId: "AD-002" }));
  });
});

describe("재현성", () => {
  it("입력 순서가 달라도 같은 데이터·같은 정책이면 같은 검증 결과 해시가 나온다", () => {
    const events = scenario532();
    const a = runVerification(input(events));
    const b = runVerification({ ...input(events), events: [...events].reverse() });
    expect(computeVerificationHash(a)).toBe(computeVerificationHash(b));
  });

  it("정책이 다르면 같은 데이터라도 결과 해시가 달라진다", () => {
    const events = scenario532();
    const a = runVerification(input(events, { policy: PRODUCTION }));
    const b = runVerification(input(events, { policy: SANDBOX }));
    expect(a.verifiedCount).toBe(b.verifiedCount);
    expect(computeVerificationHash(a)).not.toBe(computeVerificationHash(b));
  });
});
