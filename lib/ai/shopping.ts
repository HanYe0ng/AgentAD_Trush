/**
 * 쇼핑 AI 실행 (POST /api/chat)
 * 광고 제공 → AD_RECEIVED → AI 추천 생성 → AD_RECOMMENDED → 소비자 화면이 AD_PRESENTED·AD_NOT_PRESENTED 보고
 */
import { prisma } from "@/lib/db";
import { nextId } from "@/lib/ids";
import { getSponsoredOffers, keywordScore, type SponsoredOffer } from "@/lib/ads/offers";
import { CATALOG, parseBudget } from "@/lib/ai/catalog";
import { recommend, type Candidate } from "@/lib/ai/recommender";
import { recordEvent, signDisplayToken } from "@/lib/events/recorder";
import type { DataMode } from "@/lib/events/spec";
import type { ClientBehavior, Scenario, ShoppingItem, ShoppingResult } from "@/lib/ai/scenarios";

export async function runShoppingAssistant(query: string, scenario: Scenario): Promise<ShoppingResult> {
  const dataMode: DataMode = scenario === "LIVE" ? "LIVE" : "TEST";
  const runId = await nextId("RUN", 4);
  await prisma.aiRun.create({
    data: {
      id: runId,
      query,
      dataMode,
      scenario,
      provider: "pending",
      answer: "",
      itemsJson: "[]",
      receivedOfferIds: "",
    },
  });

  // 1) 광고 API에서 스폰서 정보 수신 → AD_RECEIVED
  const offers = await getSponsoredOffers(query);
  for (const offer of offers) {
    await recordEvent({
      campaignId: offer.campaignId,
      offerId: offer.offerId,
      runId,
      responseId: null,
      eventType: "AD_RECEIVED",
      source: "AI_BACKEND",
      dataMode,
      payload: { matchScore: offer.score },
    });
  }

  // 2) AI 추천 생성 (일반 상품 + 스폰서 상품 후보)
  const organic = CATALOG.map<Candidate>((p) => ({
    itemId: p.productId,
    sponsored: false,
    name: p.name,
    brand: p.brand,
    price: p.price,
    category: p.category,
    description: p.description,
    keywords: p.keywords,
  }));
  const relevantOrganic = organic.filter((c) => keywordScore(query, [c.category, ...c.keywords]) > 0);
  const sponsored = offers.map<Candidate>((o) => ({
    itemId: o.offerId,
    sponsored: true,
    name: o.productName,
    brand: o.brand,
    price: o.price,
    category: o.category,
    description: o.description,
    keywords: o.keywords,
  }));
  // 예산 조건("3만 원 이하")이 있으면 넘는 상품은 후보에서 뺀다.
  // 광고는 이미 수신(AD_RECEIVED)됐지만 추천되지 않으므로 '수신 후 미추천'이 자연스럽게 발생한다.
  const budget = parseBudget(query);
  const withinBudget = (c: Candidate) => budget === null || c.price <= budget;
  const candidates = [...(relevantOrganic.length > 0 ? relevantOrganic : organic), ...sponsored].filter(withinBudget);
  const rec = await recommend(query, candidates);

  // 3) 시연 조건 적용 (실제 동작과 구분되는 TEST 데이터로 기록됨): 화면 동작을 재현하려면 스폰서 추천이 있어야 한다
  let picks = rec.picks;
  const offerById = new Map(offers.map((o) => [o.offerId, o]));
  const affordable = offers.filter((o) => budget === null || o.price <= budget);
  if (scenario !== "LIVE" && affordable.length > 0) {
    if (!picks.some((p) => offerById.has(p.itemId))) {
      picks = [{ itemId: affordable[0].offerId, reason: "[시연] 스폰서 상품 추천" }, ...picks].slice(0, 3);
    }
  }
  const clientBehavior: ClientBehavior =
    scenario === "TEST_NOT_PRESENTED" ? "SUPPRESS" : scenario === "TEST_EVIDENCE_MISSING" ? "NO_BEACON" : "PRESENT";

  // 4) 최종 추천 응답(responseId) 1건 생성 → 구조화된 추천의 itemId가 전달받은 offerId인 경우에만 AD_RECOMMENDED
  //    (상품명이 우연히 같은 것만으로는 유료 추천으로 기록하지 않는다 — 인정 조건 ③)
  const responseId = await nextId("RES", 4);
  const candidateById = new Map(candidates.map((c) => [c.itemId, c]));
  const items: ShoppingItem[] = [];
  for (const [rank, pick] of picks.entries()) {
    const c = candidateById.get(pick.itemId);
    if (!c) continue;
    const offer: SponsoredOffer | undefined = offerById.get(pick.itemId);
    if (offer) {
      await recordEvent({
        campaignId: offer.campaignId,
        offerId: offer.offerId,
        runId,
        responseId,
        eventType: "AD_RECOMMENDED",
        source: "AI_BACKEND",
        dataMode,
        payload: { linkedOfferId: offer.offerId, rank: rank + 1, provider: rec.provider },
      });
    }
    items.push({
      itemId: c.itemId,
      sponsored: !!offer,
      name: c.name,
      brand: c.brand,
      price: c.price,
      category: c.category,
      description: c.description,
      reason: pick.reason,
      offerId: offer?.offerId ?? null,
      campaignId: offer?.campaignId ?? null,
      displayToken: offer ? signDisplayToken(responseId, offer.offerId) : null,
      viewability: offer?.viewability ?? null,
      disclosureLabel: offer?.disclosureLabel ?? null,
      clientBehavior: offer ? clientBehavior : "PRESENT",
    });
  }

  await prisma.aiRun.update({
    where: { id: runId },
    data: {
      provider: rec.provider,
      model: rec.model,
      answer: rec.answer,
      responseId,
      itemsJson: JSON.stringify(items.map((item) => ({ ...item, displayToken: undefined }))),
      receivedOfferIds: offers.map((o) => o.offerId).join(","),
    },
  });

  return {
    runId,
    responseId,
    query,
    scenario,
    dataMode,
    answer: rec.answer,
    items,
    receivedOffers: offers.map((o) => ({
      offerId: o.offerId,
      campaignId: o.campaignId,
      productName: o.productName,
      recommended: items.some((i) => i.offerId === o.offerId),
    })),
    budget,
    provider: rec.provider,
    model: rec.model,
    note: rec.note,
  };
}
