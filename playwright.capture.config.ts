import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * 제출 자료용 화면 캡처 실행
 *   npx playwright test -c playwright.capture.config.ts
 * 기본 E2E(playwright.config.ts)와 같은 시나리오·환경(노드 8546, 서버 3100, 규칙 기반 AI)을 그대로 쓰고,
 * 각 테스트가 끝난 시점의 화면을 test-results/capture/ 에 남긴다.
 * (상단 바가 고정되어 있어 fullPage 캡처는 이어 붙인 자리에 헤더가 끼므로, 세로로 긴 뷰포트를 쓴다.)
 * docs/submission/images/ 의 화면 캡처는 이 실행 결과에서 골라 옮긴 것이다.
 */
export default defineConfig({
  ...base,
  outputDir: "test-results/capture",
  reporter: [["list"]],
  use: {
    ...base.use,
    viewport: { width: 1440, height: 1900 },
    screenshot: "on",
  },
});
