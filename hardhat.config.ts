import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

/**
 * 스마트 컨트랙트 개발 설정 (Hardhat 3)
 * - 소스: contracts/AgentAdRegistry.sol
 * - 테스트: tests/contract/*.test.ts (node:test + viem)
 * - 네트워크: 로컬 Hardhat 노드(localhost), 공개 테스트넷(Sepolia)
 *
 * Sepolia 배포 시 비밀 값은 코드에 넣지 말고 환경 변수 또는 Hardhat 키스토어로 전달한다.
 *   npx hardhat keystore set SEPOLIA_PRIVATE_KEY
 */
export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  paths: {
    sources: "contracts",
    tests: {
      nodejs: "tests/contract",
      solidity: "tests/contract",
    },
  },
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
      production: {
        version: "0.8.28",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    },
  },
  networks: {
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    // Playwright E2E 전용 로컬 노드 (개발용 노드와 포트 분리)
    e2e: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8546",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable("ETHERSCAN_API_KEY"),
    },
  },
});
