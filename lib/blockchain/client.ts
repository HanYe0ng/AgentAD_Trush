/**
 * 브라우저 전용: 지갑 서명 및 컨트랙트 트랜잭션 전송 (viem)
 *  - metamask : 사용자의 MetaMask 지갑으로 서명 (Sepolia 시연)
 *  - dev      : 로컬 Hardhat 노드 전용. Hardhat의 공개 테스트 니모닉에서 역할별 계정을 파생해 서명
 *               (실제 자산이 없는 공개 테스트 키이며 chainId 31337 에서만 활성화됨)
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  keccak256,
  toHex,
  UserRejectedRequestError,
  type Address,
  type Chain,
  type EIP1193Provider,
  type Hex,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { hardhat, sepolia } from "viem/chains";
import { agentAdRegistryAbi } from "@/lib/blockchain/abi";
import {
  CHAIN_ERROR_LABEL,
  HARDHAT_CHAIN_ID,
  SEPOLIA_CHAIN_ID,
  type ChainConfig,
  type SignerRole,
} from "@/lib/blockchain/shared";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export type SignerMode = "dev" | "metamask";
export interface TxSigner {
  mode: SignerMode;
  /** dev 모드에서 사용할 역할 계정 */
  role: SignerRole;
}

const HARDHAT_TEST_MNEMONIC = "test test test test test test test test test test test junk";
const DEV_ACCOUNT_INDEX: Record<SignerRole, number> = { advertiser: 1, publisher: 2, verifier: 3, outsider: 4 };

export function devAccount(role: SignerRole) {
  return mnemonicToAccount(HARDHAT_TEST_MNEMONIC, { addressIndex: DEV_ACCOUNT_INDEX[role] });
}

export function chainOf(config: ChainConfig): Chain {
  if (config.chainId === SEPOLIA_CHAIN_ID) return sepolia;
  return defineChain({
    ...hardhat,
    id: config.chainId ?? HARDHAT_CHAIN_ID,
    name: "Hardhat Local",
    rpcUrls: { default: { http: [config.browserRpcUrl] } },
  });
}

export function browserPublicClient(config: ChainConfig) {
  return createPublicClient({ chain: chainOf(config), transport: http(config.browserRpcUrl) });
}

export async function connectMetaMask(config: ChainConfig): Promise<Address> {
  if (!window.ethereum) throw new Error("MetaMask가 설치되어 있지 않습니다.");
  const chain = chainOf(config);
  const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
  const [address] = await wallet.requestAddresses();
  if ((await wallet.getChainId()) !== chain.id) {
    try {
      await wallet.switchChain({ id: chain.id });
    } catch {
      await wallet.addChain({ chain });
      await wallet.switchChain({ id: chain.id });
    }
  }
  return address;
}

export type RegistryCall =
  // campaignId, policyId, policyHash, termsHash, publisher, verifier, startTime, endTime
  | { functionName: "registerCampaign"; args: readonly [Hex, Hex, Hex, Hex, Address, Address, bigint, bigint] }
  // campaignId, termsHash
  | { functionName: "acceptCampaign"; args: readonly [Hex, Hex] }
  // reportId, campaignId, reportedCount, evidenceHash
  | { functionName: "submitReport"; args: readonly [Hex, Hex, bigint, Hex] }
  // reportId, verifiedCount(VALID), heldCount(INCONCLUSIVE), verificationHash, evidenceIntact
  | { functionName: "verifyReport"; args: readonly [Hex, bigint, bigint, Hex, boolean] }
  | { functionName: "approveReport"; args: readonly [Hex] }
  // reportId, reasonHash
  | { functionName: "disputeReport"; args: readonly [Hex, Hex] };

/**
 * 컨트랙트 함수를 먼저 시뮬레이션(eth_call)해 권한·상태 오류를 확인한 뒤 서명·전송한다.
 * 권한 없는 지갑의 요청은 이 단계에서 컨트랙트가 revert 하여 전송되지 않는다.
 */
export async function sendRegistryTx(config: ChainConfig, signer: TxSigner, call: RegistryCall): Promise<Hex> {
  if (!config.registryAddress) throw new Error("컨트랙트 주소가 없습니다.");
  const chain = chainOf(config);
  const publicClient = browserPublicClient(config);

  let wallet;
  let account: Address | ReturnType<typeof devAccount>;
  if (signer.mode === "dev") {
    if (!config.devSignerAvailable) throw new Error("로컬 개발 키는 Hardhat 로컬 체인에서만 사용할 수 있습니다.");
    account = devAccount(signer.role);
    wallet = createWalletClient({ account, chain, transport: http(config.browserRpcUrl) });
  } else {
    account = await connectMetaMask(config);
    wallet = createWalletClient({ account, chain, transport: custom(window.ethereum!) });
  }

  const request = {
    address: config.registryAddress,
    abi: agentAdRegistryAbi,
    functionName: call.functionName,
    args: call.args,
    account,
    chain,
  } as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await publicClient.simulateContract(request as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hash = await wallet.writeContract(request as any);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`트랜잭션 실패: ${hash}`);
  return hash;
}

/** 권한 없는 지갑으로 호출을 시도하고, 컨트랙트가 거부한 결과를 돌려준다 (시연용) */
export async function simulateRegistryCall(config: ChainConfig, signer: TxSigner, call: RegistryCall) {
  if (!config.registryAddress) throw new Error("컨트랙트 주소가 없습니다.");
  const account = signer.mode === "dev" ? devAccount(signer.role) : await connectMetaMask(config);
  await browserPublicClient(config).simulateContract({
    address: config.registryAddress,
    abi: agentAdRegistryAbi,
    functionName: call.functionName,
    args: call.args,
    account,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

const ROLE_HASH_NAME: Record<string, string> = {
  [keccak256(toHex("ADVERTISER_ROLE"))]: "ADVERTISER_ROLE (광고주)",
  [keccak256(toHex("PUBLISHER_ROLE"))]: "PUBLISHER_ROLE (광고 매체)",
  [keccak256(toHex("VERIFIER_ROLE"))]: "VERIFIER_ROLE (검증기관)",
};

export interface ChainErrorInfo {
  title: string;
  detail: string;
  raw: string | null;
}

export function describeChainError(err: unknown): ChainErrorInfo {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) {
      return { title: "서명 취소", detail: "지갑에서 요청을 거절했습니다.", raw: null };
    }
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? "Reverted";
      const args = (revert.data?.args ?? []).map((a) => ROLE_HASH_NAME[String(a)] ?? String(a));
      return {
        title: `컨트랙트가 거부함: ${name}`,
        detail: CHAIN_ERROR_LABEL[name] ?? revert.shortMessage,
        raw: `${name}(${args.join(", ")})`,
      };
    }
    return { title: "블록체인 요청 실패", detail: err.shortMessage, raw: null };
  }
  return { title: "오류", detail: err instanceof Error ? err.message : String(err), raw: null };
}
