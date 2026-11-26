import { z } from "zod";
import { handle, readJson } from "@/lib/api/http";
import { createFixtureScenario } from "@/lib/test-mode/service";

const Body = z.object({ campaignId: z.string().min(1) });

/** [테스트 모드] 가상 사례(수신 5 · 추천 3 · 표시 2) 이벤트 생성 - TEST 데이터로 기록 */
export async function POST(req: Request) {
  return handle(async () => createFixtureScenario(Body.parse(await readJson(req)).campaignId));
}
