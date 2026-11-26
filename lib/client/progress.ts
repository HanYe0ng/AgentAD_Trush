/** 계약(캠페인) 상태로 6단계 진행 상황 · 다음 할 일 · 상태 라벨을 계산한다 (홈 대시보드에서 사용) */
import type { CampaignDetail, ReportView } from "@/lib/views";
import type { PageKey } from "@/components/roles";

export type StepStatus = "done" | "current" | "todo" | "failed";

export interface Step {
  key: string;
  title: string;
  page: PageKey;
  href: string;
  status: StepStatus;
  note: string;
}

export interface NextAction {
  page: PageKey;
  href: string;
  /** 처리할 일 목록에 쓰는 짧은 이름 (모두 끝났으면 null) */
  task: string | null;
  title: string;
  description: string;
  cta: string;
}

export interface StageSummary {
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
  doneCount: number;
}

/** 진행 단계 계산에 필요한 최소 정보 (캠페인 상세 또는 홈 대시보드 요약) */
export interface ProgressSource {
  campaign: Pick<CampaignDetail["campaign"], "chainStatus">;
  reports: ReportView[];
  funnel: { stageCounts: CampaignDetail["funnel"]["stageCounts"] };
  unreported: { eventCount: number };
}

export function latestReport(detail: Pick<ProgressSource, "reports"> | null): ReportView | null {
  return detail?.reports[0] ?? null;
}

export function computeProgress(detail: ProgressSource | null): { steps: Step[]; next: NextAction; summary: StageSummary } {
  const c = detail?.campaign;
  const latest = latestReport(detail);
  const s = detail?.funnel.stageCounts;
  // 이전 보고가 확정된 뒤 새 광고 기록이 쌓였으면 보고 → 검증 → 승인을 새로 진행한다
  const newRecords = detail?.unreported.eventCount ?? 0;
  const newCycle = latest?.status === "FINALIZED" && newRecords > 0;
  const r = newCycle ? null : latest;

  const done = {
    register: !!c && c.chainStatus !== "DRAFT",
    accept: c?.chainStatus === "ACTIVE",
    activity: (s?.received ?? 0) > 0,
    report: !!r && r.status !== "PENDING_CHAIN",
    verify: !!r && ["VERIFIED", "FINALIZED", "DISPUTED"].includes(r.status),
    approve: r?.status === "FINALIZED",
  };
  const failed = { verify: r?.status === "REJECTED", approve: r?.status === "DISPUTED" };

  const raw: Omit<Step, "status">[] = [
    {
      key: "register",
      title: "광고 등록 · 계약 제안",
      page: "advertiser",
      href: "/advertiser",
      note: c ? (done.register ? "블록체인에 제안됨" : "계약 제안 서명 필요") : "아직 등록된 광고 없음",
    },
    { key: "accept", title: "계약 수락", page: "publisher", href: "/publisher", note: done.accept ? "같은 조건으로 확정" : "매체의 수락 대기" },
    {
      key: "activity",
      title: "AI 추천 · 광고 표시",
      page: "consumer",
      href: "/consumer",
      note: done.activity ? `수신 ${s!.received} · 추천 ${s!.recommended} · 표시 ${s!.presented}` : "소비자 질문 대기",
    },
    {
      key: "report",
      title: "실적 보고",
      page: "publisher",
      href: "/publisher",
      note: done.report ? `매체 보고 ${r!.reportedCount}건` : newCycle ? `새 기록 ${newRecords}건 보고 대기` : "매체 보고 대기",
    },
    {
      key: "verify",
      title: "표시 검증",
      page: "verifier",
      href: "/verifier",
      note: failed.verify
        ? "증빙 불일치로 반려"
        : done.verify
          ? `인정 ${r!.onChainVerified ?? r!.latestVerification?.verifiedCount ?? 0}건`
          : "검증기관 검증 대기",
    },
    {
      key: "approve",
      title: "최종 승인",
      page: "advertiser",
      href: "/advertiser",
      note: failed.approve ? "광고주 이의 제기" : done.approve ? `${r!.onChainVerified}건 확정` : "광고주 승인 대기",
    },
  ];

  let currentAssigned = false;
  const steps: Step[] = raw.map((step) => {
    const key = step.key as keyof typeof done;
    if ((failed as Record<string, boolean>)[key]) return { ...step, status: "failed" };
    if (done[key]) return { ...step, status: "done" };
    if (!currentAssigned && !failed.verify && !failed.approve) {
      currentAssigned = true;
      return { ...step, status: "current" };
    }
    return { ...step, status: "todo" };
  });

  const current = steps.find((st) => st.status === "current")?.key;
  const summary: StageSummary = {
    doneCount: steps.filter((st) => st.status === "done").length,
    ...(failed.verify
      ? { label: "반려 · 재보고 필요", tone: "danger" as const }
      : failed.approve
        ? { label: "이의 제기 · 재보고 필요", tone: "danger" as const }
        : (STAGE_LABEL[current ?? "done"] ?? STAGE_LABEL.done)),
  };
  if (current === "report" && newCycle) summary.label = "집행 중 · 새 실적 보고 대기";

  return { steps, next: nextAction(detail, done, failed, newCycle ? newRecords : 0), summary };
}

