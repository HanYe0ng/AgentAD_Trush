import { connection } from "next/server";
import { handle } from "@/lib/api/http";
import { getCampaignLedger } from "@/lib/ledger";

/** 캠페인의 온체인 기록 (트랜잭션·블록 번호·시각) */
export async function GET(_req: Request, ctx: RouteContext<"/api/campaigns/[id]/ledger">) {
  await connection();
  const { id } = await ctx.params;
  return handle(() => getCampaignLedger(id));
}
