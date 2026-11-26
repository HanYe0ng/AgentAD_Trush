/**
 * 쇼핑 AI 연결 확인: 이 PC에서 Claude가 응답하는지, 시연 질문에 광고 상품을 추천하는지 확인한다.
 *   npm run ai:check
 * (.env 의 AI_PROVIDER / ANTHROPIC_API_KEY, 또는 `ant auth login` 로그인을 사용. 실제 API를 1회 호출합니다)
 */
export {};

process.loadEnvFile?.(".env");

const { CATALOG, parseBudget } = await import("../lib/ai/catalog");
const { providerMode, recommend } = await import("../lib/ai/recommender");

const query = process.argv[2] ?? "3만 원 이하로 출근할 때 쓸 텀블러 추천해 줘";
const budget = parseBudget(query);
const sponsored = {
  itemId: "AD-001",
  sponsored: true,
  name: "모아 데일리 텀블러",
  brand: "모아리빙",
  price: 24000,
  category: "텀블러",
  description: "450mL · 한 손으로 여는 슬라이드 뚜껑, 8시간 보온",
  keywords: ["텀블러", "출근", "보온", "보냉", "커피"],
};
const candidates = [
  ...CATALOG.filter((p) => p.category === "텀블러").map((p) => ({
    itemId: p.productId,
    sponsored: false,
    name: p.name,
    brand: p.brand,
    price: p.price,
    category: p.category,
    description: p.description,
    keywords: p.keywords,
  })),
  sponsored,
].filter((c) => budget === null || c.price <= budget);

console.log(`설정된 추천 방식: ${providerMode()}  (AI_PROVIDER=${process.env.AI_PROVIDER ?? "(없음)"})`);
console.log(`질문: ${query}`);
const started = Date.now();
const rec = await recommend(query, candidates);
console.log(`응답 주체: ${rec.provider}${rec.model ? ` (${rec.model})` : ""} · ${((Date.now() - started) / 1000).toFixed(1)}초`);
if (rec.note) console.log(`참고: ${rec.note}`);
console.log(`답변: ${rec.answer}`);
for (const p of rec.picks) console.log(` - ${p.itemId === sponsored.itemId ? "[광고] " : ""}${candidates.find((c) => c.itemId === p.itemId)?.name}: ${p.reason}`);
console.log(rec.picks.some((p) => p.itemId === sponsored.itemId) ? "→ 광고 상품을 추천했습니다." : "→ 광고 상품을 추천하지 않았습니다.");
