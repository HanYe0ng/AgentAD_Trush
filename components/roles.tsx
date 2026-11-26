import { Blocks, Building2, House, Megaphone, ShieldCheck, ShoppingCart, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/blockchain/shared";

export type PageKey = "home" | "advertiser" | "publisher" | "consumer" | "verifier" | "ledger";

export interface PageMeta {
  key: PageKey;
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** 이 화면에서 서명하는 지갑 역할 */
  signer?: Role;
}

export const PAGES: PageMeta[] = [
  { key: "home", href: "/", label: "홈", icon: House, description: "광고 계약 현황과 처리할 일을 한눈에 봅니다." },
  {
    key: "advertiser",
    href: "/advertiser",
    label: "광고주",
    icon: Megaphone,
    description: "광고 상품을 등록해 계약을 제안하고, 검증된 실적을 승인합니다.",
    signer: "advertiser",
  },
  {
    key: "publisher",
    href: "/publisher",
    label: "광고 매체",
    icon: Building2,
    description: "쇼핑 AI 운영사. 계약을 수락하고 광고 실적을 보고합니다.",
    signer: "publisher",
  },
  { key: "consumer", href: "/consumer", label: "소비자", icon: ShoppingCart, description: "쇼핑 AI에게 상품을 추천받습니다." },
  {
    key: "verifier",
    href: "/verifier",
    label: "검증기관",
    icon: ShieldCheck,
    description: "광고가 실제로 화면에 표시됐는지 기록을 대조해 검증합니다.",
    signer: "verifier",
  },
  { key: "ledger", href: "/ledger", label: "블록체인 기록", icon: Blocks, description: "누가 무엇을 승인했는지 블록체인 기록을 확인합니다." },
];

export function pageMeta(key: PageKey): PageMeta {
  return PAGES.find((p) => p.key === key)!;
}
