/**
 * 컴파일된 AgentAdRegistry ABI를 웹 앱에서 타입 안전하게 쓰도록 TypeScript 상수로 내보낸다.
 * 실행: npm run chain:build  (hardhat build 후 자동 실행)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const artifactPath = "artifacts/contracts/AgentAdRegistry.sol/AgentAdRegistry.json";
const outPath = "lib/blockchain/abi.ts";

const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as { abi: unknown[] };

const source = `// 자동 생성 파일 - 직접 수정하지 마세요. (npm run chain:build)
// source: contracts/AgentAdRegistry.sol

export const agentAdRegistryAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;
`;

mkdirSync("lib/blockchain", { recursive: true });
writeFileSync(outPath, source);
console.log(`ABI exported → ${outPath} (${artifact.abi.length} entries)`);
