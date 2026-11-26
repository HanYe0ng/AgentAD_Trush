import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

/** Route Handler 공통 오류 처리: 예상된 오류는 메시지 그대로, 그 외는 500 */
export async function handle(fn: () => Promise<unknown>): Promise<Response> {
  try {
    const data = await fn();
    return Response.json(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return Response.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof ZodError) {
      return Response.json(
        { error: "요청 형식이 올바르지 않습니다.", issues: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
        { status: 400 },
      );
    }
    console.error(err);
    return Response.json({ error: err instanceof Error ? err.message : "서버 오류" }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "JSON 본문이 필요합니다.");
  }
}
