import { expect, test, type Page } from "@playwright/test";

/**
 * 시연 시나리오 E2E (역할별 화면)
 *  광고주 등록·계약 제안 → 매체 수락 → 소비자 질문(정상·예산 미추천·화면 미표시·측정 오류)
 *  → 매체 보고 → 검증기관 검증·등록 → 광고주 승인 → 홈 진행판 → 블록체인 기록·권한 테스트·재현
 *  → 증빙 변조 반려 → 재보고 후 이의 제기
 */
test.describe.configure({ mode: "serial" });

const NORMAL_Q = "3만 원 이하로 출근할 때 쓸 텀블러 추천해 줘";
const BUDGET_Q = "2만 원 이하 텀블러 추천해 줘";

type StoredEvent = { eventType: string };

async function ask(page: Page, scenario: "LIVE" | "TEST_NOT_PRESENTED" | "TEST_EVIDENCE_MISSING", query: string) {
  await page.getByTestId(`scenario-${scenario}`).click();
  await page.getByRole("textbox", { name: "질문" }).fill(query);
  const before = await page.locator('[data-testid^="run-events-"]').count();
  await page.getByTestId("ask").click();
  await expect(page.locator('[data-testid^="run-events-"]')).toHaveCount(before + 1);
  const testId = await page.locator('[data-testid^="run-events-"]').first().getAttribute("data-testid");
  return testId!.replace("run-events-", "");
}

async function eventTypes(page: Page, runId: string) {
  const res = await page.request.get(`/api/events?runId=${runId}`);
  return ((await res.json()) as { events: StoredEvent[] }).events.map((e) => e.eventType);
}

test("광고주: 광고 상품을 등록하고 계약을 블록체인에 제안한다", async ({ page }) => {
  await page.goto("/advertiser");
  await expect(page.getByTestId("chain-status")).toContainText("로컬 블록체인");
  await page.getByTestId("register-ad").click();
  await expect(page.getByText("광고를 등록하고 계약을 블록체인에 제안했습니다")).toBeVisible();
});

test("광고 매체: 같은 조건 해시로 계약을 수락한다", async ({ page }) => {
  await page.goto("/publisher");
  await page.getByTestId("accept-contract").click();
  await expect(page.getByText("계약을 수락했습니다")).toBeVisible();
});

test("소비자 · 정상: 광고 카드가 화면에 표시되고, 소비자에게 내부 ID는 보이지 않는다", async ({ page }) => {
  await page.goto("/consumer");
  const runId = await ask(page, "LIVE", NORMAL_Q);
  const card = page.getByTestId("sponsored-card");
  await expect(card).toContainText("유료 광고 · 모아리빙");
  await expect(card).not.toContainText("AD-");
  await expect(card).toBeInViewport({ ratio: 0.5 });
  await expect(card).toHaveAttribute("data-display-status", "viewable");
  await expect.poll(() => eventTypes(page, runId)).toEqual(["AD_RECEIVED", "AD_RECOMMENDED", "AD_PRESENTED", "AD_VIEWABLE"]);
});

test("소비자 · 예산 초과: 광고를 받았지만 AI가 추천하지 않는다", async ({ page }) => {
  await page.goto("/consumer");
  const runId = await ask(page, "LIVE", BUDGET_Q);
  await expect(page.getByTestId("sponsored-card")).toHaveCount(0);
  expect(await eventTypes(page, runId)).toEqual(["AD_RECEIVED"]);
});

test("소비자 · 화면 미표시: 카드를 그리지 못하고 미표시를 보고한다", async ({ page }) => {
  await page.goto("/consumer");
  const runId = await ask(page, "TEST_NOT_PRESENTED", NORMAL_Q);
  await expect(page.getByTestId("sponsored-card")).toHaveCount(0);
  await expect.poll(() => eventTypes(page, runId)).toEqual(["AD_RECEIVED", "AD_RECOMMENDED", "AD_NOT_PRESENTED"]);
});

test("소비자 · 측정 오류: 카드는 보이지만 표시 기록이 남지 않는다", async ({ page }) => {
  await page.goto("/consumer");
  const runId = await ask(page, "TEST_EVIDENCE_MISSING", NORMAL_Q);
  await expect(page.getByTestId("sponsored-card")).toHaveAttribute("data-display-status", "disabled");
  await page.waitForTimeout(2000);
  expect(await eventTypes(page, runId)).toEqual(["AD_RECEIVED", "AD_RECOMMENDED"]);
});

test("서버가 발급하지 않은 표시 토큰은 거부된다", async ({ request }) => {
  const res = await request.post("/api/events/display", {
    data: {
      eventType: "AD_PRESENTED",
      responseId: "RES-0001",
      offerId: "AD-001",
      displayToken: "forged-token",
      evidence: {
        contentHash: "0x" + "ab".repeat(32),
        disclosureText: "유료 광고 · 모아리빙",
        disclosureVisible: true,
        viewport: { width: 1, height: 1 },
        clientRenderedAt: new Date().toISOString(),
        userAgent: "attacker",
      },
    },
  });
  expect(res.status()).toBe(403);
});

