"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Ban, Blocks, Check, Clock, Repeat, ShieldCheck } from "lucide-react";
import { api, formatDateTime } from "@/lib/client/api";
import { latestReport } from "@/lib/client/progress";
import { describeChainError, simulateRegistryCall, type RegistryCall } from "@/lib/blockchain/client";
import { explorerAddressUrl, ROLE_LABEL, toBytes32Id, type Role, type SignerRole } from "@/lib/blockchain/shared";
import type { LedgerEntry } from "@/lib/ledger";
import { useChain } from "@/components/chain-provider";
import { useCampaign } from "@/components/campaign-provider";
import { PageHeader } from "@/components/app-shell";
import { pageMeta } from "@/components/roles";
import { Badge, Button, Card, cx, Empty, HashText, Mono, Notice, TxLink } from "@/components/ui";
import { useAction } from "@/components/use-action";

const PERMISSIONS: { role: Role; can: string; fn: string }[] = [
  { role: "advertiser", can: "계약 제안 · 최종 승인 · 이의 제기", fn: "registerCampaign · approveReport · disputeReport" },
  { role: "publisher", can: "계약 수락 · 실적 보고", fn: "acceptCampaign · submitReport" },
  { role: "verifier", can: "검증 결과 등록 (또는 반려)", fn: "verifyReport" },
];

