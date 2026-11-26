"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Eye, EyeOff, Inbox, Bot, Send, Sparkles, X, CircleHelp } from "lucide-react";
import { api } from "@/lib/client/api";
import { SCENARIO_DESCRIPTION, SCENARIO_LABEL, SCENARIOS, type Scenario, type ShoppingResult } from "@/lib/ai/scenarios";
import type { StoredAdEvent } from "@/lib/events/spec";
import { useCampaign } from "@/components/campaign-provider";
import { Logo, PageHeader } from "@/components/app-shell";
import { ProductCard } from "@/components/shopping/product-card";
import { pageMeta } from "@/components/roles";
import { Badge, Button, Card, cx, Notice } from "@/components/ui";
import { useAction } from "@/components/use-action";

interface Turn {
  id: number;
  query: string;
  scenario: Scenario;
  result?: ShoppingResult;
  error?: string;
}

const SUGGESTIONS = [
  { q: "3만 원 이하로 출근할 때 쓸 텀블러 추천해 줘", hint: "광고 상품이 추천·표시되는 경우" },
  { q: "2만 원 이하 텀블러 추천해 줘", hint: "예산 때문에 광고를 받고도 추천하지 않는 경우" },
  { q: "가벼운 러닝화 추천해 줘", hint: "광고 계약과 관계없는 질문" },
];

