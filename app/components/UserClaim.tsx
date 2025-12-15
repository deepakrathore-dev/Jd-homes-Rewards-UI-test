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

import {
  generateMerkleTree,
  getMerkleProof,
  type MerkleLeaf,
} from "@/app/utils/merkle";
import {
  getMerkleLeaves,
  findLeafByAccount,
  getCampaignProperty,
} from "@/app/utils/merkleStorage";

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
  string,   // token
  string,   // merkleRoot
  bigint,   // totalAllocation
  bigint,   // totalFunded
  bigint,   // totalClaimed
  bigint,   // expiry
  boolean   // active
];

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
  const [propertyId, setPropertyId] = useState<number | null>(null);

  const metadataAbi = parseAbi([
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function decimals() view returns (uint8)",
  ]);

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

  const campaignData = data as CampaignTuple;

  console.log("Campaign Data:", campaignData);

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
    const localProperty = getCampaignProperty(Number(campaignId));
    setPropertyId(localProperty);
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

  // Auto-find user's leaf and generate proof when campaign ID changes
  useEffect(() => {
    console.log("Generating proof for campaign ID:", campaignId);
    if (!campaignId || !address || !isConnected) {
      setUserLeaf(null);
      setMerkleProof([]);
      setProofError("");
      return;
    }

    // Find user's leaf
    const leaf = findLeafByAccount(Number(campaignId), address);
    console.log("Found leaf for user:", leaf);
    if (!leaf) {
      setUserLeaf(null);
      setMerkleProof([]);
      setProofError("No reward found for your address in this campaign");
      return;
    }

    setUserLeaf(leaf);
    setProofError("");

    // Get all leaves and generate proof
    const allLeaves = getMerkleLeaves(Number(campaignId));
    if (!allLeaves) {
      setMerkleProof([]);
      setProofError("Merkle tree data not found for this campaign");
      return;
    }

    try {
      const tree = generateMerkleTree(allLeaves);
      const proof = getMerkleProof(tree, leaf);
      setMerkleProof(proof);
      setProofError("");
    } catch (error) {
      console.error("Error generating proof:", error);
      setProofError("Failed to generate merkle proof");
      setMerkleProof([]);
    }
  }, [campaignId, address, isConnected]);

  // Refetch claim status when user leaf changes
  useEffect(() => {
    if (userLeaf && campaignId) {
      refetchClaimed();
    }
  }, [userLeaf, campaignId]);

  const campaignInfoRows: { label: string; value: ReactNode }[] = (
    campaignInfo
      ? ([
        propertyId !== null
          ? {
            label: "Property ID",
            value: propertyId.toString(),
          }
          : null,
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
      ] as ({ label: string; value: ReactNode } | null)[])
      : []
  ).filter(
    (row): row is { label: string; value: ReactNode } => row !== null
  );

  const rewardInfoRows: { label: string; value: ReactNode }[] = userLeaf
    ? [
      {
        label: "Index",
        value: userLeaf.index,
      },
      {
        label: "Amount",
        value: `${formatUnits(userLeaf.amount, tokenMeta.decimals)} ${tokenMeta.symbol || "tokens"
          }`,
      },
      {
        label: "Account",
        value: <span className="font-mono text-xs break-all">{address}</span>,
      },
    ]
    : [];

  const handleCheckCampaign = () => {
    if (!campaignId) {
      alert("Please enter campaign ID");
      return;
    }
    refetchCampaign();
  };

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
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Claim Rewards
        </h2>

        <div className="space-y-6">
          {/* Campaign Info Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Campaign ID *
              </label>
              <input
                type="number"
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="1"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={handleCheckCampaign}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Check Campaign Info
              </button>
            </div>
          </div>

          {campaignInfo && (
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Campaign Information
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-300">
                  {tokenMeta.name || "Token"} {tokenMeta.symbol && `(${tokenMeta.symbol})`}
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
              <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                Your Reward Information
              </h3>
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

          {/* Claim Form */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Claim Your Reward
            </h3>

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
                    ? "Enter Campaign ID to Find Your Reward"
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

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>How it works:</strong> Enter the campaign ID and the system
              will automatically find your reward, generate the merkle proof, and
              allow you to claim. No manual input required!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
