import { connection } from "next/server";
import { handle } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { getReportOrThrow } from "@/lib/reports/service";
import { readOnChainReport } from "@/lib/blockchain/server";
import { serializeReport } from "@/lib/views";

/** 검증 결과·차이 사유 조회 + 온체인 상태 실시간 조회 */
export async function GET(_req: Request, ctx: RouteContext<"/api/reports/[id]">) {
  await connection();
  const { id } = await ctx.params;
  return handle(async () => {
    await getReportOrThrow(id);
    const report = await prisma.report.findUniqueOrThrow({
      where: { id },
      include: { verifications: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    let onChain = null;
    let chainError: string | null = null;
    try {
      onChain = await readOnChainReport(id);
    } catch (err) {
      chainError = err instanceof Error ? err.message.split("\n")[0] : "블록체인 조회 실패";
    }
    return { report: serializeReport(report), onChain, chainError };
  });
}
