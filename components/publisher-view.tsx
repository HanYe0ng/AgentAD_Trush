"use client";

import { useState, type ReactNode } from "react";
import { Bot, Handshake, Inbox, Send } from "lucide-react";
import { api, formatDate, formatDateTime, formatWon } from "@/lib/client/api";
import { REPORT_STATUS_LABEL, type ReportStatus } from "@/lib/blockchain/shared";
import type { ReportView } from "@/lib/views";
import { useChain } from "@/components/chain-provider";
import { useCampaign } from "@/components/campaign-provider";
import { PageHeader } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { pageMeta } from "@/components/roles";
import { Badge, Button, Card, Empty, HashText, inputClass, Notice, TxLink, type Tone } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { acceptCampaignOnChain, submitReportOnChain } from "@/components/chain-actions";

const STATUS_TONE: Record<ReportStatus, Tone> = {
  PENDING_CHAIN: "warning",
  SUBMITTED: "info",
  VERIFIED: "info",
  REJECTED: "danger",
  DISPUTED: "warning",
  FINALIZED: "success",
};

export function PublisherView() {
  return (
    <div>
      <PageHeader page={pageMeta("publisher")} title="광고 매체 (쇼핑 AI 운영사)" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ContractInbox />
        <ReportCard />
      </div>
    </div>
  );
}

