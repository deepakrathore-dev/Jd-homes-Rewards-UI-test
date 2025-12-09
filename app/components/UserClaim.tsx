"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseEther, formatEther, type Address } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "@/app/config/contract";
import { getMerkleProof, type MerkleLeaf } from "@/app/utils/merkle";

interface CampaignInfo {
  token: Address;
  merkleRoot: `0x${string}`;
  totalAllocation: bigint;
  totalFunded: bigint;
  totalClaimed: bigint;
  expiry: bigint;
  active: boolean;
}

export default function UserClaim() {
  const { address, isConnected } = useAccount();
  const [campaignId, setCampaignId] = useState("");
  const [index, setIndex] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [merkleRoot, setMerkleRoot] = useState("");
  const [merkleProof, setMerkleProof] = useState<`0x${string}`[]>([]);
  const [proofInput, setProofInput] = useState("");
  const [isClaimed, setIsClaimed] = useState<boolean | null>(null);
  const [campaignInfo, setCampaignInfo] = useState<CampaignInfo | null>(null);

  const {
    writeContract: claim,
    data: claimHash,
    isPending: isClaiming,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isClaimSuccess } =
    useWaitForTransactionReceipt({
      hash: claimHash,
    });

  // Read campaign info
  const { data: campaignData, refetch: refetchCampaign } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "campaigns",
    args: campaignId ? [BigInt(campaignId)] : undefined,
    query: { enabled: !!campaignId },
  });

  // Check if already claimed
  const { data: claimedStatus, refetch: refetchClaimed } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "isClaimed",
    args: campaignId && index ? [BigInt(campaignId), BigInt(index)] : undefined,
    query: { enabled: !!campaignId && !!index },
  });

  useEffect(() => {
    if (campaignData) {
      setCampaignInfo({
        token: campaignData[0] as Address,
        merkleRoot: campaignData[1] as `0x${string}`,
        totalAllocation: campaignData[2] as bigint,
        totalFunded: campaignData[3] as bigint,
        totalClaimed: campaignData[4] as bigint,
        expiry: campaignData[5] as bigint,
        active: campaignData[6] as boolean,
      });
      setMerkleRoot(campaignData[1] as string);
    }
  }, [campaignData]);

  useEffect(() => {
    if (claimedStatus !== undefined) {
      setIsClaimed(claimedStatus as boolean);
    }
  }, [claimedStatus]);

  const handleCheckClaimStatus = () => {
    if (!campaignId || !index) {
      alert("Please enter campaign ID and index");
      return;
    }
    refetchCampaign();
    refetchClaimed();
  };

  const handleGenerateProof = () => {
    if (!merkleRoot || !index || !address || !claimAmount) {
      alert("Please fill all fields");
      return;
    }

    // For demo purposes, we'll use the proof input field
    // In production, you would generate this from the merkle tree
    // This is a placeholder - users should provide the proof from backend/API
    if (proofInput) {
      try {
        const proofArray = JSON.parse(proofInput) as string[];
        setMerkleProof(proofArray as `0x${string}`[]);
        alert("Proof loaded! You can now claim.");
      } catch (e) {
        alert(
          "Invalid proof format. Please provide a JSON array of hex strings."
        );
      }
    } else {
      alert(
        "Please provide merkle proof. In production, this would be generated from your backend."
      );
    }
  };

  const handleClaim = async () => {
    if (
      !campaignId ||
      !index ||
      !address ||
      !claimAmount ||
      merkleProof.length === 0
    ) {
      alert("Please fill all fields and generate proof");
      return;
    }

    if (isClaimed) {
      alert("This reward has already been claimed");
      return;
    }

    claim({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "claim",
      args: [
        BigInt(campaignId),
        BigInt(index),
        address,
        parseEther(claimAmount),
        merkleProof,
      ],
    });
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
                onClick={handleCheckClaimStatus}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Check Campaign Info
              </button>
            </div>
          </div>

          {campaignInfo && (
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <h3 className="font-semibold mb-2 text-gray-900 dark:text-white">
                Campaign Information
              </h3>
              <div className="space-y-1 text-sm">
                <p className="text-gray-700 dark:text-gray-300">
                  Token: <span className="font-mono">{campaignInfo.token}</span>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Total Funded: {formatEther(campaignInfo.totalFunded)} ETH
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Total Claimed: {formatEther(campaignInfo.totalClaimed)} ETH
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Active: {campaignInfo.active ? "Yes" : "No"}
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Merkle Root:{" "}
                  <span className="font-mono text-xs break-all">
                    {campaignInfo.merkleRoot}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Claim Form */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
              Claim Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Index *
                </label>
                <input
                  type="number"
                  value={index}
                  onChange={(e) => setIndex(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Claim Amount (ETH) *
                </label>
                <input
                  type="text"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="10"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Merkle Root
              </label>
              <input
                type="text"
                value={merkleRoot}
                onChange={(e) => setMerkleRoot(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                placeholder="0x..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Merkle Proof (JSON Array) *
              </label>
              <textarea
                value={proofInput}
                onChange={(e) => setProofInput(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                rows={4}
                placeholder='["0x...", "0x...", "0x..."]'
              />
              <p className="text-xs text-gray-500 mt-1">
                Paste your merkle proof as a JSON array of hex strings
              </p>
            </div>

            <div className="flex space-x-4 mb-4">
              <button
                onClick={handleGenerateProof}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Load Proof
              </button>
              <button
                onClick={handleCheckClaimStatus}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Check Claim Status
              </button>
            </div>

            {isClaimed !== null && (
              <div
                className={`p-4 rounded-lg mb-4 ${
                  isClaimed
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

            {merkleProof.length > 0 && (
              <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-lg mb-4">
                <p className="text-blue-800 dark:text-blue-200 text-sm">
                  ✓ Proof loaded ({merkleProof.length} elements)
                </p>
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={
                isClaiming ||
                isConfirming ||
                isClaimed === true ||
                merkleProof.length === 0
              }
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isClaiming || isConfirming
                ? "Claiming..."
                : isClaimSuccess
                ? "Claimed Successfully!"
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
          <div className="mt-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> In production, the merkle proof should be
              generated by your backend service based on the campaign's merkle
              root and your claim details. The proof verifies that your address
              and amount are included in the campaign's reward distribution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
