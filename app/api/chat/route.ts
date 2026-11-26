import { z } from "zod";
import { handle, readJson } from "@/lib/api/http";
import { runShoppingAssistant } from "@/lib/ai/shopping";
import { SCENARIOS } from "@/lib/ai/scenarios";

const Body = z.object({
  query: z.string().trim().min(1).max(300),
  scenario: z.enum(SCENARIOS).default("LIVE"),
});

/** 쇼핑 AI에 질문 → 광고 제공·추천 생성·이벤트 저장이 자동으로 진행 */
export async function POST(req: Request) {
  return handle(async () => {
    const { query, scenario } = Body.parse(await readJson(req));
    return runShoppingAssistant(query, scenario);
  });
}
