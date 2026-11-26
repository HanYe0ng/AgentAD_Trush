import type { Hex } from "viem";
import { hashCanonical } from "@/lib/core/canonical";

/**
 * AgentAd Trust 광고 이벤트 규격 v2 (광고 집계 계약 정책 v1.0 반영)
 *
 * 수신·추천·표시는 각각 다른 지표로 집계한다.
 *  - AD_RECEIVED      : AI 실행 과정에서 광고 API로부터 스폰서 정보를 수신         (보조 통계)
 *  - AD_RECOMMENDED   : AI의 구조화된 추천 응답에 유료 광고 제안(offerId)이 연결됨   (보조 통계)
 *  - AD_PRESENTED     : 해당 추천이 소비자 화면에 렌더링된 사실 + 화면 증빙        (기본 정산 지표)
 *  - AD_VIEWABLE      : 광고 카드가 가시성 기준(50%·연속 1초)을 충족               (보조 · 향후 확장)
 *  - AD_NOT_PRESENTED : 소비자 화면이 응답을 렌더링했지만 해당 광고는 표시하지 않았음을 확인
 *                       (‘표시 기록 없음 = 검증 불가’와 ‘미표시 확인’을 구분하기 위한 신호)
 *
 * 공통 식별자
 *  - runId      : 어떤 AI 실행 과정에서 발생했는가 (수신 이벤트는 runId로 응답과 연결)
 *  - offerId    : 어떤 유료 광고 제안과 연결되는가
 *  - responseId : 어떤 AI 답변(최종 추천 응답)과 연결되는가 — 중복 집계 단위의 일부
 *  - eventId    : 이벤트 고유 식별자
 *
 * ※ AD_PRESENTED는 렌더링 사실이지 사람이 읽었다는 증거가 아니다 (IAB/MRC 노출 원칙과 동일).
 */
export const EVENT_SPEC_VERSION = "agentad-trust/event@2";
export const EVIDENCE_SPEC_VERSION = "agentad-trust/evidence@1";
export const PRESENTATION_SPEC_VERSION = "agentad-trust/presentation@1";

export const AD_EVENT_TYPES = [
  "AD_RECEIVED",
  "AD_RECOMMENDED",
  "AD_PRESENTED",
  "AD_VIEWABLE",
  "AD_NOT_PRESENTED",
] as const;
export type AdEventType = (typeof AD_EVENT_TYPES)[number];

/** 소비자 화면(프론트엔드)이 보내는 이벤트 */
export const CLIENT_EVENT_TYPES = ["AD_PRESENTED", "AD_VIEWABLE", "AD_NOT_PRESENTED"] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

export const EVENT_SOURCES = ["AI_BACKEND", "CONSUMER_FRONTEND", "TEST_FIXTURE"] as const;
export type EventSource = (typeof EVENT_SOURCES)[number];

/** 실제 동작(LIVE)과 시연·자동 테스트 데이터(TEST)를 명확히 구분한다 */
export type DataMode = "LIVE" | "TEST";

export interface AdEventRecord {
  eventId: string;
  campaignId: string;
  offerId: string;
  runId: string;
  responseId: string | null;
  eventType: AdEventType;
  timestamp: string; // ISO-8601 (서버 기록 시각)
  source: EventSource;
  dataMode: DataMode;
  payload: Record<string, unknown>;
}

export interface StoredAdEvent extends AdEventRecord {
  hash: Hex | string;
  recordedAt: string;
}

/** 이벤트 해시 = keccak256(canonical JSON(규격 버전 + 이벤트 필드)) */
export function computeEventHash(event: AdEventRecord): Hex {
  return hashCanonical({
    spec: EVENT_SPEC_VERSION,
    eventId: event.eventId,
    campaignId: event.campaignId,
    offerId: event.offerId,
    runId: event.runId,
    responseId: event.responseId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    source: event.source,
    dataMode: event.dataMode,
    payload: event.payload,
  });
}

/**
 * 화면 증빙 해시: 소비자 화면이 실제로 렌더링한 광고 카드의 내용(상품명)을 응답·제안 ID와 묶어 해시한다.
 * 검증 엔진은 등록된 광고 제안의 상품명으로 같은 값을 계산해 대조한다.
 * (상품명이 우연히 같은 일반 추천은 responseId·offerId 연결이 없으므로 인정되지 않는다)
 */
export function computePresentationHash(input: { responseId: string; offerId: string; productName: string }): Hex {
  return hashCanonical({
    spec: PRESENTATION_SPEC_VERSION,
    responseId: input.responseId,
    offerId: input.offerId,
    productName: input.productName.trim(),
  });
}

export interface ManifestEntry {
  eventId: string;
  hash: string;
}

export interface EvidenceBundle {
  spec: typeof EVIDENCE_SPEC_VERSION;
  campaignId: string;
  periodStart: string;
  periodEnd: string;
  events: ManifestEntry[];
}

export function buildManifest(events: AdEventRecord[]): ManifestEntry[] {
  return events
    .map((e) => ({ eventId: e.eventId, hash: computeEventHash(e) }))
    .sort((a, b) => (a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0));
}

/** 증빙 해시 = keccak256(canonical JSON(캠페인 + 집계 기간 + 이벤트 해시 목록)) */
export function computeEvidenceHash(bundle: Omit<EvidenceBundle, "spec">): Hex {
  const sorted = [...bundle.events].sort((a, b) =>
    a.eventId < b.eventId ? -1 : a.eventId > b.eventId ? 1 : 0,
  );
  return hashCanonical({ ...bundle, events: sorted, spec: EVIDENCE_SPEC_VERSION });
}

export const EVENT_TYPE_LABEL: Record<AdEventType, string> = {
  AD_RECEIVED: "수신",
  AD_RECOMMENDED: "추천",
  AD_PRESENTED: "표시",
  AD_VIEWABLE: "가시성",
  AD_NOT_PRESENTED: "미표시",
};
