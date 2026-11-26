import { z } from "zod";
import { handle, readJson } from "@/lib/api/http";
import { reproduceVerification, verifyReport } from "@/lib/verification/service";

const Body = z.object({
  reportId: z.string().min(1),
  mode: z.enum(["verify", "reproduce"]).default("verify"),
});

/**
 * 이벤트 재집계 및 증빙 검증 (규칙 기반 TypeScript 엔진 - LLM 사용 안 함)
 *  - verify    : 검증기관이 실행 → 결과 저장, 온체인 제출값 반환
 *  - reproduce : 누구나 다시 계산해 온체인 검증 결과 해시와 일치하는지 확인
 */
export async function POST(req: Request) {
  return handle(async () => {
    const { reportId, mode } = Body.parse(await readJson(req));
    if (mode === "reproduce") return reproduceVerification(reportId);
    const run = await verifyReport(reportId);
    return {
      result: run.result,
      verificationHash: run.verificationHash,
      verificationId: run.verification.id,
      chainWarning: run.chainWarning,
      chainArgs: {
        reportId,
        verifiedCount: run.result.verifiedCount,
        heldCount: run.result.heldCount,
        verificationHash: run.verificationHash,
        evidenceIntact: run.result.integrity.intact,
      },
    };
  });
}
