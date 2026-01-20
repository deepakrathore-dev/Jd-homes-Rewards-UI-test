import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/app/utils/mongodb";

export async function GET(
  request: NextRequest,
  { params }: { params: { campaignId: string } | Promise<{ campaignId: string }> }
) {
  try {
    const resolvedParams =
      typeof (params as any)?.then === "function" ? await (params as any) : params;
    const campaignId = parseInt((resolvedParams as any).campaignId);
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!campaignId || Number.isNaN(campaignId)) {
      return NextResponse.json(
        { error: "Invalid campaign ID" },
        { status: 400 }
      );
    }

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const entry = await db.collection("campaign_reward_entries").findOne({
      campaign_id: campaignId,
      kol_address: address.toLowerCase(),
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Reward entry not found for this address" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        index: entry.index_in_merkle,
        address: entry.kol_address,
        amount: entry.reward_amount,
        proof: entry.merkle_proof,
        claimed: entry.claimed,
        claimed_tx_hash: entry.claimed_tx_hash,
        claimed_at: entry.claimed_at,
      },
    });
  } catch (error: any) {
    console.error("Error fetching proof:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch proof" },
      { status: 500 }
    );
  }
}

