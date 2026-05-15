import { NextResponse } from "next/server";
import { getTrackerPicks } from "@/lib/supabase";
import { TrackerPick, TrackerPickEnriched } from "@/types/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Fetch all picks from Supabase
  let picks: TrackerPick[];
  try {
    picks = await getTrackerPicks();
  } catch (err) {
    console.error("Failed to load tracker picks:", err);
    return NextResponse.json({ picks: [], summary: null, debug: String(err) });
  }

  if (!picks.length) {
    return NextResponse.json({ picks: [], summary: null, debug: "getTrackerPicks returned empty array" });
  }

  // 2. Unique coin IDs from last 90 days
  const cutoffMs = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const recentCoinIds: string[] = Array.from(
    new Set(
      picks
        .filter((p) => new Date(p.pick_date).getTime() >= cutoffMs)
        .map((p) => p.coin_id)
    )
  );

  // 3. Fetch live prices from CoinGecko
  const currentPrices: Record<string, number> = {};
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${recentCoinIds.join(",")}&vs_currencies=usd`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const raw = (await res.json()) as Record<string, { usd: number }>;
      for (const [id, val] of Object.entries(raw)) {
        currentPrices[id] = val.usd;
      }
    }
  } catch (err) {
    console.error("CoinGecko price fetch failed:", err);
  }

  // 4. Enrich each pick with live P&L
  const now = Date.now();
  const enriched: TrackerPickEnriched[] = picks.map((pick) => {
    const currentPrice: number | null = currentPrices[pick.coin_id] ?? null;
    const currentValue: number | null =
      currentPrice !== null ? pick.coins_held * currentPrice : null;
    const pnlUsd: number | null =
      currentValue !== null ? currentValue - pick.amount_usd : null;
    const pnlPct: number | null =
      pnlUsd !== null ? (pnlUsd / pick.amount_usd) * 100 : null;
    const daysSincePick = Math.floor(
      (now - new Date(pick.pick_date).getTime()) / (1000 * 60 * 60 * 24)
    );
    return { ...pick, currentPrice, currentValue, pnlUsd, pnlPct, daysSincePick };
  });

  // 5. Portfolio-level summary
  const priced = enriched.filter((p) => p.pnlUsd !== null);
  const totalInvested = priced.reduce((s, p) => s + p.amount_usd, 0);
  const totalCurrentValue = priced.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const totalPnlUsd = totalCurrentValue - totalInvested;
  const totalPnlPct =
    totalInvested > 0 ? (totalPnlUsd / totalInvested) * 100 : 0;
  const winners = priced.filter((p) => (p.pnlUsd ?? 0) > 0).length;
  const losers = priced.filter((p) => (p.pnlUsd ?? 0) < 0).length;
  const winRate = priced.length > 0 ? (winners / priced.length) * 100 : 0;

  const summary = {
    totalPicks: picks.length,
    pricedPicks: priced.length,
    totalInvested,
    totalCurrentValue,
    totalPnlUsd,
    totalPnlPct,
    winRate,
    winners,
    losers,
  };

  return NextResponse.json({ picks: enriched, summary });
}
