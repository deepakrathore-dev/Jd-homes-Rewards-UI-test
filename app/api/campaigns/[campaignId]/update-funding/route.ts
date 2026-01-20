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
    const { totalFunded, isFunded } = body;

    if (!campaignId || Number.isNaN(campaignId)) {
      return NextResponse.json(
        { error: "Invalid campaign ID" },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const updateData: Record<string, unknown> = {};
    if (totalFunded !== undefined) updateData.total_funded = totalFunded.toString();
    if (isFunded !== undefined) updateData.is_funded = Boolean(isFunded);

    const result = await db
      .collection("campaigns")
      .updateOne({ id: campaignId }, { $set: updateData });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Campaign funding updated",
    });
  } catch (error: any) {
    console.error("Error updating campaign funding:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update campaign funding" },
      { status: 500 }
    );
  }
}

