"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, CircleAlert, Clock, Plus } from "lucide-react";
import { api, formatDate, formatDateTime, formatWon } from "@/lib/client/api";
import { computeProgress, latestReport, type Step } from "@/lib/client/progress";
import type { CampaignDetail } from "@/lib/views";
import type { LedgerEntry } from "@/lib/ledger";
import type { Overview } from "@/lib/overview";
import { useCampaign } from "@/components/campaign-provider";
import { PageHeader } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { segmentsOf } from "@/components/results";
import { pageMeta, type PageKey } from "@/components/roles";
import { Badge, cx, Notice, TxLink } from "@/components/ui";

/**
 * 홈: 현재 광고 계약 하나를 기준으로
 *  ① 지금 어디까지 왔고 무엇을 해야 하는지 → ② 광고가 얼마나 보였는지 → ③ 몇 건이 정산되는지 → ④ 누가 무엇을 기록했는지
 * 를 위에서 아래로 한 번에 읽히게 보여 준다.
 */
export function HomeView() {
  const { campaigns, detail, loading, error } = useCampaign();
  const empty = !loading && campaigns?.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        page={pageMeta("home")}
        title="광고 계약 현황"
        description="지금 어디까지 진행됐는지, 광고가 얼마나 보였고 몇 건이 정산되는지 한눈에 봅니다."
        actions={
          !empty && (
            <Link
              href="/advertiser"
              className="flex h-11 items-center gap-2 rounded-xl bg-white px-4.5 text-[16px] font-semibold text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50"
            >
              <Plus size={18} />새 광고 등록
            </Link>
          )
        }
      />
      {error && <Notice tone="danger" title="불러오기 실패">{error}</Notice>}

      {empty ? (
        <Onboarding />
      ) : !detail ? (
        <p className="py-16 text-center text-[17px] text-stone-400">불러오는 중…</p>
      ) : (
        <>
          <StatusHero detail={detail} />
          <div className="grid gap-6 xl:grid-cols-2">
            <Exposure detail={detail} />
            <Settlement detail={detail} />
          </div>
          <Timeline campaignId={detail.campaign.id} refreshKey={detail} />
          {(campaigns?.length ?? 0) > 1 && <OtherContracts refreshKey={detail} />}
        </>
      )}
    </div>
  );
}

/* ───────────── 공통: 질문형 섹션 ───────────── */

function Section({ question, hint, action, children, testId }: { question: string; hint: string; action?: ReactNode; children: ReactNode; testId?: string }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6" data-testid={testId}>
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[21px] font-extrabold tracking-tight text-stone-900">{question}</h2>
          <p className="mt-1 text-[15.5px] text-stone-500">{hint}</p>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-1 text-[15.5px] font-semibold text-emerald-800 hover:underline">
      {children} <ArrowRight size={16} />
    </Link>
  );
}

/* ───────────── ① 지금 상황 ───────────── */

