"use client";

import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseEther, formatEther } from "viem";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  ADMIN_ADDRESS,
} from "@/app/config/contract";
import {
  generateMerkleTree,
  getMerkleRoot,
  type MerkleLeaf,
} from "@/app/utils/merkle";

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
  const [newLeaf, setNewLeaf] = useState({
    index: "",
    account: "",
    amount: "",
  });
  const [merkleRoot, setMerkleRoot] = useState<`0x${string}` | null>(null);

  // Fund Campaign State
  const [fundCampaignId, setFundCampaignId] = useState("");
  const [fundAmount, setFundAmount] = useState("");

  const {
    writeContract: createCampaign,
    data: createHash,
    isPending: isCreating,
  } = useWriteContract();
  const {
    writeContract: fundCampaign,
    data: fundHash,
    isPending: isFunding,
  } = useWriteContract();

  const { isLoading: isConfirmingCreate, isSuccess: isCreateSuccess } =
    useWaitForTransactionReceipt({
      hash: createHash,
    });

  const { isLoading: isConfirmingFund, isSuccess: isFundSuccess } =
    useWaitForTransactionReceipt({
      hash: fundHash,
    });

  // Read next campaign ID
  const { data: nextCampaignId } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "nextCampaignId",
  });

  const isAdmin = address?.toLowerCase() === ADMIN_ADDRESS.toLowerCase();

  const handleAddLeaf = () => {
    if (!newLeaf.index || !newLeaf.account || !newLeaf.amount) return;

    const leaf: MerkleLeaf = {
      index: parseInt(newLeaf.index),
      account: newLeaf.account as `0x${string}`,
      amount: parseEther(newLeaf.amount),
    };

    setMerkleLeaves([...merkleLeaves, leaf]);
    setNewLeaf({ index: "", account: "", amount: "" });
  };

  const handleGenerateMerkleRoot = () => {
    if (merkleLeaves.length === 0) {
      alert("Please add at least one leaf");
      return;
    }

    const tree = generateMerkleTree(merkleLeaves);
    const root = getMerkleRoot(tree);
    setMerkleRoot(root);
  };

  const handleCreateCampaign = async () => {
    if (!merkleRoot) {
      alert("Please generate merkle root first");
      return;
    }

    if (!propertyId || !tokenAddress || !totalAllocation) {
      alert("Please fill all required fields");
      return;
    }

    const expiryTimestamp = expiry
      ? Math.floor(new Date(expiry).getTime() / 1000)
      : 0;

    createCampaign({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
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
  };

  const handleFundCampaign = async () => {
    if (!fundCampaignId || !fundAmount) {
      alert("Please fill all fields");
      return;
    }

    fundCampaign({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "fundCampaign",
      args: [BigInt(fundCampaignId), parseEther(fundAmount)],
    });
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
            className={`px-4 py-2 font-medium ${
              activeTab === "create"
                ? "text-blue-600 border-b-2 border-blue-600 dark:text-blue-400"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            Create Campaign
          </button>
          <button
            onClick={() => setActiveTab("fund")}
            className={`px-4 py-2 font-medium ${
              activeTab === "fund"
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
                Build Merkle Tree
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <input
                  type="number"
                  value={newLeaf.index}
                  onChange={(e) =>
                    setNewLeaf({ ...newLeaf, index: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Index"
                />
                <input
                  type="text"
                  value={newLeaf.account}
                  onChange={(e) =>
                    setNewLeaf({ ...newLeaf, account: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Account Address"
                />
                <input
                  type="text"
                  value={newLeaf.amount}
                  onChange={(e) =>
                    setNewLeaf({ ...newLeaf, amount: e.target.value })
                  }
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Amount (ETH)"
                />
                <button
                  onClick={handleAddLeaf}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Add Leaf
                </button>
              </div>

              {merkleLeaves.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Leaves: {merkleLeaves.length}
                  </p>
                  <button
                    onClick={handleGenerateMerkleRoot}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                  >
                    Generate Merkle Root
                  </button>
                </div>
              )}

              {merkleRoot && (
                <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Merkle Root:
                  </p>
                  <p className="text-xs font-mono text-gray-900 dark:text-white break-all">
                    {merkleRoot}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleCreateCampaign}
              disabled={isCreating || isConfirmingCreate || !merkleRoot}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isCreating || isConfirmingCreate
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
                  onChange={(e) => setFundCampaignId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="1"
                />
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

            <button
              onClick={handleFundCampaign}
              disabled={isFunding || isConfirmingFund}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {isFunding || isConfirmingFund
                ? "Funding Campaign..."
                : isFundSuccess
                ? "Campaign Funded!"
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
