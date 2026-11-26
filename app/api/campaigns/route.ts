import { connection } from "next/server";
import { handle, readJson } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { createCampaign } from "@/lib/campaigns/service";
import { serializeCampaign } from "@/lib/views";

/** 캠페인 목록 */
export async function GET() {
  await connection();
  return handle(async () => {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { offers: true, _count: { select: { events: true, reports: true } } },
    });
    return {
      campaigns: campaigns.map((c) => ({
        ...serializeCampaign(c),
        eventCount: c._count.events,
        reportCount: c._count.reports,
      })),
    };
  });
}

/** 캠페인 및 집계 기준 등록 (DB) - 이후 광고주 지갑으로 registerCampaign() 서명 */
export async function POST(req: Request) {
  return handle(async () => ({ campaign: serializeCampaign(await createCampaign(await readJson(req))) }));
}
