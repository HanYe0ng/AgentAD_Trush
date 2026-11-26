/** 쇼핑 AI 실행 조건과 응답 타입 (브라우저·서버 공용) */
import type { DataMode } from "@/lib/events/spec";

/**
 * 시연 조건 (소비자 화면의 동작)
 *  - LIVE                  : 정상 — 화면이 실제로 렌더링한 결과를 기록
 *  - TEST_NOT_PRESENTED    : 화면 미표시 — 광고 카드를 그리지 못하고 '미표시'를 보고
 *  - TEST_EVIDENCE_MISSING : 측정 오류 — 카드는 보이지만 표시 기록이 전송되지 않음 (검증 불가)
 * ‘수신 후 미추천’은 예산 조건 질문(예: 2만 원 이하)으로 자연스럽게 재현한다.
 */
export const SCENARIOS = ["LIVE", "TEST_NOT_PRESENTED", "TEST_EVIDENCE_MISSING"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const SCENARIO_LABEL: Record<Scenario, string> = {
  LIVE: "정상",
  TEST_NOT_PRESENTED: "화면 미표시",
  TEST_EVIDENCE_MISSING: "측정 오류",
};

export const SCENARIO_DESCRIPTION: Record<Scenario, string> = {
  LIVE: "AI가 직접 판단하고, 소비자 화면이 실제로 그린 결과를 기록합니다.",
  TEST_NOT_PRESENTED: "추천은 됐지만 소비자 화면이 광고 카드를 그리지 못하고 ‘미표시’를 보고합니다.",
  TEST_EVIDENCE_MISSING: "카드는 보이지만 측정 오류로 표시 기록이 전송되지 않습니다. (검증 불가 사례)",
};

/**
 * 소비자 화면의 동작
 *  - PRESENT  : 카드를 렌더링하고 AD_PRESENTED(+가시성 충족 시 AD_VIEWABLE) 전송
 *  - SUPPRESS : 카드를 렌더링하지 않고 AD_NOT_PRESENTED 전송 (미표시 확인)
 *  - NO_BEACON: 카드는 렌더링하지만 아무 기록도 보내지 않음 (측정 오류 재현)
 */
export type ClientBehavior = "PRESENT" | "SUPPRESS" | "NO_BEACON";

export interface ShoppingItem {
  itemId: string;
  sponsored: boolean;
  name: string;
  brand: string;
  price: number;
  category: string;
  description: string;
  reason: string;
  offerId: string | null;
  campaignId: string | null;
  displayToken: string | null;
  viewability: { minVisibleRatio: number; minVisibleMs: number } | null;
  disclosureLabel: string | null;
  clientBehavior: ClientBehavior;
}

export interface ShoppingResult {
  runId: string;
  responseId: string;
  query: string;
  scenario: Scenario;
  dataMode: DataMode;
  answer: string;
  items: ShoppingItem[];
  receivedOffers: { offerId: string; campaignId: string; productName: string; recommended: boolean }[];
  budget: number | null;
  provider: string;
  model: string | null;
  note: string | null;
}
