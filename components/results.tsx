"use client";

import { ArrowRight, Bot, Eye, Inbox } from "lucide-react";
import type { ReasonCode, StageCounts, UnitResult, VerificationResult } from "@/lib/verification/engine";
import { cx } from "@/components/ui";

/** 판정 사유를 발표·시연용 쉬운 말과 색으로 */
export const REASON_PLAIN: Record<ReasonCode, { label: string; group: "valid" | "excluded" | "held" | "invalid"; color: string }> = {
  ALL_CONDITIONS_MET: { label: "화면 표시 확인 · 인정", group: "valid", color: "bg-emerald-600" },
  NOT_RECOMMENDED: { label: "AI가 추천하지 않음", group: "excluded", color: "bg-stone-400" },
  NOT_PRESENTED: { label: "추천됐지만 화면 미표시", group: "excluded", color: "bg-stone-300" },
  EVIDENCE_MISSING: { label: "표시 기록 없음 · 보류", group: "held", color: "bg-amber-400" },
  EVIDENCE_CONFLICT: { label: "표시 기록 충돌 · 보류", group: "held", color: "bg-amber-400" },
  DISCLOSURE_VIOLATION: { label: "광고 표기 누락 · 보류", group: "held", color: "bg-amber-500" },
  EVIDENCE_MISMATCH: { label: "화면 증빙 불일치", group: "invalid", color: "bg-rose-400" },
  NOT_VIEWABLE: { label: "가시성 미달", group: "invalid", color: "bg-rose-400" },
  TEST_TRAFFIC: { label: "테스트 트래픽 제외", group: "excluded", color: "bg-violet-300" },
  CONTRACT_INACTIVE: { label: "계약 기간 외", group: "invalid", color: "bg-rose-400" },
  UNKNOWN_OFFER: { label: "등록되지 않은 광고", group: "invalid", color: "bg-rose-400" },
  WRONG_CAMPAIGN: { label: "다른 캠페인", group: "invalid", color: "bg-rose-400" },
  UNLINKED_RECOMMENDATION: { label: "광고와 연결되지 않은 추천", group: "invalid", color: "bg-rose-400" },
  MALFORMED: { label: "형식 오류", group: "invalid", color: "bg-rose-400" },
  NO_RECEIPT: { label: "수신 기록 없음", group: "invalid", color: "bg-rose-400" },
  NO_RECOMMENDATION: { label: "추천 기록 없음", group: "invalid", color: "bg-rose-400" },
  OUT_OF_ORDER: { label: "순서 오류", group: "invalid", color: "bg-rose-400" },
  DUPLICATE_EVENT: { label: "중복 기록", group: "excluded", color: "bg-stone-300" },
  TAMPERED_ADDED: { label: "제출 후 추가된 기록 (변조)", group: "invalid", color: "bg-rose-500" },
  TAMPERED_MODIFIED: { label: "제출 후 바뀐 기록 (변조)", group: "invalid", color: "bg-rose-500" },
};

/** 수신 → 추천 → 표시 깔때기 */
export function Funnel({ counts, compact }: { counts: StageCounts; compact?: boolean }) {
  const stages = [
    { label: "광고 수신", sub: "AI가 광고 정보를 받음", value: counts.received, icon: Inbox },
    { label: "유료 추천", sub: "AI 답변에 광고 포함", value: counts.recommended, icon: Bot },
    { label: "화면 표시", sub: "소비자 화면에 그려짐", value: counts.presented, icon: Eye, billing: true },
  ];
  return (
    <div className="flex items-stretch gap-2" data-testid="funnel">
      {stages.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={s.label} className="flex flex-1 items-center gap-2">
            <div
              className={cx(
                "flex-1 rounded-xl border",
                compact ? "px-3 py-2.5" : "px-4 py-3",
                s.billing ? "border-emerald-300 bg-emerald-50" : "border-stone-200 bg-white",
              )}
            >
              <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-stone-600">
                <Icon size={15} className={s.billing ? "text-emerald-700" : "text-stone-400"} />
                {s.label}
                {s.billing && !compact && <span className="rounded bg-emerald-700 px-1.5 py-px text-[10.5px] text-white">정산 기준</span>}
              </p>
              <p className={cx("tabular mt-1 font-extrabold leading-none text-stone-900", compact ? "text-[26px]" : "text-[34px]")} data-testid={`funnel-${i}`}>
                {s.value}
                <span className="ml-1 text-[14px] font-semibold text-stone-400">건</span>
              </p>
              {!compact && <p className="mt-1 text-[11.5px] text-stone-400">{s.sub}</p>}
            </div>
            {i < stages.length - 1 && <ArrowRight size={18} className="shrink-0 text-stone-300" />}
          </div>
        );
      })}
    </div>
  );
}

