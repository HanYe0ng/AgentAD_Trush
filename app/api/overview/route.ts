import { connection } from "next/server";
import { handle } from "@/lib/api/http";
import { getOverview } from "@/lib/overview";

/** 홈 대시보드: 전체 광고 계약 현황 · 핵심 지표 · 최근 블록체인 기록 */
export async function GET() {
  await connection();
  return handle(() => getOverview());
}
