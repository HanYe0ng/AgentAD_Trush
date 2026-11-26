import { connection } from "next/server";
import { handle } from "@/lib/api/http";
import { getCampaignDetail } from "@/lib/views";

/** 캠페인 상세: 단계별 집계, 이벤트 로그, 보고서 */
export async function GET(_req: Request, ctx: RouteContext<"/api/campaigns/[id]">) {
  await connection();
  const { id } = await ctx.params;
  return handle(() => getCampaignDetail(id));
}
