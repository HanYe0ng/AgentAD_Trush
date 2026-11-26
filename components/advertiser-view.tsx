"use client";

import { useState, type ReactNode } from "react";
import { Check, Clock, FilePenLine, Lock, Megaphone, PackagePlus, ShoppingBag } from "lucide-react";
import { api, formatDate, formatWon } from "@/lib/client/api";
import { latestReport } from "@/lib/client/progress";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/blockchain/shared";
import type { CampaignView } from "@/lib/views";
import { useChain } from "@/components/chain-provider";
import { useCampaign, type CampaignRow } from "@/components/campaign-provider";
import { PageHeader } from "@/components/app-shell";
import { ProductThumb } from "@/components/product-thumb";
import { SettlementResult } from "@/components/results";
import { pageMeta } from "@/components/roles";
import { Badge, Button, Card, cx, Empty, Field, HashText, inputClass, SectionLabel, TxLink } from "@/components/ui";
import { useAction } from "@/components/use-action";
import { approveReportOnChain, disputeReportOnChain, proposeCampaignOnChain } from "@/components/chain-actions";

function toDateInput(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const today = new Date();
const DEFAULT_FORM = {
  productName: "모아 데일리 텀블러",
  price: 24000,
  category: "텀블러",
  keywords: "텀블러,출근,보온,보냉,커피",
  description: "450mL · 한 손으로 여는 슬라이드 뚜껑, 8시간 보온",
  advertiserName: "모아리빙",
  publisherName: "숍메이트 AI",
  verifierName: "트러스트랩 검증센터",
  startDate: toDateInput(today),
  endDate: toDateInput(new Date(today.getTime() + 30 * 86_400_000)),
};

export function AdvertiserView() {
  const { config, ready, signerFor } = useChain();
  const { campaigns, currentId, detail, refresh, select } = useCampaign();
  const [form, setForm] = useState(DEFAULT_FORM);
  const register = useAction();
  const set = <K extends keyof typeof DEFAULT_FORM>(k: K, v: (typeof DEFAULT_FORM)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    void register.run("create", async () => {
      const { campaign } = await api<{ campaign: CampaignView }>("/api/campaigns", {
        body: {
          name: `${form.productName} AI 추천 광고`,
          advertiserName: form.advertiserName,
          publisherName: form.publisherName,
          verifierName: form.verifierName,
          startAt: new Date(`${form.startDate}T00:00:00`).toISOString(),
          endAt: new Date(`${form.endDate}T23:59:59`).toISOString(),
          offers: [
            {
              productName: form.productName,
              brand: form.advertiserName,
              price: Number(form.price),
              category: form.category,
              keywords: form.keywords,
              description: form.description,
            },
          ],
        },
      });
      await refresh(campaign.id);
      await proposeCampaignOnChain(config!, signerFor("advertiser"), campaign);
      await refresh(campaign.id);
      return {
        tone: "success",
        title: "광고를 등록하고 계약을 블록체인에 제안했습니다",
        body: "이제 광고 매체가 같은 조건으로 수락하면 계약이 확정됩니다.",
      };
    });
  }

  return (
    <div>
      <PageHeader page={pageMeta("advertiser")} title="광고 상품 · 계약" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card icon={<PackagePlus size={18} />} title="광고 상품 등록" subtitle="후원할 상품과 계약 조건을 정하고, 한 번에 블록체인에 계약을 제안합니다.">
          <div className="space-y-5">
            <div className="space-y-3">
              <SectionLabel icon={<ShoppingBag size={16} />}>상품 정보 (광고 대상)</SectionLabel>
              <Field label="상품명" required>
                <input className={inputClass} value={form.productName} onChange={(e) => set("productName", e.target.value)} />
              </Field>
              <Field label="가격(원)" required>
                <input type="number" className={inputClass} value={form.price} onChange={(e) => set("price", Number(e.target.value))} />
              </Field>
              <Field label="카테고리" required>
                <input className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)} />
              </Field>
              <Field label="추천 키워드" hint="소비자 질문에 이 단어가 있으면 쇼핑 AI에게 광고가 전달됩니다.">
                <input className={inputClass} value={form.keywords} onChange={(e) => set("keywords", e.target.value)} />
              </Field>
              <Field label="한 줄 설명">
                <input className={inputClass} value={form.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
            </div>

            <div className="space-y-3">
              <SectionLabel icon={<Megaphone size={16} />}>후원 정보 (광고 관계)</SectionLabel>
              <Field label="광고주" required>
                <input className={inputClass} value={form.advertiserName} onChange={(e) => set("advertiserName", e.target.value)} />
              </Field>
              <Field label="광고 표기" hint="소비자 화면에 반드시 함께 보여야 하는 문구입니다. 빠지면 정산이 보류됩니다.">
                <span className="inline-block rounded-lg bg-emerald-800 px-2.5 py-1 text-[12.5px] font-bold text-white">
                  유료 광고 · {form.advertiserName || "광고주"}
                </span>
              </Field>
            </div>

            <div className="space-y-3">
              <SectionLabel icon={<FilePenLine size={16} />}>계약 조건</SectionLabel>
              <Field label="정산 기준">
                <p className="text-[14px] font-semibold text-stone-800">
                  소비자 화면에 표시된 건만 인정 <span className="font-normal text-stone-400">(AI가 받기만 하거나 추천만 한 건 제외)</span>
                </p>
              </Field>
              <Field label="광고 매체">
                <input className={inputClass} value={form.publisherName} onChange={(e) => set("publisherName", e.target.value)} />
              </Field>
              <Field label="검증기관">
                <input className={inputClass} value={form.verifierName} onChange={(e) => set("verifierName", e.target.value)} />
              </Field>
              <Field label="기간">
                <div className="flex items-center gap-2">
                  <input type="date" className={inputClass} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
                  <span className="text-stone-400">~</span>
                  <input type="date" className={inputClass} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
                </div>
              </Field>
            </div>

            {register.view}
            <Button size="lg" className="w-full" disabled={!ready} loading={register.busy === "create"} onClick={submit} data-testid="register-ad">
              등록하고 계약 제안하기 (광고주 서명)
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <ApprovalCard />
          <MyAds campaigns={campaigns} currentId={currentId} onSelect={select} refreshAll={() => refresh(currentId ?? undefined)} />
          {detail && <TermsCard campaign={detail.campaign} />}
        </div>
      </div>
    </div>
  );
}

