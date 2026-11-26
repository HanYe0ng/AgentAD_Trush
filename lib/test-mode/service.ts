/**
 * 시연용 테스트 모드. 여기서 만드는 데이터는 모두 dataMode=TEST 로 기록되어 실제 동작(LIVE) 데이터와 구분된다.
 * 실제 계약 정책(AGENTAD-PRESENTED-V1)은 테스트 트래픽을 실적에서 제외하고,
 * 시연용 샌드박스 정책(AGENTAD-PRESENTED-V1-SANDBOX)은 같은 인정 조건으로 판정한다.
 */
import { ApiError } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { nextId } from "@/lib/ids";
import { getCampaignOrThrow } from "@/lib/campaigns/service";
import { getPolicy } from "@/lib/policy/policies";
import { recordEvent } from "@/lib/events/recorder";
import { computePresentationHash } from "@/lib/events/spec";
import { getReportOrThrow, loadWindowEvents } from "@/lib/reports/service";

function presentedPayload(responseId: string, offerId: string, productName: string, label: string, at: number) {
  return {
    contentHash: computePresentationHash({ responseId, offerId, productName }),
    disclosureText: `${label} · 스폰서`,
    disclosureVisible: true,
    viewport: { width: 1280, height: 800 },
    clientRenderedAt: new Date(at).toISOString(),
    userAgent: "agentad-test-fixture",
  };
}

/**
 * 정책 문서의 검증 예시를 재현한다: 수신 5 · 유료 추천 3 · 표시 확인 2
 *  - 2건: AI가 광고를 받았지만 추천하지 않음                    → 미추천
 *  - 1건: 추천했지만 소비자 화면이 표시하지 않았다고 보고         → 추천 후 미표시
 *  - 2건: 정상 표시 (그중 1건은 표시 기록이 재전송됨 → 중복 1건 제외)
 */
export async function createFixtureScenario(campaignId: string) {
  const campaign = await getCampaignOrThrow(campaignId);
  if (campaign.chainStatus !== "ACTIVE") {
    throw new ApiError(409, "블록체인에서 확정된(매체 수락) 계약에서만 시나리오를 만들 수 있습니다.");
  }
  const policy = getPolicy(campaign.policyId);
  const offer = campaign.offers[0];
  const plan = ["RECEIVED_ONLY", "RECEIVED_ONLY", "NOT_PRESENTED", "PRESENTED", "PRESENTED_DUP"] as const;

  // 계약 활성 이후 시각으로 기록 (인정 조건 ①)
  const activeFrom = (campaign.activatedAt?.getTime() ?? campaign.startAt.getTime()) + 1000;
  const base = Math.max(Date.now() - plan.length * 1500 - 1000, activeFrom);
  const runs: string[] = [];
  for (const [i, kind] of plan.entries()) {
    const runId = await nextId("RUN", 4);
    const responseId = await nextId("RES", 4);
    const t0 = base + i * 1500;
    const recommended = kind !== "RECEIVED_ONLY";
    await prisma.aiRun.create({
      data: {
        id: runId,
        query: `예시 대화 ${i + 1} · ${offer.category} 추천해 줘`,
        dataMode: "TEST",
        scenario: "TEST_FIXTURE",
        provider: "fixture",
        answer: recommended ? `${offer.productName}을(를) 추천합니다.` : "스폰서 상품을 제외하고 추천했습니다.",
        responseId,
        itemsJson: "[]",
        receivedOfferIds: offer.id,
      },
    });
    runs.push(runId);
    const common = { campaignId, offerId: offer.id, runId, dataMode: "TEST" as const };

    await recordEvent({ ...common, responseId: null, source: "TEST_FIXTURE", eventType: "AD_RECEIVED", timestamp: new Date(t0), payload: { fixture: kind } });
    if (!recommended) continue;
    await recordEvent({
      ...common,
      responseId,
      source: "TEST_FIXTURE",
      eventType: "AD_RECOMMENDED",
      timestamp: new Date(t0 + 300),
      payload: { linkedOfferId: offer.id, rank: 1 },
    });
    if (kind === "NOT_PRESENTED") {
      await recordEvent({
        ...common,
        responseId,
        source: "TEST_FIXTURE",
        eventType: "AD_NOT_PRESENTED",
        timestamp: new Date(t0 + 700),
        payload: { reason: "CLIENT_SUPPRESSED", clientRenderedAt: new Date(t0 + 600).toISOString() },
      });
      continue;
    }
    const payload = presentedPayload(responseId, offer.id, offer.productName, policy.disclosure.label, t0 + 600);
    await recordEvent({ ...common, responseId, source: "TEST_FIXTURE", eventType: "AD_PRESENTED", timestamp: new Date(t0 + 700), payload });
    if (kind === "PRESENTED_DUP") {
      await recordEvent({
        ...common,
        responseId,
        source: "TEST_FIXTURE",
        eventType: "AD_PRESENTED",
        timestamp: new Date(t0 + 1000),
        payload: { ...payload, note: "새로고침으로 같은 표시 기록 재전송" },
      });
    }
  }
  return { campaignId, offerId: offer.id, runs };
}

