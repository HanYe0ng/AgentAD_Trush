import { execSync } from "node:child_process";
import { test as setup, expect } from "@playwright/test";

/**
 * 개발 서버는 처음 요청이 올 때 화면·API를 컴파일한다. 첫 테스트가 컴파일을 기다리다 시간 초과되지 않도록
 * 모든 화면과 API를 미리 한 번씩 요청해 둔다. (응답 코드는 상관없음: 404·405도 컴파일은 끝난다)
 */
const WARM_UP = [
  "/",
  "/advertiser",
  "/publisher",
  "/consumer",
  "/verifier",
  "/ledger",
  "/api/overview",
  "/api/campaigns",
  "/api/campaigns/WARM-UP",
  "/api/campaigns/WARM-UP/chain",
  "/api/campaigns/WARM-UP/ledger",
  "/api/chat",
  "/api/events",
  "/api/events/display",
  "/api/reports/WARM-UP",
  "/api/reports/WARM-UP/chain",
  "/api/reports/submit",
  "/api/reports/verify",
  "/api/test/scenario",
  "/api/test/tamper",
];

/** E2E 전용 로컬 노드(8546)에 컨트랙트를 새로 배포하고 deployments/e2e.json 생성 */
setup("deploy AgentAdRegistry to e2e chain", async ({ request }) => {
  setup.setTimeout(300_000);
  execSync("npx hardhat run scripts/deploy.ts --network e2e", { stdio: "inherit" });
  const config = await (await request.get("/api/chain/config")).json();
  expect(config.deployed).toBe(true);
  expect(config.devSignerAvailable).toBe(true);

  for (const path of WARM_UP) await request.get(path, { timeout: 120_000 });
});
