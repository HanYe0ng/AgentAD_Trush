// 자동 생성 파일 - 직접 수정하지 마세요. (npm run chain:build)
// source: contracts/AgentAdRegistry.sol

export const agentAdRegistryAbi = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "admin",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AccessControlBadConfirmation",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "neededRole",
        "type": "bytes32"
      }
    ],
    "name": "AccessControlUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      }
    ],
    "name": "CampaignAlreadyRegistered",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      }
    ],
    "name": "CampaignNotFound",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "evidenceHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      }
    ],
    "name": "EvidenceAlreadyUsed",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "internalType": "enum AgentAdRegistry.CampaignStatus",
        "name": "current",
        "type": "uint8"
      },
      {
        "internalType": "enum AgentAdRegistry.CampaignStatus",
        "name": "expected",
        "type": "uint8"
      }
    ],
    "name": "InvalidCampaignStatus",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidInput",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "InvalidParticipant",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidPeriod",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "internalType": "enum AgentAdRegistry.ReportStatus",
        "name": "current",
        "type": "uint8"
      },
      {
        "internalType": "enum AgentAdRegistry.ReportStatus",
        "name": "expected",
        "type": "uint8"
      }
    ],
    "name": "InvalidStatus",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "NotCampaignParticipant",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "PartiesNotIndependent",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      }
    ],
    "name": "ReportAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      }
    ],
    "name": "ReportNotFound",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "expected",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "provided",
        "type": "bytes32"
      }
    ],
    "name": "TermsMismatch",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "termsHash",
        "type": "bytes32"
      }
    ],
    "name": "CampaignActivated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "advertiser",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "verifier",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "policyId",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "policyHash",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "termsHash",
        "type": "bytes32"
      }
    ],
    "name": "CampaignProposed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "advertiser",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "reasonHash",
        "type": "bytes32"
      }
    ],
    "name": "ReportDisputed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "advertiser",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "finalCount",
        "type": "uint256"
      }
    ],
    "name": "ReportFinalized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "verifier",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "verifiedCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "heldCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "verificationHash",
        "type": "bytes32"
      }
    ],
    "name": "ReportRejected",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "reportedCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "evidenceHash",
        "type": "bytes32"
      }
    ],
    "name": "ReportSubmitted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "verifier",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "verifiedCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "heldCount",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "verificationHash",
        "type": "bytes32"
      }
    ],
    "name": "ReportVerified",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "previousAdminRole",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "newAdminRole",
        "type": "bytes32"
      }
    ],
    "name": "RoleAdminChanged",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleGranted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "account",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "sender",
        "type": "address"
      }
    ],
    "name": "RoleRevoked",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "ADVERTISER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "DEFAULT_ADMIN_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PUBLISHER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "VERIFIER_ROLE",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "termsHash",
        "type": "bytes32"
      }
    ],
    "name": "acceptCampaign",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      }
    ],
    "name": "approveReport",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "reasonHash",
        "type": "bytes32"
      }
    ],
    "name": "disputeReport",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "evidenceHash",
        "type": "bytes32"
      }
    ],
    "name": "evidenceUsedBy",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      }
    ],
    "name": "getCampaign",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "policyId",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "policyHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "termsHash",
            "type": "bytes32"
          },
          {
            "internalType": "address",
            "name": "advertiser",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "publisher",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "verifier",
            "type": "address"
          },
          {
            "internalType": "uint64",
            "name": "startTime",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "endTime",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "proposedAt",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "activatedAt",
            "type": "uint64"
          },
          {
            "internalType": "enum AgentAdRegistry.CampaignStatus",
            "name": "status",
            "type": "uint8"
          }
        ],
        "internalType": "struct AgentAdRegistry.Campaign",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      }
    ],
    "name": "getReport",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "campaignId",
            "type": "bytes32"
          },
          {
            "internalType": "uint256",
            "name": "reportedCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "verifiedCount",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "heldCount",
            "type": "uint256"
          },
          {
            "internalType": "bytes32",
            "name": "evidenceHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "verificationHash",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "disputeReasonHash",
            "type": "bytes32"
          },
          {
            "internalType": "enum AgentAdRegistry.ReportStatus",
            "name": "status",
            "type": "uint8"
          },
          {
            "internalType": "uint64",
            "name": "submittedAt",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "verifiedAt",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "closedAt",
            "type": "uint64"
          }
        ],
        "internalType": "struct AgentAdRegistry.Report",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      }
    ],
    "name": "getRoleAdmin",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "grantRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "hasRole",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "policyId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "policyHash",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "termsHash",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "publisher",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "verifier",
        "type": "address"
      },
      {
        "internalType": "uint64",
        "name": "startTime",
        "type": "uint64"
      },
      {
        "internalType": "uint64",
        "name": "endTime",
        "type": "uint64"
      }
    ],
    "name": "registerCampaign",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "callerConfirmation",
        "type": "address"
      }
    ],
    "name": "renounceRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "role",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "revokeRole",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "internalType": "bytes32",
        "name": "campaignId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "reportedCount",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "evidenceHash",
        "type": "bytes32"
      }
    ],
    "name": "submitReport",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes4",
        "name": "interfaceId",
        "type": "bytes4"
      }
    ],
    "name": "supportsInterface",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "reportId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "verifiedCount",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "heldCount",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "verificationHash",
        "type": "bytes32"
      },
      {
        "internalType": "bool",
        "name": "evidenceIntact",
        "type": "bool"
      }
    ],
    "name": "verifyReport",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
