import { mkdirSync } from "node:fs";
import { defineConfig } from "@playwright/test";

/**
 * E2E 시연 시나리오 테스트
 * - 별도 Hardhat 노드(8546) + 별도 SQLite(e2e.db) + 별도 Next 서버(3100)를 띄워 개발 환경과 섞이지 않는다.
 * - 쇼핑 AI는 결정적인 규칙 기반 추천기를 사용한다 (AI_PROVIDER=rule).
 * - 브라우저는 Windows에 설치된 Microsoft Edge를 사용한다. (다른 OS: PW_CHANNEL=chrome 또는 npx playwright install chromium)
 */
const PORT = 3100;

// 실행마다 새 SQLite 파일을 만든다 (기존 DB를 초기화·삭제하지 않음). prisma/e2e/ 는 git에서 제외됨.
const RUN_ID = process.env.E2E_RUN_ID ?? String(Date.now());
process.env.E2E_RUN_ID = RUN_ID; // 워커 프로세스도 같은 값을 상속
mkdirSync("prisma/e2e", { recursive: true });
const DATABASE_URL = `file:./e2e/run-${RUN_ID}.db`;

const channel = process.env.PW_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    { name: "e2e", testMatch: /.*\.spec\.ts/, dependencies: ["setup"] },
  ],
  webServer: [
    {
      command: "npx hardhat node --port 8546",
      port: 8546,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx prisma db push --skip-generate && npx next dev --port ${PORT}`,
      url: `http://localhost:${PORT}/api/chain/config`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        DATABASE_URL,
        CHAIN_NETWORK: "e2e",
        CHAIN_RPC_URL: "http://127.0.0.1:8546",
        AI_PROVIDER: "rule",
        NEXT_DIST_DIR: ".next-e2e",
        DISPLAY_TOKEN_SECRET: "e2e-display-secret",
      },
    },
  ],
});
