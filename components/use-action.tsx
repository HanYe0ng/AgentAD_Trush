"use client";

import { useState, type ReactNode } from "react";
import { describeChainError } from "@/lib/blockchain/client";
import { Mono, Notice } from "@/components/ui";

export type ActionMessage = { tone: "success" | "danger" | "warning" | "info"; title: string; body?: ReactNode };

/** 버튼 동작 공통 처리: 진행 중 표시, 성공 메시지, 컨트랙트 오류를 쉬운 말로 */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<ActionMessage | null>(null);

  async function run(key: string, fn: () => Promise<ActionMessage | void>, after?: () => Promise<void>) {
    setBusy(key);
    setMessage(null);
    try {
      const result = await fn();
      if (result) setMessage(result);
      await after?.();
    } catch (err) {
      const info = describeChainError(err);
      setMessage({
        tone: "danger",
        title: info.title,
        body: (
          <>
            {info.detail}
            {info.raw && <Mono className="mt-1 block break-all text-[11px] text-rose-800">{info.raw}</Mono>}
          </>
        ),
      });
      await after?.();
    } finally {
      setBusy(null);
    }
  }

  const view = message ? (
    <Notice tone={message.tone} title={message.title}>
      {message.body}
    </Notice>
  ) : null;

  return { busy, message, setMessage, run, view };
}
