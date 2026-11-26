/** 서버 전용: 배포 정보 로드, 온체인 상태 조회, 트랜잭션 영수증 확인 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  hexToString,
  http,
  isAddressEqual,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { hardhat, sepolia } from "viem/chains";
import { agentAdRegistryAbi } from "@/lib/blockchain/abi";
import {
  CHAIN_CAMPAIGN_STATUS,
  CHAIN_REPORT_STATUS,
  type ChainCampaignStatus,
  HARDHAT_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  toBytes32Id,
  type ChainConfig,
  type ChainReportStatus,
  type Role,
} from "@/lib/blockchain/shared";
import { ApiError } from "@/lib/api/http";

export interface Deployment {
  network: string;
  chainId: number;
  address: Address;
  admin: Address;
  roles: Record<Role, Address>;
  deployBlock: string;
  deployedAt: string;
}

export function chainNetwork(): string {
  return process.env.CHAIN_NETWORK ?? "localhost";
}

export function loadDeployment(): Deployment | null {
  const file = path.join(process.cwd(), "deployments", `${chainNetwork()}.json`);
  if (!existsSync(file)) return null;
  const deployment = JSON.parse(readFileSync(file, "utf8")) as Deployment;
  if (process.env.REGISTRY_ADDRESS) deployment.address = process.env.REGISTRY_ADDRESS as Address;
  return deployment;
}

function defaultRpcUrl(network: string): string {
  if (network === "sepolia") return "https://ethereum-sepolia-rpc.publicnode.com";
  if (network === "e2e") return "http://127.0.0.1:8546";
  return "http://127.0.0.1:8545";
}

export function serverRpcUrl(): string {
  return process.env.CHAIN_RPC_URL ?? defaultRpcUrl(chainNetwork());
}

function chainFor(chainId: number, rpcUrl: string) {
  if (chainId === SEPOLIA_CHAIN_ID) return { ...sepolia, rpcUrls: { default: { http: [rpcUrl] } } };
  return defineChain({ ...hardhat, id: chainId, rpcUrls: { default: { http: [rpcUrl] } } });
}

let cached: { key: string; client: PublicClient } | null = null;

export function publicClient(): { client: PublicClient; deployment: Deployment } {
  const deployment = loadDeployment();
  if (!deployment) {
    throw new ApiError(503, `컨트랙트 배포 정보가 없습니다 (deployments/${chainNetwork()}.json). npm run chain:deploy 를 실행하세요.`);
  }
  const rpcUrl = serverRpcUrl();
  const key = `${deployment.chainId}|${rpcUrl}`;
  if (!cached || cached.key !== key) {
    cached = {
      key,
      client: createPublicClient({ chain: chainFor(deployment.chainId, rpcUrl), transport: http(rpcUrl) }) as PublicClient,
    };
  }
  return { client: cached.client, deployment };
}

export async function getChainConfig(): Promise<ChainConfig> {
  const network = chainNetwork();
  const deployment = loadDeployment();
  const browserRpcUrl = process.env.CHAIN_BROWSER_RPC_URL ?? serverRpcUrl();
  const base: ChainConfig = {
    network,
    chainId: deployment?.chainId ?? null,
    registryAddress: deployment?.address ?? null,
    roles: deployment?.roles ?? null,
    browserRpcUrl,
    explorerUrl: deployment?.chainId === SEPOLIA_CHAIN_ID ? "https://sepolia.etherscan.io" : null,
    deployed: false,
    reachable: false,
    devSignerAvailable: deployment?.chainId === HARDHAT_CHAIN_ID,
    message: null,
  };
  if (!deployment) {
    return { ...base, message: `deployments/${network}.json 이 없습니다. 컨트랙트를 먼저 배포하세요.` };
  }
  try {
    const { client } = publicClient();
    const [chainId, code] = await Promise.all([
      client.getChainId(),
      client.getCode({ address: deployment.address }),
    ]);
    if (chainId !== deployment.chainId) {
      return { ...base, reachable: true, message: `RPC 체인 ID(${chainId})가 배포 정보(${deployment.chainId})와 다릅니다.` };
    }
    const deployed = !!code && code !== "0x";
    return {
      ...base,
      reachable: true,
      deployed,
      message: deployed ? null : "이 주소에 컨트랙트가 없습니다. 로컬 노드를 재시작했다면 다시 배포하세요.",
    };
  } catch {
    return { ...base, message: `블록체인 RPC(${serverRpcUrl()})에 연결할 수 없습니다.` };
  }
}

export interface OnChainReport {
  campaignId: string;
  reportedCount: number;
  verifiedCount: number;
  heldCount: number;
  evidenceHash: Hex;
  verificationHash: Hex;
  disputeReasonHash: Hex;
  status: ChainReportStatus;
  submittedAt: number;
  verifiedAt: number;
  closedAt: number;
}

export interface OnChainCampaign {
  policyId: string;
  policyHash: Hex;
  termsHash: Hex;
  advertiser: Address;
  publisher: Address;
  verifier: Address;
  startTime: number;
  endTime: number;
  proposedAt: number;
  activatedAt: number;
  status: ChainCampaignStatus;
}

function isNotFound(err: unknown, errorName: string) {
  return err instanceof Error && err.message.includes(errorName);
}

export async function readOnChainReport(reportId: string): Promise<OnChainReport | null> {
  const { client, deployment } = publicClient();
  try {
    const r = await client.readContract({
      address: deployment.address,
      abi: agentAdRegistryAbi,
      functionName: "getReport",
      args: [toBytes32Id(reportId)],
    });
    return {
      campaignId: hexToString(r.campaignId, { size: 32 }),
      reportedCount: Number(r.reportedCount),
      verifiedCount: Number(r.verifiedCount),
      heldCount: Number(r.heldCount),
      evidenceHash: r.evidenceHash,
      verificationHash: r.verificationHash,
      disputeReasonHash: r.disputeReasonHash,
      status: CHAIN_REPORT_STATUS[r.status] ?? "None",
      submittedAt: Number(r.submittedAt),
      verifiedAt: Number(r.verifiedAt),
      closedAt: Number(r.closedAt),
    };
  } catch (err) {
    if (isNotFound(err, "ReportNotFound")) return null;
    throw err;
  }
}

export async function readOnChainCampaign(campaignId: string): Promise<OnChainCampaign | null> {
  const { client, deployment } = publicClient();
  try {
    const c = await client.readContract({
      address: deployment.address,
      abi: agentAdRegistryAbi,
      functionName: "getCampaign",
      args: [toBytes32Id(campaignId)],
    });
    return {
      policyId: hexToString(c.policyId, { size: 32 }),
      policyHash: c.policyHash,
      termsHash: c.termsHash,
      advertiser: c.advertiser,
      publisher: c.publisher,
      verifier: c.verifier,
      startTime: Number(c.startTime),
      endTime: Number(c.endTime),
      proposedAt: Number(c.proposedAt),
      activatedAt: Number(c.activatedAt),
      status: CHAIN_CAMPAIGN_STATUS[c.status] ?? "None",
    };
  } catch (err) {
    if (isNotFound(err, "CampaignNotFound")) return null;
    throw err;
  }
}

type RegistryEventName =
  | "CampaignProposed"
  | "CampaignActivated"
  | "ReportSubmitted"
  | "ReportVerified"
  | "ReportRejected"
  | "ReportDisputed"
  | "ReportFinalized";

/**
 * 브라우저가 보낸 트랜잭션 해시를 그대로 믿지 않고, 영수증을 직접 조회해
 * 레지스트리 컨트랙트에서 기대한 이벤트가 해당 ID로 발생했는지 확인한다.
 */