function StatusHero({ detail }: { detail: CampaignDetail }) {
  const { steps, next, summary } = computeProgress(detail);
  const campaign = detail.campaign;
  const offer = campaign.offers[0];
  const nextMeta = pageMeta(next.page);
  const NextIcon = nextMeta.icon;
  const finished = !next.task;
  const failed = summary.tone === "danger";

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      {/* 어떤 계약인지 */}
      <div className="flex flex-wrap items-center gap-4 border-b border-stone-100 px-6 py-5">
        {offer && <ProductThumb category={offer.category} brand={offer.brand} size="sm" />}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2.5">
            <span className="text-[24px] font-extrabold tracking-tight text-stone-900">{offer?.productName ?? campaign.name}</span>
            <Badge tone={summary.tone}>{summary.label}</Badge>
          </p>
          <p className="mt-0.5 text-[15.5px] text-stone-500">
            광고주 {campaign.advertiserName} · 매체 {campaign.publisherName} · 검증 {campaign.verifierName}
            {offer ? ` · ${formatWon(offer.price)}` : ""} · {formatDate(campaign.startAt)} ~ {formatDate(campaign.endAt)}
          </p>
        </div>
      </div>

      {/* 진행 단계 */}
      <div className="px-6 pb-2 pt-6">
        <Tracker steps={steps} />
      </div>

      {/* 지금 할 일 */}
      <div
        className={cx(
          "m-6 mt-5 flex flex-wrap items-center gap-5 rounded-2xl px-6 py-5",
          failed ? "bg-rose-50 ring-1 ring-rose-200" : finished ? "bg-stone-50 ring-1 ring-stone-200" : "bg-emerald-800 text-white",
        )}
        data-testid="next-action"
      >
        <span
          className={cx(
            "grid size-13 shrink-0 place-items-center rounded-2xl",
            failed ? "bg-white text-rose-600" : finished ? "bg-white text-emerald-700" : "bg-white/15 text-white",
          )}
        >
          {finished ? <Check size={26} strokeWidth={2.5} /> : failed ? <CircleAlert size={26} /> : <NextIcon size={26} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cx("text-[15px] font-semibold", failed ? "text-rose-700" : finished ? "text-stone-500" : "text-emerald-200")}>
            {finished ? "완료" : `지금 할 일 · ${nextMeta.label} 차례`}
          </p>
          <p className={cx("mt-0.5 text-[22px] font-extrabold tracking-tight", failed ? "text-rose-900" : finished ? "text-stone-900" : "text-white")}>{next.title}</p>
          <p className={cx("mt-0.5 text-[16px]", failed ? "text-rose-800" : finished ? "text-stone-600" : "text-emerald-100")}>{next.description}</p>
        </div>
        <Link
          href={next.href}
          className={cx(
            "flex h-13 shrink-0 items-center gap-2 rounded-xl px-6 text-[17px] font-bold",
            failed || finished ? "bg-emerald-800 text-white hover:bg-emerald-700" : "bg-white text-emerald-900 hover:bg-emerald-50",
          )}
        >
          {next.cta}
          <ArrowRight size={19} />
        </Link>
      </div>
    </section>
  );
}

