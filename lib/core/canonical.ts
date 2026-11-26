import { keccak256, stringToBytes, type Hex } from "viem";

/**
 * 결정적(canonical) JSON 직렬화.
 * - 객체 키를 사전순으로 정렬하고 공백 없이 출력한다.
 * - undefined 필드는 제외한다.
 * 같은 데이터는 어느 참여자가 계산해도 항상 같은 문자열 → 같은 해시가 된다.
 */
export function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("canonicalize: non-finite number");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint") return JSON.stringify(value.toString());
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalize(v)).join(",")}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(record[k])}`).join(",")}}`;
}

/** keccak256(canonical JSON) - 이더리움과 동일한 해시 함수 */
export function hashCanonical(value: unknown): Hex {
  return keccak256(stringToBytes(canonicalize(value)));
}

export function shortHash(hash: string | null | undefined, size = 6): string {
  if (!hash) return "-";
  if (hash.length <= size * 2 + 2) return hash;
  return `${hash.slice(0, size + 2)}…${hash.slice(-size)}`;
}
