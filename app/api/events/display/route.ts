import { z } from "zod";
import { ApiError, handle, readJson } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { recordEvent, verifyDisplayToken } from "@/lib/events/recorder";

const viewport = z.object({ width: z.number().int().min(0), height: z.number().int().min(0) });

const Body = z.discriminatedUnion("eventType", [
  // 소비자 화면에 광고 카드가 렌더링됨 (기본 정산 지표) + 화면 증빙
  z.object({
    eventType: z.literal("AD_PRESENTED"),
    responseId: z.string().min(1),
    offerId: z.string().min(1),
    displayToken: z.string().min(1),
    evidence: z.object({
      contentHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      disclosureText: z.string().max(40),
      disclosureVisible: z.boolean(),
      viewport,
      clientRenderedAt: z.string().max(40),
      userAgent: z.string().max(300),
    }),
  }),
  // 광고 카드가 가시성 기준(50%·1초)을 충족 (보조 지표)
  z.object({
    eventType: z.literal("AD_VIEWABLE"),
    responseId: z.string().min(1),
    offerId: z.string().min(1),
    displayToken: z.string().min(1),
    evidence: z.object({
      visibleRatio: z.number().min(0).max(1),
      visibleMs: z.number().int().min(0).max(3_600_000),
      viewport,
      clientRenderedAt: z.string().max(40),
    }),
  }),
  // 응답은 렌더링했지만 이 광고는 표시하지 않았음을 확인 (미표시 확인 ≠ 검증 불가)
  z.object({
    eventType: z.literal("AD_NOT_PRESENTED"),
    responseId: z.string().min(1),
    offerId: z.string().min(1),
    displayToken: z.string().min(1),
    evidence: z.object({
      reason: z.enum(["CLIENT_SUPPRESSED", "RENDER_FAILED", "TRUNCATED"]),
      clientRenderedAt: z.string().max(40),
    }),
  }),
]);

/**
 * 소비자 화면 이벤트 수집: AD_PRESENTED / AD_VIEWABLE / AD_NOT_PRESENTED
 * 서버가 발급한 표시 토큰과 해당 응답의 유료 추천 기록이 있는 경우에만 받는다. 기록 시각은 서버 시각.
 * 주의: AD_PRESENTED는 렌더링 사실이지 사람이 읽었다는 증거가 아니다.
 */
export async function POST(req: Request) {
  return handle(async () => {
    const body = Body.parse(await readJson(req));
    if (!verifyDisplayToken(body.responseId, body.offerId, body.displayToken)) {
      throw new ApiError(403, "유효하지 않은 표시 토큰입니다.");
    }
    const recommended = await prisma.adEvent.findFirst({
      where: { eventType: "AD_RECOMMENDED", responseId: body.responseId, offerId: body.offerId },
    });
    if (!recommended) throw new ApiError(404, "해당 응답의 유료 추천 기록이 없습니다.");

    const event = await recordEvent({
      campaignId: recommended.campaignId,
      offerId: recommended.offerId,
      runId: recommended.runId,
      responseId: body.responseId,
      eventType: body.eventType,
      source: "CONSUMER_FRONTEND",
      dataMode: recommended.dataMode as "LIVE" | "TEST",
      payload: { ...body.evidence },
    });
    return { event };
  });
}
