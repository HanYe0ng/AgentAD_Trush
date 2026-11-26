/**
 * 홈 대시보드용: 모든 광고 계약의 현황 · 핵심 지표 · 최근 블록체인 기록을 한 번에 모은다.
 */
import { prisma } from "@/lib/db";
import { getCampaignDetail, type ReportView } from "@/lib/views";
import { getCampaignLedger, type LedgerEntry } from "@/lib/ledger";

export interface OverviewCampaign {
  campaign: Awaited<ReturnType<typeof getCampaignDetail>>["campaign"];
  funnel: { stageCounts: Awaited<ReturnType<typeof getCampaignDetail>>["funnel"]["stageCounts"] };
  unreported: { eventCount: number };
  /** 최신 보고서 1건 (진행 단계 계산용) */
  reports: ReportView[];
  /** 광고주가 최종 승인한 실적 합계 */
  confirmedCount: number;
  /** 최신 검증 결과의 정산 보류 건수 */
  heldCount: number;
}

export type ActivityEntry = LedgerEntry & { campaignId: string; productName: string };

export async function getOverview() {
  const rows = await prisma.campaign.findMany({ orderBy: { createdAt: "desc" }, select: { id: true } });
  const campaigns: OverviewCampaign[] = [];
  const activity: ActivityEntry[] = [];
  let chainError: string | null = null;

  for (const { id } of rows) {
    const d = await getCampaignDetail(id);
    const latest = d.reports[0] ?? null;
    const verifiedLatest = d.reports.find((r) => ["VERIFIED", "FINALIZED", "DISPUTED"].includes(r.status)) ?? null;
    campaigns.push({
      campaign: d.campaign,
      funnel: { stageCounts: d.funnel.stageCounts },
      unreported: { eventCount: d.unreported.eventCount },
      reports: latest ? [latest] : [],
      confirmedCount: d.reports.filter((r) => r.status === "FINALIZED").reduce((n, r) => n + (r.onChainVerified ?? 0), 0),
      heldCount: verifiedLatest ? (verifiedLatest.onChainHeld ?? verifiedLatest.latestVerification?.heldCount ?? 0) : 0,
    });

    const ledger = await getCampaignLedger(id);
    chainError ??= ledger.chainError;
    const productName = d.campaign.offers[0]?.productName ?? d.campaign.name;
    for (const e of ledger.entries) activity.push({ ...e, campaignId: id, productName });
  }

  activity.sort((a, b) => (b.timestamp ?? "").localeCompare(a.timestamp ?? "") || (b.blockNumber ?? 0) - (a.blockNumber ?? 0));

  const sum = (pick: (c: OverviewCampaign) => number) => campaigns.reduce((n, c) => n + pick(c), 0);
  return {
    campaigns,
    totals: {
      campaigns: campaigns.length,
      active: campaigns.filter((c) => c.campaign.chainStatus === "ACTIVE").length,
      received: sum((c) => c.funnel.stageCounts.received),
      recommended: sum((c) => c.funnel.stageCounts.recommended),
      presented: sum((c) => c.funnel.stageCounts.presented),
      confirmed: sum((c) => c.confirmedCount),
      held: sum((c) => c.heldCount),
      onChain: activity.length,
    },
    activity: activity.slice(0, 8),
    chainError,
  };
}

export type Overview = Awaited<ReturnType<typeof getOverview>>;
