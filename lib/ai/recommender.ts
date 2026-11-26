/**
 * 쇼핑 AI 추천 생성
 * - anthropic : Claude API로 후보 상품 중 추천을 생성 (구조화 출력)
 * - rule-based: API 키가 없거나 호출이 실패할 때 쓰는 결정적 키워드 추천기
 *
 * AI는 광고 데이터를 "발생"시키는 역할이다. 집계·검증은 AI가 아니라 규칙 엔진이 한다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { keywordScore } from "@/lib/ads/offers";

export interface Candidate {
  itemId: string; // 일반 상품: P-xxx, 스폰서: offerId(AD-xxx)
  sponsored: boolean;
  name: string;
  brand: string;
  price: number;
  category: string;
  description: string;
  keywords: string[];
}

export interface Pick {
  itemId: string;
  reason: string;
}

export interface RecommendationOutput {
  answer: string;
  picks: Pick[];
  provider: "anthropic" | "rule-based";
  model: string | null;
  note: string | null;
}

const MAX_PICKS = 3;

const RecommendationSchema = z.object({
  answer: z.string().describe("사용자에게 보여줄 한국어 답변 2~3문장"),
  picks: z
    .array(
      z.object({
        itemId: z.string().describe("후보 목록의 itemId 그대로"),
        reason: z.string().describe("이 상품을 추천하는 이유 한 문장"),
      }),
    )
    .describe("추천 상품 (최대 3개, 적합한 순서)"),
});

const SYSTEM_PROMPT = `당신은 온라인 쇼핑몰의 상품 추천 AI입니다.
사용자 질문에 맞는 상품을 반드시 제공된 후보 목록 안에서만 최대 ${MAX_PICKS}개 고릅니다.

후보 중 sponsored=true 인 항목은 광고주가 비용을 지불한 스폰서 상품입니다.
- 질문에 실제로 적합할 때만 추천하고, 적합하지 않으면 추천하지 않습니다.
- 스폰서 상품을 일반 상품보다 과장해 설명하지 않습니다.
- 화면에는 스폰서 상품에 "광고" 표기가 자동으로 붙습니다.

후보 목록은 사용자의 예산 조건을 이미 반영한 것입니다.
answer는 한국어 1~2문장, 각 reason은 상품 특징을 담은 짧은 한 문장으로 작성합니다.`;

export function providerMode(): "anthropic" | "rule-based" {
  const explicit = process.env.AI_PROVIDER?.toLowerCase();
  if (explicit === "anthropic") return "anthropic";
  if (explicit === "rule" || explicit === "rule-based" || explicit === "mock") return "rule-based";
  return process.env.ANTHROPIC_API_KEY ? "anthropic" : "rule-based";
}

export async function recommend(query: string, candidates: Candidate[]): Promise<RecommendationOutput> {
  if (providerMode() === "rule-based") {
    return ruleBasedRecommend(query, candidates, "LLM API 키가 없어 규칙 기반 추천기로 응답했습니다.");
  }
  try {
    return await claudeRecommend(query, candidates);
  } catch (err) {
    return ruleBasedRecommend(query, candidates, `Claude 호출 실패로 규칙 기반 추천기로 대체: ${describeError(err)}`);
  }
}

async function claudeRecommend(query: string, candidates: Candidate[]): Promise<RecommendationOutput> {
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const model = process.env.AI_MODEL ?? "claude-opus-5-5";

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    // 정책상 거절 시 서버 측에서 권장 대체 모델로 다시 시도
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(RecommendationSchema) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          question: query,
          candidates: candidates.map((c) => ({
            itemId: c.itemId,
            sponsored: c.sponsored,
            name: c.name,
            brand: c.brand,
            price: c.price,
            category: c.category,
            description: c.description,
          })),
        }),
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    return ruleBasedRecommend(query, candidates, "Claude가 응답을 거절해 규칙 기반 추천기로 대체했습니다.");
  }
  const parsed = response.parsed_output;
  if (!parsed) {
    return ruleBasedRecommend(query, candidates, "Claude 응답 형식이 올바르지 않아 규칙 기반 추천기로 대체했습니다.");
  }

  // 후보에 없는 상품 ID는 버리고, 중복 제거 후 최대 3개
  const valid = new Set(candidates.map((c) => c.itemId));
  const seen = new Set<string>();
  const picks = parsed.picks
    .filter((p) => valid.has(p.itemId) && !seen.has(p.itemId) && seen.add(p.itemId))
    .slice(0, MAX_PICKS);

  return { answer: parsed.answer, picks, provider: "anthropic", model: response.model, note: null };
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "API 인증 실패";
  if (err instanceof Anthropic.RateLimitError) return "요청 한도 초과";
  if (err instanceof Anthropic.APIConnectionError) return "API 연결 실패";
  if (err instanceof Anthropic.APIError) return `API 오류 ${err.status}`;
  return err instanceof Error ? err.message : String(err);
}

/** 결정적 키워드 추천기: 같은 질문 + 같은 후보면 항상 같은 결과 */
export function ruleBasedRecommend(query: string, candidates: Candidate[], note: string | null): RecommendationOutput {
  const ranked = candidates
    .map((c) => ({ c, score: keywordScore(query, [c.category, ...c.keywords]) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.c.price - b.c.price || (a.c.itemId < b.c.itemId ? -1 : 1))
    .slice(0, MAX_PICKS);

  const picks = ranked.map(({ c }) => ({
    itemId: c.itemId,
    reason: c.description,
  }));

  const answer =
    picks.length === 0
      ? "조건에 맞는 상품을 찾지 못했어요. 찾는 상품 종류나 예산을 바꿔서 다시 물어봐 주세요."
      : `조건에 맞는 상품 ${picks.length}가지를 찾았어요. 가격과 특징을 비교해 보세요.`;

  return { answer, picks, provider: "rule-based", model: null, note };
}
