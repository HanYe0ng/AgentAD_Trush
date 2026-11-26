import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { ChainProvider } from "@/components/chain-provider";
import { CampaignProvider } from "@/components/campaign-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentAd Trust",
  description: "AI 에이전트 광고 집계 검증 · 블록체인 공동 승인 시연",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ChainProvider>
          <CampaignProvider>
            <AppShell>{children}</AppShell>
          </CampaignProvider>
        </ChainProvider>
      </body>
    </html>
  );
}
