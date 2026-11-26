import { handle, readJson } from "@/lib/api/http";
import { createReportDraft } from "@/lib/reports/service";
import { serializeReport } from "@/lib/views";

/** 광고 매체의 집계 보고: 증빙 목록을 고정하고 증빙 해시 계산 → 매체 지갑으로 submitReport() 서명 */
export async function POST(req: Request) {
  return handle(async () => ({ report: serializeReport(await createReportDraft(await readJson(req))) }));
}
