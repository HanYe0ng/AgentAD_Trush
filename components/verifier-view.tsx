"use client";
import type { ReactNode } from "react";

import { Check, CircleHelp, Fingerprint, Minus, Play, ScanSearch, ShieldAlert, X } from "lucide-react";
import { api, formatDateTime } from "@/lib/client/api";
import { latestReport } from "@/lib/client/progress";
import { REPORT_STATUS_LABEL } from "@/lib/blockchain/shared";
import { shortHash } from "@/lib/core/canonical";
import type { UnitResult, VerificationResult } from "@/lib/verification/engine";
import type { CampaignDetail } from "@/lib/views";
import { useChain } from "@/components/chain-provider";
import { useCampaign } from "@/components/campaign-provider";
import { PageHeader } from "@/components/app-shell";
import { REASON_PLAIN, SettlementResult } from "@/components/results";
import { pageMeta } from "@/components/roles";
import { Badge, Button, Card, cx, Empty, TxLink } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { verifyReportOnChain } from "@/components/chain-actions";

export function VerifierView() {
  const { config, ready, signerFor } = useChain();
  const { detail, refresh } = useCampaign();
  const action = useAction();
  const demo = useAction();
  const report = latestReport(detail);
  const v = report?.latestVerification ?? null;
  const result = v?.result ?? null;

  if (!report || report.status === "PENDING_CHAIN") {
    return (
      <div>
        <PageHeader page={pageMeta("verifier")} title="광고 표시 검증" />
        <Card>
          <Empty icon={<ScanSearch size={22} />} title="검증할 보고서가 없습니다">
            광고 매체가 실적을 보고하면, 그 기록을 계약 기준으로 다시 세어 검증합니다.
          </Empty>
        </Card>
      </div>
    );
  }

  const canVerify = report.status === "SUBMITTED";

  return (
    <div className="space-y-6">
      <PageHeader page={pageMeta("verifier")} title="광고 표시 검증" description="매체가 보고한 숫자를 믿지 않고, 원본 기록을 계약 기준(소비자 화면 표시)으로 다시 셉니다." />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 px-6 py-5">
          <Info label="검증 대상 보고서" value={<span className="font-mono">{report.id}</span>} />
          <Info label="매체 보고" value={`${report.reportedCount}건`} />
          <Info label="보고 기간" value={`${formatDateTime(report.periodStart)} ~ ${formatDateTime(report.periodEnd)}`} />
          <Info label="제출 트랜잭션" value={<TxLink hash={report.submitTxHash} />} />
          <Info label="상태" value={<Badge tone={report.status === "REJECTED" ? "danger" : "success"}>{REPORT_STATUS_LABEL[report.status]}</Badge>} />
          <div className="ml-auto flex gap-2">
            {canVerify && (
              <Button
                variant={v ? "secondary" : "primary"}
                loading={action.busy === "verify"}
                data-testid="run-verification"
                onClick={() =>
                  action.run(
                    "verify",
                    async () => {
                      const res = await api<{ result: VerificationResult }>("/api/reports/verify", { body: { reportId: report.id } });
                      return res.result.integrity.intact
                        ? { tone: "success", title: `검증 완료: ${res.result.reportedCount}건 중 ${res.result.verifiedCount}건 인정`, body: "결과를 확인한 뒤 블록체인에 등록하세요." }
                        : { tone: "danger", title: "증빙 지문이 일치하지 않습니다", body: "제출 이후 원본 기록이 바뀌었습니다. 등록하면 이 보고서는 반려됩니다." };
                    },
                    () => refresh(),
                  )
                }
              >
                <Play size={16} /> {v ? "다시 검증" : "검증 실행"}
              </Button>
            )}
            {canVerify && v && (
              <Button
                variant={v.evidenceIntact ? "primary" : "danger"}
                disabled={!ready}
                loading={action.busy === "register"}
                data-testid="verify-onchain"
                onClick={() =>
                  action.run(
                    "register",
                    async () => {
                      await verifyReportOnChain(config!, signerFor("verifier"), report);
                      return v.evidenceIntact
                        ? { tone: "success", title: "검증 결과를 블록체인에 등록했습니다.", body: "이제 광고주가 승인하거나 이의를 제기할 수 있습니다." }
                        : { tone: "warning", title: "증빙 불일치로 반려를 블록체인에 기록했습니다." };
                    },
                    () => refresh(),
                  )
                }
              >
                {v.evidenceIntact ? "검증 결과 등록 (검증기관 서명)" : "반려 기록 (검증기관 서명)"}
              </Button>
            )}
          </div>
        </div>
        {action.message && <div className="px-6 pb-5">{action.view}</div>}
      </Card>

      {!result ? (
        <Card>
          <Empty icon={<ScanSearch size={22} />} title="검증 실행 전">
            ‘검증 실행’을 누르면 기록을 한 건씩 대조해 인정 여부를 판단합니다.
          </Empty>
        </Card>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Card title="검증 결과 요약">
              <SettlementResult result={result} />
            </Card>
            <IntegrityCard result={result} />
          </div>
          <UnitChecks result={result} detail={detail!} />
        </>
      )}

      <Card title="시연 도구" subtitle="제출된 증빙을 몰래 바꾸면 어떻게 되는지 보여 줍니다.">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="danger"
            disabled={!canVerify}
            loading={demo.busy === "tamper"}
            data-testid="tamper"
            onClick={() =>
              demo.run(
                "tamper",
                async () => {
                  const res = await api<{ forged: { eventId: string; eventType: string }[] }>("/api/test/tamper", { body: { reportId: report.id } });
                  return {
                    tone: "warning",
                    title: "DB에 가짜 ‘화면 표시’ 기록을 끼워 넣었습니다",
                    body: `${res.forged.map((f) => f.eventId).join(", ")} — 이제 ‘다시 검증’을 눌러 보세요.`,
                  };
                },
                () => refresh(),
              )
            }
          >
            <ShieldAlert size={16} /> 증빙 변조해 보기
          </Button>
          {(detail?.injectedCount ?? 0) > 0 && (
            <Button
              variant="ghost"
              loading={demo.busy === "cleanup"}
              onClick={() =>
                demo.run(
                  "cleanup",
                  async () => {
                    const res = await api<{ removed: number }>(`/api/test/tamper?campaignId=${detail!.campaign.id}`, { method: "DELETE" });
                    return { tone: "info", title: `변조 기록 ${res.removed}건을 정리했습니다.` };
                  },
                  () => refresh(),
                )
              }
            >
              변조 기록 정리
            </Button>
          )}
        </div>
        {demo.message && <div className="mt-3">{demo.view}</div>}
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-stone-400">{label}</p>
      <div className="text-[14.5px] font-semibold text-stone-800">{value}</div>
    </div>
  );
}

