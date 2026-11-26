"use client";

import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Clock } from "lucide-react";
import { formatDate, formatWon } from "@/lib/client/api";
import { computeProgress, latestReport, type Step } from "@/lib/client/progress";
import { CAMPAIGN_STATUS_LABEL, REPORT_STATUS_LABEL } from "@/lib/blockchain/shared";
import { useCampaign } from "@/components/campaign-provider";
import { PageHeader } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { Funnel, SettlementResult } from "@/components/results";
import { PAGES, pageMeta } from "@/components/roles";
import { Badge, Card, cx, Empty, Notice } from "@/components/ui";

export function HomeView() {
  const { detail, loading, error } = useCampaign();
  const { steps, next } = computeProgress(detail);
  const report = latestReport(detail);
  const result = report?.latestVerification?.result ?? null;
  const NextIcon = pageMeta(next.page).icon;
  const campaign = detail?.campaign;
  const offer = campaign?.offers[0];

  return (
    <div className="space-y-6">
      <PageHeader page={pageMeta("home")} title="시연 진행판" description="광고 1건이 등록부터 블록체인 확정까지 어떻게 흘러가는지 한눈에 봅니다." />
      {error && <Notice tone="danger" title="불러오기 실패">{error}</Notice>}

      {/* 지금 할 일 */}
      <section className="flex flex-wrap items-center gap-5 rounded-2xl bg-emerald-800 px-6 py-5 text-white" data-testid="next-action">
        <span className="grid size-12 place-items-center rounded-2xl bg-white/15">
          <NextIcon size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-emerald-200">지금 할 일</p>
          <p className="text-[19px] font-bold">{loading ? "불러오는 중…" : next.title}</p>
          <p className="text-[13.5px] text-emerald-100">{next.description}</p>
        </div>
        <Link
          href={next.href}
          className="flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[14px] font-bold text-emerald-900 hover:bg-emerald-50"
        >
          {next.cta}
          <ArrowRight size={17} />
        </Link>
      </section>

      {/* 진행 단계 */}
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" data-testid="steps">
        {steps.map((s, i) => (
          <StepCard key={s.key} step={s} index={i + 1} />
        ))}
      </ol>

      {!campaign && !loading ? (
        <Card>
          <Empty title="아직 등록된 광고가 없습니다">광고주 화면에서 첫 광고 상품을 등록하면 시연이 시작됩니다.</Empty>
        </Card>
      ) : (
        campaign && (
          <>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
              <Card title="현재 광고 계약" subtitle="모든 역할 화면이 이 캠페인을 기준으로 동작합니다.">
                <div className="flex gap-4">
                  {offer && <ProductThumb category={offer.category} brand={offer.brand} />}
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-[18px] font-bold text-stone-900">{offer?.productName ?? campaign.name}</p>
                    <p className="text-[14px] text-stone-600">
                      {campaign.advertiserName} · {offer ? formatWon(offer.price) : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={campaign.chainStatus === "ACTIVE" ? "success" : "warning"}>{CAMPAIGN_STATUS_LABEL[campaign.chainStatus]}</Badge>
                      <Badge>정산 기준 · 소비자 화면 표시</Badge>
                    </div>
                    <p className="text-[12.5px] text-stone-400">
                      {formatDate(campaign.startAt)} ~ {formatDate(campaign.endAt)} · 매체 {campaign.publisherName} · 검증 {campaign.verifierName}
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <p className="mb-2 text-[13px] font-semibold text-stone-700">지금까지 쌓인 광고 기록</p>
                  <Funnel counts={detail!.funnel.stageCounts} compact />
                </div>
              </Card>

              <Card
                title="정산 결과"
                subtitle={report ? `${report.id} · ${REPORT_STATUS_LABEL[report.status]}` : "매체 보고와 검증이 끝나면 여기에 표시됩니다."}
              >
                {result ? (
                  <SettlementResult result={result} />
                ) : (
                  <Empty icon={<Clock size={22} />} title={report ? "검증 대기 중" : "보고 전"}>
                    {report ? `매체가 ${report.reportedCount}건을 보고했습니다. 검증기관이 검증하면 결과가 나옵니다.` : "광고 매체가 실적을 보고하면 검증할 수 있습니다."}
                  </Empty>
                )}
              </Card>
            </div>
          </>
        )
      )}

      {/* 역할 바로가기 */}
      <div>
        <p className="mb-3 text-[15px] font-bold text-stone-800">역할별 화면</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {PAGES.filter((p) => p.key !== "home").map((p) => {
            const Icon = p.icon;
            const todo = p.key === next.page;
            return (
              <Link
                key={p.key}
                href={p.href}
                className={cx(
                  "group relative rounded-2xl border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-sm",
                  todo ? "border-emerald-400 ring-2 ring-emerald-100" : "border-stone-200",
                )}
              >
                {todo && <span className="absolute right-3 top-3 rounded-md bg-emerald-700 px-1.5 py-0.5 text-[11px] font-bold text-white">할 차례</span>}
                <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                  <Icon size={20} />
                </span>
                <p className="mt-3 text-[15px] font-bold text-stone-900">{p.label}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-stone-500">{p.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const meta = pageMeta(step.page);
  const Icon = meta.icon;
  const tone =
    step.status === "done"
      ? "border-emerald-200 bg-white"
      : step.status === "current"
        ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100"
        : step.status === "failed"
          ? "border-rose-200 bg-rose-50"
          : "border-stone-200 bg-white/60";
  return (
    <li className={cx("rounded-2xl border p-4", tone)} data-step={step.key} data-status={step.status}>
      <div className="flex items-center justify-between">
        <span
          className={cx(
            "grid size-7 place-items-center rounded-full text-[13px] font-bold",
            step.status === "done"
              ? "bg-emerald-600 text-white"
              : step.status === "current"
                ? "bg-emerald-800 text-white"
                : step.status === "failed"
                  ? "bg-rose-600 text-white"
                  : "bg-stone-200 text-stone-500",
          )}
        >
          {step.status === "done" ? <Check size={15} strokeWidth={3} /> : step.status === "failed" ? <CircleAlert size={15} /> : index}
        </span>
        <span className="flex items-center gap-1 text-[11.5px] font-semibold text-stone-500">
          <Icon size={13} />
          {meta.label}
        </span>
      </div>
      <p className={cx("mt-3 text-[14.5px] font-bold", step.status === "todo" ? "text-stone-400" : "text-stone-900")}>{step.title}</p>
      <p className="mt-0.5 text-[12px] text-stone-500">{step.note}</p>
      {step.status === "current" && (
        <Link href={step.href} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-emerald-800 hover:underline">
          이동 <ArrowRight size={13} />
        </Link>
      )}
    </li>
  );
}
