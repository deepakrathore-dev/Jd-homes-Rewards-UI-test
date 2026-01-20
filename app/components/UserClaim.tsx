"use client";

import { useState, useEffect, ReactNode } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { readContract, writeContract } from "@wagmi/core";
import { formatUnits, parseAbi } from "viem";
import { config } from "@/app/config/WagmiConfig";
import { CONTRACT_ADDRESS } from "@/app/config/contract";
import CONTRACT_ABI from "@/app/utils/contractABI.json";

import type { MerkleLeaf } from "@/app/utils/merkle";

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

const metadataAbi = parseAbi([
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
]);

// Campaign Card Component
function CampaignCard({
  id,
  campaign,
  onCheckEligibility,
  tokenMeta,
}: {
  id: number;
  campaign: Campaign;
  onCheckEligibility: (id: number) => void;
  tokenMeta: { symbol: string; name: string; decimals: number };
}) {
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
        <button
          onClick={() => onCheckEligibility(id)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
        >
          Check Eligibility
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
          <p className="text-gray-600 dark:text-gray-400">Token</p>
          <p className="font-mono text-xs text-gray-900 dark:text-white break-all">
            {campaign.token.slice(0, 10)}...
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UserClaim() {
  const { address, isConnected } = useAccount();
  const [campaignId, setCampaignId] = useState("");
  const [userLeaf, setUserLeaf] = useState<MerkleLeaf | null>(null);
  const [merkleProof, setMerkleProof] = useState<`0x${string}`[]>([]);
  const [isClaimed, setIsClaimed] = useState<boolean | null>(null);
  const [campaignInfo, setCampaignInfo] = useState<Campaign | null>(null);
  const [proofError, setProofError] = useState<string>("");
  const [claimHash, setClaimHash] = useState<`0x${string}` | undefined>();
  const [isClaiming, setIsClaiming] = useState(false);
  const [tokenMeta, setTokenMeta] = useState<{
    symbol: string;
    name: string;
    decimals: number;
  }>({ symbol: "", name: "", decimals: 18 });

  // All campaigns
  const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
  const [campaignIds, setCampaignIds] = useState<number[]>([]);
  const [campaignTokenMetas, setCampaignTokenMetas] = useState<
    Record<number, { symbol: string; name: string; decimals: number }>
  >({});

  const { isLoading: isConfirming, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({
      hash: claimHash,
    });

  // Read campaign info
  const { data, refetch: refetchCampaign } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI.abi,
    functionName: "campaigns",
    args: campaignId ? [BigInt(campaignId)] : undefined,
    query: { enabled: !!campaignId },
  });

  const campaignData = data as CampaignTuple | undefined;

  // Read all campaigns
  const { data: allCampaignsData, refetch: refetchCampaigns } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI.abi,
    functionName: "getAllCampaigns",
  });

  // Check if already claimed
  const { data: claimedStatus, refetch: refetchClaimed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI.abi,
    functionName: "isClaimed",
    args:
      campaignId && userLeaf
        ? [BigInt(campaignId), BigInt(userLeaf.index)]
        : undefined,
    query: { enabled: !!campaignId && !!userLeaf },
  });

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

      // Fetch token metadata for all campaigns
      campaigns.forEach((campaign, index) => {
        const id = index + 1;
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
            setCampaignTokenMetas((prev) => ({
              ...prev,
              [id]: {
                symbol: symbol as string,
                name: name as string,
                decimals: Number(decimals),
              },
            }));
          } catch (e) {
            console.error(`Error fetching token metadata for campaign ${id}:`, e);
          }
        })();
      });
    }
  }, [allCampaignsData]);

  useEffect(() => {
    if (campaignData) {
      setCampaignInfo({
        token: campaignData[0] as `0x${string}`,
        merkleRoot: campaignData[1] as `0x${string}`,
        totalAllocation: campaignData[2],
        totalFunded: campaignData[3],
        totalClaimed: campaignData[4],
        expiry: campaignData[5],
        active: campaignData[6],
      });
    }
  }, [campaignData]);

  // Fetch token metadata for display/formatting
  useEffect(() => {
    if (!campaignInfo?.token) return;

    let cancelled = false;
    (async () => {
      try {
        const [symbol, name, decimals] = await Promise.all([
          readContract(config, {
            address: campaignInfo.token,
            abi: metadataAbi,
            functionName: "symbol",
          }),
          readContract(config, {
            address: campaignInfo.token,
            abi: metadataAbi,
            functionName: "name",
          }),
          readContract(config, {
            address: campaignInfo.token,
            abi: metadataAbi,
            functionName: "decimals",
          }),
        ]);

        if (!cancelled) {
          setTokenMeta({
            symbol: symbol as string,
            name: name as string,
            decimals: Number(decimals),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setTokenMeta({ symbol: "", name: "", decimals: 18 });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [campaignInfo?.token]);

  useEffect(() => {
    if (claimedStatus !== undefined) {
      setIsClaimed(claimedStatus as boolean);
    }
  }, [claimedStatus]);

  // Check eligibility and fetch proof from MongoDB
  const handleCheckEligibility = async (id: number) => {
    setCampaignId(id.toString());
    setUserLeaf(null);
    setMerkleProof([]);
    setProofError("");

    if (!address || !isConnected) {
      setProofError("Please connect your wallet");
      return;
    }

    try {
      // Fetch proof from API
      const response = await fetch(
        `/api/campaigns/${id}/proof?address=${address}`
      );

      if (!response.ok) {
        const error = await response.json();
        setProofError(error.error || "Failed to fetch proof");
        setUserLeaf(null);
        setMerkleProof([]);
        return;
      }

      const data = await response.json();
      if (data.success && data.data) {
        const proofData = data.data;

        // Set user leaf from API response
        setUserLeaf({
          index: proofData.index,
          account: proofData.address as `0x${string}`,
          amount: BigInt(proofData.amount),
        });

        // Set merkle proof from API
        setMerkleProof(proofData.proof as `0x${string}`[]);
        setProofError("");

        // Update claimed status
        setIsClaimed(proofData.claimed);

        refetchCampaign();
      } else {
        setProofError("No reward found for your address in this campaign");
        setUserLeaf(null);
        setMerkleProof([]);
      }
    } catch (error) {
      console.error("Error fetching proof:", error);
      setProofError("Failed to fetch proof from database");
      setUserLeaf(null);
      setMerkleProof([]);
    }
  };

  // Auto-fetch proof when campaign ID changes (if address is available)
  useEffect(() => {
    if (!campaignId || !address || !isConnected) {
      return;
    }

    // Fetch proof from API
    (async () => {
      try {
        const response = await fetch(
          `/api/campaigns/${campaignId}/proof?address=${address}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const proofData = data.data;

            setUserLeaf({
              index: proofData.index,
              account: proofData.address as `0x${string}`,
              amount: BigInt(proofData.amount),
            });

            setMerkleProof(proofData.proof as `0x${string}`[]);
            setProofError("");
            setIsClaimed(proofData.claimed);
          } else {
            setUserLeaf(null);
            setMerkleProof([]);
          }
        } else {
          setUserLeaf(null);
          setMerkleProof([]);
        }
      } catch (error) {
        console.error("Error fetching proof:", error);
        setUserLeaf(null);
        setMerkleProof([]);
      }
    })();
  }, [campaignId, address, isConnected]);

  // Refetch claim status when user leaf changes
  useEffect(() => {
    if (userLeaf && campaignId) {
      refetchClaimed();
    }
  }, [userLeaf, campaignId, refetchClaimed]);

  const campaignInfoRows: { label: string; value: ReactNode }[] = (
    campaignInfo
      ? [
        {
          label: "Token",
          value: (
            <span className="font-mono text-xs break-all">
              {campaignInfo.token}
            </span>
          ),
        },
        {
          label: "Total Allocation",
          value: `${formatUnits(
            campaignInfo.totalAllocation,
            tokenMeta.decimals
          )} ${tokenMeta.symbol || "tokens"}`,
        },
        {
          label: "Total Funded",
          value: `${formatUnits(
            campaignInfo.totalFunded,
            tokenMeta.decimals
          )} ${tokenMeta.symbol || "tokens"}`,
        },
        {
          label: "Total Claimed",
          value: `${formatUnits(
            campaignInfo.totalClaimed,
            tokenMeta.decimals
          )} ${tokenMeta.symbol || "tokens"}`,
        },
        {
          label: "Active",
          value: campaignInfo.active ? "Yes" : "No",
        },
        {
          label: "Merkle Root",
          value: (
            <span className="font-mono text-[11px] break-all">
              {campaignInfo.merkleRoot}
            </span>
          ),
        },
      ]
      : []
  );

  const rewardInfoRows: { label: string; value: ReactNode }[] = userLeaf
    ? [
      {
        label: "Index",
        value: userLeaf.index,
      },
      {
        label: "Amount",
        value: `${formatUnits(userLeaf.amount, tokenMeta.decimals)} ${tokenMeta.symbol || "tokens"}`,
      },
      {
        label: "Account",
        value: <span className="font-mono text-xs break-all">{address}</span>,
      },
    ]
    : [];

  const handleClaim = async () => {
    if (!campaignId || !address || !userLeaf || merkleProof.length === 0) {
      alert("Please enter campaign ID and ensure your reward is found");
      return;
    }

    if (isClaimed) {
      alert("This reward has already been claimed");
      return;
    }

    if (proofError) {
      alert(`Error: ${proofError}`);
      return;
    }

    try {
      setIsClaiming(true);
      const hash = await writeContract(config, {
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI.abi,
        functionName: "claim",
        args: [
          BigInt(campaignId),
          BigInt(userLeaf.index),
          address,
          userLeaf.amount,
          merkleProof,
        ],
      });
      setClaimHash(hash);

      // Mark as claimed in MongoDB after transaction is submitted
      // Note: In production, you might want to wait for confirmation
      try {
        await fetch(`/api/campaigns/${campaignId}/mark-claimed`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            index: userLeaf.index,
            txHash: hash,
          }),
        });
      } catch (dbError) {
        console.error("Error marking reward as claimed in DB:", dbError);
        // Don't fail the claim if DB update fails
      }
    } catch (error) {
      console.error("Error claiming reward:", error);
      alert("Failed to claim reward. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Please connect your wallet to claim rewards
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Claim Rewards
        </h2>

        {/* All Campaigns Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Available Campaigns ({allCampaigns.length})
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
                const meta = campaignTokenMetas[id] || {
                  symbol: "",
                  name: "",
                  decimals: 18,
                };

                return (
                  <CampaignCard
                    key={id}
                    id={id}
                    campaign={campaign}
                    onCheckEligibility={handleCheckEligibility}
                    tokenMeta={meta}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Claim Section */}
        {campaignId && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Claim Your Reward - Campaign #{campaignId}
            </h3>

            {campaignInfo && (
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    Campaign Information
                  </h4>
                  <span className="text-xs text-gray-500 dark:text-gray-300">
                    {tokenMeta.name || "Token"}{" "}
                    {tokenMeta.symbol && `(${tokenMeta.symbol})`}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {campaignInfoRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between rounded-lg bg-white/60 dark:bg-gray-800/60 px-3 py-2 border border-gray-200 dark:border-gray-600"
                    >
                      <span className="text-gray-600 dark:text-gray-300">
                        {row.label}
                      </span>
                      <span className="text-gray-900 dark:text-white text-right ml-3">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Reward Info */}
            {userLeaf && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  Your Reward Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {rewardInfoRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between rounded-lg bg-white/70 dark:bg-green-950/40 px-3 py-2 border border-green-200 dark:border-green-700"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {row.label}
                      </span>
                      <span className="text-gray-900 dark:text-white text-right ml-3">
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {proofError && (
              <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                <p className="text-red-800 dark:text-red-200 text-sm">
                  ⚠️ {proofError}
                </p>
              </div>
            )}

            {merkleProof.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
                <p className="text-blue-800 dark:text-blue-200 text-sm mb-2">
                  ✓ Merkle proof generated automatically ({merkleProof.length}{" "}
                  elements)
                </p>
                <details className="mt-2">
                  <summary className="text-xs text-blue-600 dark:text-blue-400 cursor-pointer">
                    View Proof
                  </summary>
                  <pre className="mt-2 text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded overflow-auto">
                    {JSON.stringify(merkleProof, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            {isClaimed !== null && (
              <div
                className={`p-4 rounded-lg mb-4 ${isClaimed
                  ? "bg-red-100 dark:bg-red-900"
                  : "bg-green-100 dark:bg-green-900"
                  }`}
              >
                <p
                  className={
                    isClaimed
                      ? "text-red-800 dark:text-red-200"
                      : "text-green-800 dark:text-green-200"
                  }
                >
                  {isClaimed
                    ? "⚠️ This reward has already been claimed"
                    : "✅ This reward is available to claim"}
                </p>
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={
                isClaiming ||
                isConfirming ||
                isClaimed === true ||
                merkleProof.length === 0 ||
                !userLeaf ||
                !!proofError
              }
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isClaiming || isConfirming
                ? "Claiming..."
                : isClaimSuccess
                  ? "Claimed Successfully!"
                  : !userLeaf
                    ? "Check Eligibility First"
                    : merkleProof.length === 0
                      ? "Generating Proof..."
                      : "Claim Reward"}
            </button>

            {isClaimSuccess && (
              <div className="mt-4 p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <p className="text-green-800 dark:text-green-200">
                  🎉 Reward claimed successfully!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
