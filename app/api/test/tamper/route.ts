import { z } from "zod";
import { ApiError, handle, readJson } from "@/lib/api/http";
import { cleanupTamper, injectTamper } from "@/lib/test-mode/service";

const Body = z.object({ reportId: z.string().min(1) });

/** [테스트 모드] 증빙 변조 시뮬레이션: 제출된 보고 기간에 가짜 표시 이벤트 삽입 */
export async function POST(req: Request) {
  return handle(async () => injectTamper(Body.parse(await readJson(req)).reportId));
}

/** [테스트 모드] 변조 시뮬레이션 이벤트 정리 (?campaignId=) */
export async function DELETE(req: Request) {
  return handle(async () => {
    const campaignId = new URL(req.url).searchParams.get("campaignId");
    if (!campaignId) throw new ApiError(400, "campaignId가 필요합니다.");
    return cleanupTamper(campaignId);
  });
}
