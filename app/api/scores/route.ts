import { NextRequest, NextResponse } from "next/server";
import { getSnapshotHistory } from "@/lib/supabase";
import { Strategy } from "@/types/crypto";

// GET /api/scores?strategy=growth&limit=30
// Returns historical snapshot list (for performance tracking)
export async function GET(req: NextRequest) {
  const strategy = (req.nextUrl.searchParams.get("strategy") ?? "growth") as Strategy;
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "30", 10);

  try {
    const history = await getSnapshotHistory(strategy, limit);
    return NextResponse.json(history);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
