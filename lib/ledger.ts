/**
 * 블록체인 기록 화면용: 캠페인과 관련된 온체인 트랜잭션을 시간순으로 모은다.
 * DB에 저장된 트랜잭션 해시로 영수증·블록을 직접 조회해 블록 번호와 시각을 붙인다.
 */
import type { Hex } from "viem";
import { prisma } from "@/lib/db";
import { getCampaignOrThrow } from "@/lib/campaigns/service";
import { publicClient } from "@/lib/blockchain/server";
import type { Role } from "@/lib/blockchain/shared";

export interface LedgerEntry {
  key: string;
  action: string; // 컨트랙트 함수
  title: string;
  role: Role;
  txHash: string;
  reportId: string | null;
  fields: { label: string; value: string; hash?: boolean }[];
  blockNumber: number | null;
  timestamp: string | null;
  status: "success" | "reverted" | "unknown";
}

export async function getCampaignLedger(campaignId: string) {
  const campaign = await getCampaignOrThrow(campaignId);
  const reports = await prisma.report.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
    include: { verifications: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const entries: Omit<LedgerEntry, "blockNumber" | "timestamp" | "status">[] = [];
  if (campaign.proposeTxHash) {
    entries.push({
      key: "propose",
      action: "registerCampaign",
      title: "계약 제안",
      role: "advertiser",
      txHash: campaign.proposeTxHash,
      reportId: null,
      fields: [
        { label: "정책 버전", value: campaign.policyId },
        { label: "계약 조건 해시", value: campaign.termsHash, hash: true },
      ],
    });
  }
  if (campaign.acceptTxHash) {
    entries.push({
      key: "accept",
      action: "acceptCampaign",
      title: "계약 수락 → 확정",
      role: "publisher",
      txHash: campaign.acceptTxHash,
      reportId: null,
      fields: [{ label: "합의한 조건 해시", value: campaign.termsHash, hash: true }],
    });
  }
  for (const r of reports) {
    const v = r.verifications[0];
    if (r.submitTxHash) {
      entries.push({
        key: `${r.id}:submit`,
        action: "submitReport",
        title: `실적 보고 ${r.reportedCount}건`,
        role: "publisher",
        txHash: r.submitTxHash,
        reportId: r.id,
        fields: [
          { label: "보고서", value: r.id },
          { label: "증빙 해시", value: r.evidenceHash, hash: true },
        ],
      });
    }
    if (r.verifyTxHash) {
      const rejected = r.status === "REJECTED";
      entries.push({
        key: `${r.id}:verify`,
        action: "verifyReport",
        title: rejected ? "검증 실패 기록 (증빙 불일치)" : `검증 등록 · 인정 ${r.onChainVerified ?? "-"}건`,
        role: "verifier",
        txHash: r.verifyTxHash,
        reportId: r.id,
        fields: [
          { label: "인정 / 보류", value: `${r.onChainVerified ?? "-"} / ${r.onChainHeld ?? "-"}` },
          ...(v ? [{ label: "검증 결과 해시", value: v.verificationHash, hash: true }] : []),
        ],
      });
    }
    if (r.approveTxHash) {
      entries.push({
        key: `${r.id}:approve`,
        action: "approveReport",
        title: `최종 승인 · ${r.onChainVerified ?? "-"}건 확정`,
        role: "advertiser",
        txHash: r.approveTxHash,
        reportId: r.id,
        fields: [{ label: "보고서", value: r.id }],
      });
    }
    if (r.disputeTxHash) {
      entries.push({
        key: `${r.id}:dispute`,
        action: "disputeReport",
        title: "이의 제기",
        role: "advertiser",
        txHash: r.disputeTxHash,
        reportId: r.id,
        fields: [{ label: "사유", value: r.disputeReason ?? "-" }],
      });
    }
  }

  let chainError: string | null = null;
  const blockTimes = new Map<bigint, string>();
  const detailed: LedgerEntry[] = [];
  for (const e of entries) {
    try {
      const { client } = publicClient();
      const receipt = await client.getTransactionReceipt({ hash: e.txHash as Hex });
      if (!blockTimes.has(receipt.blockNumber)) {
        const block = await client.getBlock({ blockNumber: receipt.blockNumber });
        blockTimes.set(receipt.blockNumber, new Date(Number(block.timestamp) * 1000).toISOString());
      }
      detailed.push({
        ...e,
        blockNumber: Number(receipt.blockNumber),
        timestamp: blockTimes.get(receipt.blockNumber) ?? null,
        status: receipt.status,
      });
    } catch {
      chainError = "블록체인에서 일부 트랜잭션을 찾을 수 없습니다. (로컬 노드를 재시작했다면 이전 기록은 사라집니다)";
      detailed.push({ ...e, blockNumber: null, timestamp: null, status: "unknown" });
    }
  }
  detailed.sort((a, b) => (a.blockNumber ?? Number.MAX_SAFE_INTEGER) - (b.blockNumber ?? Number.MAX_SAFE_INTEGER));
  return { campaignId, entries: detailed, chainError };
}
