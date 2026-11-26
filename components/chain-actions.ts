"use client";

import type { Address, Hex } from "viem";
import { api } from "@/lib/client/api";
import { sendRegistryTx, type TxSigner } from "@/lib/blockchain/client";
import { disputeReasonHash, toBytes32Id, type ChainConfig } from "@/lib/blockchain/shared";
import type { CampaignView, ReportView } from "@/lib/views";

/** 광고주: 집계 정책 버전·정책 해시·계약 조건 해시를 블록체인에 제안 */
export async function proposeCampaignOnChain(config: ChainConfig, signer: TxSigner, c: CampaignView) {
  const txHash = await sendRegistryTx(config, signer, {
    functionName: "registerCampaign",
    args: [
      toBytes32Id(c.id),
      toBytes32Id(c.policyId),
      c.policyHash as Hex,
      c.termsHash as Hex,
      c.publisherAddress as Address,
      c.verifierAddress as Address,
      BigInt(Math.floor(Date.parse(c.startAt) / 1000)),
      BigInt(Math.floor(Date.parse(c.endAt) / 1000)),
    ],
  });
  await api(`/api/campaigns/${c.id}/chain`, { body: { action: "propose", txHash } });
  return txHash;
}

/** 광고 매체: 같은 계약 조건 해시로 수락 → 계약 기준 확정 */
export async function acceptCampaignOnChain(config: ChainConfig, signer: TxSigner, c: CampaignView) {
  const txHash = await sendRegistryTx(config, signer, {
    functionName: "acceptCampaign",
    args: [toBytes32Id(c.id), c.termsHash as Hex],
  });
  await api(`/api/campaigns/${c.id}/chain`, { body: { action: "accept", txHash } });
  return txHash;
}

/** 광고 매체: 보고 실적·증빙 해시 제출 → 서버가 영수증 확인 후 상태 반영 */
export async function submitReportOnChain(config: ChainConfig, signer: TxSigner, report: ReportView) {
  const txHash = await sendRegistryTx(config, signer, {
    functionName: "submitReport",
    args: [toBytes32Id(report.id), toBytes32Id(report.campaignId), BigInt(report.reportedCount), report.evidenceHash as Hex],
  });
  await api(`/api/reports/${report.id}/chain`, { body: { action: "submit", txHash } });
  return txHash;
}

/** 검증기관: 최신 정책 엔진 판정 결과 등록 (VALID·INCONCLUSIVE 건수, 무결성 실패 시 반려) */
export async function verifyReportOnChain(config: ChainConfig, signer: TxSigner, report: ReportView) {
  const v = report.latestVerification;
  if (!v) throw new Error("먼저 검증을 실행하세요.");
  const txHash = await sendRegistryTx(config, signer, {
    functionName: "verifyReport",
    args: [toBytes32Id(report.id), BigInt(v.verifiedCount), BigInt(v.heldCount), v.verificationHash as Hex, v.evidenceIntact],
  });
  await api(`/api/reports/${report.id}/chain`, { body: { action: "verify", txHash } });
  return txHash;
}

/** 광고주: 검증 실적(VALID) 최종 확정 */
export async function approveReportOnChain(config: ChainConfig, signer: TxSigner, report: ReportView) {
  const txHash = await sendRegistryTx(config, signer, {
    functionName: "approveReport",
    args: [toBytes32Id(report.id)],
  });
  await api(`/api/reports/${report.id}/chain`, { body: { action: "approve", txHash } });
  return txHash;
}

/** 광고주: 검증 결과에 이의 제기 (사유 원문은 DB, 사유 해시는 체인) */
export async function disputeReportOnChain(config: ChainConfig, signer: TxSigner, report: ReportView, reason: string) {
  const txHash = await sendRegistryTx(config, signer, {
    functionName: "disputeReport",
    args: [toBytes32Id(report.id), disputeReasonHash(report.id, reason)],
  });
  await api(`/api/reports/${report.id}/chain`, { body: { action: "dispute", txHash, reason } });
  return txHash;
}