const STAGE_LABEL: Record<string, Omit<StageSummary, "doneCount">> = {
  register: { label: "계약 제안 전", tone: "neutral" },
  accept: { label: "매체 수락 대기", tone: "warning" },
  activity: { label: "집행 중 · 광고 대기", tone: "info" },
  report: { label: "집행 중 · 실적 보고 대기", tone: "info" },
  verify: { label: "검증 대기", tone: "warning" },
  approve: { label: "광고주 승인 대기", tone: "warning" },
  done: { label: "정산 확정", tone: "success" },
};

function nextAction(
  detail: ProgressSource | null,
  done: Record<string, boolean>,
  failed: Record<string, boolean>,
  newRecords: number,
): NextAction {
  if (!detail) {
    return { page: "advertiser", href: "/advertiser", task: "첫 광고 상품 등록", title: "광고주가 광고 상품을 등록할 차례입니다", description: "상품과 계약 조건을 등록하고 블록체인에 계약을 제안하세요.", cta: "광고주 화면으로" };
  }
  if (!done.register) {
    return { page: "advertiser", href: "/advertiser", task: "계약 제안 서명", title: "광고주가 계약을 제안할 차례입니다", description: "등록한 광고의 계약 조건을 블록체인에 제안하세요.", cta: "광고주 화면으로" };
  }
  if (!done.accept) {
    return { page: "publisher", href: "/publisher", task: "계약 수락", title: "광고 매체가 계약을 수락할 차례입니다", description: "같은 조건 해시로 수락하면 계약이 확정되고 광고가 집행됩니다.", cta: "광고 매체 화면으로" };
  }
  if (failed.verify || failed.approve) {
    return {
      page: "publisher",
      href: "/publisher",
      task: "실적 다시 보고",
      title: failed.verify ? "증빙 불일치로 반려됐습니다 — 매체가 다시 보고할 차례" : "광고주가 이의를 제기했습니다 — 매체가 다시 보고할 차례",
      description: "원본을 바로잡은 뒤 실적을 다시 보고하면 같은 절차로 검증합니다.",
      cta: "광고 매체 화면으로",
    };
  }
  if (!done.activity) {
    return { page: "consumer", href: "/consumer", task: "쇼핑 AI 광고 집행 (소비자 질문 대기)", title: "소비자가 쇼핑 AI에 질문할 차례입니다", description: "AI가 광고를 받고, 추천하고, 화면에 표시하는 기록이 쌓입니다.", cta: "소비자 화면으로" };
  }
  if (!done.report) {
    return {
      page: "publisher",
      href: "/publisher",
      task: newRecords > 0 ? `새 실적 ${newRecords}건 보고` : "실적 보고",
      title: newRecords > 0 ? "새 광고 기록이 쌓였습니다 — 매체가 다시 보고할 차례" : "광고 매체가 실적을 보고할 차례입니다",
      description:
        newRecords > 0
          ? `이전 보고는 확정됐고, 그 뒤 새 기록 ${newRecords}건이 생겼습니다. 새 실적으로 보고 → 검증 → 승인을 진행합니다.`
          : "매체가 자체 기준으로 센 실적과 증빙 지문을 블록체인에 제출합니다.",
      cta: "광고 매체 화면으로",
    };
  }
  if (!done.verify) {
    return { page: "verifier", href: "/verifier", task: "광고 표시 검증", title: "검증기관이 검증할 차례입니다", description: "기록을 계약 기준으로 다시 세고, 결과를 블록체인에 등록합니다.", cta: "검증기관 화면으로" };
  }
  if (!done.approve) {
    return { page: "advertiser", href: "/advertiser", task: "검증 실적 최종 승인", title: "광고주가 결과를 승인할 차례입니다", description: "검증된 실적을 확정하거나 이의를 제기합니다.", cta: "광고주 화면으로" };
  }
  return { page: "ledger", href: "/ledger", task: null, title: "모든 단계가 블록체인에 기록됐습니다", description: "블록체인 기록 화면에서 승인 이력을 확인하거나, 새 질문으로 다음 실적을 쌓을 수 있습니다.", cta: "블록체인 기록 보기" };
}
