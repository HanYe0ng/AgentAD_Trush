import { z } from "zod";
import { handle, readJson } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { confirmReportTx } from "@/lib/reports/service";
import { serializeReport } from "@/lib/views";

const Body = z.object({
  action: z.enum(["submit", "verify", "approve", "dispute"]),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  reason: z.string().trim().min(1).max(500).optional(),
});

/** 매체 제출 / 검증 등록 / 광고주 확정·이의 제기 트랜잭션을 서버가 확인하고 상태 반영 */
export async function POST(req: Request, ctx: RouteContext<"/api/reports/[id]/chain">) {
  const { id } = await ctx.params;
  return handle(async () => {
    const { action, txHash, reason } = Body.parse(await readJson(req));
    await confirmReportTx(id, action, txHash as `0x${string}`, reason);
    const report = await prisma.report.findUniqueOrThrow({
      where: { id },
      include: { verifications: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return { report: serializeReport(report) };
  });
}
