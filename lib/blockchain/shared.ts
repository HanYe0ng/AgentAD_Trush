/** 브라우저·서버 공용 블록체인 상수와 변환 함수 */
import { stringToHex, type Address, type Hex } from "viem";
import { hashCanonical } from "@/lib/core/canonical";

export const HARDHAT_CHAIN_ID = 31337;
export const SEPOLIA_CHAIN_ID = 11155111;

/** 사람이 읽을 수 있는 ID(CAM-001-7F3A, AGENTAD-PRESENTED-V1)를 bytes32로 변환 - Etherscan에서 디코딩 가능 */
export function toBytes32Id(id: string): Hex {
  if (id.length > 31) throw new Error(`ID too long for bytes32: ${id}`);
  return stringToHex(id, { size: 32 });
}

/** 이의 제기 사유 해시 (사유 원문은 DB, 해시만 체인) */
export function disputeReasonHash(reportId: string, reason: string): Hex {
  return hashCanonical({ spec: "agentad-trust/dispute@1", reportId, reason: reason.trim() });
}

export const CHAIN_CAMPAIGN_STATUS = ["None", "Proposed", "Active"] as const;
export type ChainCampaignStatus = (typeof CHAIN_CAMPAIGN_STATUS)[number];

export const CHAIN_REPORT_STATUS = ["None", "Submitted", "Verified", "Rejected", "Disputed", "Finalized"] as const;
export type ChainReportStatus = (typeof CHAIN_REPORT_STATUS)[number];

export type CampaignChainStatus = "DRAFT" | "PROPOSED" | "ACTIVE";
export type ReportStatus = "PENDING_CHAIN" | "SUBMITTED" | "VERIFIED" | "REJECTED" | "DISPUTED" | "FINALIZED";

export const CAMPAIGN_STATUS_LABEL: Record<CampaignChainStatus, string> = {
  DRAFT: "블록체인 미등록",
  PROPOSED: "광고주 제안 · 매체 수락 대기",
  ACTIVE: "계약 확정 (집행 가능)",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  PENDING_CHAIN: "온체인 제출 대기",
  SUBMITTED: "매체 제출 완료 · 검증 대기",
  VERIFIED: "독립 검증 완료 · 광고주 확인 대기",
  REJECTED: "검증 실패 (증빙 불일치) · 정산 보류",
  DISPUTED: "광고주 이의 제기",
  FINALIZED: "광고주 최종 확정",
};

export function chainStatusToReportStatus(status: ChainReportStatus): ReportStatus | null {
  const map: Partial<Record<ChainReportStatus, ReportStatus>> = {
    Submitted: "SUBMITTED",
    Verified: "VERIFIED",
    Rejected: "REJECTED",
    Disputed: "DISPUTED",
    Finalized: "FINALIZED",
  };
  return map[status] ?? null;
}

export type Role = "advertiser" | "publisher" | "verifier";
export type SignerRole = Role | "outsider";

export const ROLE_LABEL: Record<SignerRole, string> = {
  advertiser: "광고주",
  publisher: "광고 매체",
  verifier: "검증기관",
  outsider: "권한 없는 지갑",
};

/** /api/chain/config 응답 */
export interface ChainConfig {
  network: string;
  chainId: number | null;
  registryAddress: Address | null;
  roles: Record<Role, Address> | null;
  browserRpcUrl: string;
  explorerUrl: string | null;
  deployed: boolean;
  reachable: boolean;
  devSignerAvailable: boolean;
  message: string | null;
}

export function explorerTxUrl(config: Pick<ChainConfig, "explorerUrl">, hash: string | null | undefined) {
  return config.explorerUrl && hash ? `${config.explorerUrl}/tx/${hash}` : null;
}

export function explorerAddressUrl(config: Pick<ChainConfig, "explorerUrl">, address: string | null | undefined) {
  return config.explorerUrl && address ? `${config.explorerUrl}/address/${address}` : null;
}

/** 컨트랙트 커스텀 오류 → 사용자 설명 */
export const CHAIN_ERROR_LABEL: Record<string, string> = {
  AccessControlUnauthorizedAccount: "이 지갑에는 해당 작업의 역할 권한이 없습니다.",
  NotCampaignParticipant: "이 캠페인에 지정된 참여자 지갑이 아닙니다.",
  InvalidStatus: "현재 보고서 상태에서는 이 작업을 할 수 없습니다.",
  InvalidCampaignStatus: "현재 계약 상태에서는 이 작업을 할 수 없습니다. (매체 수락 전이거나 이미 확정됨)",
  TermsMismatch: "광고주가 제안한 계약 조건 해시와 다릅니다. (합의 내용 불일치)",
  ReportAlreadyExists: "이미 제출된 보고서입니다. (중복 제출 거부)",
  EvidenceAlreadyUsed: "같은 증빙이 이미 다른 보고서에 사용되었습니다. (이중 청구 거부)",
  CampaignAlreadyRegistered: "이미 등록된 캠페인입니다. 집계 기준은 변경할 수 없습니다.",
  PartiesNotIndependent: "광고주·매체·검증기관은 서로 다른 지갑이어야 합니다.",
  InvalidParticipant: "지정한 매체/검증기관 지갑에 역할 권한이 없습니다.",
  CampaignNotFound: "블록체인에 등록되지 않은 캠페인입니다.",
  ReportNotFound: "블록체인에 없는 보고서입니다.",
  InvalidPeriod: "캠페인 기간이 올바르지 않습니다.",
  InvalidInput: "입력값이 올바르지 않습니다.",
};
