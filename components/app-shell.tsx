"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Wallet } from "lucide-react";
import { shortHash } from "@/lib/core/canonical";
import { describeChainError } from "@/lib/blockchain/client";
import { CAMPAIGN_STATUS_LABEL, ROLE_LABEL, type Role } from "@/lib/blockchain/shared";
import { useChain } from "@/components/chain-provider";
import { useCampaign } from "@/components/campaign-provider";
import { PAGES, type PageMeta } from "@/components/roles";
import { cx } from "@/components/ui";

export function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
      <rect x="3" y="3" width="17" height="17" rx="4" fill="none" stroke="#047857" strokeWidth="3" />
      <rect x="12" y="12" width="17" height="17" rx="4" fill="#34d399" fillOpacity="0.35" stroke="#065f46" strokeWidth="3" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 px-8 py-7">{children}</main>
      </div>
    </div>
  );
}

function TopBar() {
  const { campaigns, currentId, select } = useCampaign();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-stone-200 bg-white px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo />
        <span className="text-[19px] font-extrabold tracking-tight text-stone-900">AgentAd Trust</span>
      </Link>
      <div className="ml-auto flex items-center gap-3">
        {campaigns && campaigns.length > 0 && (
          <label className="flex items-center gap-2 text-[12.5px] text-stone-500">
            현재 캠페인
            <select
              value={currentId ?? ""}
              onChange={(e) => select(e.target.value)}
              className="h-9 max-w-64 rounded-lg border border-stone-300 bg-white px-2 text-[13px] font-medium text-stone-800"
              aria-label="현재 캠페인"
              data-testid="campaign-select"
            >
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.offers[0]?.productName ?? c.name} · {c.id} ({CAMPAIGN_STATUS_LABEL[c.chainStatus]})
                </option>
              ))}
            </select>
          </label>
        )}
        <ChainStatus />
      </div>
    </header>
  );
}

function ChainStatus() {
  const { config, loading, mode, setMode, metamaskAddress, connect, roleOf, refresh } = useChain();
  const [error, setError] = useState<string | null>(null);
  if (loading && !config) return <span className="text-[12px] text-stone-400">체인 확인 중…</span>;
  const healthy = !!config?.deployed;
  const network = config?.chainId === 11155111 ? "Sepolia 테스트넷" : config?.chainId === 31337 ? "로컬 블록체인" : config?.network;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => void refresh()}
        title={config?.message ?? `컨트랙트 ${config?.registryAddress ?? ""}`}
        data-testid="chain-status"
        className={cx(
          "flex h-9 items-center gap-2 rounded-lg px-3 text-[12.5px] font-semibold",
          healthy ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700",
        )}
      >
        <span className={cx("size-2 rounded-full", healthy ? "bg-emerald-500" : "bg-rose-500")} />
        {healthy ? network : "블록체인 연결 필요"}
      </button>
      {config?.devSignerAvailable && (
        <div className="flex h-9 items-center rounded-lg bg-stone-100 p-1 text-[12px]" title="트랜잭션에 서명할 방식">
          {(["dev", "metamask"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cx("h-7 rounded-md px-2.5 font-semibold", mode === m ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")}
            >
              {m === "dev" ? "시연 지갑" : "MetaMask"}
            </button>
          ))}
        </div>
      )}
      {mode === "metamask" && (
        <button
          type="button"
          title={error ?? undefined}
          onClick={async () => {
            setError(null);
            try {
              await connect();
            } catch (err) {
              setError(describeChainError(err).detail);
            }
          }}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 text-[12.5px] font-semibold text-white hover:bg-emerald-700"
        >
          <Wallet size={15} />
          {metamaskAddress ? `${shortHash(metamaskAddress, 4)} · ${roleOf(metamaskAddress) ? ROLE_LABEL[roleOf(metamaskAddress)!] : "역할 없음"}` : "지갑 연결"}
        </button>
      )}
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const { config, mode } = useChain();
  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-stone-200 bg-[#f1f3f0] px-3 py-5 md:flex">
      <nav className="space-y-1">
        {PAGES.map((p) => (
          <NavItem key={p.key} page={p} active={p.href === "/" ? pathname === "/" : pathname?.startsWith(p.href) ?? false} />
        ))}
      </nav>
      {config?.roles && (
        <div className="mt-auto rounded-xl bg-white/70 p-3 text-[11.5px] text-stone-500">
          <p className="mb-1.5 font-semibold text-stone-600">{mode === "dev" ? "시연 지갑 (로컬 테스트 계정)" : "역할별 지갑"}</p>
          {(Object.entries(config.roles) as [Role, string][]).map(([role, address]) => (
            <p key={role} className="flex justify-between gap-2">
              <span>{ROLE_LABEL[role]}</span>
              <span className="font-mono">{shortHash(address, 4)}</span>
            </p>
          ))}
        </div>
      )}
    </aside>
  );
}

function NavItem({ page, active }: { page: PageMeta; active: boolean }) {
  const Icon = page.icon;
  return (
    <Link
      href={page.href}
      className={cx(
        "flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold transition-colors",
        active ? "bg-emerald-100 text-emerald-900" : "text-stone-600 hover:bg-white hover:text-stone-900",
      )}
    >
      <Icon size={20} strokeWidth={1.8} />
      {page.label}
    </Link>
  );
}

/** 페이지 제목 + 이 화면에서 서명하는 지갑 안내 */
export function PageHeader({ page, title, description, actions }: { page: PageMeta; title?: string; description?: string; actions?: ReactNode }) {
  const { mode, signerAddress } = useChain();
  const Icon = page.icon;
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-700">
          <Icon size={15} />
          {page.label}
        </p>
        <h1 className="mt-1 text-[30px] font-extrabold tracking-tight text-stone-900">{title ?? page.label}</h1>
        <p className="mt-1 text-[14px] text-stone-500">{description ?? page.description}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {page.signer && (
          <span className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[12px] text-stone-500 ring-1 ring-stone-200">
            <Wallet size={14} className="text-emerald-700" />
            {ROLE_LABEL[page.signer]} 지갑으로 서명
            <span className="font-mono text-stone-700">
              {mode === "dev" ? shortHash(signerAddress(page.signer) ?? "", 4) : "MetaMask"}
            </span>
          </span>
        )}
        {actions}
      </div>
    </div>
  );
}