export function LedgerView() {
  const { config } = useChain();
  const { currentId, detail } = useCampaign();
  const [ledger, setLedger] = useState<{ entries: LedgerEntry[]; chainError: string | null } | null>(null);

  const load = useCallback(async () => {
    if (!currentId) return;
    setLedger(await api<{ entries: LedgerEntry[]; chainError: string | null }>(`/api/campaigns/${currentId}/ledger`));
  }, [currentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 캠페인이 바뀌면 온체인 기록 재조회
    void load();
  }, [load, detail]);

  return (
    <div className="space-y-6">
      <PageHeader page={pageMeta("ledger")} title="블록체인 기록" description="원본 데이터는 DB에, 누가 무엇을 승인했는지와 데이터의 지문만 블록체인에 남깁니다." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card icon={<Blocks size={18} />} title="온체인 기록" subtitle="현재 캠페인과 관련된 트랜잭션을 블록 순서대로 보여 줍니다.">
          {ledger?.chainError && <Notice tone="warning" className="mb-3">{ledger.chainError}</Notice>}
          {!currentId ? (
            <Empty title="현재 캠페인이 없습니다" />
          ) : !ledger ? (
            <p className="text-[15px] text-stone-400">불러오는 중…</p>
          ) : ledger.entries.length === 0 ? (
            <Empty icon={<Clock size={22} />} title="아직 기록이 없습니다">광고주가 계약을 제안하면 첫 기록이 생깁니다.</Empty>
          ) : (
            <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-stone-200" data-testid="ledger">
              {ledger.entries.map((e) => (
                <li key={e.key} className="relative flex gap-4" data-action={e.action}>
                  <span className="z-10 grid size-8 shrink-0 place-items-center rounded-full bg-emerald-700 text-white">
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border border-stone-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[16.5px] font-bold text-stone-900">{e.title}</p>
                      <Badge tone="success">{ROLE_LABEL[e.role]}</Badge>
                      <Mono className="text-stone-400">{e.action}()</Mono>
                      <span className="ml-auto text-[14px] text-stone-400">
                        {e.blockNumber !== null ? `블록 #${e.blockNumber}` : "블록 확인 불가"}
                        {e.timestamp && ` · ${formatDateTime(e.timestamp)}`}
                      </span>
                    </div>
                    <dl className="mt-2 grid gap-1 text-[14.5px]">
                      {e.fields.map((f) => (
                        <div key={f.label} className="flex justify-between gap-3">
                          <dt className="text-stone-500">{f.label}</dt>
                          <dd className="text-stone-800">{f.hash ? <HashText value={f.value} /> : f.value}</dd>
                        </div>
                      ))}
                      <div className="flex justify-between gap-3">
                        <dt className="text-stone-500">트랜잭션</dt>
                        <dd>
                          <TxLink hash={e.txHash} />
                        </dd>
                      </div>
                    </dl>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="space-y-6">
          <Card icon={<ShieldCheck size={18} />} title="스마트 컨트랙트와 역할">
            <dl className="mb-4 grid gap-1.5 text-[15px]">
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">네트워크</dt>
                <dd className="font-semibold text-stone-800">{config?.chainId === 11155111 ? "Ethereum Sepolia" : `로컬 블록체인 (chainId ${config?.chainId ?? "-"})`}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stone-500">AgentAdRegistry</dt>
                <dd>
                  {config?.registryAddress && config.explorerUrl ? (
                    <a className="font-mono text-[14px] text-emerald-700 hover:underline" href={explorerAddressUrl(config, config.registryAddress) ?? "#"} target="_blank" rel="noreferrer">
                      {config.registryAddress.slice(0, 10)}… ↗
                    </a>
                  ) : (
                    <HashText value={config?.registryAddress} />
                  )}
                </dd>
              </div>
            </dl>
            <table className="w-full text-left text-[14.5px]">
              <thead className="text-[13.5px] text-stone-400">
                <tr>
                  <th className="pb-1.5 font-medium">역할</th>
                  <th className="pb-1.5 font-medium">지갑</th>
                  <th className="pb-1.5 font-medium">할 수 있는 일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {PERMISSIONS.map((p) => (
                  <tr key={p.role}>
                    <td className="whitespace-nowrap py-2 pr-2 font-semibold text-stone-800">{ROLE_LABEL[p.role]}</td>
                    <td className="whitespace-nowrap py-2 pr-2">
                      <HashText value={config?.roles?.[p.role]} size={4} />
                    </td>
                    <td className="py-2 text-stone-600">
                      {p.can}
                      <span className="block font-mono text-[13px] text-stone-400">{p.fn}</span>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 font-semibold text-stone-800">소비자</td>
                  <td className="py-2 text-stone-400">-</td>
                  <td className="py-2 text-stone-600">조회만 가능</td>
                </tr>
              </tbody>
            </table>
          </Card>

          <PermissionTest />
          <ReproduceCard />
        </div>
      </div>
    </div>
  );
}

function PermissionTest() {
  const { config, mode } = useChain();
  const { detail } = useCampaign();
  const reportId = latestReport(detail)?.id ?? "RPT-000-TEST";
  const campaignId = detail?.campaign.id ?? "CAM-000-TEST";
  const [results, setResults] = useState<Record<string, { ok: boolean; text: ReactNode }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const tests: { key: string; who: SignerRole; label: string; call: RegistryCall }[] = [
    { key: "approve", who: "publisher", label: "광고 매체가 자기 실적을 최종 승인", call: { functionName: "approveReport", args: [toBytes32Id(reportId)] } },
    {
      key: "verify",
      who: "outsider",
      label: "권한 없는 지갑이 검증 결과 등록",
      call: { functionName: "verifyReport", args: [toBytes32Id(reportId), 99n, 0n, `0x${"ab".repeat(32)}`, true] },
    },
    {
      key: "accept",
      who: "advertiser",
      label: "광고주가 매체 대신 계약 수락",
      call: { functionName: "acceptCampaign", args: [toBytes32Id(campaignId), (detail?.campaign.termsHash ?? `0x${"00".repeat(32)}`) as `0x${string}`] },
    },
  ];

  async function attempt(t: (typeof tests)[number]) {
    setBusy(t.key);
    try {
      await simulateRegistryCall(config!, { mode: "dev", role: t.who }, t.call);
      setResults((r) => ({ ...r, [t.key]: { ok: true, text: "허용됨 (예상과 다름)" } }));
    } catch (err) {
      const info = describeChainError(err);
      setResults((r) => ({
        ...r,
        [t.key]: {
          ok: false,
          text: (
            <>
              <b>컨트랙트가 거부</b> — {info.detail}
              {info.raw && <Mono className="block break-all text-[13px] text-rose-700">{info.raw}</Mono>}
            </>
          ),
        },
      }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card icon={<Ban size={18} />} title="권한 테스트" subtitle="화면에서 막는 것이 아니라, 블록체인 컨트랙트가 직접 거부하는지 확인합니다.">
      {mode !== "dev" ? (
        <p className="text-[15px] text-stone-500">MetaMask 모드에서는 역할이 다른 계정으로 바꾼 뒤 각 화면의 버튼을 눌러 보세요.</p>
      ) : (
        <ul className="space-y-2" data-testid="permission-tests">
          {tests.map((t) => (
            <li key={t.key} className="rounded-xl border border-stone-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-stone-800">{t.label}</span>
                <Button size="sm" variant="secondary" loading={busy === t.key} disabled={!config?.deployed} onClick={() => void attempt(t)} data-testid={`try-${t.key}`}>
                  시도
                </Button>
              </div>
              {results[t.key] && (
                <p className={cx("mt-2 text-[14.5px]", results[t.key].ok ? "text-amber-700" : "text-rose-800")} data-testid={`result-${t.key}`}>
                  {results[t.key].text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ReproduceCard() {
  const { detail } = useCampaign();
  const report = latestReport(detail);
  const action = useAction();
  const [res, setRes] = useState<{ hash: string; anchored: string | null; matches: boolean | null } | null>(null);
  const verified = report && ["VERIFIED", "FINALIZED", "DISPUTED", "REJECTED"].includes(report.status);
  return (
    <Card icon={<Repeat size={18} />} title="누구나 다시 계산하기" subtitle="같은 기록과 같은 계약 기준이면 검증 결과의 지문도 같아야 합니다.">
      <Button
        variant="secondary"
        className="w-full"
        disabled={!verified}
        loading={action.busy === "reproduce"}
        data-testid="reproduce"
        onClick={() =>
          action.run("reproduce", async () => {
            const r = await api<{ verificationHash: string; anchoredVerificationHash: string | null; matchesOnChain: boolean | null }>(
              "/api/reports/verify",
              { body: { reportId: report!.id, mode: "reproduce" } },
            );
            setRes({ hash: r.verificationHash, anchored: r.anchoredVerificationHash, matches: r.matchesOnChain });
          })
        }
      >
        검증 결과 다시 계산해 비교
      </Button>
      {action.view}
      {res && (
        <div className={cx("mt-3 rounded-xl p-3 text-[15px]", res.matches ? "bg-emerald-50 text-emerald-900" : "bg-rose-50 text-rose-900")} data-testid="reproduce-result">
          <p className="font-bold">{res.matches ? "재현 일치 — 블록체인에 기록된 검증 결과와 같습니다" : "재현 불일치 — 검증 이후 데이터가 바뀌었습니다"}</p>
          <p className="mt-1 text-[14px]">
            다시 계산 <HashText value={res.hash} /> / 블록체인 <HashText value={res.anchored} />
          </p>
        </div>
      )}
    </Card>
  );
}
