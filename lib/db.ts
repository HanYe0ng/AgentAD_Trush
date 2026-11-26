import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaByUrl?: Map<string, PrismaClient> };

/** 현재 DATABASE_URL에 맞는 클라이언트 (URL별로 1개만 만든다) */
function clientFor(url: string): PrismaClient {
  globalForPrisma.prismaByUrl ??= new Map();
  let client = globalForPrisma.prismaByUrl.get(url);
  if (!client) {
    client = url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
    globalForPrisma.prismaByUrl.set(url, client);
  }
  return client;
}

/**
 * .env 의 DATABASE_URL 을 바꾸면 개발 서버가 env를 다시 읽는데, 이때 재시작하지 않아도
 * 다음 요청부터 새 DB로 연결되도록 접근할 때마다 현재 URL의 클라이언트를 고른다.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = clientFor(process.env.DATABASE_URL ?? "");
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
