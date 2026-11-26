"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { isAddressEqual, type Address } from "viem";
import { api } from "@/lib/client/api";
import { connectMetaMask, devAccount, type SignerMode, type TxSigner } from "@/lib/blockchain/client";
import { ROLE_LABEL, type ChainConfig, type Role, type SignerRole } from "@/lib/blockchain/shared";

interface ChainContextValue {
  config: ChainConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  mode: SignerMode;
  setMode: (mode: SignerMode) => void;
  metamaskAddress: Address | null;
  connect: () => Promise<void>;
  /** 역할별 서명자 (dev: 해당 역할 키, metamask: 현재 연결된 지갑) */
  signerFor: (role: SignerRole) => TxSigner;
  /** 이 작업을 서명할 지갑 주소 */
  signerAddress: (role: SignerRole) => Address | null;
  roleOf: (address: Address | null) => Role | null;
  ready: boolean;
}

const ChainContext = createContext<ChainContextValue | null>(null);

const MODE_KEY = "agentad.signerMode";

export function ChainProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ChainConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setModeState] = useState<SignerMode>("dev");
  const [metamaskAddress, setMetamaskAddress] = useState<Address | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api<ChainConfig>("/api/chain/config");
      setConfig(next);
      const saved = window.localStorage.getItem(MODE_KEY) as SignerMode | null;
      setModeState(saved ?? (next.devSignerAvailable ? "dev" : "metamask"));
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 1회 체인 설정 로드
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const eth = window.ethereum;
    if (!eth) return;
    const onAccounts = (accounts: unknown) => {
      const list = accounts as Address[];
      setMetamaskAddress(list[0] ?? null);
    };
    eth.on?.("accountsChanged", onAccounts);
    return () => eth.removeListener?.("accountsChanged", onAccounts);
  }, []);

  const setMode = useCallback((next: SignerMode) => {
    window.localStorage.setItem(MODE_KEY, next);
    setModeState(next);
  }, []);

  const connect = useCallback(async () => {
    if (!config) return;
    setMetamaskAddress(await connectMetaMask(config));
  }, [config]);

  const roleOf = useCallback(
    (address: Address | null): Role | null => {
      if (!address || !config?.roles) return null;
      const entry = (Object.entries(config.roles) as [Role, Address][]).find(([, a]) => isAddressEqual(a, address));
      return entry?.[0] ?? null;
    },
    [config],
  );

  const effectiveMode: SignerMode = config?.devSignerAvailable ? mode : "metamask";

  const value = useMemo<ChainContextValue>(
    () => ({
      config,
      loading,
      refresh,
      mode: effectiveMode,
      setMode,
      metamaskAddress,
      connect,
      signerFor: (role) => ({ mode: effectiveMode, role }),
      signerAddress: (role) => (effectiveMode === "dev" ? devAccount(role).address : metamaskAddress),
      roleOf,
      ready: !!config?.deployed,
    }),
    [config, loading, refresh, effectiveMode, setMode, metamaskAddress, connect, roleOf],
  );

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
}

export function useChain() {
  const ctx = useContext(ChainContext);
  if (!ctx) throw new Error("useChain must be used inside ChainProvider");
  return ctx;
}

export function roleLabel(role: SignerRole | null) {
  return role ? ROLE_LABEL[role] : "역할 없음";
}
