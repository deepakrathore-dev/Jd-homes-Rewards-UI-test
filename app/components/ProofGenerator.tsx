"use client";

import { useState } from "react";
import { parseEther, type Address } from "viem";
import {
  generateMerkleTree,
  getMerkleProof,
  type MerkleLeaf,
} from "@/app/utils/merkle";

interface ProofGeneratorProps {
  onProofGenerated: (proof: `0x${string}`[]) => void;
  merkleRoot: `0x${string}`;
  leaves: MerkleLeaf[];
}

/**
 * Component to help generate merkle proofs for testing
 * In production, this would be done on the backend
 */
export default function ProofGenerator({
  onProofGenerated,
  merkleRoot,
  leaves,
}: ProofGeneratorProps) {
  const [selectedIndex, setSelectedIndex] = useState("");
  const [generatedProof, setGeneratedProof] = useState<`0x${string}`[]>([]);

  const handleGenerateProof = () => {
    if (!selectedIndex) {
      alert("Please enter an index");
      return;
    }

    const index = parseInt(selectedIndex);
    const leaf = leaves.find((l) => l.index === index);

    if (!leaf) {
      alert("Leaf not found for this index");
      return;
    }

    const tree = generateMerkleTree(leaves);
    const proof = getMerkleProof(tree, leaf);
    setGeneratedProof(proof);
    onProofGenerated(proof);
  };

  return (
    <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
      <h4 className="font-semibold mb-2 text-gray-900 dark:text-white">
        Generate Proof (Testing Only)
      </h4>
      <div className="flex space-x-2">
        <input
          type="number"
          value={selectedIndex}
          onChange={(e) => setSelectedIndex(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white"
          placeholder="Leaf Index"
        />
        <button
          onClick={handleGenerateProof}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Generate
        </button>
      </div>
      {generatedProof.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Proof:
          </p>
          <textarea
            readOnly
            value={JSON.stringify(generatedProof)}
            className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600"
            rows={3}
          />
        </div>
      )}
    </div>
  );
}
