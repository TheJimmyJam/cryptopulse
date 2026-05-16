import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { ensureTodayPicks } from "@/lib/recommend";
import { getLatestSnapshot } from "@/lib/supabase";
import { Strategy } from "@/types/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/recommendations?strategy=growth&refresh=false
export async function GET(req: NextRequest) {
  const strategy = (req.nextUrl.searchParams.get("strategy") ?? "growth") as Strategy;
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
  const today = format(new Date(), "yyyy-MM-dd");

  // Fast path: serve cached snapshot if forceRefresh is off
  if (!forceRefresh) {
    const cached = await getLatestSnapshot(strategy);
    if (cached && cached.date === today) {
      return NextResponse.json(cached);
    }
  }

  // Generate (or pick up regenerated) today's picks via the shared helper.
  // This guarantees /api/recommendations and /api/baskets/buy see the same
  // 15-unique, no-stables, no-gold lineup.
  const picks = await ensureTodayPicks(today);
  return NextResponse.json(picks[strategy]);
}
