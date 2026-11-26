/**
 * 광고 집계 계약 정책 (데이터로 관리)
 *
 * 집계 규칙을 코드에 고정하지 않고 policies/*.json 으로 관리한다. 검증 엔진은 이 데이터를 읽어
 * 같은 이벤트 기록을 같은 방식으로 판정하고, 캠페인 계약에는 정책 ID와 정책 해시가 포함되어
 * 블록체인에 등록된다. 정책 내용이 한 글자라도 바뀌면 해시가 바뀌므로, 기준 변경은 새 버전으로만 가능하다.
 *
 * ※ 기존 IAB/MRC 원칙을 참고한 AgentAd Trust 자체 계약 규칙이며 업계 인증 표준이 아니다.
 */
import type { Hex } from "viem";
import { hashCanonical } from "@/lib/core/canonical";
import presentedV1 from "@/policies/AGENTAD-PRESENTED-V1.json";
import presentedV1Sandbox from "@/policies/AGENTAD-PRESENTED-V1-SANDBOX.json";

export type MetricType = "AD_RECEIVED" | "AD_RECOMMENDED" | "AD_PRESENTED" | "AD_VIEWABLE";
export type DedupField = "campaignId" | "offerId" | "responseId";

export interface AggregationPolicy {
  policyId: string;
  version: string;
  title: string;
  environment: "PRODUCTION" | "SANDBOX";
  billingMetric: "AD_PRESENTED" | "AD_VIEWABLE";
  requires: MetricType[];
  requireSponsoredOffer: boolean;
  requireEvidence: boolean;
  deduplicationKey: DedupField[];
  excludeTestTraffic: boolean;
  onMissingEvidence: "INCONCLUSIVE" | "INVALID";
  onDuplicate: "EXCLUDE";
  onDisclosureViolation: "INCONCLUSIVE" | "INVALID";
  auditApprovalRequired: boolean;
  disclosure: { required: boolean; label: string };
  supplementaryMetrics: MetricType[];
  viewability: { minVisibleRatio: number; minVisibleMs: number };
  notice: string;
}

export const POLICIES: readonly AggregationPolicy[] = [
  presentedV1 as AggregationPolicy,
  presentedV1Sandbox as AggregationPolicy,
];

export const DEFAULT_POLICY_ID = "AGENTAD-PRESENTED-V1";
/** 시연 서비스가 계약에 사용하는 정책: 같은 인정 조건을 시연·테스트 데이터에도 적용 (정산 대상 아님) */
export const DEMO_POLICY_ID = "AGENTAD-PRESENTED-V1-SANDBOX";

export function findPolicy(policyId: string): AggregationPolicy | null {
  return POLICIES.find((p) => p.policyId === policyId) ?? null;
}

export function getPolicy(policyId: string): AggregationPolicy {
  const policy = findPolicy(policyId);
  if (!policy) throw new Error(`알 수 없는 집계 정책: ${policyId}`);
  return policy;
}

/** 정책 해시 = keccak256(canonical JSON(정책 전체)) */
export function policyHash(policy: AggregationPolicy): Hex {
  return hashCanonical(policy);
}

export const METRIC_LABEL: Record<MetricType, string> = {
  AD_RECEIVED: "광고 수신",
  AD_RECOMMENDED: "유료 추천 생성",
  AD_PRESENTED: "소비자 화면 표시",
  AD_VIEWABLE: "가시성 충족",
};

/** 계약서에 들어가는 조항 (정책에서 결정적으로 만들어지며 계약 조건 해시에 포함된다) */
export function contractClauses(policy: AggregationPolicy) {
  return {
    billingMetric: `${policy.billingMetric} (${METRIC_LABEL[policy.billingMetric]})`,
    target: policy.requireSponsoredOffer ? "등록된 유료 스폰서 제안(offerId)과 연결된 추천" : "모든 추천",
    deduplication: `${policy.deduplicationKey.join(" + ")} 당 1건`,
    evidence: "수신 로그 · 추천 로그 · 화면 표시 기록(화면 증빙 해시)",
    onMissingEvidence: policy.onMissingEvidence === "INCONCLUSIVE" ? "검증 불가 → 정산 보류" : "실적 제외",
    testTraffic: policy.excludeTestTraffic ? "자동 테스트 실행은 실적에서 제외" : "테스트 트래픽도 같은 규칙으로 판정 (시연용, 정산 대상 아님)",
    disclosure: policy.disclosure.required
      ? `‘${policy.disclosure.label}’ 표기 필수, 위반 시 준수 위반 기록 및 정산 보류`
      : "공개 표기 검사 없음",
    ruleChange: "집행 전에 새 정책 버전으로 합의 (등록 후 변경 불가)",
    finalApproval: policy.auditApprovalRequired ? "독립 검증기관 확인 후 광고주 승인" : "광고주 승인",
    payment: "MVP 제외 — 확정 실적만 기록",
  };
}

export type ContractClauses = ReturnType<typeof contractClauses>;

export const CLAUSE_LABEL: Record<keyof ContractClauses, string> = {
  billingMetric: "집계 기준",
  target: "집계 대상",
  deduplication: "중복 처리",
  evidence: "증빙",
  onMissingEvidence: "검증 불가",
  testTraffic: "테스트 트래픽",
  disclosure: "광고 관계 공개",
  ruleChange: "집계 기준 변경",
  finalApproval: "최종 승인",
  payment: "실제 결제",
};
