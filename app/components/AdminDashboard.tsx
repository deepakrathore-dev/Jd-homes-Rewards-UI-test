"use client";

import { useState, useEffect, ReactNode } from "react";
import { useAccount, useReadContract } from "wagmi";
import { readContract, writeContract } from "@wagmi/core";
import { formatUnits, parseUnits, parseAbi } from "viem";
import { config } from "@/app/config/WagmiConfig";
import { CONTRACT_ADDRESS, ADMIN_ADDRESS } from "@/app/config/contract";
import CONTRACT_ABI from "@/app/utils/contractABI.json";
import {
  generateMerkleTree,
  getMerkleRoot,
  type MerkleLeaf,
} from "@/app/utils/merkle";
import { storeMerkleLeaves } from "@/app/utils/merkleStorage";
import { waitForTransactionReceipt } from "@wagmi/core";
import { useToken } from "@/app/components/hooks/useToken";

const metadataAbi = parseAbi([
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
]);

const DEFAULT_TOKEN = {
  label: "USDT",
  address: "0x17B8334F89209Cda855F55201e0C99E838A21784" as `0x${string}`,
};

// Campaign Card Component
function CampaignCard({
  id,
  campaign,
  onFund,
  onViewDetails,
}: {
  id: number;
  campaign: Campaign;
  onFund: (id: number, amount: string) => void;
  onViewDetails: (id: number) => void;
}) {
  const [tokenMeta, setTokenMeta] = useState<{
    symbol: string;
    name: string;
    decimals: number;
  }>({ symbol: "", name: "", decimals: 18 });

  useEffect(() => {
    (async () => {
      try {
        const [symbol, name, decimals] = await Promise.all([
          readContract(config, {
            address: campaign.token,
            abi: metadataAbi,
            functionName: "symbol",
          }),
          readContract(config, {
            address: campaign.token,
            abi: metadataAbi,
            functionName: "name",
          }),
          readContract(config, {
            address: campaign.token,
            abi: metadataAbi,
            functionName: "decimals",
          }),
        ]);
        setTokenMeta({
          symbol: symbol as string,
          name: name as string,
          decimals: Number(decimals),
        });
      } catch (e) {
        console.error("Error fetching token metadata:", e);
      }
    })();
  }, [campaign.token]);

  const expiryDate = campaign.expiry > BigInt(0)
    ? new Date(Number(campaign.expiry) * 1000).toLocaleString()
    : "No expiry";

  const unclaimedAmount = campaign.totalFunded - campaign.totalClaimed;

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Campaign #{id}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {campaign.active ? (
              <span className="text-green-600 dark:text-green-400">Active</span>
            ) : (
              <span className="text-gray-600 dark:text-gray-400">Inactive</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onViewDetails(id)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
          >
            View Details
          </button>
          {campaign.totalFunded < campaign.totalAllocation && (
            <button
              onClick={() => {
                const remaining = campaign.totalAllocation - campaign.totalFunded;
                onFund(
                  id,
                  formatUnits(remaining, tokenMeta.decimals || 18)
                );
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              Fund
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
        <div>
          <p className="text-gray-600 dark:text-gray-400">Total Allocation</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatUnits(campaign.totalAllocation, tokenMeta.decimals || 18)}{" "}
            {tokenMeta.symbol || "tokens"}
          </p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Total Funded</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatUnits(campaign.totalFunded, tokenMeta.decimals || 18)}{" "}
            {tokenMeta.symbol || "tokens"}
          </p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Total Claimed</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatUnits(campaign.totalClaimed, tokenMeta.decimals || 18)}{" "}
            {tokenMeta.symbol || "tokens"}
          </p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Unclaimed</p>
          <p className="font-medium text-gray-900 dark:text-white">
            {formatUnits(unclaimedAmount, tokenMeta.decimals || 18)}{" "}
            {tokenMeta.symbol || "tokens"}
          </p>
        </div>
        <div>
          <p className="text-gray-600 dark:text-gray-400">Expiry</p>
          <p className="font-medium text-gray-900 dark:text-white text-xs">
            {expiryDate}
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Token: <span className="font-mono">{campaign.token}</span>
        </p>
      </div>
    </div>
  );
}

