import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/** 원자적으로 시퀀스를 증가시킨다 (SQLite UPSERT ... RETURNING) */
export async function nextSeq(name: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ value: number | bigint }[]>`
    INSERT INTO "Counter" ("name", "value") VALUES (${name}, 1)
    ON CONFLICT("name") DO UPDATE SET "value" = "value" + 1
    RETURNING "value"`;
  return Number(rows[0].value);
}

/** EVT-000001, RUN-0001 처럼 DB 내부에서만 쓰는 순차 ID */
export async function nextId(prefix: string, width: number): Promise<string> {
  return `${prefix}-${String(await nextSeq(prefix)).padStart(width, "0")}`;
}

/**
 * 블록체인에 기록되는 ID (캠페인·보고서). DB를 초기화해도 이미 체인에 있는 ID와
 * 겹치지 않도록 짧은 난수 접미사를 붙인다. 예: CAM-001-7F3A (bytes32에 들어가도록 31자 이하)
 */
export async function nextChainId(prefix: "CAM" | "RPT"): Promise<string> {
  const seq = String(await nextSeq(prefix)).padStart(3, "0");
  return `${prefix}-${seq}-${randomBytes(2).toString("hex").toUpperCase()}`;
}