function ApprovalCard() {
  const { config, ready, signerFor } = useChain();
  const { detail, refresh } = useCampaign();
  const action = useAction();
  const [reason, setReason] = useState("표시 기록 원본 재확인 요청");
  const report = latestReport(detail);
  const v = report?.latestVerification;

  let body;
  if (!report || report.status === "PENDING_CHAIN") {
    body = <Empty icon={<Clock size={22} />} title="아직 승인할 실적이 없습니다">매체가 실적을 보고하고 검증기관이 검증하면 여기서 최종 승인합니다.</Empty>;
  } else if (report.status === "SUBMITTED") {
    body = (
      <div className="flex items-start gap-3 rounded-xl bg-stone-50 p-4 text-[13.5px] text-stone-600">
        <Lock size={18} className="mt-0.5 shrink-0 text-stone-400" />
        <div>
          매체가 <b>{report.reportedCount}건</b>을 보고했습니다. 검증기관이 결과를 블록체인에 등록하면 승인할 수 있습니다.
          <p className="mt-1 text-[12px] text-stone-400">화면에서 막는 것이 아니라, 컨트랙트가 ‘검증 완료’ 상태에서만 승인을 받아들입니다.</p>
        </div>
      </div>
    );
  } else if (report.status === "REJECTED") {
    body = <p className="rounded-xl bg-rose-50 p-4 text-[13.5px] text-rose-800">검증기관이 증빙 불일치로 반려한 보고서입니다. 매체가 다시 보고해야 합니다.</p>;
  } else {
    body = (
      <div className="space-y-4">
        {v && <SettlementResult result={v.result} />}
        {report.status === "VERIFIED" && (
          <div className="space-y-2 border-t border-stone-100 pt-4">
            <Button
              size="lg"
              className="w-full"
              disabled={!ready}
              loading={action.busy === "approve"}
              data-testid="approve"
              onClick={() =>
                action.run(
                  "approve",
                  async () => {
                    await approveReportOnChain(config!, signerFor("advertiser"), report);
                    return { tone: "success", title: `인정 실적 ${v?.verifiedCount ?? 0}건을 최종 확정했습니다.` };
                  },
                  () => refresh(),
                )
              }
            >
              <Check size={18} /> 인정 실적 {v?.verifiedCount ?? 0}건 최종 승인
            </Button>
            <div className="flex gap-2">
              <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="이의 제기 사유" />
              <Button
                variant="danger"
                className="shrink-0 whitespace-nowrap"
                disabled={!ready || !reason.trim()}
                loading={action.busy === "dispute"}
                data-testid="dispute"
                onClick={() =>
                  action.run(
                    "dispute",
                    async () => {
                      await disputeReportOnChain(config!, signerFor("advertiser"), report, reason);
                      return { tone: "warning", title: "이의 제기를 블록체인에 기록했습니다.", body: "매체는 원본을 보완해 다시 보고할 수 있습니다." };
                    },
                    () => refresh(),
                  )
                }
              >
                이의 제기
              </Button>
            </div>
          </div>
        )}
        {report.status === "FINALIZED" && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-[14px] font-semibold text-emerald-800" data-testid="finalized">
            <Check size={18} /> {report.onChainVerified}건 최종 확정 · <TxLink hash={report.approveTxHash} />
          </p>
        )}
        {report.status === "DISPUTED" && (
          <p className="rounded-xl bg-amber-50 p-3 text-[13.5px] text-amber-900" data-testid="disputed">
            이의 제기됨: {report.disputeReason} · <TxLink hash={report.disputeTxHash} />
          </p>
        )}
      </div>
    );
  }

  return (
    <Card icon={<Check size={18} />} title="검증된 실적 승인" subtitle={report ? `${report.id} · 매체 보고 ${report.reportedCount}건` : "현재 캠페인의 최신 보고서"}>
      <div className="space-y-3">
        {action.view}
        {body}
      </div>
    </Card>
  );
}

