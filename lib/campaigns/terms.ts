import type { Hex } from "viem";
import { canonicalize, hashCanonical } from "@/lib/core/canonical";
import { contractClauses, policyHash, type AggregationPolicy } from "@/lib/policy/policies";

export const TERMS_SPEC_VERSION = "agentad-trust/contract-terms@1";
export const ENGINE_VERSION = "agentad-policy-engine@2";

export interface ContractTermsInput {
  campaignId: string;
  name: string;
  policy: AggregationPolicy;
  advertiser: { name: string; address: string };
  publisher: { name: string; address: string };
  verifier: { name: string; address: string };
  startAt: string;
  endAt: string;
  offers: { offerId: string; productName: string; brand: string; price: number }[];
}

/**
 * 광고 계약 조건 원문. 광고주가 제안하고 광고 매체가 같은 해시로 수락하면 블록체인에서 확정된다.
 * 집계 정책은 ID·버전·해시로 참조하고, 정책에서 파생된 계약 조항을 함께 담는다.
 */
export function buildContractTerms(input: ContractTermsInput) {
  return {
    spec: TERMS_SPEC_VERSION,
    engine: ENGINE_VERSION,
    campaignId: input.campaignId,
    name: input.name,
    policy: {
      policyId: input.policy.policyId,
      version: input.policy.version,
      policyHash: policyHash(input.policy),
    },
    clauses: contractClauses(input.policy),
    parties: {
      advertiser: { name: input.advertiser.name, address: input.advertiser.address.toLowerCase() },
      publisher: { name: input.publisher.name, address: input.publisher.address.toLowerCase() },
      verifier: { name: input.verifier.name, address: input.verifier.address.toLowerCase() },
    },
    period: { startAt: input.startAt, endAt: input.endAt },
    offers: [...input.offers].sort((a, b) => (a.offerId < b.offerId ? -1 : 1)),
  };
}

export type ContractTerms = ReturnType<typeof buildContractTerms>;

export function serializeTerms(terms: ContractTerms): { json: string; hash: Hex } {
  return { json: canonicalize(terms), hash: hashCanonical(terms) };
}
