"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import type { CampaignDetail, CampaignView } from "@/lib/views";

export type CampaignRow = CampaignView & { eventCount: number; reportCount: number };

interface CampaignContextValue {
  campaigns: CampaignRow[] | null;
  currentId: string | null;
  detail: CampaignDetail | null;
  loading: boolean;
  error: string | null;
  select: (id: string) => void;
  refresh: (preferId?: string) => Promise<void>;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);
const KEY = "agentad.currentCampaign";

/** 시연은 보통 캠페인 1개로 진행한다. 모든 역할 화면이 같은 ‘현재 캠페인’을 공유한다. */
export function CampaignProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<CampaignRow[] | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentRef = useRef<string | null>(null);

  const refresh = useCallback(async (preferId?: string) => {
    try {
      const { campaigns: list } = await api<{ campaigns: CampaignRow[] }>("/api/campaigns");
      setCampaigns(list);
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
      const candidates = [preferId, currentRef.current, stored, list[0]?.id];
      const id = candidates.find((c) => c && list.some((x) => x.id === c)) ?? null;
      currentRef.current = id;
      setCurrentId(id);
      if (id) {
        window.localStorage.setItem(KEY, id);
        setDetail(await api<CampaignDetail>(`/api/campaigns/${id}`));
      } else {
        setDetail(null);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 1회 캠페인 로드
    void refresh();
  }, [refresh]);

  const select = useCallback(
    (id: string) => {
      currentRef.current = id;
      window.localStorage.setItem(KEY, id);
      void refresh(id);
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ campaigns, currentId, detail, loading, error, select, refresh }),
    [campaigns, currentId, detail, loading, error, select, refresh],
  );
  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (!ctx) throw new Error("useCampaign must be used inside CampaignProvider");
  return ctx;
}
