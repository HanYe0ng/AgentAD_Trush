/**
 * 광고 API (스폰서 정보 제공)
 * 쇼핑 AI가 사용자 질문에 맞는 스폰서 상품 정보를 요청하면, 광고주 제안 + 매체 수락으로
 * 블록체인에서 확정된(ACTIVE) 진행 중 계약의 광고 제안만 돌려준다. (인정 조건 ① 유효한 광고 계약)
 */
import { prisma } from "@/lib/db";
import { findPolicy } from "@/lib/policy/policies";

export interface SponsoredOffer {
  offerId: string;
  campaignId: string;
  productName: string;
  brand: string;
  price: number;
  category: string;
  description: string;
  keywords: string[];
  policyId: string;
  viewability: { minVisibleRatio: number; minVisibleMs: number };
  disclosureLabel: string;
  score: number;
}

export function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

export function keywordScore(query: string, keywords: string[]): number {
  const q = normalize(query);
  return keywords.map(normalize).filter((k) => k && q.includes(k)).length;
}

export async function getSponsoredOffers(query: string, now = new Date(), limit = 2): Promise<SponsoredOffer[]> {
  const campaigns = await prisma.campaign.findMany({
    where: { chainStatus: "ACTIVE", startAt: { lte: now }, endAt: { gte: now } },
    include: { offers: true },
  });

  return campaigns
    .flatMap((c) => {
      const policy = findPolicy(c.policyId);
      if (!policy) return [];
      return c.offers.map((o) => ({
        offerId: o.id,
        campaignId: c.id,
        productName: o.productName,
        brand: o.brand,
        price: o.price,
        category: o.category,
        description: o.description,
        keywords: o.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        policyId: policy.policyId,
        viewability: policy.viewability,
        disclosureLabel: policy.disclosure.label,
        score: keywordScore(query, [o.category, ...o.keywords.split(",")]),
      }));
    })
    .filter((o) => o.score > 0)
    .sort((a, b) => b.score - a.score || (a.offerId < b.offerId ? -1 : 1))
    .slice(0, limit);
}