export function ConsumerView() {
  const { detail, refresh } = useCampaign();
  const [query, setQuery] = useState("");
  const [scenario, setScenario] = useState<Scenario>("LIVE");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Record<string, StoredAdEvent[]>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fixture = useAction();

  const loadEvents = useCallback(async (runId: string) => {
    const data = await api<{ events: StoredAdEvent[] }>(`/api/events?runId=${encodeURIComponent(runId)}`);
    setEvents((prev) => ({ ...prev, [runId]: data.events }));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || loading) return;
    const id = Date.now();
    setTurns((t) => [...t, { id, query: q, scenario }]);
    setQuery("");
    setLoading(true);
    try {
      const result = await api<ShoppingResult>("/api/chat", { body: { query: q, scenario } });
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, result } : turn)));
      // 소비자 화면이 응답을 렌더링하면서 그리지 못한 스폰서 카드 → 미표시 보고
      for (const item of result.items.filter((i) => i.clientBehavior === "SUPPRESS" && i.displayToken)) {
        await api("/api/events/display", {
          body: {
            eventType: "AD_NOT_PRESENTED",
            responseId: result.responseId,
            offerId: item.offerId,
            displayToken: item.displayToken,
            evidence: { reason: "RENDER_FAILED", clientRenderedAt: new Date().toISOString() },
          },
        });
      }
      await loadEvents(result.runId);
      void refresh();
    } catch (err) {
      setTurns((t) => t.map((turn) => (turn.id === id ? { ...turn, error: (err as Error).message } : turn)));
    } finally {
      setLoading(false);
    }
  }

  const runs = turns.filter((t) => t.result).map((t) => t.result!);

  return (
    <div>
      <PageHeader page={pageMeta("consumer")} title="쇼핑 AI" description="소비자가 보는 쇼핑 AI 화면입니다. 오른쪽은 발표용 시연 패널입니다." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* 소비자 화면 */}
        <div className="flex min-h-[560px] flex-col self-start rounded-2xl border border-stone-200 bg-white xl:sticky xl:top-24 xl:h-[calc(100vh/var(--app-zoom)_-_15rem)] xl:min-h-[480px]">
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            {turns.length === 0 && (
              <div className="py-14 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50">
                  <Logo />
                </span>
                <p className="mt-3 text-[19px] font-bold text-stone-800">무엇을 찾고 계신가요?</p>
                <p className="mt-1 text-[15.5px] text-stone-500">예산이나 용도를 함께 말하면 더 잘 골라 드려요.</p>
              </div>
            )}
            {turns.map((turn) => (
              <div key={turn.id} className="space-y-3" data-testid="chat-turn">
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-emerald-100 px-4 py-3 text-[17px] text-emerald-950">{turn.query}</div>
                </div>
                {!turn.result && !turn.error && <p className="pl-14 text-[15px] text-stone-400">상품을 고르는 중…</p>}
                {turn.error && <Notice tone="danger" title="추천 실패">{turn.error}</Notice>}
                {turn.result && (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-50">
                        <Logo />
                      </span>
                      <div className="rounded-2xl rounded-tl-md bg-stone-100 px-4 py-3 text-[17px] text-stone-800">{turn.result.answer}</div>
                    </div>
                    <div className="grid gap-3 pl-[52px] lg:grid-cols-2">
                      {turn.result.items
                        .filter((item) => item.clientBehavior !== "SUPPRESS")
                        .map((item) => (
                          <ProductCard key={item.itemId} item={item} responseId={turn.result!.responseId} onEvent={() => void loadEvents(turn.result!.runId)} />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <form
            className="flex gap-2 border-t border-stone-100 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(query);
            }}
          >
            <input
              className="h-12 flex-1 rounded-xl border border-stone-300 px-4 text-[17px] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              placeholder="쇼핑 질문을 입력하세요"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="질문"
            />
            <Button type="submit" size="lg" loading={loading} data-testid="ask" aria-label="보내기">
              <Send size={18} />
            </Button>
          </form>
        </div>

        {/* 시연 패널 */}
        <div className="space-y-4">
          <Card title="시연 조건" subtitle="소비자 화면이 어떻게 동작할지 고릅니다.">
            <div className="grid gap-2" role="radiogroup" aria-label="시연 조건">
              {SCENARIOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scenario === s}
                  data-testid={`scenario-${s}`}
                  onClick={() => setScenario(s)}
                  className={cx(
                    "rounded-xl border px-3 py-2.5 text-left",
                    scenario === s ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100" : "border-stone-200 hover:border-stone-300",
                  )}
                >
                  <span className="text-[16px] font-bold text-stone-900">{SCENARIO_LABEL[s]}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-stone-500">{SCENARIO_DESCRIPTION[s]}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="추천 질문">
            <div className="space-y-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.q}
                  type="button"
                  onClick={() => void ask(s.q)}
                  disabled={loading}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-left hover:border-emerald-300 hover:bg-emerald-50/40"
                >
                  <span className="block text-[15.5px] font-semibold text-stone-800">“{s.q}”</span>
                  <span className="text-[13.5px] text-stone-400">{s.hint}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card title="광고 기록" subtitle="소비자에게는 보이지 않는, 이번 대화에서 남은 기록입니다.">
            {detail?.campaign.chainStatus !== "ACTIVE" && (
              <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2.5 text-[14.5px] font-semibold text-amber-900" data-testid="no-contract-hint">
                아직 확정된 광고 계약이 없어 질문해도 광고가 전달되지 않습니다. 광고주 등록 → 매체 수락을 먼저 진행하세요.
              </p>
            )}
            {runs.length === 0 ? (
              <p className="text-[15px] text-stone-400">질문하면 수신 → 추천 → 표시 기록이 여기에 쌓입니다.</p>
            ) : (
              <div className="space-y-3">
                {[...runs].reverse().map((run) => (
                  <RunTrace key={run.runId} run={run} events={events[run.runId] ?? []} contractActive={detail?.campaign.chainStatus === "ACTIVE"} />
                ))}
              </div>
            )}
            {detail && detail.unreported.eventCount > 0 && (
              <Link
                href="/publisher"
                className="mt-3 flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 text-[14.5px] font-semibold text-emerald-900 hover:bg-emerald-100"
                data-testid="unreported-hint"
              >
                <span>
                  아직 보고되지 않은 기록 {detail.unreported.eventCount}건 · 광고 수신 {detail.unreported.stageCounts.received}회
                </span>
                <span>광고 매체 화면에서 보고 →</span>
              </Link>
            )}
          </Card>

          <Card title="예시 데이터" subtitle="발표 예시(수신 5 · 추천 3 · 표시 2)를 시연 데이터로 한 번에 만듭니다.">
            {fixture.view}
            <Button
              variant="secondary"
              className="w-full"
              disabled={detail?.campaign.chainStatus !== "ACTIVE"}
              loading={fixture.busy === "fixture"}
              data-testid="create-fixture"
              onClick={() =>
                fixture.run(
                  "fixture",
                  async () => {
                    await api("/api/test/scenario", { body: { campaignId: detail!.campaign.id } });
                    return { tone: "success", title: "예시 대화 5건을 만들었습니다." };
                  },
                  () => refresh(),
                )
              }
            >
              <Sparkles size={16} /> 예시 대화 5건 만들기
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RunTrace({ run, events, contractActive }: { run: ShoppingResult; events: StoredAdEvent[]; contractActive: boolean }) {
  const has = (type: string) => events.find((e) => e.eventType === type);
  const received = has("AD_RECEIVED");
  const recommended = has("AD_RECOMMENDED");
  const presented = has("AD_PRESENTED");
  const notPresented = has("AD_NOT_PRESENTED");
  const viewable = has("AD_VIEWABLE");

  return (
    <div className="rounded-xl border border-stone-200 p-3" data-testid={`run-events-${run.runId}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[15px] font-semibold text-stone-800">“{run.query}”</p>
        {run.dataMode === "TEST" && <Badge tone="test">시연</Badge>}
      </div>
      {run.receivedOffers.length === 0 ? (
        <p className="mt-1.5 text-[14px] text-stone-400">
          {contractActive ? "전달된 광고 없음 (계약된 광고와 관계없는 질문)" : "전달된 광고 없음 (확정된 광고 계약 없음)"}
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-[14.5px]">
          <Trace ok={!!received} icon={Inbox} label="광고 수신" id={received?.offerId} type="AD_RECEIVED" />
          <Trace ok={!!recommended} icon={Bot} label={recommended ? "유료 추천" : run.budget ? "추천 안 함 (예산 초과)" : "추천 안 함"} id={recommended?.responseId} type="AD_RECOMMENDED" />
          {recommended && (
            <Trace
              ok={presented ? true : notPresented ? false : null}
              icon={presented ? Eye : EyeOff}
              label={presented ? "화면 표시" : notPresented ? "화면 미표시 보고" : "표시 기록 없음"}
              id={(presented ?? notPresented)?.eventId}
              type={presented ? "AD_PRESENTED" : notPresented ? "AD_NOT_PRESENTED" : "NONE"}
            />
          )}
          {viewable && <Trace ok icon={Eye} label="가시성 충족 (50%·1초, 보조)" id={viewable.eventId} type="AD_VIEWABLE" />}
        </ul>
      )}
    </div>
  );
}

function Trace({
  ok,
  icon: Icon,
  label,
  id,
  type,
}: {
  ok: boolean | null;
  icon: typeof Inbox;
  label: string;
  id?: string | null;
  type: string;
}) {
  return (
    <li className="flex items-center gap-2" data-testid="event-row" data-event-type={type}>
      <span
        className={cx(
          "grid size-5 place-items-center rounded-full",
          ok === true ? "bg-emerald-600 text-white" : ok === false ? "bg-stone-300 text-white" : "bg-amber-400 text-white",
        )}
      >
        {ok === true ? <Check size={12} strokeWidth={3} /> : ok === false ? <X size={12} strokeWidth={3} /> : <CircleHelp size={12} />}
      </span>
      <Icon size={14} className="text-stone-400" />
      <span className="text-stone-700">{label}</span>
      {id && <span className="ml-auto font-mono text-[13px] text-stone-400">{id}</span>}
    </li>
  );
}