function ContractInbox() {
  const { config, ready, signerFor } = useChain();
  const { campaigns, refresh } = useCampaign();
  const action = useAction();
  const pending = (campaigns ?? []).filter((c) => c.chainStatus === "PROPOSED");
  const active = (campaigns ?? []).filter((c) => c.chainStatus === "ACTIVE");

  return (
    <Card icon={<Handshake size={18} />} title="계약 수락" subtitle="광고주가 제안한 계약 조건을 확인하고, 같은 조건 해시로 수락하면 계약이 확정됩니다.">
      <div className="space-y-3">
        {action.view}
        {pending.length === 0 && <Empty icon={<Handshake size={22} />} title="수락할 계약이 없습니다">광고주가 계약을 제안하면 여기에 나타납니다.</Empty>}
        {pending.map((c) => {
          const offer = c.offers[0];
          return (
            <div key={c.id} className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-4" data-testid={`proposal-${c.id}`}>
              <div className="flex gap-3">
                <ProductThumb category={offer?.category ?? ""} brand={offer?.brand ?? ""} size="sm" />
                <div className="min-w-0">
                  <p className="text-[17px] font-bold text-stone-900">{offer?.productName}</p>
                  <p className="text-[14.5px] text-stone-500">
                    광고주 {c.advertiserName} · {offer ? formatWon(offer.price) : ""} · {formatDate(c.startAt)} ~ {formatDate(c.endAt)}
                  </p>
                </div>
              </div>
              <dl className="mt-3 grid gap-1.5 rounded-lg bg-white p-3 text-[14.5px]">
                <Term label="정산 기준" value="소비자 화면에 표시된 건만 인정" />
                <Term label="중복 처리" value="같은 AI 답변 안의 반복은 1건" />
                <Term label="증빙" value="수신·추천 기록 + 화면 표시 기록" />
                <Term label="표시 기록 없음" value="검증 불가 → 정산 보류" />
                <Term label="계약 조건 해시" value={<HashText value={c.termsHash} />} />
              </dl>
              <Button
                className="mt-3 w-full"
                disabled={!ready}
                loading={action.busy === c.id}
                data-testid="accept-contract"
                onClick={() =>
                  action.run(
                    c.id,
                    async () => {
                      await acceptCampaignOnChain(config!, signerFor("publisher"), c);
                      return { tone: "success", title: "계약을 수락했습니다. 이제 쇼핑 AI가 이 광고를 받을 수 있습니다." };
                    },
                    () => refresh(c.id),
                  )
                }
              >
                같은 조건으로 수락 (매체 서명)
              </Button>
            </div>
          );
        })}
        {active.length > 0 && (
          <div className="pt-2">
            <p className="mb-2 text-[14.5px] font-semibold text-stone-500">확정된 계약</p>
            <ul className="space-y-1.5">
              {active.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-lg bg-stone-50 px-3 py-2 text-[15px]">
                  <span className="font-semibold text-stone-800">{c.offers[0]?.productName}</span>
                  <span className="flex items-center gap-2 text-stone-500">
                    <Badge tone="success">확정</Badge>
                    <TxLink hash={c.acceptTxHash} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function ReportCard() {
  const { config, ready, signerFor } = useChain();
  const { detail, refresh } = useCampaign();
  const action = useAction();
  const [count, setCount] = useState<number | null>(null);

  if (!detail) {
    return (
      <Card icon={<Send size={18} />} title="광고 실적 보고">
        <Empty title="현재 캠페인이 없습니다">광고주가 광고를 등록하면 보고할 수 있습니다.</Empty>
      </Card>
    );
  }
  const c = detail.campaign;
  const unreported = detail.unreported;
  const suggested = unreported.stageCounts.received;
  const value = count ?? suggested;
  const inProgress = detail.reports.find((r) => r.status === "SUBMITTED" || r.status === "VERIFIED");

  return (
    <Card icon={<Send size={18} />} title="광고 실적 보고" subtitle={`${c.offers[0]?.productName ?? c.name} · 보고 실적과 증빙 지문을 블록체인에 제출합니다.`}>
      <div className="space-y-4">
        {c.chainStatus !== "ACTIVE" && <Notice tone="warning">계약을 먼저 수락해야 실적을 보고할 수 있습니다.</Notice>}
        <div className="rounded-xl bg-stone-50 p-4">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-stone-700">
            <Bot size={16} className="text-emerald-700" /> 우리 쇼핑 AI의 자체 집계
          </p>
          <p className="mt-1 text-[14.5px] text-stone-500">매체는 AI가 광고 정보를 받은 횟수를 ‘노출’로 세어 보고합니다.</p>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div>
              <p className="flex items-center gap-1 text-[14px] text-stone-500">
                <Inbox size={13} /> AI가 광고를 받은 횟수 (미보고분)
              </p>
              <p className="tabular text-[38px] font-extrabold leading-none text-stone-900" data-testid="received-count">
                {suggested}
                <span className="ml-1 text-[17px] text-stone-400">건</span>
              </p>
            </div>
            <p className="text-[14px] text-stone-400">
              {formatDateTime(unreported.periodStart)} 이후 기록 {unreported.eventCount}건
            </p>
          </div>
        </div>

        <label className="block">
          <span className="text-[15px] font-medium text-stone-700">보고할 실적 (건)</span>
          <input
            type="number"
            min={0}
            className={inputClass + " mt-1.5"}
            value={value}
            onChange={(e) => setCount(Number(e.target.value))}
            data-testid="reported-input"
          />
        </label>

        {inProgress && <Notice tone="info">{inProgress.id} 보고서가 검증·승인 진행 중입니다. 끝난 뒤 새로 보고할 수 있습니다.</Notice>}
        {action.view}
        <Button
          size="lg"
          className="w-full"
          disabled={!ready || !!inProgress || unreported.eventCount === 0 || c.chainStatus !== "ACTIVE"}
          loading={action.busy === "report"}
          data-testid="submit-report"
          onClick={() =>
            action.run(
              "report",
              async () => {
                const { report } = await api<{ report: ReportView }>("/api/reports/submit", {
                  body: { campaignId: c.id, reportedCount: value, reportedBasis: "매체 자체 집계 (광고 수신 기준)" },
                });
                await submitReportOnChain(config!, signerFor("publisher"), report);
                setCount(null);
                return { tone: "success", title: `실적 ${report.reportedCount}건과 증빙 지문을 블록체인에 제출했습니다.`, body: "이제 검증기관이 기록을 다시 세어 검증합니다." };
              },
              () => refresh(),
            )
          }
        >
          실적 보고 (매체 서명)
        </Button>

        {detail.reports.length > 0 && (
          <div>
            <p className="mb-2 text-[14.5px] font-semibold text-stone-500">보고 내역</p>
            <ul className="space-y-1.5" data-testid="report-list">
              {detail.reports.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-[15px]" data-status={r.status}>
                  <span className="font-mono text-[14px] text-stone-700">{r.id}</span>
                  <span className="text-stone-600">보고 {r.reportedCount}건</span>
                  <Badge tone={STATUS_TONE[r.status]}>{REPORT_STATUS_LABEL[r.status]}</Badge>
                  <TxLink hash={r.submitTxHash} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function Term({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right font-medium text-stone-800">{value}</dd>
    </div>
  );
}