function MyAds({
  campaigns,
  currentId,
  onSelect,
  refreshAll,
}: {
  campaigns: CampaignRow[] | null;
  currentId: string | null;
  onSelect: (id: string) => void;
  refreshAll: () => Promise<void>;
}) {
  const { config, ready, signerFor } = useChain();
  const action = useAction();
  return (
    <Card title="등록한 광고" subtitle="선택한 광고가 모든 화면의 ‘현재 캠페인’이 됩니다.">
      {action.view}
      {!campaigns || campaigns.length === 0 ? (
        <Empty title="등록한 광고가 없습니다">왼쪽에서 첫 광고를 등록하세요.</Empty>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((c) => {
            const offer = c.offers[0];
            const current = c.id === currentId;
            return (
              <li
                key={c.id}
                className={cx("flex items-center gap-3 rounded-xl border p-3", current ? "border-emerald-400 bg-emerald-50/50" : "border-stone-200")}
                data-testid={`ad-${c.id}`}
              >
                <ProductThumb category={offer?.category ?? ""} brand={offer?.brand ?? ""} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-bold text-stone-900">{offer?.productName}</p>
                  <p className="text-[12px] text-stone-500">
                    {c.advertiserName} · {offer ? formatWon(offer.price) : ""} · {formatDate(c.startAt)}~
                  </p>
                </div>
                <Badge tone={c.chainStatus === "ACTIVE" ? "success" : "warning"}>{CAMPAIGN_STATUS_LABEL[c.chainStatus]}</Badge>
                {c.chainStatus === "DRAFT" ? (
                  <Button
                    size="sm"
                    disabled={!ready}
                    loading={action.busy === c.id}
                    onClick={() =>
                      action.run(
                        c.id,
                        async () => {
                          await proposeCampaignOnChain(config!, signerFor("advertiser"), c);
                          return { tone: "success", title: "계약을 블록체인에 제안했습니다." };
                        },
                        refreshAll,
                      )
                    }
                  >
                    계약 제안
                  </Button>
                ) : (
                  !current && (
                    <Button size="sm" variant="secondary" onClick={() => onSelect(c.id)}>
                      선택
                    </Button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function TermsCard({ campaign }: { campaign: CampaignView }) {
  return (
    <Card title="블록체인에 제안한 계약" subtitle="계약 조건 전체의 지문(해시)이 체인에 기록되어, 집행 후에는 기준을 바꿀 수 없습니다.">
      <dl className="grid gap-2 text-[13px]">
        <Row label="계약 상태" value={<Badge tone={campaign.chainStatus === "ACTIVE" ? "success" : "warning"}>{CAMPAIGN_STATUS_LABEL[campaign.chainStatus]}</Badge>} />
        <Row label="정산 기준" value="소비자 화면 표시 (같은 답변 안의 반복은 1건)" />
        <Row label="계약 조건 해시" value={<HashText value={campaign.termsHash} />} />
        <Row label="제안 트랜잭션" value={<TxLink hash={campaign.proposeTxHash} />} />
        <Row label="수락 트랜잭션" value={<TxLink hash={campaign.acceptTxHash} />} />
      </dl>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-2 last:border-0">
      <dt className="text-stone-500">{label}</dt>
      <dd className="text-right text-stone-800">{value}</dd>
    </div>
  );
}
