/** API 응답용 직렬화 (DB 행 → 화면에서 쓰는 JSON) */
import type { Report, Verification } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCampaignOrThrow, type CampaignWithOffers } from "@/lib/campaigns/service";
import type { ContractTerms } from "@/lib/campaigns/terms";
import { findPolicy } from "@/lib/policy/policies";
import { toEventRecord, toStoredEvent } from "@/lib/events/recorder";
import { nextPeriodStart, parseManifest } from "@/lib/reports/service";
import { engineCampaign } from "@/lib/verification/service";
import { analyzeEvents, type VerificationResult } from "@/lib/verification/engine";
import type { CampaignChainStatus, ReportStatus } from "@/lib/blockchain/shared";

export function serializeCampaign(c: CampaignWithOffers) {
  const policy = findPolicy(c.policyId);
  return {
    id: c.id,
    name: c.name,
    advertiserName: c.advertiserName,
    advertiserAddress: c.advertiserAddress,
    publisherName: c.publisherName,
    publisherAddress: c.publisherAddress,
    verifierName: c.verifierName,
    verifierAddress: c.verifierAddress,
    policyId: c.policyId,
    policyHash: c.policyHash,
    policyTitle: policy?.title ?? c.policyId,
    policyEnvironment: policy?.environment ?? "PRODUCTION",
    billingMetric: policy?.billingMetric ?? "AD_PRESENTED",
    excludeTestTraffic: policy?.excludeTestTraffic ?? true,
    startAt: c.startAt.toISOString(),
    endAt: c.endAt.toISOString(),
    termsHash: c.termsHash,
    clauses: (JSON.parse(c.termsJson) as ContractTerms).clauses,
    chainStatus: c.chainStatus as CampaignChainStatus,
    chainId: c.chainId,
    proposeTxHash: c.proposeTxHash,
    acceptTxHash: c.acceptTxHash,
    activatedAt: c.activatedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    offers: c.offers.map((o) => ({
      id: o.id,
      productName: o.productName,
      brand: o.brand,
      price: o.price,
      category: o.category,
      keywords: o.keywords,
      description: o.description,
    })),
  };
}

export type CampaignView = ReturnType<typeof serializeCampaign>;

export function serializeReport(r: Report & { verifications?: Verification[] }) {
  const latest = r.verifications?.[0] ?? null;
  return {
    id: r.id,
    campaignId: r.campaignId,
    reportedCount: r.reportedCount,
    reportedBasis: r.reportedBasis,
    periodStart: r.periodStart.toISOString(),
    periodEnd: r.periodEnd.toISOString(),
    evidenceHash: r.evidenceHash,
    eventCount: parseManifest(r).length,
    status: r.status as ReportStatus,
    submitTxHash: r.submitTxHash,
    verifyTxHash: r.verifyTxHash,
    approveTxHash: r.approveTxHash,
    disputeTxHash: r.disputeTxHash,
    disputeReason: r.disputeReason,
    onChainVerified: r.onChainVerified,
    onChainHeld: r.onChainHeld,
    createdAt: r.createdAt.toISOString(),
    latestVerification: latest
      ? {
          id: latest.id,
          verifiedCount: latest.verifiedCount,
          heldCount: latest.heldCount,
          evidenceIntact: latest.evidenceIntact,
          verificationHash: latest.verificationHash,
          createdAt: latest.createdAt.toISOString(),
          result: JSON.parse(latest.resultJson) as VerificationResult,
        }
      : null,
  };
}

export type ReportView = ReturnType<typeof serializeReport>;

/** 검증 대시보드용 캠페인 상세: 정책 판정 실시간 집계 + 이벤트 로그 + 보고서 */
export async function getCampaignDetail(id: string) {
  const campaign = await getCampaignOrThrow(id);
  const rows = await prisma.adEvent.findMany({ where: { campaignId: id }, orderBy: { id: "asc" } });
  const ec = engineCampaign(campaign, null);
  const genuine = rows.filter((r) => !r.testInjected);
  const all = analyzeEvents(ec, genuine.map(toEventRecord));

  const periodStart = await nextPeriodStart(campaign.id, campaign.createdAt);
  const unreportedRows = genuine.filter((r) => r.recordedAt > periodStart);
  const unreported = analyzeEvents(ec, unreportedRows.map(toEventRecord));

  const reports = await prisma.report.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    include: { verifications: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const rawEventCounts: Record<string, number> = {};
  for (const r of genuine) rawEventCounts[r.eventType] = (rawEventCounts[r.eventType] ?? 0) + 1;

  // 판정 화면에서 "어떤 질문에서 나온 광고인지" 보여주기 위한 실행 정보
  const runIds = [...new Set(rows.map((r) => r.runId))];
  const runRows = await prisma.aiRun.findMany({ where: { id: { in: runIds } } });
  const runs: Record<string, { query: string; dataMode: string; scenario: string }> = {};
  for (const r of runRows) runs[r.id] = { query: r.query, dataMode: r.dataMode, scenario: r.scenario };

  return {
    campaign: serializeCampaign(campaign),
    funnel: {
      stageCounts: all.stageCounts,
      stageCountsByMode: all.stageCountsByMode,
      verdictCounts: all.verdictCounts,
      billableCount: all.billableCount,
      heldCount: all.heldCount,
      rawEventCounts,
    },
    unreported: {
      periodStart: periodStart.toISOString(),
      eventCount: unreportedRows.length,
      stageCounts: unreported.stageCounts,
    },
    events: rows.slice(-300).reverse().map(toStoredEvent),
    runs,
    injectedCount: rows.length - genuine.length,
    reports: reports.map(serializeReport),
  };
}

export type CampaignDetail = Awaited<ReturnType<typeof getCampaignDetail>>;
