/**
 * 배포 코드 일치 확인 — 로컬 체인용 "Verified" 대체 재현 자료
 *
 *   npm run chain:verify                 # deployments/localhost.json  (RPC http://127.0.0.1:8545)
 *   npx tsx scripts/verify-local.ts e2e  # deployments/e2e.json        (RPC http://127.0.0.1:8546)
 *   npx tsx scripts/verify-local.ts sepolia --rpc https://...   # 공개 테스트넷도 같은 방식으로 대조 가능
 *
 * 로컬 Hardhat 체인은 Etherscan 소스 검증을 받을 수 없으므로, 다음을 직접 대조해 같은 결론을 재현한다.
 *   1. 저장소의 contracts/AgentAdRegistry.sol == 컴파일 입력(build-info)에 들어간 소스   (keccak256 비교)
 *   2. 체인에 배포된 런타임 바이트코드(eth_getCode) == 그 소스를 컴파일한 deployedBytecode
 *   3. deployments/<network>.json 의 역할 지갑이 컨트랙트에서 실제로 해당 권한을 갖는지 (hasRole)
 * 하나라도 다르면 종료 코드 1.
 */
import { existsSync, readFileSync } from "node:fs";
import { createPublicClient, http, keccak256, toBytes, type Address, type Hex } from "viem";

const args = process.argv.slice(2);
const rpcFlag = args.indexOf("--rpc");
const rpcOverride = rpcFlag >= 0 ? args[rpcFlag + 1] : undefined;
const networkName = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--rpc") ?? "localhost";

const DEFAULT_RPC: Record<string, string> = {
  localhost: "http://127.0.0.1:8545",
  e2e: "http://127.0.0.1:8546",
};
const rpcUrl = rpcOverride ?? DEFAULT_RPC[networkName];
if (!rpcUrl) throw new Error(`RPC를 알 수 없습니다: --rpc <url> 로 지정하세요 (network=${networkName})`);

const deploymentPath = `deployments/${networkName}.json`;
const artifactPath = "artifacts/contracts/AgentAdRegistry.sol/AgentAdRegistry.json";
for (const p of [deploymentPath, artifactPath]) {
  if (!existsSync(p)) throw new Error(`${p} 이(가) 없습니다. (npm run setup / npm run chain:deploy 먼저 실행)`);
}

type Deployment = { network: string; chainId: number; address: Address; admin: Address; roles: Record<string, Address>; deployBlock: string };
type Artifact = { abi: unknown[]; deployedBytecode: Hex; inputSourceName: string; buildInfoId: string };
type BuildInfo = {
  solcLongVersion: string;
  input: { sources: Record<string, { content: string }>; settings: { evmVersion?: string; optimizer?: { enabled: boolean; runs: number } } };
};

const deployment = JSON.parse(readFileSync(deploymentPath, "utf8")) as Deployment;
const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as Artifact;
const buildInfo = JSON.parse(readFileSync(`artifacts/build-info/${artifact.buildInfoId}.json`, "utf8")) as BuildInfo;

const client = createPublicClient({ transport: http(rpcUrl) });
let failed = false;
const check = (ok: boolean, label: string, detail = "") => {
  if (!ok) failed = true;
  console.log(`  ${ok ? "✔" : "✘"} ${label}${detail ? ` — ${detail}` : ""}`);
};
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

console.log("AgentAdRegistry 배포 코드 일치 확인");
console.log(`  네트워크      ${networkName} (RPC ${rpcUrl})`);
console.log(`  컨트랙트 주소 ${deployment.address}  (배포 블록 ${deployment.deployBlock})`);
console.log(`  컴파일러      solc ${buildInfo.solcLongVersion}, optimizer ${buildInfo.input.settings.optimizer?.enabled ? `on (runs ${buildInfo.input.settings.optimizer.runs})` : "off"}, evmVersion ${buildInfo.input.settings.evmVersion ?? "default"}`);
console.log("");

// 1. 저장소 소스 == 컴파일 입력 소스
const repoSource = readFileSync("contracts/AgentAdRegistry.sol", "utf8");
const compiledSource = buildInfo.input.sources[artifact.inputSourceName]?.content ?? "";
const repoHash = keccak256(toBytes(repoSource.replace(/\r\n/g, "\n")));
const compiledHash = keccak256(toBytes(compiledSource.replace(/\r\n/g, "\n")));
check(repoHash === compiledHash, "저장소 소스 = 컴파일에 쓰인 소스", `keccak256 ${short(repoHash)}`);

// 2. 온체인 런타임 바이트코드 == 컴파일 결과
const chainId = await client.getChainId();
check(chainId === deployment.chainId, "체인 ID 일치", String(chainId));
const onchain = ((await client.getCode({ address: deployment.address })) ?? "0x").toLowerCase() as Hex;
const compiled = artifact.deployedBytecode.toLowerCase() as Hex;
if (onchain === "0x") {
  check(false, "온체인 바이트코드 존재", "코드가 없습니다 — 노드를 재시작했다면 npm run demo:reset 으로 다시 배포하세요");
} else {
  check(
    onchain === compiled,
    "온체인 바이트코드 = 컴파일 결과(deployedBytecode)",
    `${(onchain.length - 2) / 2} bytes, keccak256 ${short(keccak256(onchain))}`,
  );
}

// 3. 역할 권한
if (onchain !== "0x") {
  const abi = artifact.abi as readonly unknown[];
  const read = (functionName: string, fnArgs: unknown[] = []) =>
    client.readContract({ address: deployment.address, abi: abi as never, functionName: functionName as never, args: fnArgs as never }) as Promise<unknown>;
  const roleIds = {
    advertiser: (await read("ADVERTISER_ROLE")) as Hex,
    publisher: (await read("PUBLISHER_ROLE")) as Hex,
    verifier: (await read("VERIFIER_ROLE")) as Hex,
  };
  const adminRole = (await read("DEFAULT_ADMIN_ROLE")) as Hex;
  check((await read("hasRole", [adminRole, deployment.admin])) === true, "관리자 권한", deployment.admin);
  for (const [role, id] of Object.entries(roleIds)) {
    const account = deployment.roles[role];
    check((await read("hasRole", [id, account])) === true, `${role} 역할 권한`, account);
  }
}

console.log("");
console.log(failed ? "결과: 불일치 항목이 있습니다." : "결과: 배포된 컨트랙트는 저장소의 소스를 위 설정으로 컴파일한 코드와 바이트 단위로 같습니다.");
process.exitCode = failed ? 1 : 0;
