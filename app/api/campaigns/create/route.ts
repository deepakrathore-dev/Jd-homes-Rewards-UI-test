import { NextRequest, NextResponse } from "next/server";
import {
  getDatabase,
  type CampaignDocument,
  type CampaignRewardEntryDocument,
} from "@/app/utils/mongodb";
import type { MerkleLeaf } from "@/app/utils/merkle";
import {
  generateMerkleTree,
  getMerkleRoot,
  getMerkleProof,
  hashLeaf,
} from "@/app/utils/merkle";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      campaignId,
      merkleRoot,
      rewardToken,
      leaves,
      expiry,
    }: {
      campaignId: number;
      merkleRoot: string;
      rewardToken: string;
      leaves: Array<{ index: number; account: string; amount: string }>;
      expiry?: number;
    } = body;

    if (
      !campaignId ||
      !merkleRoot ||
      !rewardToken ||
      !leaves ||
      leaves.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    // Convert string amounts back to BigInt for merkle tree generation
    const merkleLeaves: MerkleLeaf[] = leaves.map((leaf) => ({
      index: leaf.index,
      account: leaf.account as `0x${string}`,
      amount: BigInt(leaf.amount),
    }));

    // Generate merkle tree and proofs for all leaves
    const tree = generateMerkleTree(merkleLeaves);
    const generatedRoot = getMerkleRoot(tree);

    // Verify root matches
    if (generatedRoot.toLowerCase() !== merkleRoot.toLowerCase()) {
      return NextResponse.json(
        { error: "Merkle root mismatch" },
        { status: 400 }
      );
    }

    // Create campaign document
    const campaignDoc: CampaignDocument = {
      id: campaignId,
      merkle_root: merkleRoot,
      reward_token: rewardToken,
      total_funded: "0",
      total_claimed: "0",
      is_funded: false,
      is_finalized: true,
      finalized_at: new Date(),
      claim_deadline: expiry ? new Date(expiry * 1000) : undefined,
      created_at: new Date(),
    };

    // Insert campaign
    await db.collection("campaigns").insertOne(campaignDoc);

    // Generate and store proofs for all entries
    const rewardEntries: CampaignRewardEntryDocument[] = merkleLeaves.map(
      (leaf) => {
        const proof = getMerkleProof(tree, leaf);
        const hashedLeaf = hashLeaf(leaf);
        const leafHash = "0x" + hashedLeaf.toString("hex");

        return {
          campaign_id: campaignId,
          index_in_merkle: leaf.index,
          kol_address: leaf.account.toLowerCase(),
          reward_amount: leaf.amount.toString(),
          leaf_hash: leafHash,
          merkle_proof: proof,
          claimed: false,
          created_at: new Date(),
        };
      }
    );

    // Insert all reward entries
    if (rewardEntries.length > 0) {
      await db.collection("campaign_reward_entries").insertMany(rewardEntries);
    }

    return NextResponse.json({
      success: true,
      campaignId,
      entriesCount: rewardEntries.length,
    });
  } catch (error: any) {
    console.error("Error creating campaign in DB:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create campaign" },
      { status: 500 }
    );
  }
}

