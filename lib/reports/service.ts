import type { Report } from "@prisma/client";
import type { Hex } from "viem";
import { z } from "zod";
import { ApiError } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { nextChainId } from "@/lib/ids";
import { getCampaignOrThrow } from "@/lib/campaigns/service";
import { buildManifest, computeEvidenceHash, type ManifestEntry } from "@/lib/events/spec";
import { toEventRecord } from "@/lib/events/recorder";
import { chainStatusToReportStatus, disputeReasonHash, type ReportStatus } from "@/lib/blockchain/shared";
import { confirmRegistryTx, readOnChainReport } from "@/lib/blockchain/server";

export const SubmitReportSchema = z.object({
  campaignId: z.string().min(1),
  reportedCount: z.number().int().min(0).max(1_000_000),
  reportedBasis: z.string().trim().max(120).default("매체 자체 집계 (광고 수신 기준)"),
});

const IN_PROGRESS: ReportStatus[] = ["SUBMITTED", "VERIFIED"];

/** 보고 기간 시작점: 마지막으로 확정된 보고의 종료 시점 (없으면 캠페인 생성 시점) */
export async function nextPeriodStart(campaignId: string, createdAt: Date): Promise<Date> {
  const last = await prisma.report.findFirst({
    where: { campaignId, status: "FINALIZED" },
    orderBy: { periodEnd: "desc" },
  });
  return last?.periodEnd ?? createdAt;
}

/** 보고 기간에 해당하는 현재 DB 이벤트 원본 */
export async function loadWindowEvents(campaignId: string, periodStart: Date, periodEnd: Date) {
  const rows = await prisma.adEvent.findMany({
    where: { campaignId, recordedAt: { gt: periodStart, lte: periodEnd } },
    orderBy: { id: "asc" },
  });
  return rows;
}

/**
 * 광고 매체의 집계 보고 초안 생성 (POST /api/reports/submit)
 * 보고 기간의 이벤트 목록을 고정(manifest)하고 증빙 해시를 계산한다.
 * 이후 매체 지갑이 submitReport()로 이 해시를 블록체인에 제출한다.
 */
export async function createReportDraft(raw: unknown) {
  const input = SubmitReportSchema.parse(raw);
  const campaign = await getCampaignOrThrow(input.campaignId);
  if (campaign.chainStatus !== "ACTIVE") {
    throw new ApiError(409, "광고주 제안과 매체 수락으로 블록체인에서 확정된 계약만 보고할 수 있습니다.");
  }
  const busy = await prisma.report.findFirst({
    where: { campaignId: campaign.id, status: { in: IN_PROGRESS } },
  });
  if (busy) throw new ApiError(409, `진행 중인 보고서(${busy.id})가 있습니다. 확정·이의 제기·반려 후 새로 보고하세요.`);

  // 서명하지 않고 남은 초안은 새 초안으로 교체
  await prisma.report.deleteMany({ where: { campaignId: campaign.id, status: "PENDING_CHAIN" } });

  const periodStart = await nextPeriodStart(campaign.id, campaign.createdAt);
  const rows = await prisma.adEvent.findMany({
    where: { campaignId: campaign.id, recordedAt: { gt: periodStart } },
    orderBy: { id: "asc" },
  });
  if (rows.length === 0) throw new ApiError(400, "보고할 광고 이벤트가 없습니다.");
  const periodEnd = rows.reduce((max, r) => (r.recordedAt > max ? r.recordedAt : max), rows[0].recordedAt);

  const manifest = buildManifest(rows.map(toEventRecord));
  const evidenceHash = computeEvidenceHash({
    campaignId: campaign.id,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    events: manifest,
  });

  return prisma.report.create({
    data: {
      id: await nextChainId("RPT"),
      campaignId: campaign.id,
      reportedCount: input.reportedCount,
      reportedBasis: input.reportedBasis,
      periodStart,
      periodEnd,
      manifestJson: JSON.stringify(manifest),
      evidenceHash,
    },
  });
}

export function parseManifest(report: Report): ManifestEntry[] {
  return JSON.parse(report.manifestJson) as ManifestEntry[];
}

export async function getReportOrThrow(id: string) {
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report) throw new ApiError(404, `보고서 ${id}을(를) 찾을 수 없습니다.`);
  return report;
}

export type ChainAction = "submit" | "verify" | "approve" | "dispute";

const ACTION_EVENTS = {
  submit: ["ReportSubmitted"],
  verify: ["ReportVerified", "ReportRejected"],
  approve: ["ReportFinalized"],
  dispute: ["ReportDisputed"],
} as const;

/**
 * 브라우저 지갑이 보낸 트랜잭션을 서버가 직접 확인하고, 블록체인 상태를 DB에 반영한다.
 * DB 상태는 언제나 온체인 상태를 따른다.
 */
export async function confirmReportTx(reportId: string, action: ChainAction, txHash: Hex, disputeReason?: string) {
  const report = await getReportOrThrow(reportId);
  await confirmRegistryTx(txHash, { events: [...ACTION_EVENTS[action]], idField: "reportId", id: reportId });

  const onChain = await readOnChainReport(reportId);
  if (!onChain) throw new ApiError(400, "블록체인에서 보고서를 찾을 수 없습니다.");
  if (onChain.evidenceHash.toLowerCase() !== report.evidenceHash.toLowerCase()) {
    throw new ApiError(409, "온체인 증빙 해시가 DB의 보고서와 다릅니다.");
  }
  if (action === "verify") {
    const latest = await prisma.verification.findFirst({ where: { reportId }, orderBy: { createdAt: "desc" } });
    if (!latest || latest.verificationHash.toLowerCase() !== onChain.verificationHash.toLowerCase()) {
      throw new ApiError(409, "온체인 검증 결과 해시가 서버의 최신 검증 결과와 다릅니다.");
    }
  }
  if (action === "dispute") {
    if (!disputeReason || disputeReasonHash(reportId, disputeReason).toLowerCase() !== onChain.disputeReasonHash.toLowerCase()) {
      throw new ApiError(409, "이의 제기 사유가 온체인에 기록된 사유 해시와 다릅니다.");
    }
  }

  return prisma.report.update({
    where: { id: reportId },
    data: {
      status: chainStatusToReportStatus(onChain.status) ?? report.status,
      onChainVerified: onChain.status === "Submitted" ? null : onChain.verifiedCount,
      onChainHeld: onChain.status === "Submitted" ? null : onChain.heldCount,
      ...(action === "submit" ? { submitTxHash: txHash } : {}),
      ...(action === "verify" ? { verifyTxHash: txHash } : {}),
      ...(action === "approve" ? { approveTxHash: txHash } : {}),
      ...(action === "dispute" ? { disputeTxHash: txHash, disputeReason: disputeReason!.trim() } : {}),
    },
  });
}