interface Segment {
  key: string;
  label: string;
  count: number;
  color: string;
  group: string;
}

export function segmentsOf(units: UnitResult[]): Segment[] {
  const map = new Map<string, Segment>();
  for (const u of units) {
    const plain = REASON_PLAIN[u.reason];
    const seg = map.get(u.reason) ?? { key: u.reason, label: plain.label, count: 0, color: plain.color, group: plain.group };
    seg.count += 1;
    map.set(u.reason, seg);
  }
  const order = { valid: 0, held: 1, excluded: 2, invalid: 3 } as Record<string, number>;
  return [...map.values()].sort((a, b) => order[a.group] - order[b.group] || b.count - a.count);
}

/** 매체 보고 vs 인정 실적 + 차이 사유 막대 */
export function SettlementResult({ result }: { result: VerificationResult }) {
  const segments = segmentsOf(result.units);
  const total = Math.max(result.reportedCount, result.units.length, 1);
  const unsupported = result.gap.unsupportedByEvidence;
  return (
    <div data-testid="settlement-result">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <Big label="매체가 보고한 실적" value={result.reportedCount} hint="AI가 광고를 받은 횟수 기준" testId="reported-count" />
        <ArrowRight className="mb-5 text-stone-300" />
        <Big label="계약 기준으로 인정된 실적" value={result.verifiedCount} hint="소비자 화면 표시가 확인된 건" tone="good" testId="verified-count" />
        {result.heldCount > 0 && <Big label="정산 보류" value={result.heldCount} hint="표시 기록 부족 · 증빙 보완 필요" tone="warn" testId="held-count" />}
      </div>

      <div className="mt-5 flex h-4 overflow-hidden rounded-full bg-stone-100" aria-hidden>
        {segments.map((s) => (
          <div key={s.key} className={s.color} style={{ width: `${(s.count / total) * 100}%` }} title={`${s.label} ${s.count}건`} />
        ))}
        {unsupported > 0 && <div className="bg-rose-200" style={{ width: `${(unsupported / total) * 100}%` }} />}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]" data-testid="gap-summary">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5 text-stone-600">
            <span className={cx("size-2.5 rounded-sm", s.color)} />
            {s.label} <b className="tabular text-stone-900">{s.count}건</b>
          </li>
        ))}
        {unsupported > 0 && (
          <li className="flex items-center gap-1.5 text-stone-600">
            <span className="size-2.5 rounded-sm bg-rose-200" />
            기록 없이 보고된 수 <b className="text-stone-900">{unsupported}건</b>
          </li>
        )}
      </ul>
      <p className="mt-3 text-[12.5px] text-stone-500">
        매체의 숫자가 거짓이라는 뜻이 아니라, 매체는 ‘광고를 받은 횟수’를 세고 계약은 ‘소비자 화면에 표시된 횟수’를 인정하기 때문에 생기는 차이입니다.
      </p>
    </div>
  );
}

function Big({ label, value, hint, tone, testId }: { label: string; value: number; hint: string; tone?: "good" | "warn"; testId?: string }) {
  return (
    <div>
      <p className="text-[12.5px] font-medium text-stone-500">{label}</p>
      <p
        data-testid={testId}
        className={cx(
          "tabular text-[44px] font-extrabold leading-none tracking-tight",
          tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-600" : "text-stone-900",
        )}
      >
        {value}
        <span className="ml-1 text-[18px] font-bold text-stone-400">건</span>
      </p>
      <p className="mt-1 text-[11.5px] text-stone-400">{hint}</p>
    </div>
  );
}
