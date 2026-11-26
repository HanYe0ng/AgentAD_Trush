import { ApiError } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { nextId } from "@/lib/ids";
import { getCampaignOrThrow, rebuildTerms, type CampaignWithOffers } from "@/lib/campaigns/service";
import { getPolicy } from "@/lib/policy/policies";
import { toEventRecord } from "@/lib/events/recorder";
import { getReportOrThrow, loadWindowEvents, parseManifest } from "@/lib/reports/service";
import { readOnChainCampaign, readOnChainReport, type OnChainReport } from "@/lib/blockchain/server";
import {
  computeVerificationHash,
  runVerification,
  type EngineCampaign,
  type VerificationResult,
} from "@/lib/verification/engine";

export interface VerificationRun {
  result: VerificationResult;
  verificationHash: string;
  onChain: OnChainReport | null;
  chainWarning: string | null;
}

/** DB 캠페인 → 정책 엔진 입력 (계약 정책은 계약에 등록된 버전을 그대로 사용) */
export function engineCampaign(campaign: CampaignWithOffers, anchoredTermsHash: string | null): EngineCampaign {
  return {
    campaignId: campaign.id,
    startAt: campaign.startAt.toISOString(),
    endAt: campaign.endAt.toISOString(),
    activatedAt: campaign.activatedAt?.toISOString() ?? null,
    offers: campaign.offers.map((o) => ({ offerId: o.id, productName: o.productName })),
    policy: getPolicy(campaign.policyId),
    termsHash: rebuildTerms(campaign).hash,
    anchoredTermsHash,
  };
}

/** DB 원본 + 온체인 앵커(증빙·계약 조건 해시)를 모아 정책 엔진을 실행한다 */
export async function computeVerification(reportId: string): Promise<VerificationRun> {
  const report = await getReportOrThrow(reportId);
  const campaign = await getCampaignOrThrow(report.campaignId);

  let onChain: OnChainReport | null = null;
  let anchoredTermsHash: string | null = null;
  let chainWarning: string | null = null;
  try {
    onChain = await readOnChainReport(report.id);
    anchoredTermsHash = (await readOnChainCampaign(campaign.id))?.termsHash ?? null;
    if (!onChain) chainWarning = "블록체인에 제출되지 않은 보고서입니다. DB에 저장된 해시와만 대조했습니다.";
  } catch {
    chainWarning = "블록체인에 연결할 수 없어 DB에 저장된 해시와만 대조했습니다.";
  }

  const rows = await loadWindowEvents(campaign.id, report.periodStart, report.periodEnd);
  const result = runVerification({
    campaign: engineCampaign(campaign, anchoredTermsHash),
    report: {
      reportId: report.id,
      reportedCount: report.reportedCount,
      periodStart: report.periodStart.toISOString(),
      periodEnd: report.periodEnd.toISOString(),
      manifest: parseManifest(report),
      evidenceHash: report.evidenceHash,
      onChainEvidenceHash: onChain?.evidenceHash ?? null,
    },
    events: rows.map(toEventRecord),
  });

  return { result, verificationHash: computeVerificationHash(result), onChain, chainWarning };
}

/** 검증기관의 검증 실행: 결과를 저장하고, 검증자 지갑이 온체인에 제출할 값을 돌려준다 */
export async function verifyReport(reportId: string) {
  const report = await getReportOrThrow(reportId);
  if (report.status !== "SUBMITTED") {
    throw new ApiError(409, "매체가 블록체인에 제출한 보고서(검증 대기)만 검증할 수 있습니다.");
  }
  const run = await computeVerification(reportId);
  if (!run.onChain || run.onChain.status !== "Submitted") {
    throw new ApiError(409, "블록체인에서 검증 대기 상태의 보고서를 확인할 수 없습니다.");
  }
  const verification = await prisma.verification.create({
    data: {
      id: await nextId("VER", 4),
      reportId,
      verifiedCount: run.result.verifiedCount,
      heldCount: run.result.heldCount,
      evidenceIntact: run.result.integrity.intact,
      resultJson: JSON.stringify(run.result),
      verificationHash: run.verificationHash,
    },
  });
  return { ...run, verification };
}

/** 재현 확인: 누구나 같은 데이터·같은 정책으로 다시 계산해 온체인 검증 결과 해시와 일치하는지 확인 */
export async function reproduceVerification(reportId: string) {
  const run = await computeVerification(reportId);
  const anchored = run.onChain?.verificationHash;
  const hasAnchor = !!anchored && !/^0x0+$/.test(anchored);
  return {
    ...run,
    anchoredVerificationHash: hasAnchor ? anchored : null,
    matchesOnChain: hasAnchor ? anchored!.toLowerCase() === run.verificationHash.toLowerCase() : null,
  };
}