/** 택배 배송 조회처럼 6단계를 가로로 보여 준다 */
function Tracker({ steps }: { steps: Step[] }) {
  return (
    <ol className="grid grid-cols-3 gap-y-6 lg:grid-cols-6" data-testid="steps">
      {steps.map((s, i) => {
        const meta = pageMeta(s.page);
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative px-1.5 text-center" data-step={s.key} data-status={s.status}>
            {!last && (
              <span
                aria-hidden
                className={cx("absolute left-1/2 top-5 h-1 w-full -translate-y-1/2 rounded-full", s.status === "done" ? "bg-emerald-500" : "bg-stone-200")}
              />
            )}
            <span
              className={cx(
                "relative mx-auto grid size-10 place-items-center rounded-full text-[16px] font-bold",
                s.status === "done"
                  ? "bg-emerald-600 text-white"
                  : s.status === "current"
                    ? "bg-white text-emerald-800 ring-4 ring-emerald-600"
                    : s.status === "failed"
                      ? "bg-rose-600 text-white"
                      : "bg-stone-200 text-stone-500",
              )}
            >
              {s.status === "done" ? <Check size={20} strokeWidth={3} /> : s.status === "failed" ? <CircleAlert size={20} /> : i + 1}
            </span>
            <p className={cx("mt-3 text-[16.5px] font-bold leading-snug", s.status === "todo" ? "text-stone-400" : "text-stone-900")}>{s.title}</p>
            <p className={cx("mt-0.5 text-[14.5px]", s.status === "current" ? "font-semibold text-emerald-700" : "text-stone-500")}>{meta.label}</p>
            <p className={cx("text-[14.5px]", s.status === "failed" ? "text-rose-600" : "text-stone-400")}>{s.note}</p>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────── ② 광고가 얼마나 보였나요? ───────────── */

function Exposure({ detail }: { detail: CampaignDetail }) {
  const c = detail.funnel.stageCounts;
  const max = Math.max(c.received, 1);
  const rate = c.recommended > 0 ? Math.round((c.presented / c.recommended) * 100) : null;
  const rows = [
    { key: "received", label: "광고를 받음", desc: "쇼핑 AI가 광고 정보를 전달받은 횟수", value: c.received, bar: "bg-stone-300" },
    { key: "recommended", label: "AI가 추천함", desc: "AI 답변에 광고 상품을 넣은 횟수", value: c.recommended, bar: "bg-emerald-300" },
    { key: "presented", label: "화면에 보임", desc: "소비자 화면에 광고 카드가 실제로 그려진 횟수", value: c.presented, bar: "bg-emerald-600", billing: true },
  ];

  return (
    <Section question="광고가 얼마나 보였나요?" hint="받은 광고 중 실제로 소비자 화면에 보인 것만 정산 대상입니다." testId="home-exposure">
      {c.received === 0 ? (
        <EmptyLine icon={<Clock size={22} />} title="아직 광고 기록이 없어요">
          소비자가 쇼핑 AI에 질문하면 ‘받음 → 추천 → 화면에 보임’ 기록이 쌓입니다.
        </EmptyLine>
      ) : (
        <>
          <ul className="space-y-5">
            {rows.map((r) => (
              <li key={r.key}>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-[17px] font-bold text-stone-900">
                    {r.label}
                    {r.billing && <span className="ml-2 rounded-md bg-emerald-700 px-2 py-0.5 align-middle text-[13px] font-bold text-white">정산 기준</span>}
                  </p>
                  <p className="tabular text-[30px] font-extrabold leading-none text-stone-900" data-testid={`home-funnel-${r.key}`}>
                    {r.value}
                    <span className="ml-1 text-[16px] font-bold text-stone-400">건</span>
                  </p>
                </div>
                <div className="mt-2 h-3.5 overflow-hidden rounded-full bg-stone-100">
                  <div className={cx("h-full rounded-full", r.bar)} style={{ width: `${(r.value / max) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-[14.5px] text-stone-500">{r.desc}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-xl bg-stone-50 px-4 py-3 text-[15.5px] text-stone-600">
            {rate === null ? "아직 AI가 추천한 광고가 없습니다." : `AI가 추천한 ${c.recommended}건 중 ${c.presented}건(${rate}%)이 실제로 화면에 보였습니다.`}
            {detail.unreported.eventCount > 0 && (
              <span className="block font-semibold text-emerald-800">아직 매체가 보고하지 않은 새 기록이 {detail.unreported.eventCount}건 있습니다.</span>
            )}
          </p>
        </>
      )}
    </Section>
  );
}

/* ───────────── ③ 몇 건이 정산되나요? ───────────── */

function Settlement({ detail }: { detail: CampaignDetail }) {
  const report = latestReport(detail);
  const v = report?.latestVerification ?? null;
  const result = v?.result ?? null;

  let body: ReactNode;
  if (!report) {
    body = (
      <EmptyLine icon={<Clock size={22} />} title="아직 매체가 실적을 보고하지 않았어요">
        매체가 보고하면 검증기관이 ‘화면에 보임’ 기록과 하나씩 대조해 인정할 건수를 정합니다.
      </EmptyLine>
    );
  } else if (report.status === "REJECTED") {
    body = (
      <EmptyLine icon={<CircleAlert size={22} />} title="증빙이 맞지 않아 반려됐어요" tone="danger">
        보고 후 기록이 바뀐 것이 확인됐습니다. 매체가 원본을 바로잡아 다시 보고해야 합니다.
      </EmptyLine>
    );
  } else if (!result || report.status === "SUBMITTED" || report.status === "PENDING_CHAIN") {
    body = (
      <EmptyLine icon={<Clock size={22} />} title={`매체가 ${report.reportedCount}건을 보고했어요`}>
        검증기관이 기록을 다시 세면 인정 건수가 나옵니다.
      </EmptyLine>
    );
  } else {
    const verified = report.onChainVerified ?? result.verifiedCount;
    const held = report.onChainHeld ?? result.heldCount;
    const segments = segmentsOf(result.units).filter((s) => s.group !== "valid");
    const stateText =
      report.status === "FINALIZED" ? "광고주가 최종 승인해 정산이 확정됐습니다." : report.status === "DISPUTED" ? "광고주가 이의를 제기했습니다." : "광고주의 최종 승인을 기다리고 있습니다.";
    body = (
      <>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <BigNumber label="매체가 보고" value={report.reportedCount} />
          <ArrowRight size={28} className="text-stone-300" />
          <BigNumber label="검증 후 인정" value={verified} tone="good" testId="settle-verified" />
          {held > 0 && <BigNumber label="보류 (기록 보완 필요)" value={held} tone="warn" />}
        </div>
        <p className={cx("mt-4 text-[16px] font-semibold", report.status === "FINALIZED" ? "text-emerald-700" : "text-stone-700")}>{stateText}</p>
        {segments.length > 0 && (
          <div className="mt-4 rounded-xl bg-stone-50 px-4 py-3">
            <p className="text-[15px] font-semibold text-stone-700">인정되지 않은 이유</p>
            <ul className="mt-1.5 space-y-1 text-[15.5px] text-stone-600">
              {segments.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className={cx("size-2.5 shrink-0 rounded-sm", s.color)} />
                  {s.label} <b className="tabular text-stone-900">{s.count}건</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  }

  return (
    <Section
      question="몇 건이 정산되나요?"
      hint="매체가 보고한 숫자를 검증기관이 계약 기준(화면에 보임)으로 다시 셉니다."
      action={report && <MoreLink href="/verifier">검증 자세히</MoreLink>}
      testId="home-settlement"
    >
      {body}
    </Section>
  );
}

function BigNumber({ label, value, tone, testId }: { label: string; value: number; tone?: "good" | "warn"; testId?: string }) {
  return (
    <div>
      <p className="text-[15.5px] font-semibold text-stone-500">{label}</p>
      <p
        className={cx(
          "tabular mt-1 text-[48px] font-extrabold leading-none tracking-tight",
          tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-600" : "text-stone-900",
        )}
        data-testid={testId}
      >
        {value}
        <span className="ml-1 text-[20px] font-bold text-stone-400">건</span>
      </p>
    </div>
  );
}

/* ───────────── ④ 누가 무엇을 기록했나요? ───────────── */

function Timeline({ campaignId, refreshKey }: { campaignId: string; refreshKey: unknown }) {
  const [entries, setEntries] = useState<LedgerEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ entries: LedgerEntry[] }>(`/api/campaigns/${campaignId}/ledger`)
      .then((r) => alive && setEntries(r.entries))
      .catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [campaignId, refreshKey]);

  return (
    <Section
      question="누가 무엇을 기록했나요?"
      hint="계약부터 승인까지, 각 역할이 자기 지갑으로 서명한 기록이 블록체인에 남습니다."
      action={<MoreLink href="/ledger">블록체인 기록 전체</MoreLink>}
    >
      {entries === null ? (
        <p className="py-4 text-[16px] text-stone-400">불러오는 중…</p>
      ) : entries.length === 0 ? (
        <EmptyLine icon={<Clock size={22} />} title="아직 블록체인 기록이 없어요">
          광고주가 계약을 제안하면 첫 기록이 남습니다.
        </EmptyLine>
      ) : (
        <ol className="space-y-1" data-testid="timeline">
          {[...entries].reverse().map((e, i, arr) => {
            const meta = pageMeta(e.role as PageKey);
            const Icon = meta.icon;
            return (
              <li key={e.key} className="relative flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-stone-50">
                {i < arr.length - 1 && <span aria-hidden className="absolute left-[29px] top-12 h-[calc(100%-1.5rem)] w-0.5 bg-stone-200" />}
                <span className={cx("relative grid size-11 shrink-0 place-items-center rounded-full", i === 0 ? "bg-emerald-700 text-white" : "bg-stone-100 text-stone-600")}>
                  <Icon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] font-bold text-stone-900">{e.title}</p>
                  <p className="text-[15px] text-stone-500">
                    {meta.label} 지갑 서명 · {formatDateTime(e.timestamp)}
                  </p>
                </div>
                <div className="hidden shrink-0 text-right sm:block">
                  <p className="text-[14px] text-stone-400">블록 #{e.blockNumber ?? "-"}</p>
                  <TxLink hash={e.txHash} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

/* ───────────── 다른 계약 (2개 이상일 때만) ───────────── */

function OtherContracts({ refreshKey }: { refreshKey: unknown }) {
  const { currentId, select } = useCampaign();
  const [overview, setOverview] = useState<Overview | null>(null);
  useEffect(() => {
    let alive = true;
    api<Overview>("/api/overview")
      .then((o) => alive && setOverview(o))
      .catch(() => alive && setOverview(null));
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return (
    <Section question="다른 광고 계약" hint="누르면 위 화면이 그 계약 기준으로 바뀝니다.">
      <ul className="divide-y divide-stone-100" data-testid="campaign-list">
        {(overview?.campaigns ?? []).map((c) => {
          const { summary } = computeProgress(c);
          const offer = c.campaign.offers[0];
          const selected = c.campaign.id === currentId;
          return (
            <li key={c.campaign.id}>
              <button
                type="button"
                onClick={() => select(c.campaign.id)}
                className={cx("flex w-full items-center gap-4 rounded-xl px-3 py-3 text-left", selected ? "bg-emerald-50" : "hover:bg-stone-50")}
              >
                {offer && <ProductThumb category={offer.category} brand={offer.brand} size="sm" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-bold text-stone-900">{offer?.productName ?? c.campaign.name}</p>
                  <p className="text-[15px] text-stone-500">
                    화면에 보임 {c.funnel.stageCounts.presented}건 · 정산 확정 {c.confirmedCount}건
                  </p>
                </div>
                <Badge tone={summary.tone}>{summary.label}</Badge>
                {selected && <span className="text-[14px] font-semibold text-emerald-700">보는 중</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ───────────── 첫 방문 ───────────── */

function Onboarding() {
  const flow = [
    { icon: pageMeta("advertiser").icon, who: "광고주", title: "광고를 등록하고 계약을 제안", body: "어떤 상품을, 어떤 기준(소비자 화면에 보인 건)으로 정산할지 정해 블록체인에 올립니다." },
    { icon: pageMeta("publisher").icon, who: "광고 매체", title: "같은 조건으로 수락하고 AI에 광고 집행", body: "쇼핑 AI 운영사가 수락하면, AI가 답변할 때 이 광고를 추천할 수 있습니다." },
    { icon: pageMeta("verifier").icon, who: "검증기관 · 광고주", title: "화면에 보인 건만 검증하고 승인", body: "매체가 보고한 숫자를 기록과 대조해 인정 건수를 정하고, 광고주가 최종 승인합니다." },
  ];
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-8">
      <p className="text-[15px] font-bold text-emerald-700">시작하기</p>
      <h2 className="mt-1 text-[30px] font-extrabold tracking-tight text-stone-900">아직 광고 계약이 없어요</h2>
      <p className="mt-2 max-w-3xl text-[17px] leading-relaxed text-stone-600">
        AgentAd Trust는 쇼핑 AI가 <b className="text-stone-900">실제로 소비자 화면에 보여 준 광고만</b> 정산합니다. 계약 · 보고 · 검증 · 승인은 모두 블록체인에 남아 누구도
        혼자 바꿀 수 없습니다.
      </p>
      <ol className="mt-7 grid gap-4 lg:grid-cols-3">
        {flow.map((f, i) => {
          const Icon = f.icon;
          return (
            <li key={f.title} className="rounded-2xl bg-stone-50 p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-emerald-700 text-[17px] font-bold text-white">{i + 1}</span>
                <span className="flex items-center gap-1.5 text-[15px] font-semibold text-stone-500">
                  <Icon size={17} />
                  {f.who}
                </span>
              </div>
              <p className="mt-4 text-[19px] font-bold text-stone-900">{f.title}</p>
              <p className="mt-1.5 text-[15.5px] leading-relaxed text-stone-500">{f.body}</p>
            </li>
          );
        })}
      </ol>
      <Link
        href="/advertiser"
        className="mt-7 inline-flex h-13 items-center gap-2 rounded-xl bg-emerald-800 px-6 text-[18px] font-bold text-white hover:bg-emerald-700"
        data-testid="start-first"
      >
        첫 광고 등록하러 가기 <ArrowRight size={20} />
      </Link>
    </section>
  );
}

function EmptyLine({ icon, title, children, tone }: { icon: ReactNode; title: string; children: ReactNode; tone?: "danger" }) {
  return (
    <div className={cx("flex items-start gap-4 rounded-xl px-4 py-4", tone === "danger" ? "bg-rose-50" : "bg-stone-50")}>
      <span className={cx("grid size-11 shrink-0 place-items-center rounded-full bg-white", tone === "danger" ? "text-rose-600" : "text-stone-400")}>{icon}</span>
      <div>
        <p className={cx("text-[18px] font-bold", tone === "danger" ? "text-rose-900" : "text-stone-800")}>{title}</p>
        <p className={cx("mt-0.5 text-[15.5px] leading-relaxed", tone === "danger" ? "text-rose-800" : "text-stone-500")}>{children}</p>
      </div>
    </div>
  );
}
