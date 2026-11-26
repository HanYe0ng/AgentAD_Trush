/**
 * 시연 초기화: 시연용 DB(prisma/demo.db)의 기록을 모두 비우고, 로컬 블록체인에 새 컨트랙트를 배포한다.
 * 개발 서버는 켜 둔 채로 실행해도 됩니다. 끝나면 브라우저만 새로고침하세요.
 *
 *   npm run demo:reset
 *
 * ⚠ prisma/demo.db 의 시연 기록(캠페인·대화·이벤트·보고서)이 모두 지워집니다.
 *   .env 의 DATABASE_URL 이 file:./demo.db 일 때만 동작합니다.
 */
import { execSync } from "node:child_process";

process.loadEnvFile?.(".env");

const DEMO_URL = "file:./demo.db";
if (process.env.DATABASE_URL !== DEMO_URL) {
  console.error(`✗ .env 의 DATABASE_URL 이 "${DEMO_URL}" 일 때만 초기화합니다. (현재: ${process.env.DATABASE_URL})`);
  process.exit(1);
}

async function chainReachable() {
  try {
    const res = await fetch("http://127.0.0.1:8545", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

if (!(await chainReachable())) {
  console.error("✗ 로컬 블록체인(127.0.0.1:8545)에 연결할 수 없습니다. 다른 터미널에서 먼저 `npm run chain` 을 실행하세요.");
  process.exit(1);
}

console.log("1/3 시연 DB 준비 (prisma/demo.db)");
execSync("npx prisma db push --skip-generate", { stdio: "inherit" });

console.log("\n2/3 시연 기록 비우기");
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient({ datasources: { db: { url: DEMO_URL } } });
const counts = await prisma.$transaction([
  prisma.verification.deleteMany(),
  prisma.report.deleteMany(),
  prisma.adEvent.deleteMany(),
  prisma.aiRun.deleteMany(),
  prisma.offer.deleteMany(),
  prisma.campaign.deleteMany(),
  prisma.counter.deleteMany(),
]);
await prisma.$disconnect();
console.log(`   캠페인 ${counts[5].count} · 대화 ${counts[3].count} · 이벤트 ${counts[2].count} · 보고서 ${counts[1].count}건 삭제`);

console.log("\n3/3 새 컨트랙트 배포 (로컬 블록체인)");
execSync("npx hardhat run scripts/deploy.ts --network localhost", { stdio: "inherit" });

console.log("\n완료 — 브라우저에서 http://localhost:3000 을 새로고침하고 시연을 시작하세요. (대본: DEMO.md)");
