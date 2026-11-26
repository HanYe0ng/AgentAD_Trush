import type { Campaign, Offer } from "@prisma/client";
import { getAddress, isAddress, isAddressEqual, type Hex } from "viem";
import { z } from "zod";
import { ApiError } from "@/lib/api/http";
import { prisma } from "@/lib/db";
import { nextChainId, nextId } from "@/lib/ids";
import { buildContractTerms, serializeTerms } from "@/lib/campaigns/terms";
import { DEMO_POLICY_ID, findPolicy, getPolicy, policyHash, POLICIES } from "@/lib/policy/policies";
import { confirmRegistryTx, loadDeployment, readOnChainCampaign } from "@/lib/blockchain/server";

const address = z
  .string()
  .refine((v) => isAddress(v), "올바른 지갑 주소가 아닙니다.")
  .transform((v) => getAddress(v));

export const CreateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(80),
  policyId: z
    .string()
    .default(DEMO_POLICY_ID)
    .refine((id) => POLICIES.some((p) => p.policyId === id), "등록되지 않은 집계 정책입니다."),
  advertiserName: z.string().trim().min(1).max(40),
  publisherName: z.string().trim().min(1).max(40),
  verifierName: z.string().trim().min(1).max(40),
  advertiserAddress: address.optional(),
  publisherAddress: address.optional(),
  verifierAddress: address.optional(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  offers: z
    .array(
      z.object({
        productName: z.string().trim().min(1).max(60),
        brand: z.string().trim().min(1).max(40),
        price: z.number().int().min(0),
        category: z.string().trim().min(1).max(30),
        keywords: z.string().trim().min(1).max(200),
        description: z.string().trim().max(200).default(""),
      }),
    )
    .min(1)
    .max(5),
});

export type CampaignWithOffers = Campaign & { offers: Offer[] };

/** DB 컬럼 + 현재 정책 파일로 계약 조건을 다시 만든다 (검증 시 DB·정책 변조 탐지에 사용) */
export function rebuildTerms(campaign: CampaignWithOffers) {
  return serializeTerms(
    buildContractTerms({
      campaignId: campaign.id,
      name: campaign.name,
      policy: getPolicy(campaign.policyId),
      advertiser: { name: campaign.advertiserName, address: campaign.advertiserAddress },
      publisher: { name: campaign.publisherName, address: campaign.publisherAddress },
      verifier: { name: campaign.verifierName, address: campaign.verifierAddress },
      startAt: campaign.startAt.toISOString(),
      endAt: campaign.endAt.toISOString(),
      offers: campaign.offers.map((o) => ({ offerId: o.id, productName: o.productName, brand: o.brand, price: o.price })),
    }),
  );
}

export async function createCampaign(raw: unknown) {
  const input = CreateCampaignSchema.parse(raw);
  if (input.endAt <= input.startAt) throw new ApiError(400, "종료일은 시작일 이후여야 합니다.");
  const policy = getPolicy(input.policyId);

  const deployment = loadDeployment();
  const advertiserAddress = input.advertiserAddress ?? deployment?.roles.advertiser;
  const publisherAddress = input.publisherAddress ?? deployment?.roles.publisher;
  const verifierAddress = input.verifierAddress ?? deployment?.roles.verifier;
  if (!advertiserAddress || !publisherAddress || !verifierAddress) {
    throw new ApiError(400, "참여자 지갑 주소가 없습니다. 컨트랙트를 배포하거나 주소를 직접 입력하세요.");
  }

  const campaignId = await nextChainId("CAM");
  const offers = [];
  for (const o of input.offers) offers.push({ ...o, id: await nextId("AD", 3) });

  const { json, hash } = serializeTerms(
    buildContractTerms({
      campaignId,
      name: input.name,
      policy,
      advertiser: { name: input.advertiserName, address: advertiserAddress },
      publisher: { name: input.publisherName, address: publisherAddress },
      verifier: { name: input.verifierName, address: verifierAddress },
      startAt: input.startAt.toISOString(),
      endAt: input.endAt.toISOString(),
      offers: offers.map((o) => ({ offerId: o.id, productName: o.productName, brand: o.brand, price: o.price })),
    }),
  );

  return prisma.campaign.create({
    data: {
      id: campaignId,
      name: input.name,
      advertiserName: input.advertiserName,
      advertiserAddress,
      publisherName: input.publisherName,
      publisherAddress,
      verifierName: input.verifierName,
      verifierAddress,
      policyId: policy.policyId,
      policyHash: policyHash(policy),
      startAt: input.startAt,
      endAt: input.endAt,
      termsJson: json,
      termsHash: hash,
      offers: {
        create: offers.map((o) => ({
          id: o.id,
          productName: o.productName,
          brand: o.brand,
          price: o.price,
          category: o.category,
          keywords: o.keywords,
          description: o.description,
        })),
      },
    },
    include: { offers: true },
  });
}

export async function getCampaignOrThrow(id: string): Promise<CampaignWithOffers> {
  const campaign = await prisma.campaign.findUnique({ where: { id }, include: { offers: true } });
  if (!campaign) throw new ApiError(404, `캠페인 ${id}을(를) 찾을 수 없습니다.`);
  return campaign;
}

/**
 * 광고주 제안(registerCampaign) / 매체 수락(acceptCampaign) 트랜잭션의 영수증과 온체인 상태를
 * 서버가 직접 확인한 뒤 DB 상태를 갱신한다.
 */
export async function confirmCampaignTx(id: string, action: "propose" | "accept", txHash: Hex) {
  const campaign = await getCampaignOrThrow(id);
  await confirmRegistryTx(txHash, {
    events: [action === "propose" ? "CampaignProposed" : "CampaignActivated"],
    idField: "campaignId",
    id,
  });
  const onChain = await readOnChainCampaign(id);
  if (!onChain) throw new ApiError(400, "블록체인에서 캠페인을 찾을 수 없습니다.");

  const policy = findPolicy(campaign.policyId);
  if (!policy || onChain.policyId !== campaign.policyId || onChain.policyHash.toLowerCase() !== policyHash(policy).toLowerCase()) {
    throw new ApiError(409, "온체인 집계 정책(버전·해시)이 캠페인과 다릅니다.");
  }
  if (onChain.termsHash.toLowerCase() !== campaign.termsHash.toLowerCase()) {
    throw new ApiError(409, "온체인 계약 조건 해시가 DB와 다릅니다.");
  }
  if (
    !isAddressEqual(onChain.advertiser, campaign.advertiserAddress as Hex) ||
    !isAddressEqual(onChain.publisher, campaign.publisherAddress as Hex) ||
    !isAddressEqual(onChain.verifier, campaign.verifierAddress as Hex)
  ) {
    throw new ApiError(409, "온체인 참여자 지갑이 캠페인 설정과 다릅니다.");
  }

  const deployment = loadDeployment();
  return prisma.campaign.update({
    where: { id },
    data:
      action === "propose"
        ? { chainStatus: onChain.status === "Active" ? "ACTIVE" : "PROPOSED", proposeTxHash: txHash, chainId: deployment?.chainId ?? null }
        : {
            chainStatus: onChain.status === "Active" ? "ACTIVE" : campaign.chainStatus,
            acceptTxHash: txHash,
            activatedAt: onChain.activatedAt ? new Date(onChain.activatedAt * 1000) : new Date(),
          },
    include: { offers: true },
  });
}