function IntegrityCard({ result }: { result: VerificationResult }) {
  const ev = result.integrity.evidence;
  const ok = result.integrity.intact;
  return (
    <Card icon={<Fingerprint size={18} />} title="증빙 지문 대조" subtitle="매체가 보고할 때 체인에 남긴 지문과, 지금 DB 원본으로 다시 만든 지문을 비교합니다.">
      <div className="space-y-3" data-testid="integrity">
        <HashRow label="보고 때 블록체인에 기록된 지문" value={ev.anchoredHash} />
        <HashRow label="지금 DB 원본으로 다시 만든 지문" value={ev.computedHash} ok={ev.intact} />
        <div className={cx("flex items-start gap-3 rounded-xl p-4", ok ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900")}>
          {ok ? <Check size={22} className="shrink-0" /> : <X size={22} className="shrink-0" />}
          <div className="text-[13.5px]">
            <p className="font-bold">{ok ? "일치 — 보고 이후 원본이 바뀌지 않았습니다" : "불일치 — 보고 이후 원본이 바뀌었습니다"}</p>
            {!ok && ev.addedEventIds.length > 0 && <p className="mt-0.5">나중에 추가된 기록: {ev.addedEventIds.join(", ")}</p>}
            {!ok && ev.modifiedEventIds.length > 0 && <p className="mt-0.5">바뀐 기록: {ev.modifiedEventIds.join(", ")}</p>}
            {!ok && <p className="mt-0.5">바뀐 기록은 집계에서 빼고, 보고서는 반려로 기록해야 합니다.</p>}
          </div>
        </div>
      </div>
    </Card>
  );
}

function HashRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-50 px-4 py-2.5">
      <p className="text-[12px] text-stone-500">{label}</p>
      <p className={cx("font-mono text-[13px] font-semibold", ok === false ? "text-rose-700" : ok ? "text-emerald-700" : "text-stone-800")} title={value}>
        {shortHash(value, 10)}
      </p>
    </div>
  );
}

