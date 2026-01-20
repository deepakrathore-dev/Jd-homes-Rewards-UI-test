import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/app/utils/mongodb";

export async function POST(
  request: NextRequest,
  { params }: { params: { campaignId: string } | Promise<{ campaignId: string }> }
) {
  try {
    const resolvedParams =
      typeof (params as any)?.then === "function" ? await (params as any) : params;
    const campaignId = parseInt((resolvedParams as any).campaignId);
    const body = await request.json();
    const { index, txHash } = body;

    if (!campaignId || Number.isNaN(campaignId)) {
      return NextResponse.json(
        { error: "Invalid campaign ID" },
        { status: 400 }
      );
    }

    if (index === undefined || !txHash) {
      return NextResponse.json(
        { error: "Index and transaction hash are required" },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const result = await db.collection("campaign_reward_entries").updateOne(
      {
        campaign_id: campaignId,
        index_in_merkle: index,
      },
      {
        $set: {
          claimed: true,
          claimed_tx_hash: txHash,
          claimed_at: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Reward entry not found" }, { status: 404 });
    }

    // Update campaign total_claimed
    const allEntries = await db
      .collection("campaign_reward_entries")
      .find({ campaign_id: campaignId, claimed: true })
      .toArray();

    const totalClaimed = allEntries.reduce(
      (sum, e: any) => sum + BigInt(e.reward_amount),
      BigInt(0)
    );

    await db.collection("campaigns").updateOne(
      { id: campaignId },
      { $set: { total_claimed: totalClaimed.toString() } }
    );

    return NextResponse.json({
      success: true,
      message: "Reward marked as claimed",
    });
  } catch (error: any) {
    console.error("Error marking reward as claimed:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark reward as claimed" },
      { status: 500 }
    );
  }
}

