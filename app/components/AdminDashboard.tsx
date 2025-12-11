"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { writeContract } from "@wagmi/core";
import { parseEther, formatEther } from "viem";
import { config } from "@/app/config/WagmiConfig";
import {
  CONTRACT_ADDRESS,
  ADMIN_ADDRESS,
  ERC20_ABI,
} from "@/app/config/contract";
import CONTRACT_ABI from "@/app/utils/contractABI.json";
import {
  generateMerkleTree,
  getMerkleRoot,
  type MerkleLeaf,
} from "@/app/utils/merkle";
import { storeMerkleLeaves } from "@/app/utils/merkleStorage";
import { waitForTransactionReceipt } from "@wagmi/core";




export default function AdminDashboard() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<"create" | "fund">("create");

  // Create Campaign State
  const [propertyId, setPropertyId] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [totalAllocation, setTotalAllocation] = useState("");
  const [expiry, setExpiry] = useState("");
  const [active, setActive] = useState(true);
  const [merkleLeaves, setMerkleLeaves] = useState<MerkleLeaf[]>([]);
  const [merkleRoot, setMerkleRoot] = useState<`0x${string}` | null>(null);
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");

  // Fund Campaign State
  const [fundCampaignId, setFundCampaignId] = useState("");
  const [fundAmount, setFundAmount] = useState("");
  const [fundTokenAddress, setFundTokenAddress] = useState<
    `0x${string}` | null
  >(null);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);

  // Transaction state
  const [isCreating, setIsCreating] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCreateSuccess, setIsCreateSuccess] = useState(false);
  const [isApproveSuccess, setIsApproveSuccess] = useState(false);
  const [isFundSuccess, setIsFundSuccess] = useState(false);



  //campaign retunr type

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



  // Read campaign token address
  const { data } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI.abi,
    functionName: "campaigns",
    args: fundCampaignId ? [BigInt(fundCampaignId)] : undefined,
    query: { enabled: !!fundCampaignId },
  });

  const campaignData = data as CampaignTuple;

  // Read token allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract(
    {
      address: fundTokenAddress || undefined,
      abi: ERC20_ABI,
      functionName: "allowance",
      args:
        address && fundTokenAddress ? [address, CONTRACT_ADDRESS] : undefined,
      query: { enabled: !!address && !!fundTokenAddress },
    }
  );

  // Read token balance
  const { data: balance } = useReadContract({
    address: fundTokenAddress || undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!fundTokenAddress },
  });

  // Update token address when campaign data changes
  useEffect(() => {
    if (campaignData) {
      const token = campaignData as CampaignTuple;
      setFundTokenAddress(token[0] as `0x${string}`);
    } else {
      setFundTokenAddress(null);
    }
  }, [campaignData]);

  // Update allowance when it changes
  useEffect(() => {
    if (currentAllowance !== undefined) {
      setAllowance(currentAllowance as bigint);
    }
  }, [currentAllowance]);

  // Update balance when it changes
  useEffect(() => {
    if (balance !== undefined) {
      setTokenBalance(balance as bigint);
    }
  }, [balance]);

  // Refetch allowance after approval
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance]);

  // Read next campaign ID
  const { data: nextcampaign } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI.abi,
    functionName: "nextCampaignId",
  });

  const nextCampaignId = nextcampaign as bigint | undefined;



  // Store leaves after campaign is created
  useEffect(() => {
    if (isCreateSuccess && nextCampaignId && merkleLeaves.length > 0) {
      // Campaign ID is nextCampaignId - 1 (since it was incremented after creation)
      const createdCampaignId = Number(nextCampaignId) - 1;
      storeMerkleLeaves(createdCampaignId, merkleLeaves);
    }
  }, [isCreateSuccess, nextCampaignId, merkleLeaves]);

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

  const handleLoadFromJson = () => {
    if (!jsonInput.trim()) {
      setJsonError("Please provide JSON data");
      return;
    }

    try {
      const data = JSON.parse(jsonInput);

      if (!Array.isArray(data)) {
        setJsonError("JSON must be an array of objects");
        return;
      }

      const leaves: MerkleLeaf[] = data.map((item, index) => {
        if (!item.address || !item.amount) {
          throw new Error(`Missing address or amount at index ${index}`);
        }

        // Validate address format
        if (!/^0x[a-fA-F0-9]{40}$/.test(item.address)) {
          throw new Error(
            `Invalid address format at index ${index}: ${item.address}`
          );
        }

        // Parse amount with 18 decimals
        const amount = parseEther(item.amount.toString());

        return {
          index: index,
          account: item.address.toLowerCase() as `0x${string}`,
          amount: amount,
        };
      });

      if (leaves.length === 0) {
        setJsonError("No valid entries found in JSON");
        return;
      }

      setMerkleLeaves(leaves);
      setJsonError("");
      setJsonInput(""); // Clear input after successful load
    } catch (error: any) {
      setJsonError(error.message || "Invalid JSON format");
      setMerkleLeaves([]);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonInput(content);

      try {
        const data = JSON.parse(content);

        if (!Array.isArray(data)) {
          setJsonError("JSON must be an array of objects");
          return;
        }

        const leaves: MerkleLeaf[] = data.map((item, index) => {
          if (!item.address || !item.amount) {
            throw new Error(`Missing address or amount at index ${index}`);
          }

          // Validate address format
          if (!/^0x[a-fA-F0-9]{40}$/.test(item.address)) {
            throw new Error(
              `Invalid address format at index ${index}: ${item.address}`
            );
          }

          // Parse amount with 18 decimals
          const amount = parseEther(item.amount.toString());

          return {
            index: index,
            account: item.address.toLowerCase() as `0x${string}`,
            amount: amount,
          };
        });

        if (leaves.length === 0) {
          setJsonError("No valid entries found in JSON");
          return;
        }

        setMerkleLeaves(leaves);
        setJsonError("");
      } catch (error: any) {
        setJsonError(error.message || "Invalid JSON format");
        setMerkleLeaves([]);
      }
    };
    reader.onerror = () => {
      setJsonError("Error reading file");
    };
    reader.readAsText(file);
  };

  const handleCreateCampaign = async () => {
    if (!merkleRoot) {
      alert("Please add at least one leaf to generate merkle root");
      return;
    }

    if (!propertyId || !tokenAddress || !totalAllocation) {
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
          BigInt(propertyId),
          tokenAddress as `0x${string}`,
          merkleRoot,
          parseEther(totalAllocation),
          BigInt(expiryTimestamp),
          active,
        ],
      });

      const receipt = await waitForTransactionReceipt(config, {
        hash,
      });

      if (receipt) {
        setIsCreating(false);
        setIsCreateSuccess(true);
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

    const amount = parseEther(fundAmount);
    // Approve a bit more than needed to avoid multiple approvals
    const approveAmount = amount + amount / BigInt(10); // 10% buffer

    try {
      setIsApproving(true);
      const hash = await writeContract(config, {
        address: fundTokenAddress,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, approveAmount],
      });
      const receipt = await waitForTransactionReceipt(config, {
        hash,
      });

      if (receipt) {
        setIsApproving(false);
        setIsApproveSuccess(true);
      }
    } catch (error) {
      console.error("Error approving token:", error);
      alert("Failed to approve token. Please try again.");
    } finally {
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

    const amount = parseEther(fundAmount);

    // Check if approval is needed
    if (allowance === null || allowance < amount) {
      alert(
        `Insufficient allowance. Current: ${allowance !== null ? formatEther(allowance) : "0"
        }, Required: ${formatEther(amount)}. Please approve first.`
      );
      return;
    }

    // Check balance
    if (tokenBalance === null || tokenBalance < amount) {
      alert(
        `Insufficient balance. Current: ${tokenBalance !== null ? formatEther(tokenBalance) : "0"
        }, Required: ${formatEther(amount)}`
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
      const receipt = await waitForTransactionReceipt(config, {
        hash,
      });

      if (receipt) {
        setIsFunding(false);
        setIsFundSuccess(true);
      }
    } catch (error) {
      console.error("Error funding campaign:", error);
      alert("Failed to fund campaign. Please try again.");
    } finally {
      setIsFunding(false);
    }
  };

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
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Admin Dashboard
        </h2>

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
            onClick={() => setActiveTab("fund")}
            className={`px-4 py-2 font-medium ${activeTab === "fund"
              ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400"
              }`}
          >
            Fund Campaign
          </button>
        </div>

        {/* Create Campaign Tab */}
        {activeTab === "create" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Property ID *
                </label>
                <input
                  type="number"
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token Address *
                </label>
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="0x..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Total Allocation (ETH) *
                </label>
                <input
                  type="text"
                  value={totalAllocation}
                  onChange={(e) => setTotalAllocation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expiry Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Active (Enable claims immediately)
                </label>
              </div>
            </div>

            {/* Merkle Tree Builder */}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                Load Rewards from JSON
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload JSON File or Paste JSON
                </label>
                <div className="flex gap-4 mb-2">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 dark:text-gray-400
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      dark:file:bg-blue-900 dark:file:text-blue-300
                      cursor-pointer"
                  />
                </div>
                <textarea
                  value={jsonInput}
                  onChange={(e) => {
                    setJsonInput(e.target.value);
                    setJsonError("");
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                  rows={8}
                  placeholder={`[\n  {\n    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",\n    "amount": "100.5"\n  },\n  {\n    "address": "0x8ba1f109551bD432803012645Hac136c22C172e8",\n    "amount": "250.75"\n  }\n]`}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  JSON format: Array of objects with "address" and "amount"
                  fields. Amount uses 18 decimals.
                </p>
              </div>

              {jsonError && (
                <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    ⚠️ {jsonError}
                  </p>
                </div>
              )}

              <button
                onClick={handleLoadFromJson}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition mb-4"
              >
                Load JSON Data
              </button>

              {merkleLeaves.length > 0 && (
                <div className="mb-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                      ✓ Loaded {merkleLeaves.length} reward entries
                    </p>
                    <div className="max-h-40 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-green-200 dark:border-green-800">
                            <th className="text-left py-1 px-2">Index</th>
                            <th className="text-left py-1 px-2">Address</th>
                            <th className="text-right py-1 px-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {merkleLeaves.slice(0, 10).map((leaf, idx) => (
                            <tr
                              key={idx}
                              className="border-b border-green-100 dark:border-green-900"
                            >
                              <td className="py-1 px-2">{leaf.index}</td>
                              <td className="py-1 px-2 font-mono text-xs">
                                {leaf.account.slice(0, 10)}...
                              </td>
                              <td className="py-1 px-2 text-right">
                                {formatEther(leaf.amount)} ETH
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {merkleLeaves.length > 10 && (
                        <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                          ... and {merkleLeaves.length - 10} more entries
                        </p>
                      )}
                    </div>
                  </div>
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

              {merkleLeaves.length > 0 && (
                <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    <strong>Note:</strong> Merkle leaves will be stored locally
                    for proof generation. In production, store these securely on
                    your backend.
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


            {isCreateSuccess && nextCampaignId && (
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <p className="text-green-800 dark:text-green-200">
                  Campaign created! Next Campaign ID:{" "}
                  {nextCampaignId.toString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Fund Campaign Tab */}
        {activeTab === "fund" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Campaign ID *
                </label>
                <input
                  type="number"
                  value={fundCampaignId}
                  onChange={(e) => {
                    setFundCampaignId(e.target.value);
                    setFundAmount(""); // Reset amount when campaign changes
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="1"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter campaign ID to load token information
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Amount (ETH) *
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

            {/* Token Information */}
            {fundTokenAddress && fundCampaignId && (
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">
                  Token Information
                </h3>
                <div className="space-y-2 text-sm">
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Token Address:</span>{" "}
                    <span className="font-mono text-xs">
                      {fundTokenAddress}
                    </span>
                  </p>
                  {tokenBalance !== null && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Your Balance:</span>{" "}
                      {formatEther(tokenBalance)} ETH
                    </p>
                  )}
                  {allowance !== null && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Current Allowance:</span>{" "}
                      {formatEther(allowance)} ETH
                    </p>
                  )}
                  {fundAmount && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Required Amount:</span>{" "}
                      {fundAmount} ETH
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Approval Status */}
            {fundTokenAddress && fundAmount && allowance !== null && (
              <div
                className={`p-4 rounded-lg ${allowance >= parseEther(fundAmount)
                  ? "bg-green-100 dark:bg-green-900"
                  : "bg-yellow-100 dark:bg-yellow-900"
                  }`}
              >
                {allowance >= parseEther(fundAmount) ? (
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

            {/* Balance Check */}
            {tokenBalance !== null &&
              fundAmount &&
              tokenBalance < parseEther(fundAmount) && (
                <div className="p-4 bg-red-100 dark:bg-red-900 rounded-lg">
                  <p className="text-red-800 dark:text-red-200">
                    ⚠️ Insufficient balance. You need{" "}
                    {formatEther(parseEther(fundAmount) - tokenBalance)} more
                    tokens.
                  </p>
                </div>
              )}

            {/* Approve Button */}
            {fundTokenAddress && fundAmount && (
              <button
                onClick={handleApproveToken}
                disabled={
                  isApproving ||

                  !fundTokenAddress ||
                  !fundAmount ||
                  (allowance !== null && allowance >= parseEther(fundAmount))
                }
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {isApproving
                  ? "Approving..."
                  : isApproveSuccess
                    ? "Approved!"
                    : allowance !== null && allowance >= parseEther(fundAmount)
                      ? "Already Approved"
                      : "Approve Tokens"}
              </button>
            )}

            {isApproveSuccess && (
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <p className="text-green-800 dark:text-green-200">
                  ✓ Tokens approved successfully! You can now fund the campaign.
                </p>
              </div>
            )}

            {/* Fund Button */}
            <button
              onClick={handleFundCampaign}
              disabled={
                isFunding ||
                !fundCampaignId ||
                !fundAmount ||
                !fundTokenAddress ||
                (allowance !== null && allowance < parseEther(fundAmount)) ||
                (tokenBalance !== null && tokenBalance < parseEther(fundAmount))
              }
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isFunding
                ? "Funding Campaign..."
                : isFundSuccess
                  ? "Campaign Funded!"
                  : !fundTokenAddress
                    ? "Enter Campaign ID First"
                    : allowance !== null && allowance < parseEther(fundAmount)
                      ? "Approve Tokens First"
                      : tokenBalance !== null && tokenBalance < parseEther(fundAmount)
                        ? "Insufficient Balance"
                        : "Fund Campaign"}
            </button>

            {isFundSuccess && (
              <div className="p-4 bg-green-100 dark:bg-green-900 rounded-lg">
                <p className="text-green-800 dark:text-green-200">
                  Campaign funded successfully!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
