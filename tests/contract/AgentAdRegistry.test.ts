import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { keccak256, stringToHex, toHex } from "viem";

const id = (value: string) => stringToHex(value, { size: 32 });
const hash = (value: string) => keccak256(toHex(value));

const CAMPAIGN_STATUS = { None: 0, Proposed: 1, Active: 2 } as const;
const STATUS = { None: 0, Submitted: 1, Verified: 2, Rejected: 3, Disputed: 4, Finalized: 5 } as const;

describe("AgentAdRegistry", async function () {
  const { viem, networkHelpers } = await network.create();
  const [admin, advertiser, publisher, verifier, outsider, otherAdvertiser] = await viem.getWalletClients();

  const CAMPAIGN = id("CAM-001-TEST");
  const REPORT = id("RPT-001-TEST");
  const POLICY_ID = id("AGENTAD-PRESENTED-V1");
  const POLICY_HASH = hash("policy-json");
  const TERMS = hash("contract-terms");
  const EVIDENCE = hash("evidence-bundle");
  const VERIFICATION = hash("verification-result");

  async function deployRegistry() {
    const registry = await viem.deployContract("AgentAdRegistry", [admin.account.address]);
    await registry.write.grantRole([await registry.read.ADVERTISER_ROLE(), advertiser.account.address]);
    await registry.write.grantRole([await registry.read.ADVERTISER_ROLE(), otherAdvertiser.account.address]);
    await registry.write.grantRole([await registry.read.PUBLISHER_ROLE(), publisher.account.address]);
    await registry.write.grantRole([await registry.read.VERIFIER_ROLE(), verifier.account.address]);
    return { registry };
  }

  async function propose(registry: Awaited<ReturnType<typeof deployRegistry>>["registry"]) {
    const now = BigInt(await networkHelpers.time.latest());
    return registry.write.registerCampaign(
      [CAMPAIGN, POLICY_ID, POLICY_HASH, TERMS, publisher.account.address, verifier.account.address, now, now + 86_400n],
      { account: advertiser.account },
    );
  }

  async function deployWithProposal() {
    const { registry } = await deployRegistry();
    await propose(registry);
    return { registry };
  }

  async function deployWithActiveCampaign() {
    const { registry } = await deployWithProposal();
    await registry.write.acceptCampaign([CAMPAIGN, TERMS], { account: publisher.account });
    return { registry };
  }

  async function deployWithSubmittedReport() {
    const { registry } = await deployWithActiveCampaign();
    await registry.write.submitReport([REPORT, CAMPAIGN, 5n, EVIDENCE], { account: publisher.account });
    return { registry };
  }

  async function deployWithVerifiedReport() {
    const { registry } = await deployWithSubmittedReport();
    await registry.write.verifyReport([REPORT, 2n, 0n, VERIFICATION, true], { account: verifier.account });
    return { registry };
  }

  describe("계약 기준 확정 (광고주 제안 + 광고 매체 수락)", function () {
    it("광고주가 정책 버전·정책 해시·계약 조건 해시를 제안한다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployRegistry);
      await viem.assertions.emit(propose(registry), registry, "CampaignProposed");
      const c = await registry.read.getCampaign([CAMPAIGN]);
      assert.equal(c.status, CAMPAIGN_STATUS.Proposed);
      assert.equal(c.policyId, POLICY_ID);
      assert.equal(c.policyHash, POLICY_HASH);
      assert.equal(c.termsHash, TERMS);
    });

    it("지정된 매체가 같은 조건 해시로 수락하면 계약이 활성화된다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithProposal);
      await viem.assertions.emitWithArgs(
        registry.write.acceptCampaign([CAMPAIGN, TERMS], { account: publisher.account }),
        registry,
        "CampaignActivated",
        [CAMPAIGN, (a: string) => a.toLowerCase() === publisher.account.address.toLowerCase(), TERMS],
      );
      assert.equal((await registry.read.getCampaign([CAMPAIGN])).status, CAMPAIGN_STATUS.Active);
    });

    it("다른 조건 해시로는 수락할 수 없다 (합의 내용 불일치)", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithProposal);
      await viem.assertions.revertWithCustomError(
        registry.write.acceptCampaign([CAMPAIGN, hash("other-terms")], { account: publisher.account }),
        registry,
        "TermsMismatch",
      );
    });

    it("이미 제안된 캠페인은 다시 등록(기준 변경)할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithProposal);
      await viem.assertions.revertWithCustomError(propose(registry), registry, "CampaignAlreadyRegistered");
    });

    it("광고주 권한이 없는 지갑은 계약을 제안할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployRegistry);
      const now = BigInt(await networkHelpers.time.latest());
      await viem.assertions.revertWithCustomError(
        registry.write.registerCampaign(
          [CAMPAIGN, POLICY_ID, POLICY_HASH, TERMS, publisher.account.address, verifier.account.address, now, now + 100n],
          { account: outsider.account },
        ),
        registry,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("매체와 검증기관이 같은 지갑이면 독립 검증이 아니므로 거부한다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployRegistry);
      await registry.write.grantRole([await registry.read.VERIFIER_ROLE(), publisher.account.address]);
      const now = BigInt(await networkHelpers.time.latest());
      await viem.assertions.revertWithCustomError(
        registry.write.registerCampaign(
          [CAMPAIGN, POLICY_ID, POLICY_HASH, TERMS, publisher.account.address, publisher.account.address, now, now + 100n],
          { account: advertiser.account },
        ),
        registry,
        "PartiesNotIndependent",
      );
    });

    it("매체가 수락하지 않은 계약에는 실적을 제출할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithProposal);
      await viem.assertions.revertWithCustomError(
        registry.write.submitReport([REPORT, CAMPAIGN, 5n, EVIDENCE], { account: publisher.account }),
        registry,
        "InvalidCampaignStatus",
      );
    });
  });

  describe("보고 → 검증 → 확정 / 이의 제기", function () {
    it("매체 제출, 검증기관 검증(인정·보류 건수), 광고주 확정이 서로 다른 지갑으로 기록된다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithActiveCampaign);
      await viem.assertions.emit(
        registry.write.submitReport([REPORT, CAMPAIGN, 5n, EVIDENCE], { account: publisher.account }),
        registry,
        "ReportSubmitted",
      );
      await viem.assertions.emitWithArgs(
        registry.write.verifyReport([REPORT, 2n, 1n, VERIFICATION, true], { account: verifier.account }),
        registry,
        "ReportVerified",
        [REPORT, CAMPAIGN, (a: string) => a.toLowerCase() === verifier.account.address.toLowerCase(), 2n, 1n, VERIFICATION],
      );
      await viem.assertions.emitWithArgs(
        registry.write.approveReport([REPORT], { account: advertiser.account }),
        registry,
        "ReportFinalized",
        [REPORT, CAMPAIGN, (a: string) => a.toLowerCase() === advertiser.account.address.toLowerCase(), 2n],
      );
      const r = await registry.read.getReport([REPORT]);
      assert.equal(r.status, STATUS.Finalized);
      assert.equal(r.reportedCount, 5n);
      assert.equal(r.verifiedCount, 2n);
      assert.equal(r.heldCount, 1n);
      assert.equal(r.evidenceHash, EVIDENCE);
      assert.equal(r.verificationHash, VERIFICATION);
    });

    it("광고주는 검증 결과에 이의를 제기할 수 있고, 사유 해시가 기록된다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithVerifiedReport);
      const reason = hash("화면 증빙 재확인 요청");
      await viem.assertions.emit(
        registry.write.disputeReport([REPORT, reason], { account: advertiser.account }),
        registry,
        "ReportDisputed",
      );
      const r = await registry.read.getReport([REPORT]);
      assert.equal(r.status, STATUS.Disputed);
      assert.equal(r.disputeReasonHash, reason);
      await viem.assertions.revertWithCustomError(
        registry.write.approveReport([REPORT], { account: advertiser.account }),
        registry,
        "InvalidStatus",
      );
    });

    it("검증되지 않은 실적은 광고주가 최종 승인할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithSubmittedReport);
      await viem.assertions.revertWithCustomError(
        registry.write.approveReport([REPORT], { account: advertiser.account }),
        registry,
        "InvalidStatus",
      );
    });

    it("증빙 해시 불일치(검증 실패)면 반려되고, 반려된 보고는 승인할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithSubmittedReport);
      await viem.assertions.emit(
        registry.write.verifyReport([REPORT, 2n, 0n, VERIFICATION, false], { account: verifier.account }),
        registry,
        "ReportRejected",
      );
      assert.equal((await registry.read.getReport([REPORT])).status, STATUS.Rejected);
      await viem.assertions.revertWithCustomError(
        registry.write.approveReport([REPORT], { account: advertiser.account }),
        registry,
        "InvalidStatus",
      );
    });
  });

  describe("무단 승인 거부", function () {
    it("검증기관 권한이 없는 지갑의 검증 등록을 거부한다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithSubmittedReport);
      await viem.assertions.revertWithCustomError(
        registry.write.verifyReport([REPORT, 5n, 0n, VERIFICATION, true], { account: publisher.account }),
        registry,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("광고주 권한이 없는 지갑의 최종 승인·이의 제기를 거부한다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithVerifiedReport);
      await viem.assertions.revertWithCustomError(
        registry.write.approveReport([REPORT], { account: verifier.account }),
        registry,
        "AccessControlUnauthorizedAccount",
      );
      await viem.assertions.revertWithCustomError(
        registry.write.disputeReport([REPORT, hash("x")], { account: publisher.account }),
        registry,
        "AccessControlUnauthorizedAccount",
      );
    });

    it("광고주 권한이 있어도 해당 캠페인의 광고주가 아니면 승인할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithVerifiedReport);
      await viem.assertions.revertWithCustomError(
        registry.write.approveReport([REPORT], { account: otherAdvertiser.account }),
        registry,
        "NotCampaignParticipant",
      );
    });

    it("캠페인에 지정되지 않은 지갑은 계약을 수락하거나 보고를 제출할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithProposal);
      await viem.assertions.revertWithCustomError(
        registry.write.acceptCampaign([CAMPAIGN, TERMS], { account: outsider.account }),
        registry,
        "AccessControlUnauthorizedAccount",
      );
    });
  });

  describe("중복 제출·재처리 거부", function () {
    it("같은 보고서 ID를 다시 제출하면 거부한다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithSubmittedReport);
      await viem.assertions.revertWithCustomError(
        registry.write.submitReport([REPORT, CAMPAIGN, 9n, hash("other-evidence")], { account: publisher.account }),
        registry,
        "ReportAlreadyExists",
      );
    });

    it("같은 증빙을 다른 보고서로 이중 청구하면 거부한다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithSubmittedReport);
      await viem.assertions.revertWithCustomError(
        registry.write.submitReport([id("RPT-002-TEST"), CAMPAIGN, 5n, EVIDENCE], { account: publisher.account }),
        registry,
        "EvidenceAlreadyUsed",
      );
    });

    it("반려되거나 이의 제기된 보고의 증빙은 새 보고서로 다시 제출할 수 있다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithVerifiedReport);
      await registry.write.disputeReport([REPORT, hash("reason")], { account: advertiser.account });
      await registry.write.submitReport([id("RPT-002-TEST"), CAMPAIGN, 5n, EVIDENCE], { account: publisher.account });
      assert.equal((await registry.read.getReport([id("RPT-002-TEST")])).status, STATUS.Submitted);
    });

    it("이미 검증된 보고서는 다시 검증할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithVerifiedReport);
      await viem.assertions.revertWithCustomError(
        registry.write.verifyReport([REPORT, 3n, 0n, VERIFICATION, true], { account: verifier.account }),
        registry,
        "InvalidStatus",
      );
    });

    it("이미 확정된 보고서는 다시 승인할 수 없다", async function () {
      const { registry } = await networkHelpers.loadFixture(deployWithVerifiedReport);
      await registry.write.approveReport([REPORT], { account: advertiser.account });
      await viem.assertions.revertWithCustomError(
        registry.write.approveReport([REPORT], { account: advertiser.account }),
        registry,
        "InvalidStatus",
      );
    });
  });
});
