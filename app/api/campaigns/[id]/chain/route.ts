import { z } from "zod";
import { handle, readJson } from "@/lib/api/http";
import { confirmCampaignTx } from "@/lib/campaigns/service";
import { serializeCampaign } from "@/lib/views";

const Body = z.object({
  action: z.enum(["propose", "accept"]),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
});

/** 광고주 제안(registerCampaign) / 매체 수락(acceptCampaign) 트랜잭션을 확인하고 계약 상태 반영 */
export async function POST(req: Request, ctx: RouteContext<"/api/campaigns/[id]/chain">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { action, txHash } = Body.parse(await readJson(req));
    return { campaign: serializeCampaign(await confirmCampaignTx(id, action, txHash as `0x${string}`)) };
  });
}
