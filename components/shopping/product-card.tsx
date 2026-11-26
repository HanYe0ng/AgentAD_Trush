"use client";

import { useEffect, useRef, useState } from "react";
import { api, formatWon } from "@/lib/client/api";
import type { ShoppingItem } from "@/lib/ai/scenarios";
import { computePresentationHash, type ClientEventType } from "@/lib/events/spec";
import { ProductThumb } from "@/components/product-thumb";
import { cx } from "@/components/ui";

type Beacon = { presented?: string; viewable?: string; error?: string };

/**
 * 소비자에게 보이는 추천 상품 카드. 내부 ID(광고 번호·응답 번호)는 소비자 화면에 노출하지 않고,
 * 스폰서 상품에는 ‘유료 광고 · 광고주’ 표기만 붙인다.
 *
 * 스폰서 카드는 화면 이벤트를 보낸다.
 *  - AD_PRESENTED : 카드가 렌더링되면(페인트 이후) 1회 — 화면에 그려진 상품명으로 화면 증빙 해시 계산
 *  - AD_VIEWABLE  : 카드 면적 50% 이상이 1초 이상 연속으로 보이면 1회 (보조 지표)
 *  clientBehavior가 NO_BEACON이면 렌더링만 하고 아무것도 보내지 않는다 (측정 오류 재현 → 검증 불가)
 */
export function ProductCard({ item, responseId, onEvent }: { item: ShoppingItem; responseId: string; onEvent?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const sent = useRef<{ presented: boolean; viewable: boolean }>({ presented: false, viewable: false });
  const onEventRef = useRef(onEvent);
  const [beacon, setBeacon] = useState<Beacon>({});

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const measured = item.sponsored && item.clientBehavior === "PRESENT" && !!item.displayToken && !!item.offerId;

  useEffect(() => {
    const el = ref.current;
    if (!el || !measured) return;
    const { offerId, displayToken, viewability } = item;

    const send = async (eventType: ClientEventType, evidence: Record<string, unknown>) => {
      const res = await api<{ event: { eventId: string } }>("/api/events/display", {
        body: { eventType, responseId, offerId, displayToken, evidence },
      });
      onEventRef.current?.();
      return res.event.eventId;
    };

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(async () => {
        if (sent.current.presented || !el.isConnected) return;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        sent.current.presented = true;
        const name = el.querySelector("[data-evidence='product-name']")?.textContent ?? "";
        const disclosure = el.querySelector<HTMLElement>("[data-ad-disclosure]");
        const disclosureRect = disclosure?.getBoundingClientRect();
        try {
          const eventId = await send("AD_PRESENTED", {
            contentHash: computePresentationHash({ responseId, offerId: offerId!, productName: name }),
            disclosureText: (disclosure?.textContent ?? "").slice(0, 40),
            disclosureVisible: !!disclosureRect && disclosureRect.width > 0 && disclosureRect.height > 0,
            viewport: { width: window.innerWidth, height: window.innerHeight },
            clientRenderedAt: new Date().toISOString(),
            userAgent: navigator.userAgent.slice(0, 300),
          });
          setBeacon((b) => ({ ...b, presented: eventId }));
        } catch (err) {
          sent.current.presented = false;
          setBeacon((b) => ({ ...b, error: (err as Error).message }));
        }
      });
    });

    let visibleSince: number | null = null;
    let maxRatio = 0;
    let timer: number | null = null;
    const rule = viewability ?? { minVisibleRatio: 0.5, minVisibleMs: 1000 };
    const fireViewable = async () => {
      if (sent.current.viewable || visibleSince === null) return;
      sent.current.viewable = true;
      try {
        const eventId = await send("AD_VIEWABLE", {
          visibleRatio: Math.min(1, Number(maxRatio.toFixed(3))),
          visibleMs: Math.ceil(performance.now() - visibleSince),
          viewport: { width: window.innerWidth, height: window.innerHeight },
          clientRenderedAt: new Date().toISOString(),
        });
        setBeacon((b) => ({ ...b, viewable: eventId }));
      } catch {
        sent.current.viewable = false;
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          maxRatio = Math.max(maxRatio, entry.intersectionRatio);
          const visible = entry.intersectionRatio >= rule.minVisibleRatio && document.visibilityState === "visible";
          if (visible && visibleSince === null && !sent.current.viewable) {
            visibleSince = performance.now();
            timer = window.setTimeout(fireViewable, rule.minVisibleMs);
          } else if (!visible && visibleSince !== null) {
            visibleSince = null;
            if (timer) window.clearTimeout(timer);
            timer = null;
          }
        }
      },
      { threshold: [0, 0.25, rule.minVisibleRatio, 0.75, 1] },
    );
    observer.observe(el);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      observer.disconnect();
      if (timer) window.clearTimeout(timer);
    };
  }, [measured, item, responseId]);

  const status = !item.sponsored
    ? undefined
    : !measured
      ? "disabled"
      : beacon.error
        ? "error"
        : beacon.viewable
          ? "viewable"
          : beacon.presented
            ? "presented"
            : "idle";

  return (
    <div
      ref={ref}
      data-testid={item.sponsored ? "sponsored-card" : "product-card"}
      data-offer-id={item.offerId ?? undefined}
      data-display-status={status}
      className={cx("flex gap-4 rounded-2xl border bg-white p-4", item.sponsored ? "border-emerald-200" : "border-stone-200")}
    >
      <ProductThumb category={item.category} brand={item.brand} />
      <div className="min-w-0 flex-1">
        {item.sponsored && (
          <span data-ad-disclosure className="inline-block rounded-lg bg-emerald-800 px-2.5 py-1 text-[12px] font-bold text-white">
            유료 {item.disclosureLabel ?? "광고"} · {item.brand}
          </span>
        )}
        <p className="mt-1.5 text-[17px] font-bold text-stone-900" data-evidence="product-name">
          {item.name}
        </p>
        <p className="tabular text-[15px] font-semibold text-stone-800">{formatWon(item.price)}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-stone-500">{item.reason || item.description}</p>
      </div>
    </div>
  );
}
