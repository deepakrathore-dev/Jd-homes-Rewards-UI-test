import type { MerkleLeaf } from "./merkle";

const STORAGE_PREFIX = "merkle_leaves_";
const PROPERTY_PREFIX = "campaign_property_";

/**
 * Store merkle leaves for a campaign
 * In production, this would be stored in a database/backend
 */
export function storeMerkleLeaves(
  campaignId: number,
  leaves: MerkleLeaf[]
): void {
  if (typeof window === "undefined") return;

  const key = `${STORAGE_PREFIX}${campaignId - 1}`;
  const serialized = leaves.map((leaf) => ({
    index: leaf.index,
    account: leaf.account,
    amount: leaf.amount.toString(), // Convert bigint to string for storage
  }));

  localStorage.setItem(key, JSON.stringify(serialized));
}

/**
 * Retrieve merkle leaves for a campaign
 */
export function getMerkleLeaves(campaignId: number): MerkleLeaf[] | null {
  if (typeof window === "undefined") return null;

  const key = `${STORAGE_PREFIX}${campaignId - 1}`;

  console.log("Retrieving merkle leaves from key:", key);
  const stored = localStorage.getItem(key);

  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    return parsed.map((leaf: any) => ({
      index: leaf.index,
      account: leaf.account as `0x${string}`,
      amount: BigInt(leaf.amount), // Convert string back to bigint
    }));
  } catch (e) {
    console.error("Error parsing stored merkle leaves:", e);
    return null;
  }
}

/**
 * Store propertyId for a campaign (local)
 */
export function storeCampaignProperty(
  campaignId: number,
  propertyId: number
): void {
  if (typeof window === "undefined") return;
  const key = `${PROPERTY_PREFIX}${campaignId - 1}`;
  localStorage.setItem(key, propertyId.toString());
}

/**
 * Retrieve propertyId for a campaign (local)
 */
export function getCampaignProperty(campaignId: number): number | null {
  if (typeof window === "undefined") return null;
  const key = `${PROPERTY_PREFIX}${campaignId - 1}`;
  const stored = localStorage.getItem(key);
  if (!stored) return null;
  const parsed = Number(stored);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Find a leaf by account address
 */
export function findLeafByAccount(
  campaignId: number,
  account: string
): MerkleLeaf | null {
  const leaves = getMerkleLeaves(campaignId);
  if (!leaves) return null;

  // Optional: log all leaves
  console.log("All leaves:", leaves);

  // Find the leaf for the given account
  const leaf = leaves.find(
    (leaf) => leaf.account.toLowerCase() === account.toLowerCase()
  );

  console.log("Matching leaf:", leaf);

  return leaf || null;
}


/**
 * Find a leaf by index
 */
export function findLeafByIndex(
  campaignId: number,
  index: number
): MerkleLeaf | null {
  const leaves = getMerkleLeaves(campaignId);
  if (!leaves) return null;

  return leaves.find((leaf) => leaf.index === index) || null;
}

