/**
 * AgentAdRegistry 배포 + 역할(광고주·매체·검증기관) 지갑 권한 부여
 *
 *   로컬:    npm run chain            (별도 터미널, Hardhat 노드)
 *            npm run chain:deploy
 *   Sepolia: SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY(또는 hardhat keystore),
 *            ADVERTISER_ADDRESS, PUBLISHER_ADDRESS, VERIFIER_ADDRESS 설정 후
 *            npm run chain:deploy:sepolia
 *
 * 결과는 deployments/<network>.json 에 저장되고, 웹 앱이 이 파일에서 주소와 역할을 읽는다.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { network } from "hardhat";
import { getAddress, isAddress, type Address } from "viem";

const connection = await network.create();
const { viem, networkName } = connection;
const publicClient = await viem.getPublicClient();
const wallets = await viem.getWalletClients();
const deployer = wallets[0];
const chainId = await publicClient.getChainId();
const isLocal = chainId === 31337;

function roleAddress(envName: string, localIndex: number): Address {
  const fromEnv = process.env[envName];
  if (fromEnv) {
    if (!isAddress(fromEnv)) throw new Error(`${envName} is not a valid address: ${fromEnv}`);
    return getAddress(fromEnv);
  }
  if (isLocal) return wallets[localIndex].account.address;
  throw new Error(`${envName} must be set when deploying to ${networkName}`);
}

// 로컬 Hardhat 기본 계정: #0 관리자, #1 광고주, #2 광고 매체, #3 검증기관, #4 권한 없는 계정
const roles = {
  advertiser: roleAddress("ADVERTISER_ADDRESS", 1),
  publisher: roleAddress("PUBLISHER_ADDRESS", 2),
  verifier: roleAddress("VERIFIER_ADDRESS", 3),
};

console.log(`Network: ${networkName} (chainId ${chainId})`);
console.log(`Deployer/admin: ${deployer.account.address}`);

const registry = await viem.deployContract("AgentAdRegistry", [deployer.account.address]);
const deployBlock = await publicClient.getBlockNumber();
console.log(`AgentAdRegistry deployed at ${registry.address}`);

const grants: [string, Address][] = [
  ["ADVERTISER_ROLE", roles.advertiser],
  ["PUBLISHER_ROLE", roles.publisher],
  ["VERIFIER_ROLE", roles.verifier],
];
for (const [roleName, account] of grants) {
  const role =
    roleName === "ADVERTISER_ROLE"
      ? await registry.read.ADVERTISER_ROLE()
      : roleName === "PUBLISHER_ROLE"
        ? await registry.read.PUBLISHER_ROLE()
        : await registry.read.VERIFIER_ROLE();
  const hash = await registry.write.grantRole([role, account]);
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  granted ${roleName} → ${account}`);
}

mkdirSync("deployments", { recursive: true });
const deployment = {
  network: networkName,
  chainId,
  address: registry.address,
  admin: deployer.account.address,
  roles,
  deployBlock: deployBlock.toString(),
  deployedAt: new Date().toISOString(),
};
writeFileSync(`deployments/${networkName}.json`, JSON.stringify(deployment, null, 2) + "\n");
console.log(`Saved deployments/${networkName}.json`);

if (!isLocal) {
  console.log("\nEtherscan 소스코드 검증:");
  console.log(`  npx hardhat verify --network ${networkName} ${registry.address} ${deployer.account.address}`);
}
