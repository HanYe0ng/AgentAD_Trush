import { connection } from "next/server";
import { handle } from "@/lib/api/http";
import { getChainConfig } from "@/lib/blockchain/server";

/** 브라우저가 사용할 체인·컨트랙트·역할 지갑 정보 */
export async function GET() {
  await connection();
  return handle(() => getChainConfig());
}