test("광고 매체: AI가 광고를 받은 횟수(4건)를 실적으로 보고한다", async ({ page }) => {
  await page.goto("/publisher");
  await expect(page.getByTestId("received-count")).toHaveText(/^4\s*건/);
  await expect(page.getByTestId("reported-input")).toHaveValue("4");
  await page.getByTestId("submit-report").click();
  await expect(page.getByTestId("report-list").locator("li").first()).toHaveAttribute("data-status", "SUBMITTED");
});

test("검증기관: 4건 중 1건 인정·1건 보류로 판정하고 블록체인에 등록한다", async ({ page }) => {
  await page.goto("/verifier");
  await page.getByTestId("run-verification").click();
  await expect(page.getByTestId("verified-count")).toHaveText(/^1\s*건/);
  await expect(page.getByTestId("held-count")).toHaveText(/^1\s*건/);
  const gap = page.getByTestId("gap-summary");
  await expect(gap).toContainText("AI가 추천하지 않음 1건");
  await expect(gap).toContainText("추천됐지만 화면 미표시 1건");
  await expect(gap).toContainText("표시 기록 없음 · 보류 1건");
  await expect(page.getByTestId("integrity")).toContainText("일치");
  await expect(page.getByTestId("unit-checks").locator("[data-verdict]")).toHaveCount(4);

  await page.getByTestId("verify-onchain").click();
  await expect(page.getByText("검증 결과를 블록체인에 등록했습니다")).toBeVisible();
});

test("광고주: 검증된 실적을 최종 승인하고, 홈에 노출·정산 결과와 6단계 완료가 표시된다", async ({ page }) => {
  await page.goto("/advertiser");
  await page.getByTestId("approve").click();
  await expect(page.getByTestId("finalized")).toContainText("1건 최종 확정");

  await page.goto("/");
  await expect(page.getByTestId("steps").locator('[data-status="done"]')).toHaveCount(6);
  await expect(page.getByTestId("next-action")).toContainText("모든 단계");
  await expect(page.getByTestId("home-funnel-received")).toHaveText(/^4s*건/);
  await expect(page.getByTestId("home-funnel-presented")).toHaveText(/^1s*건/);
  await expect(page.getByTestId("settle-verified")).toHaveText(/^1s*건/);
  await expect(page.getByTestId("timeline").locator("li")).toHaveCount(5);
});

test("블록체인 기록: 5건의 승인 이력, 컨트랙트 권한 거부, 재현 확인", async ({ page }) => {
  await page.goto("/ledger");
  await expect(page.getByTestId("ledger").locator("[data-action]")).toHaveCount(5);
  for (const key of ["approve", "verify", "accept"]) {
    await page.getByTestId(`try-${key}`).click();
    await expect(page.getByTestId(`result-${key}`)).toContainText("AccessControlUnauthorizedAccount");
  }
  await page.getByTestId("reproduce").click();
  await expect(page.getByTestId("reproduce-result")).toContainText("재현 일치");
});

test("증빙 변조: 제출 후 가짜 표시 기록을 넣으면 지문 불일치로 반려된다", async ({ page }) => {
  await page.goto("/consumer");
  await page.getByTestId("create-fixture").click();
  await expect(page.getByText("예시 대화 5건을 만들었습니다")).toBeVisible();

  await page.goto("/publisher");
  await expect(page.getByTestId("received-count")).toHaveText(/^5\s*건/);
  await page.getByTestId("submit-report").click();
  await expect(page.getByTestId("report-list").locator("li").first()).toHaveAttribute("data-status", "SUBMITTED");

  await page.goto("/verifier");
  await page.getByTestId("tamper").click();
  await expect(page.getByText("가짜 ‘화면 표시’ 기록을 끼워 넣었습니다")).toBeVisible();
  await page.getByTestId("run-verification").click();
  await expect(page.getByTestId("integrity")).toContainText("불일치");
  await expect(page.getByTestId("verified-count")).toHaveText(/^2\s*건/);
  await page.getByTestId("verify-onchain").click();
  await expect(page.getByText("반려를 블록체인에 기록했습니다")).toBeVisible();

  await page.goto("/");
  await expect(page.getByTestId("next-action")).toContainText("반려");
});

test("재보고 후 광고주 이의 제기: 사유가 블록체인에 기록된다", async ({ page }) => {
  await page.goto("/verifier");
  await page.getByRole("button", { name: "변조 기록 정리" }).click();
  await expect(page.getByText("변조 기록 1건을 정리했습니다")).toBeVisible();

  await page.goto("/publisher");
  await page.getByTestId("submit-report").click();
  await expect(page.getByTestId("report-list").locator("li").first()).toHaveAttribute("data-status", "SUBMITTED");

  await page.goto("/verifier");
  await page.getByTestId("run-verification").click();
  await expect(page.getByTestId("verified-count")).toHaveText(/^2\s*건/);
  await expect(page.getByTestId("integrity")).toContainText("일치");
  await page.getByTestId("verify-onchain").click();
  await expect(page.getByText("검증 결과를 블록체인에 등록했습니다")).toBeVisible();

  await page.goto("/advertiser");
  await page.getByTestId("dispute").click();
  await expect(page.getByTestId("disputed")).toContainText("이의 제기됨");
});