/**
 * 증빙 변조 시뮬레이션: 매체가 블록체인에 보고를 제출한 뒤, DB에 접근할 수 있는 누군가가
 * ‘추천 후 미표시’ 또는 ‘미추천’ 건에 가짜 표시 기록(화면 증빙 해시까지 계산해 넣음)을 과거 시각으로 끼워 넣는다.
 * 이벤트 해시는 공격자가 다시 계산할 수 있지만, 블록체인에 제출된 증빙 해시와는 맞출 수 없다.
 */
export async function injectTamper(reportId: string) {
  const report = await getReportOrThrow(reportId);
  if (report.status !== "SUBMITTED") {
    throw new ApiError(409, "블록체인에 제출되어 검증을 기다리는 보고서에서만 변조를 시뮬레이션할 수 있습니다.");
  }
  const campaign = await getCampaignOrThrow(report.campaignId);
  const policy = getPolicy(campaign.policyId);
  const rows = await loadWindowEvents(report.campaignId, report.periodStart, report.periodEnd);

  const presentedKeys = new Set(rows.filter((r) => r.eventType === "AD_PRESENTED").map((r) => `${r.responseId}|${r.offerId}`));
  const target = rows.find((r) => r.eventType === "AD_RECOMMENDED" && !presentedKeys.has(`${r.responseId}|${r.offerId}`));
  const receivedOnly = rows.find(
    (r) => r.eventType === "AD_RECEIVED" && !rows.some((x) => x.eventType === "AD_RECOMMENDED" && x.runId === r.runId && x.offerId === r.offerId),
  );
  const anchor = target ?? receivedOnly;
  if (!anchor) throw new ApiError(400, "부풀릴 수 있는 미표시 건이 없습니다. (모든 광고가 이미 표시됨)");

  const offer = campaign.offers.find((o) => o.id === anchor.offerId)!;
  const backdate = new Date(Math.min(anchor.recordedAt.getTime() + 1, report.periodEnd.getTime()));
  const common = { campaignId: anchor.campaignId, offerId: anchor.offerId, runId: anchor.runId, dataMode: anchor.dataMode as "LIVE" | "TEST" };
  let responseId = anchor.responseId;
  const forged = [];

  if (!target) {
    const run = await prisma.aiRun.findUnique({ where: { id: anchor.runId } });
    responseId = run?.responseId ?? `RES-FAKE-${anchor.runId}`;
    forged.push(
      await recordEvent(
        {
          ...common,
          responseId,
          eventType: "AD_RECOMMENDED",
          source: "AI_BACKEND",
          timestamp: new Date(anchor.timestamp.getTime() + 300),
          payload: { linkedOfferId: anchor.offerId, rank: 1 },
        },
        { recordedAt: backdate, testInjected: true },
      ),
    );
  }
  forged.push(
    await recordEvent(
      {
        ...common,
        responseId,
        eventType: "AD_PRESENTED",
        source: "CONSUMER_FRONTEND",
        timestamp: new Date(anchor.timestamp.getTime() + 900),
        payload: { ...presentedPayload(responseId!, offer.id, offer.productName, policy.disclosure.label, anchor.timestamp.getTime()), userAgent: "Mozilla/5.0" },
      },
      { recordedAt: backdate, testInjected: true },
    ),
  );
  return { reportId, forged };
}

/** 변조 시뮬레이션으로 삽입한 이벤트 정리 (반려 후 정상 데이터로 재보고할 때) */
export async function cleanupTamper(campaignId: string) {
  const { count } = await prisma.adEvent.deleteMany({ where: { campaignId, testInjected: true } });
  return { campaignId, removed: count };
}
