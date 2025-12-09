import { MerkleTree } from "merkletreejs";
import { keccak256 as keccak256Hash } from "js-sha3";
import { encodePacked, keccak256, type Address } from "viem";

export interface MerkleLeaf {
  index: number;
  account: Address;
  amount: bigint;
}

/**
 * Hash a leaf node: keccak256(abi.encodePacked(index, account, amount))
 */
function hashLeaf(leaf: MerkleLeaf): Buffer {
  const encoded = encodePacked(
    ["uint256", "address", "uint256"],
    [BigInt(leaf.index), leaf.account, leaf.amount]
  );
  const hash = keccak256(encoded as `0x${string}`);
  return Buffer.from(hash.slice(2), "hex");
}

/**
 * Hash function for MerkleTree that matches Solidity keccak256
 */
function keccak256Buffer(data: Buffer): Buffer {
  const hex = "0x" + data.toString("hex");
  const hash = keccak256(hex as `0x${string}`);
  return Buffer.from(hash.slice(2), "hex");
}

/**
 * Generate merkle tree from leaves
 */
export function generateMerkleTree(leaves: MerkleLeaf[]): MerkleTree {
  const hashedLeaves = leaves.map(hashLeaf);
  return new MerkleTree(hashedLeaves, keccak256Buffer, { sortPairs: true });
}

/**
 * Get merkle root from tree
 */
export function getMerkleRoot(tree: MerkleTree): `0x${string}` {
  return ("0x" + tree.getRoot().toString("hex")) as `0x${string}`;
}

/**
 * Get merkle proof for a specific leaf
 */
export function getMerkleProof(
  tree: MerkleTree,
  leaf: MerkleLeaf
): `0x${string}`[] {
  const hashedLeaf = hashLeaf(leaf);
  const proof = tree.getProof(hashedLeaf);
  return proof.map((p) => ("0x" + p.data.toString("hex")) as `0x${string}`);
}

/**
 * Verify merkle proof
 */
export function verifyMerkleProof(
  root: `0x${string}`,
  leaf: MerkleLeaf,
  proof: `0x${string}`[]
): boolean {
  const hashedLeaf = hashLeaf(leaf);
  const proofBuffers = proof.map((p) => Buffer.from(p.slice(2), "hex"));
  const rootBuffer = Buffer.from(root.slice(2), "hex");
  return MerkleTree.verify(
    proofBuffers,
    hashedLeaf,
    rootBuffer,
    keccak256Buffer,
    { sortPairs: true }
  );
}