// Default reward entries
const DEFAULT_REWARD_ENTRIES = [
  {
    address: "0x47aB98793ccbde62190fe0ea51121C78f9635d41",
    amount: "100",
  },
  {
    address: "0x1b1b41a6C7005C0557F9763F89e27174CeC6d4CD",
    amount: "200",
  },
];

interface RewardEntry {
  address: string;
  amount: string;
}

type Campaign = {
  token: `0x${string}`;
  merkleRoot: `0x${string}`;
  totalAllocation: bigint;
  totalFunded: bigint;
  totalClaimed: bigint;
  expiry: bigint;
  active: boolean;
};

type CampaignTuple = [
  string, // token
  string, // merkleRoot
  bigint, // totalAllocation
  bigint, // totalFunded
  bigint, // totalClaimed
  bigint, // expiry
  boolean // active
];

export default function AdminDashboard() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"create" | "campaigns">("create");

  // Create Campaign State
  const [tokenAddress, setTokenAddress] = useState<`0x${string}`>(
    DEFAULT_TOKEN.address
  );
  const [totalAllocation, setTotalAllocation] = useState("");
  const [expiry, setExpiry] = useState("");
  const [merkleLeaves, setMerkleLeaves] = useState<MerkleLeaf[]>([]);
  const [merkleRoot, setMerkleRoot] = useState<`0x${string}` | null>(null);
  const [rewardEntries, setRewardEntries] = useState<RewardEntry[]>(DEFAULT_REWARD_ENTRIES);
  const [entryError, setEntryError] = useState("");

  // Fund Campaign State
  const [fundCampaignId, setFundCampaignId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundTokenAddress, setFundTokenAddress] = useState<
    `0x${string}` | null
  >(null);

  // Transaction state
  const [isCreating, setIsCreating] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCreateSuccess, setIsCreateSuccess] = useState(false);
  const [isApproveSuccess, setIsApproveSuccess] = useState(false);
  const [isFundSuccess, setIsFundSuccess] = useState(false);
  const [createdCampaignId, setCreatedCampaignId] = useState<number | null>(null);

  // Token metadata
  const [createTokenMeta, setCreateTokenMeta] = useState<{
    symbol: string;
    name: string;
    decimals: number;
  }>({ symbol: "", name: "", decimals: 18 });

  const [fundTokenMeta, setFundTokenMeta] = useState<{
    symbol: string;
    name: string;
    decimals: number;
  }>({ symbol: "", name: "", decimals: 18 });

  // USDT Balance
  const [usdtBalance, setUsdtBalance] = useState<bigint>(BigInt(0));

  // All campaigns
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [campaignIds, setCampaignIds] = useState<number[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [selectedCampaignMeta, setSelectedCampaignMeta] = useState<{
    symbol: string;
    name: string;
    decimals: number;
  } | null>(null);
  const [isPausing, setIsPausing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState(address || "");

  // Read next campaign ID
  const { data: nextcampaign } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI.abi,
    functionName: "nextCampaignId",
  });

  const nextCampaignId = nextcampaign as bigint | undefined;

  // Read all campaigns
  const { data: allCampaignsData, refetch: refetchCampaigns } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI.abi,
    functionName: "getAllCampaigns",
  });

  // Read campaign for funding
  const { data: campaignData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI.abi,
    functionName: "campaigns",
    args: fundCampaignId ? [BigInt(fundCampaignId)] : undefined,
    query: { enabled: !!fundCampaignId },
  });

  const campaignTuple = campaignData as CampaignTuple | undefined;

  // Token helper hook for funding
  const {
    allowance,
    balance: tokenBalance,
    approve,
    fetchAllowance,
    getTokenMetadata,
  } = useToken({
    token: fundTokenAddress ?? undefined,
    owner: address ?? undefined,
    spender: CONTRACT_ADDRESS,
    onPrompt: () => {
      setIsApproving(true);
    },
    onSubmitted: () => { },
    onSuccess: async () => {
      setIsApproving(false);
      setIsApproveSuccess(true);
      setTimeout(() => {
        fetchAllowance().catch(() => { });
      }, 1500);
    },
    onError: () => {
      setIsApproving(false);
    },
  });

  // Fetch USDT balance
  useEffect(() => {
    if (!address || !isConnected) return;
    (async () => {
      try {
        const balance = await readContract(config, {
          address: DEFAULT_TOKEN.address,
          abi: metadataAbi,
          functionName: "balanceOf",
          args: [address],
        });
        setUsdtBalance(balance as bigint);
      } catch (e) {
        console.error("Error fetching USDT balance:", e);
      }
    })();
  }, [address, isConnected]);

  // Update token address when campaign data changes
  useEffect(() => {
    if (campaignTuple) {
      setFundTokenAddress(campaignTuple[0] as `0x${string}`);
    } else {
      setFundTokenAddress(null);
    }
  }, [campaignTuple]);

  // When token or account changes, fetch allowance/balance and metadata
  useEffect(() => {
    if (!fundTokenAddress) return;
    (async () => {
      try {
        await fetchAllowance();
      } catch (e) { }

      try {
        const meta = await getTokenMetadata();
        setFundTokenMeta(meta);
      } catch (e) { }
    })();
  }, [fundTokenAddress, address, fetchAllowance, getTokenMetadata]);

  // Fetch token metadata for create flow
  useEffect(() => {
    if (!tokenAddress) {
      setCreateTokenMeta({ symbol: "", name: "", decimals: 18 });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [symbol, name, decimals] = await Promise.all([
          readContract(config, {
            address: tokenAddress,
            abi: metadataAbi,
            functionName: "symbol",
          }),
          readContract(config, {
            address: tokenAddress,
            abi: metadataAbi,
            functionName: "name",
          }),
          readContract(config, {
            address: tokenAddress,
            abi: metadataAbi,
            functionName: "decimals",
          }),
        ]);
        if (!cancelled) {
          setCreateTokenMeta({
            symbol: symbol as string,
            name: name as string,
            decimals: Number(decimals),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setCreateTokenMeta({ symbol: "", name: "", decimals: 18 });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tokenAddress]);

  // Load all campaigns
  useEffect(() => {
    if (allCampaignsData) {
      const campaigns = allCampaignsData as Campaign[];
      setAllCampaigns(campaigns);
      const ids: number[] = [];
      for (let i = 1; i <= campaigns.length; i++) {
        ids.push(i);
      }
      setCampaignIds(ids);
    }
  }, [allCampaignsData]);

  // Refetch campaigns after create/fund
  useEffect(() => {
    if (isCreateSuccess || isFundSuccess) {
      setTimeout(() => {
        refetchCampaigns();
      }, 2000);
    }
  }, [isCreateSuccess, isFundSuccess, refetchCampaigns]);

  // Store leaves after campaign is created
  useEffect(() => {
    if (isCreateSuccess && createdCampaignId && merkleLeaves.length > 0) {
      storeMerkleLeaves(createdCampaignId, merkleLeaves);
    }
  }, [isCreateSuccess, createdCampaignId, merkleLeaves]);

  const isAdmin = address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  // Auto-generate merkle root whenever leaves change
  useEffect(() => {
    if (merkleLeaves.length > 0) {
      const tree = generateMerkleTree(merkleLeaves);
      const root = getMerkleRoot(tree);
      setMerkleRoot(root);
    } else {
      setMerkleRoot(null);
    }
  }, [merkleLeaves]);

  // Calculate total allocation from leaves
  useEffect(() => {
    if (merkleLeaves.length === 0) {
      setTotalAllocation("");
      return;
    }
    const sum = merkleLeaves.reduce((acc, leaf) => acc + leaf.amount, BigInt(0));
    const formatted = formatUnits(sum, createTokenMeta.decimals);
    setTotalAllocation(formatted);
  }, [merkleLeaves, createTokenMeta.decimals]);

  // Convert reward entries to merkle leaves
  useEffect(() => {
    if (rewardEntries.length === 0) {
      setMerkleLeaves([]);
      setEntryError("");
      return;
    }

    try {
      const leaves: MerkleLeaf[] = rewardEntries
        .filter((item) => item.address && item.amount)
        .map((item, index) => {
          if (!/^0x[a-fA-F0-9]{40}$/.test(item.address)) {
            throw new Error(
              `Invalid address format at row ${index + 1}: ${item.address}`
            );
          }

          const amount = parseUnits(
            item.amount.toString(),
            createTokenMeta.decimals
          );

          return {
            index: index,
            account: item.address.toLowerCase() as `0x${string}`,
            amount: amount,
          };
        });

      if (leaves.length === 0) {
        setMerkleLeaves([]);
        setEntryError("Please add at least one valid reward entry");
        return;
      }

      setMerkleLeaves(leaves);
      setEntryError("");
    } catch (error: any) {
      setEntryError(error.message || "Invalid entry format");
      setMerkleLeaves([]);
    }
  }, [rewardEntries, createTokenMeta.decimals]);

  const handleAddEntry = () => {
    setRewardEntries([...rewardEntries, { address: "", amount: "" }]);
  };

  const handleRemoveEntry = (index: number) => {
    setRewardEntries(rewardEntries.filter((_, i) => i !== index));
  };

  const handleUpdateEntry = (index: number, field: "address" | "amount", value: string) => {
    const updated = [...rewardEntries];
    updated[index] = { ...updated[index], [field]: value };
    setRewardEntries(updated);
  };

  const handleCreateCampaign = async () => {
    if (!merkleRoot) {
      alert("Please add at least one leaf to generate merkle root");
      return;
    }

    if (!tokenAddress || !totalAllocation) {
      alert("Please fill all required fields");
      return;
    }

    if (merkleLeaves.length === 0) {
      alert("Please add at least one leaf to the merkle tree");
      return;
    }

    const expiryTimestamp = expiry
      ? Math.floor(new Date(expiry).getTime() / 1000)
      : 0;

    try {
      setIsCreating(true);
      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI.abi,
        functionName: "createCampaign",
        args: [
          tokenAddress,
          merkleRoot,
          parseUnits(totalAllocation, createTokenMeta.decimals),
          BigInt(expiryTimestamp),
        ],
      });

      const receipt = await waitForTransactionReceipt(config, { hash });

      if (receipt) {
        const createdId = nextCampaignId ? Number(nextCampaignId) : null;

        // Store campaign and proofs in MongoDB
        if (createdId) {
          try {
            const expiryTimestamp = expiry
              ? Math.floor(new Date(expiry).getTime() / 1000)
              : undefined;

            // Convert BigInt values to strings for JSON serialization
            const leavesForApi = merkleLeaves.map((leaf) => ({
              index: leaf.index,
              account: leaf.account,
              amount: leaf.amount.toString(),
            }));

            const response = await fetch("/api/campaigns/create", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                campaignId: createdId,
                merkleRoot,
                rewardToken: tokenAddress,
                leaves: leavesForApi,
                expiry: expiryTimestamp,
              }),
            });

            if (!response.ok) {
              const error = await response.json();
              console.error("Error storing campaign in DB:", error);
              // Don't fail the whole operation, just log the error
            }
          } catch (dbError) {
            console.error("Error storing campaign in MongoDB:", dbError);
            // Don't fail the whole operation
          }
        }

        setIsCreating(false);
        setIsCreateSuccess(true);
        if (nextCampaignId) {
          setCreatedCampaignId(Number(nextCampaignId));
        }
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      alert("Failed to create campaign. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleApproveToken = async () => {
    if (!fundTokenAddress || !fundAmount) {
      alert("Please enter campaign ID and amount first");
      return;
    }
    try {
      const required = parseUnits(fundAmount, fundTokenMeta.decimals);
      await approve(required);
    } catch (error) {
      console.error("Error approving token:", error);
      alert("Failed to approve token. Please try again.");
      setIsApproving(false);
    }
  };

  const handleFundCampaign = async () => {
    if (!fundCampaignId || !fundAmount) {
      alert("Please fill all fields");
      return;
    }

    if (!fundTokenAddress) {
      alert("Please enter campaign ID to load token address");
      return;
    }

    const amount = parseUnits(fundAmount, fundTokenMeta.decimals);

    if (allowance < amount) {
      alert(
        `Insufficient allowance. Current: ${formatUnits(allowance, fundTokenMeta.decimals)}, Required: ${formatUnits(amount, fundTokenMeta.decimals)}. Please approve first.`
      );
      return;
    }

    if (tokenBalance < amount) {
      alert(
        `Insufficient balance. Current: ${formatUnits(tokenBalance, fundTokenMeta.decimals)}, Required: ${formatUnits(amount, fundTokenMeta.decimals)}`
      );
      return;
    }

    try {
      setIsFunding(true);
      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI.abi,
        functionName: "fundCampaign",
        args: [BigInt(fundCampaignId), amount],
      });
      const receipt = await waitForTransactionReceipt(config, { hash });

      if (receipt) {
        // Update funding status in MongoDB
        try {
          const campaignIdNum = Number(fundCampaignId);
          const newTotalFunded = campaignTuple
            ? campaignTuple[3] + amount
            : amount;

          await fetch(`/api/campaigns/${campaignIdNum}/update-funding`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              totalFunded: newTotalFunded.toString(),
              isFunded: true,
            }),
          });
        } catch (dbError) {
          console.error("Error updating funding in DB:", dbError);
          // Don't fail the operation
        }

        setIsFunding(false);
        setIsFundSuccess(true);
        setFundAmount("");
        refetchCampaigns();
      }
    } catch (error) {
      console.error("Error funding campaign:", error);
      alert("Failed to fund campaign. Please try again.");
    } finally {
      setIsFunding(false);
    }
  };

  const handleViewCampaignDetails = async (id: number) => {
    setSelectedCampaignId(id);
    setWithdrawAddress(address || "");
    const campaign = allCampaigns[id - 1];
    if (!campaign) return;

    try {
      const [symbol, name, decimals] = await Promise.all([
        readContract(config, {
          address: campaign.token,
          abi: metadataAbi,
          functionName: "symbol",
        }),
        readContract(config, {
          address: campaign.token,
          abi: metadataAbi,
          functionName: "name",
        }),
        readContract(config, {
          address: campaign.token,
          abi: metadataAbi,
          functionName: "decimals",
        }),
      ]);
      setSelectedCampaignMeta({
        symbol: symbol as string,
        name: name as string,
        decimals: Number(decimals),
      });
    } catch (e) {
      console.error("Error fetching token metadata:", e);
      setSelectedCampaignMeta({ symbol: "", name: "", decimals: 18 });
    }
  };

  const handlePauseResumeCampaign = async (id: number, newStatus: boolean) => {
    try {
      setIsPausing(true);
      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI.abi,
        functionName: "updateCampaignStatus",
        args: [BigInt(id), newStatus],
      });
      const receipt = await waitForTransactionReceipt(config, { hash });

      if (receipt) {
        setIsPausing(false);
        alert(`Campaign ${newStatus ? "activated" : "paused"} successfully!`);
        refetchCampaigns();
        if (selectedCampaignId === id) {
          const updated = await readContract(config, {
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI.abi,
            functionName: "campaigns",
            args: [BigInt(id)],
          });
          // Update local state
        }
      }
    } catch (error) {
      console.error("Error updating campaign status:", error);
      alert("Failed to update campaign status. Please try again.");
    } finally {
      setIsPausing(false);
    }
  };

  const handleWithdrawUnclaimed = async () => {
    if (!selectedCampaignId || !withdrawAmount || !withdrawAddress) {
      alert("Please fill all fields");
      return;
    }

    if (!selectedCampaignMeta) {
      alert("Campaign metadata not loaded");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(withdrawAddress)) {
      alert("Invalid address format");
      return;
    }

    const amount = parseUnits(withdrawAmount, selectedCampaignMeta.decimals);

    try {
      setIsWithdrawing(true);
      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI.abi,
        functionName: "withdrawUnclaimed",
        args: [
          BigInt(selectedCampaignId),
          withdrawAddress as `0x${string}`,
          amount,
        ],
      });
      const receipt = await waitForTransactionReceipt(config, { hash });

      if (receipt) {
        setIsWithdrawing(false);
        alert("Unclaimed funds withdrawn successfully!");
        setWithdrawAmount("");
        setWithdrawAddress("");
        refetchCampaigns();
      }
    } catch (error) {
      console.error("Error withdrawing unclaimed funds:", error);
      alert("Failed to withdraw unclaimed funds. Please try again.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const requiredAmount =
    fundAmount && fundAmount.trim() !== ""
      ? parseUnits(fundAmount, fundTokenMeta.decimals)
      : BigInt(0);

  const tokenInfoRows: { label: string; value: ReactNode }[] = (
    fundTokenAddress && fundCampaignId
      ? ([
        {
          label: "Token Address",
          value: (
            <span className="font-mono text-xs break-all">
              {fundTokenAddress}
            </span>
          ),
        },
        {
          label: "Your Balance",
          value: `${formatUnits(tokenBalance, fundTokenMeta.decimals)} ${fundTokenMeta.symbol || "tokens"}`,
        },
        {
          label: "Current Allowance",
          value: `${formatUnits(allowance, fundTokenMeta.decimals)} ${fundTokenMeta.symbol || "tokens"}`,
        },
        fundAmount
          ? {
            label: "Required Amount",
            value: `${formatUnits(requiredAmount, fundTokenMeta.decimals)} ${fundTokenMeta.symbol || "tokens"}`,
          }
          : null,
        campaignTuple
          ? {
            label: "Currently Funded",
            value: `${formatUnits(campaignTuple[3], fundTokenMeta.decimals)} ${fundTokenMeta.symbol || "tokens"}`,
          }
          : null,
        campaignTuple
          ? {
            label: "Remaining to Fund",
            value: `${formatUnits(
              campaignTuple[2] > campaignTuple[3]
                ? campaignTuple[2] - campaignTuple[3]
                : BigInt(0),
              fundTokenMeta.decimals
            )} ${fundTokenMeta.symbol || "tokens"}`,
          }
          : null,
      ] as ({ label: string; value: ReactNode } | null)[])
      : []
  ).filter((row): row is { label: string; value: ReactNode } => row !== null);

  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Please connect your wallet
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-red-600 dark:text-red-400">
          Access Denied: This address is not authorized as admin
        </p>
        <p className="text-sm text-gray-500 mt-2">Connected: {address}</p>
        <p className="text-sm text-gray-500">Admin: {ADMIN_ADDRESS}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h2>
          <div className="text-right">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              USDT Balance
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {formatUnits(usdtBalance, 6)} USDT
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 font-medium ${activeTab === "create"
              ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400"
              }`}
          >
            Create Campaign
          </button>
          <button
            onClick={() => setActiveTab("campaigns")}
            className={`px-4 py-2 font-medium ${activeTab === "campaigns"
              ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400"
              }`}
          >
            All Campaigns
          </button>
        </div>

        {/* Create Campaign Tab */}
        {activeTab === "create" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token *
                </label>
                <select
                  value={tokenAddress}
                  onChange={(e) =>
                    setTokenAddress(e.target.value as `0x${string}`)
                  }
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value={DEFAULT_TOKEN.address}>
                    {DEFAULT_TOKEN.label} ({DEFAULT_TOKEN.address})
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Total Allocation (USDT) *
                </label>
                <input
                  type="text"
                  value={totalAllocation}
                  readOnly
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white bg-gray-50 dark:bg-gray-800"
                  placeholder="Calculated from uploaded amounts"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expiry Date
                </label>
                <input
                  type="datetime-local"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Editable Rewards List */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Rewards List
                </h3>
                <button
                  onClick={handleAddEntry}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                >
                  + Add Entry
                </button>
              </div>

              {entryError && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    ⚠️ {entryError}
                  </p>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        #
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Address
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                        Amount ({createTokenMeta.symbol || "tokens"})
                      </th>
                      <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewardEntries.map((entry, index) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                          {index + 1}
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                          <input
                            type="text"
                            value={entry.address}
                            onChange={(e) =>
                              handleUpdateEntry(index, "address", e.target.value)
                            }
                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                            placeholder="0x..."
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                          <input
                            type="text"
                            value={entry.amount}
                            onChange={(e) =>
                              handleUpdateEntry(index, "amount", e.target.value)
                            }
                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                            placeholder="100"
                          />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                          <button
                            onClick={() => handleRemoveEntry(index)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm"
                            disabled={rewardEntries.length === 1}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {merkleLeaves.length > 0 && (
                <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    ✓ Processed {merkleLeaves.length} reward entries
                  </p>
                </div>
              )}

              {merkleRoot && (
                <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Generated Merkle Root:
                  </p>
                  <p className="text-xs font-mono text-gray-900 dark:text-white break-all">
                    {merkleRoot}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleCreateCampaign}
              disabled={isCreating || !merkleRoot}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isCreating
                ? "Creating Campaign..."
                : isCreateSuccess
                  ? "Campaign Created!"
                  : "Create Campaign"}
            </button>

            {isCreateSuccess && createdCampaignId && (
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <p className="text-green-800 dark:text-green-200 mb-3">
                  Campaign created successfully! Campaign ID: {createdCampaignId}
                </p>
                <button
                  onClick={() => {
                    setFundCampaignId(createdCampaignId.toString());
                    setActiveTab("campaigns");
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Fund This Campaign
                </button>
              </div>
            )}
          </div>
        )}

        {/* All Campaigns Tab */}
        {activeTab === "campaigns" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                All Campaigns ({allCampaigns.length})
              </h3>
              <button
                onClick={() => refetchCampaigns()}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
              >
                Refresh
              </button>
            </div>

            {allCampaigns.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No campaigns found
              </div>
            ) : (
              <div className="space-y-4">
                {campaignIds.map((id) => {
                  const campaign = allCampaigns[id - 1];
                  if (!campaign) return null;

                  return (
                    <CampaignCard
                      key={id}
                      id={id}
                      campaign={campaign}
                      onFund={(id, amount) => {
                        setFundCampaignId(id.toString());
                        setFundAmount(amount);
                      }}
                      onViewDetails={handleViewCampaignDetails}
                    />
                  );
                })}
              </div>
            )}

            {/* Campaign Details Section */}
            {selectedCampaignId && (() => {
              const campaign = allCampaigns[selectedCampaignId - 1];
              if (!campaign) return null;
              const meta = selectedCampaignMeta || { symbol: "", name: "", decimals: 18 };
              const expiryDate = campaign.expiry > BigInt(0)
                ? new Date(Number(campaign.expiry) * 1000).toLocaleString()
                : "No expiry";
              const unclaimedAmount = campaign.totalFunded - campaign.totalClaimed;
              const isExpired = campaign.expiry > BigInt(0) && Number(campaign.expiry) * 1000 < Date.now();

              return (
                <div className="mt-6 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      Campaign #{selectedCampaignId} Details
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedCampaignId(null);
                        setSelectedCampaignMeta(null);
                        setWithdrawAmount("");
                        setWithdrawAddress("");
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition text-sm"
                    >
                      Close
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Status</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {campaign.active ? (
                          <span className="text-green-600 dark:text-green-400">Active</span>
                        ) : (
                          <span className="text-gray-600 dark:text-gray-400">Inactive</span>
                        )}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Expiry</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {expiryDate}
                        {isExpired && (
                          <span className="ml-2 text-xs text-red-600 dark:text-red-400">(Expired)</span>
                        )}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Token Address</p>
                      <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                        {campaign.token}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Merkle Root</p>
                      <p className="text-xs font-mono text-gray-900 dark:text-white break-all">
                        {campaign.merkleRoot}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Allocation</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatUnits(campaign.totalAllocation, meta.decimals)} {meta.symbol || "tokens"}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Funded</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatUnits(campaign.totalFunded, meta.decimals)} {meta.symbol || "tokens"}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Claimed</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatUnits(campaign.totalClaimed, meta.decimals)} {meta.symbol || "tokens"}
                      </p>
                    </div>
                    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Unclaimed Amount</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatUnits(unclaimedAmount, meta.decimals)} {meta.symbol || "tokens"}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => handlePauseResumeCampaign(selectedCampaignId, !campaign.active)}
                        disabled={isPausing}
                        className={`flex-1 px-6 py-3 rounded-lg transition text-sm font-medium ${campaign.active
                          ? "bg-orange-600 hover:bg-orange-700 text-white"
                          : "bg-green-600 hover:bg-green-700 text-white"
                          } disabled:bg-gray-400 disabled:cursor-not-allowed`}
                      >
                        {isPausing
                          ? "Processing..."
                          : campaign.active
                            ? "Pause Campaign"
                            : "Resume Campaign"}
                      </button>
                    </div>

                    {/* Withdraw Unclaimed Funds */}
                    {unclaimedAmount > BigInt(0) && (isExpired || !campaign.active) && (
                      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">
                          Withdraw Unclaimed Funds
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Withdraw Amount ({meta.symbol || "tokens"}) *
                            </label>
                            <input
                              type="text"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                              placeholder={formatUnits(unclaimedAmount, meta.decimals)}
                            />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Available: {formatUnits(unclaimedAmount, meta.decimals)} {meta.symbol || "tokens"}
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Recipient Address *
                            </label>
                            <input
                              type="text"
                              value={withdrawAddress}
                              onChange={(e) => setWithdrawAddress(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                              placeholder="0x..."
                            />
                          </div>
                        </div>
                        <button
                          onClick={handleWithdrawUnclaimed}
                          disabled={
                            isWithdrawing ||
                            !withdrawAmount ||
                            !withdrawAddress ||
                            parseUnits(withdrawAmount || "0", meta.decimals) > unclaimedAmount
                          }
                          className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                        >
                          {isWithdrawing
                            ? "Withdrawing..."
                            : "Withdraw Unclaimed Funds"}
                        </button>
                        {!isExpired && campaign.active && (
                          <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-2">
                            ⚠️ Campaign must be expired or inactive to withdraw unclaimed funds
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Fund Campaign Section */}
            {fundCampaignId && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-semibold mb-4 text-gray-900 dark:text-white">
                  Fund Campaign #{fundCampaignId}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Amount *
                    </label>
                    <input
                      type="text"
                      value={fundAmount}
                      onChange={(e) => setFundAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      placeholder="100"
                    />
                  </div>
                </div>

                {fundTokenAddress && fundCampaignId && (
                  <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-900 dark:text-white">
                        Token Information
                      </h4>
                      <span className="text-xs text-gray-500 dark:text-gray-300">
                        {fundTokenMeta.name || "Token"}{" "}
                        {fundTokenMeta.symbol && `(${fundTokenMeta.symbol})`}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {tokenInfoRows.map((row, idx) => (
                        <div
                          key={idx}
                          className="flex items-start justify-between rounded-lg bg-white/60 dark:bg-gray-800/60 px-3 py-2 border border-gray-200 dark:border-gray-600"
                        >
                          <span className="text-gray-600 dark:text-gray-300">
                            {row?.label}
                          </span>
                          <span className="text-gray-900 dark:text-white text-right ml-3">
                            {row?.value as React.ReactNode}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {fundTokenAddress && fundAmount && (
                  <div
                    className={`p-4 rounded-lg mb-4 ${allowance >= requiredAmount
                      ? "bg-green-100 dark:bg-green-900"
                      : "bg-yellow-100 dark:bg-yellow-900"
                      }`}
                  >
                    {allowance >= requiredAmount ? (
                      <p className="text-green-800 dark:text-green-200">
                        ✓ Sufficient allowance. You can proceed to fund the
                        campaign.
                      </p>
                    ) : (
                      <p className="text-yellow-800 dark:text-yellow-200">
                        ⚠️ Insufficient allowance. Please approve tokens first
                        before funding.
                      </p>
                    )}
                  </div>
                )}

                {tokenBalance !== null &&
                  fundAmount &&
                  tokenBalance < requiredAmount && (
                    <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg mb-4">
                      <p className="text-red-800 dark:text-red-200">
                        ⚠️ Insufficient balance. You need{" "}
                        {formatUnits(
                          requiredAmount - tokenBalance,
                          fundTokenMeta.decimals
                        )}{" "}
                        more {fundTokenMeta.symbol || "tokens"}.
                      </p>
                    </div>
                  )}

                <div className="flex gap-3">
                  {fundTokenAddress && fundAmount && (
                    <button
                      onClick={handleApproveToken}
                      disabled={
                        isApproving ||
                        !fundTokenAddress ||
                        !fundAmount ||
                        allowance >= requiredAmount
                      }
                      className="flex-1 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                    >
                      {isApproving
                        ? "Approving..."
                        : isApproveSuccess
                          ? "Approved!"
                          : allowance >= requiredAmount
                            ? "Already Approved"
                            : "Approve Tokens"}
                    </button>
                  )}

                  <button
                    onClick={handleFundCampaign}
                    disabled={
                      isFunding ||
                      !fundCampaignId ||
                      !fundAmount ||
                      !fundTokenAddress ||
                      allowance < requiredAmount ||
                      tokenBalance < requiredAmount
                    }
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                  >
                    {isFunding
                      ? "Funding Campaign..."
                      : isFundSuccess
                        ? "Campaign Funded!"
                        : !fundTokenAddress
                          ? "Enter Campaign ID First"
                          : allowance < requiredAmount
                            ? "Approve Tokens First"
                            : tokenBalance < requiredAmount
                              ? "Insufficient Balance"
                              : "Fund Campaign"}
                  </button>
                </div>

                {isFundSuccess && (
                  <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                    <p className="text-green-800 dark:text-green-200">
                      Campaign funded successfully!
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
