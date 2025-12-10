// Contract configuration
// Replace with actual values when available

export const CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const; // Dummy address - replace with actual

// Dummy admin address - replace with actual
export const ADMIN_ADDRESS =
  "0xb87d7543e47cd48c2987a3ab545da1dde6c18a7c" as const;

// Contract ABI - Replace with actual ABI when available
export const CONTRACT_ABI = [
  {
    inputs: [
      { internalType: "uint256", name: "propertyId", type: "uint256" },
      { internalType: "address", name: "token", type: "address" },
      { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
      { internalType: "uint256", name: "totalAllocation", type: "uint256" },
      { internalType: "uint256", name: "expiry", type: "uint256" },
      { internalType: "bool", name: "active", type: "bool" },
    ],
    name: "createCampaign",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "campaignId", type: "uint256" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "fundCampaign",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "campaignId", type: "uint256" },
      { internalType: "uint256", name: "index", type: "uint256" },
      { internalType: "address", name: "account", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "bytes32[]", name: "merkleProof", type: "bytes32[]" },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "campaignId", type: "uint256" },
      { internalType: "uint256", name: "index", type: "uint256" },
    ],
    name: "isClaimed",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "propertyId", type: "uint256" }],
    name: "getPropertyCampaigns",
    outputs: [{ internalType: "uint256[]", name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    name: "campaigns",
    outputs: [
      { internalType: "address", name: "token", type: "address" },
      { internalType: "bytes32", name: "merkleRoot", type: "bytes32" },
      { internalType: "uint256", name: "totalAllocation", type: "uint256" },
      { internalType: "uint256", name: "totalFunded", type: "uint256" },
      { internalType: "uint256", name: "totalClaimed", type: "uint256" },
      { internalType: "uint256", name: "expiry", type: "uint256" },
      { internalType: "bool", name: "active", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "nextCampaignId",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ERC20 Token ABI for approve and allowance
export const ERC20_ABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