export async function confirmRegistryTx(
  txHash: Hex,
  expected: { events: RegistryEventName[]; idField: "campaignId" | "reportId"; id: string },
): Promise<{ eventName: RegistryEventName; from: Address; blockNumber: bigint }> {
  const { client, deployment } = publicClient();
  const receipt = await client.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
  if (receipt.status !== "success") throw new ApiError(400, "실패한 트랜잭션입니다.");
  if (!receipt.to || !isAddressEqual(receipt.to, deployment.address)) {
    throw new ApiError(400, "AgentAdRegistry 컨트랙트로 보낸 트랜잭션이 아닙니다.");
  }
  const target = toBytes32Id(expected.id).toLowerCase();
  for (const log of receipt.logs) {
    if (!isAddressEqual(log.address, deployment.address)) continue;
    try {
      const decoded = decodeEventLog({ abi: agentAdRegistryAbi, data: log.data, topics: log.topics });
      if (!expected.events.includes(decoded.eventName as RegistryEventName)) continue;
      const args = decoded.args as Record<string, unknown>;
      if (String(args[expected.idField]).toLowerCase() === target) {
        return { eventName: decoded.eventName as RegistryEventName, from: receipt.from, blockNumber: receipt.blockNumber };
      }
    } catch {
      // 다른 이벤트(로그)는 무시
    }
  }
  throw new ApiError(400, `트랜잭션에서 ${expected.events.join("/")} 이벤트(${expected.id})를 찾을 수 없습니다.`);
}
