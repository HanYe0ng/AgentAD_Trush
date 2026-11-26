// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AgentAdRegistry
/// @notice AI 에이전트 광고의 집계 계약(정책 버전·계약 조건 해시)을 광고주와 광고 매체가 합의해 확정하고,
///         매체 보고 → 독립 검증 → 광고주 확정/이의 제기 이력을 참여자들이 공동으로 기록·조회한다.
/// @dev 컨트랙트는 원본 광고 기록이 사실인지 스스로 알아낼 수 없다. 오프체인 정책 엔진의 판정 결과를
///      검증기관 지갑이 책임지고 제출하고, 그 공동 승인과 변경 이력만 체인에 남긴다.
contract AgentAdRegistry is AccessControl {
    bytes32 public constant ADVERTISER_ROLE = keccak256("ADVERTISER_ROLE");
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum CampaignStatus {
        None,
        Proposed, // 광고주가 계약 조건 제안
        Active // 광고 매체가 같은 조건 해시로 수락 → 계약 기준 확정
    }

    enum ReportStatus {
        None,
        Submitted,
        Verified,
        Rejected, // 증빙 해시 불일치 등 검증 실패 → 정산 보류
        Disputed, // 광고주 이의 제기
        Finalized
    }

    struct Campaign {
        bytes32 policyId; // 집계 정책 버전 (예: "AGENTAD-PRESENTED-V1")
        bytes32 policyHash; // 집계 정책 원문(JSON)의 keccak256
        bytes32 termsHash; // 계약 조건 원문의 keccak256 (정책 해시·참여자·기간·광고 제안 포함)
        address advertiser;
        address publisher;
        address verifier;
        uint64 startTime;
        uint64 endTime;
        uint64 proposedAt;
        uint64 activatedAt;
        CampaignStatus status;
    }

    struct Report {
        bytes32 campaignId;
        uint256 reportedCount; // 매체가 보고한 실적
        uint256 verifiedCount; // VALID: 계약 정책상 인정 실적
        uint256 heldCount; // INCONCLUSIVE: 증빙 부족으로 정산 보류된 건수
        bytes32 evidenceHash; // 매체가 제출한 증빙 번들 해시
        bytes32 verificationHash; // 검증 결과(판정 근거 포함) 해시
        bytes32 disputeReasonHash; // 이의 제기 사유 해시
        ReportStatus status;
        uint64 submittedAt;
        uint64 verifiedAt;
        uint64 closedAt; // 확정 또는 이의 제기 시각
    }

    mapping(bytes32 campaignId => Campaign) private _campaigns;
    mapping(bytes32 reportId => Report) private _reports;
    /// @notice 증빙 해시를 사용한 보고서 (같은 증빙으로 이중 청구 방지)
    mapping(bytes32 evidenceHash => bytes32 reportId) public evidenceUsedBy;

    event CampaignProposed(
        bytes32 indexed campaignId,
        address indexed advertiser,
        address publisher,
        address verifier,
        bytes32 policyId,
        bytes32 policyHash,
        bytes32 termsHash
    );
    event CampaignActivated(bytes32 indexed campaignId, address indexed publisher, bytes32 termsHash);
    event ReportSubmitted(
        bytes32 indexed reportId,
        bytes32 indexed campaignId,
        address indexed publisher,
        uint256 reportedCount,
        bytes32 evidenceHash
    );
    event ReportVerified(
        bytes32 indexed reportId,
        bytes32 indexed campaignId,
        address indexed verifier,
        uint256 verifiedCount,
        uint256 heldCount,
        bytes32 verificationHash
    );
    event ReportRejected(
        bytes32 indexed reportId,
        bytes32 indexed campaignId,
        address indexed verifier,
        uint256 verifiedCount,
        uint256 heldCount,
        bytes32 verificationHash
    );
    event ReportDisputed(bytes32 indexed reportId, bytes32 indexed campaignId, address indexed advertiser, bytes32 reasonHash);
    event ReportFinalized(bytes32 indexed reportId, bytes32 indexed campaignId, address indexed advertiser, uint256 finalCount);

    error InvalidInput();
    error InvalidPeriod();
    error PartiesNotIndependent();
    error InvalidParticipant(address account, bytes32 role);
    error CampaignAlreadyRegistered(bytes32 campaignId);
    error CampaignNotFound(bytes32 campaignId);
    error InvalidCampaignStatus(bytes32 campaignId, CampaignStatus current, CampaignStatus expected);
    error TermsMismatch(bytes32 expected, bytes32 provided);
    error NotCampaignParticipant(bytes32 campaignId, address account);
    error ReportAlreadyExists(bytes32 reportId);
    error ReportNotFound(bytes32 reportId);
    error EvidenceAlreadyUsed(bytes32 evidenceHash, bytes32 reportId);
    error InvalidStatus(bytes32 reportId, ReportStatus current, ReportStatus expected);

    constructor(address admin) {
        if (admin == address(0)) revert InvalidInput();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ───────────────────────────── 계약 (캠페인) ─────────────────────────────

    /// @notice 광고주가 집계 정책 버전과 계약 조건 해시를 제안한다.
    function registerCampaign(
        bytes32 campaignId,
        bytes32 policyId,
        bytes32 policyHash,
        bytes32 termsHash,
        address publisher,
        address verifier,
        uint64 startTime,
        uint64 endTime
    ) external onlyRole(ADVERTISER_ROLE) {
        if (campaignId == bytes32(0) || policyId == bytes32(0) || policyHash == bytes32(0) || termsHash == bytes32(0)) {
            revert InvalidInput();
        }
        if (_campaigns[campaignId].status != CampaignStatus.None) revert CampaignAlreadyRegistered(campaignId);
        if (endTime <= startTime) revert InvalidPeriod();
        if (!hasRole(PUBLISHER_ROLE, publisher)) revert InvalidParticipant(publisher, PUBLISHER_ROLE);
        if (!hasRole(VERIFIER_ROLE, verifier)) revert InvalidParticipant(verifier, VERIFIER_ROLE);
        if (publisher == msg.sender || verifier == msg.sender || publisher == verifier) revert PartiesNotIndependent();

        Campaign storage c = _campaigns[campaignId];
        c.policyId = policyId;
        c.policyHash = policyHash;
        c.termsHash = termsHash;
        c.advertiser = msg.sender;
        c.publisher = publisher;
        c.verifier = verifier;
        c.startTime = startTime;
        c.endTime = endTime;
        c.proposedAt = uint64(block.timestamp);
        c.status = CampaignStatus.Proposed;

        emit CampaignProposed(campaignId, msg.sender, publisher, verifier, policyId, policyHash, termsHash);
    }

    /// @notice 캠페인에 지정된 광고 매체가 같은 계약 조건 해시로 수락하면 계약 기준이 확정된다.
    function acceptCampaign(bytes32 campaignId, bytes32 termsHash) external onlyRole(PUBLISHER_ROLE) {
        Campaign storage c = _requireCampaign(campaignId);
        if (msg.sender != c.publisher) revert NotCampaignParticipant(campaignId, msg.sender);
        if (c.status != CampaignStatus.Proposed) {
            revert InvalidCampaignStatus(campaignId, c.status, CampaignStatus.Proposed);
        }
        if (termsHash != c.termsHash) revert TermsMismatch(c.termsHash, termsHash);

        c.status = CampaignStatus.Active;
        c.activatedAt = uint64(block.timestamp);
        emit CampaignActivated(campaignId, msg.sender, termsHash);
    }

    // ───────────────────────────── 보고 ─────────────────────────────

    /// @notice 광고 매체가 보고 실적과 증빙 해시를 제출한다. (확정된 계약만)
    function submitReport(bytes32 reportId, bytes32 campaignId, uint256 reportedCount, bytes32 evidenceHash)
        external
        onlyRole(PUBLISHER_ROLE)
    {
        Campaign storage c = _requireCampaign(campaignId);
        if (msg.sender != c.publisher) revert NotCampaignParticipant(campaignId, msg.sender);
        if (c.status != CampaignStatus.Active) revert InvalidCampaignStatus(campaignId, c.status, CampaignStatus.Active);
        if (reportId == bytes32(0) || evidenceHash == bytes32(0)) revert InvalidInput();
        if (_reports[reportId].status != ReportStatus.None) revert ReportAlreadyExists(reportId);

        // 같은 증빙은 이전 보고가 반려되었거나 이의 제기된 경우에만 다시 제출할 수 있다.
        bytes32 previous = evidenceUsedBy[evidenceHash];
        if (previous != bytes32(0)) {
            ReportStatus prev = _reports[previous].status;
            if (prev != ReportStatus.Rejected && prev != ReportStatus.Disputed) revert EvidenceAlreadyUsed(evidenceHash, previous);
        }
        evidenceUsedBy[evidenceHash] = reportId;

        Report storage r = _reports[reportId];
        r.campaignId = campaignId;
        r.reportedCount = reportedCount;
        r.evidenceHash = evidenceHash;
        r.status = ReportStatus.Submitted;
        r.submittedAt = uint64(block.timestamp);

        emit ReportSubmitted(reportId, campaignId, msg.sender, reportedCount, evidenceHash);
    }

    /// @notice 캠페인에 지정된 검증기관이 정책 엔진의 판정 결과를 등록한다.
    /// @param verifiedCount VALID 건수 (승인 가능)
    /// @param heldCount INCONCLUSIVE 건수 (증빙 부족, 정산 보류)
    /// @param evidenceIntact 증빙 무결성 통과 여부. false 이면 검증 실패(Rejected)로 기록된다.
    function verifyReport(
        bytes32 reportId,
        uint256 verifiedCount,
        uint256 heldCount,
        bytes32 verificationHash,
        bool evidenceIntact
    ) external onlyRole(VERIFIER_ROLE) {
        Report storage r = _requireReport(reportId);
        Campaign storage c = _campaigns[r.campaignId];
        if (msg.sender != c.verifier) revert NotCampaignParticipant(r.campaignId, msg.sender);
        if (r.status != ReportStatus.Submitted) revert InvalidStatus(reportId, r.status, ReportStatus.Submitted);
        if (verificationHash == bytes32(0)) revert InvalidInput();

        r.verifiedCount = verifiedCount;
        r.heldCount = heldCount;
        r.verificationHash = verificationHash;
        r.verifiedAt = uint64(block.timestamp);

        if (evidenceIntact) {
            r.status = ReportStatus.Verified;
            emit ReportVerified(reportId, r.campaignId, msg.sender, verifiedCount, heldCount, verificationHash);
        } else {
            r.status = ReportStatus.Rejected;
            emit ReportRejected(reportId, r.campaignId, msg.sender, verifiedCount, heldCount, verificationHash);
        }
    }

    /// @notice 캠페인 광고주가 독립 검증을 마친 실적(VALID)을 최종 확정한다.
    function approveReport(bytes32 reportId) external onlyRole(ADVERTISER_ROLE) {
        Report storage r = _requireVerifiedForAdvertiser(reportId);
        r.status = ReportStatus.Finalized;
        r.closedAt = uint64(block.timestamp);
        emit ReportFinalized(reportId, r.campaignId, msg.sender, r.verifiedCount);
    }

    /// @notice 캠페인 광고주가 검증 결과에 이의를 제기한다. 사유 원문은 오프체인, 해시만 기록한다.
    function disputeReport(bytes32 reportId, bytes32 reasonHash) external onlyRole(ADVERTISER_ROLE) {
        if (reasonHash == bytes32(0)) revert InvalidInput();
        Report storage r = _requireVerifiedForAdvertiser(reportId);
        r.status = ReportStatus.Disputed;
        r.disputeReasonHash = reasonHash;
        r.closedAt = uint64(block.timestamp);
        emit ReportDisputed(reportId, r.campaignId, msg.sender, reasonHash);
    }

    // ───────────────────────────── 조회 ─────────────────────────────

    function getCampaign(bytes32 campaignId) external view returns (Campaign memory) {
        return _requireCampaign(campaignId);
    }

    function getReport(bytes32 reportId) external view returns (Report memory) {
        return _requireReport(reportId);
    }

    function _requireCampaign(bytes32 campaignId) private view returns (Campaign storage c) {
        c = _campaigns[campaignId];
        if (c.status == CampaignStatus.None) revert CampaignNotFound(campaignId);
    }

    function _requireReport(bytes32 reportId) private view returns (Report storage r) {
        r = _reports[reportId];
        if (r.status == ReportStatus.None) revert ReportNotFound(reportId);
    }

    function _requireVerifiedForAdvertiser(bytes32 reportId) private view returns (Report storage r) {
        r = _requireReport(reportId);
        if (msg.sender != _campaigns[r.campaignId].advertiser) revert NotCampaignParticipant(r.campaignId, msg.sender);
        if (r.status != ReportStatus.Verified) revert InvalidStatus(reportId, r.status, ReportStatus.Verified);
    }
}
