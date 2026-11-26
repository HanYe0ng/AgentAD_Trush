import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdEvent } from "@prisma/client";
import { prisma } from "@/lib/db";
import { nextId } from "@/lib/ids";
import { computeEventHash, type AdEventRecord, type StoredAdEvent } from "@/lib/events/spec";

type NewEvent = Omit<AdEventRecord, "eventId" | "timestamp"> & { timestamp?: Date };

/** 이벤트를 규격대로 기록하고 수집 시점의 해시를 함께 저장한다 */
export async function recordEvent(
  input: NewEvent,
  opts: { recordedAt?: Date; testInjected?: boolean } = {},
): Promise<StoredAdEvent> {
  const eventId = await nextId("EVT", 6);
  const record: AdEventRecord = {
    eventId,
    campaignId: input.campaignId,
    offerId: input.offerId,
    runId: input.runId,
    responseId: input.responseId,
    eventType: input.eventType,
    timestamp: (input.timestamp ?? new Date()).toISOString(),
    source: input.source,
    dataMode: input.dataMode,
    payload: input.payload,
  };
  const hash = computeEventHash(record);
  const row = await prisma.adEvent.create({
    data: {
      id: record.eventId,
      campaignId: record.campaignId,
      offerId: record.offerId,
      runId: record.runId,
      responseId: record.responseId,
      eventType: record.eventType,
      timestamp: new Date(record.timestamp),
      source: record.source,
      dataMode: record.dataMode,
      payloadJson: JSON.stringify(record.payload),
      hash,
      testInjected: opts.testInjected ?? false,
      ...(opts.recordedAt ? { recordedAt: opts.recordedAt } : {}),
    },
  });
  return { ...record, hash, recordedAt: row.recordedAt.toISOString() };
}

/** DB 행 → 규격 이벤트 (검증 엔진 입력) */
export function toEventRecord(row: AdEvent): AdEventRecord {
  return {
    eventId: row.id,
    campaignId: row.campaignId,
    offerId: row.offerId,
    runId: row.runId,
    responseId: row.responseId,
    eventType: row.eventType as AdEventRecord["eventType"],
    timestamp: row.timestamp.toISOString(),
    source: row.source as AdEventRecord["source"],
    dataMode: row.dataMode as AdEventRecord["dataMode"],
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
  };
}

export function toStoredEvent(row: AdEvent): StoredAdEvent & { testInjected: boolean } {
  return { ...toEventRecord(row), hash: row.hash, recordedAt: row.recordedAt.toISOString(), testInjected: row.testInjected };
}

/**
 * 표시 토큰: 서버가 추천을 생성할 때 발급하고, 화면 표시 이벤트를 받을 때 확인한다.
 * 실제 발급된 추천에 대해서만 표시 이벤트를 받기 위한 최소한의 장치다.
 */
function tokenSecret() {
  return process.env.DISPLAY_TOKEN_SECRET ?? "agentad-trust-dev-display-secret";
}

export function signDisplayToken(responseId: string, offerId: string): string {
  return createHmac("sha256", tokenSecret()).update(`${responseId}:${offerId}`).digest("hex").slice(0, 32);
}

export function verifyDisplayToken(responseId: string, offerId: string, token: string): boolean {
  const expected = Buffer.from(signDisplayToken(responseId, offerId));
  const given = Buffer.from(token ?? "");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
