import { connection } from "next/server";
import { handle } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { toStoredEvent } from "@/lib/events/recorder";

/** 이벤트 조회 (?runId= 또는 ?campaignId=) */
export async function GET(req: Request) {
  await connection();
  return handle(async () => {
    const url = new URL(req.url);
    const runId = url.searchParams.get("runId") ?? undefined;
    const campaignId = url.searchParams.get("campaignId") ?? undefined;
    const rows = await prisma.adEvent.findMany({
      where: { ...(runId ? { runId } : {}), ...(campaignId ? { campaignId } : {}) },
      orderBy: { id: "asc" },
      take: 500,
    });
    return { events: rows.map(toStoredEvent) };
  });
}