const VERDICT_VIEW = {
  VALID: { label: "인정", cls: "bg-emerald-700 text-white" },
  INVALID: { label: "제외", cls: "bg-stone-200 text-stone-700" },
  INCONCLUSIVE: { label: "보류", cls: "bg-amber-400 text-amber-950" },
} as const;

function UnitChecks({ result, detail }: { result: VerificationResult; detail: CampaignDetail }) {
  return (
    <Card title={`한 건씩 대조한 결과 (${result.units.length}건)`} subtitle="AI가 광고를 받은 건마다, 계약 조건을 하나씩 확인합니다.">
      <div className="divide-y divide-stone-100" data-testid="unit-checks">
        {result.units.map((u) => (
          <UnitRow key={u.unitKey} unit={u} query={detail.runs[u.runId]?.query} result={result} />
        ))}
      </div>
      {result.excludedEvents.length > 0 && (
        <div className="mt-4 rounded-xl bg-stone-50 p-4">
          <p className="text-[13px] font-semibold text-stone-700">따로 걸러 낸 기록 {result.excludedEvents.length}건</p>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-stone-600">
            {result.excludedEvents.map((e) => (
              <li key={e.eventId} className="flex gap-2">
                <span className="font-mono text-stone-500">{e.eventId}</span>
                <span className={e.reason.startsWith("TAMPERED") ? "font-semibold text-rose-700" : ""}>{REASON_PLAIN[e.reason].label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function UnitRow({ unit: u, query, result }: { unit: UnitResult; query?: string; result: VerificationResult }) {
  const disclosureBad = result.compliance.disclosureViolations.includes(u.unitKey);
  const checks: { label: string; state: "ok" | "no" | "unknown" | "skip" }[] = [
    { label: "계약된 광고", state: "ok" },
    { label: "유료 추천", state: u.recommendedEventId ? "ok" : "no" },
    {
      label: "화면 표시",
      state: !u.recommendedEventId ? "skip" : u.presentedEventId && u.reason !== "EVIDENCE_MISMATCH" ? "ok" : u.notPresentedEventId ? "no" : u.presentedEventId ? "no" : "unknown",
    },
    { label: "광고 표기", state: !u.presentedEventId ? "skip" : disclosureBad ? "no" : "ok" },
  ];
  const view = VERDICT_VIEW[u.verdict];
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3" data-verdict={u.verdict}>
      <div className="min-w-56 flex-1">
        <p className="text-[14px] font-semibold text-stone-800">“{query ?? u.runId}”</p>
        <p className="font-mono text-[11.5px] text-stone-400">
          {u.runId} · {u.responseId ?? "응답에 광고 없음"} · {u.offerId}
          {u.dataMode === "TEST" && " · 시연 데이터"}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {checks.map((c) => (
          <li
            key={c.label}
            className={cx(
              "flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold",
              c.state === "ok" ? "bg-emerald-50 text-emerald-800" : c.state === "no" ? "bg-stone-100 text-stone-500" : c.state === "unknown" ? "bg-amber-50 text-amber-800" : "bg-white text-stone-300",
            )}
          >
            {c.state === "ok" ? <Check size={13} strokeWidth={3} /> : c.state === "no" ? <X size={13} strokeWidth={3} /> : c.state === "unknown" ? <CircleHelp size={13} /> : <Minus size={13} />}
            {c.label}
          </li>
        ))}
      </ul>
      <div className="flex w-56 items-center justify-end gap-2">
        <span className="text-right text-[12px] text-stone-500">{REASON_PLAIN[u.reason].label}</span>
        <span className={cx("rounded-lg px-2.5 py-1 text-[13px] font-bold", view.cls)}>{view.label}</span>
      </div>
    </div>
  );
}
