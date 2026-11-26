import { execSync } from "node:child_process";
import { test as setup, expect } from "@playwright/test";

/** E2E 전용 로컬 노드(8546)에 컨트랙트를 새로 배포하고 deployments/e2e.json 생성 */
setup("deploy AgentAdRegistry to e2e chain", async ({ request }) => {
  execSync("npx hardhat run scripts/deploy.ts --network e2e", { stdio: "inherit" });
  const config = await (await request.get("/api/chain/config")).json();
  expect(config.deployed).toBe(true);
  expect(config.devSignerAvailable).toBe(true);
});
