import { NextResponse } from "next/server";
import { getTrackerPicks } from "@/lib/supabase";
import { TrackerPickEnriched } from "@/types/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // 1. Fetch all picks from Supabase
  let picks;
  try {
    picks = await getTrackerPicks();
  } catch (err) {
    console.error("Failed to load tracker picks:", err);
    return NextResponse.json({ picks: [], summary: null });
  }

  if (!picks.length) {
    return NextResponse.json({ picks: [], summary: null });
  }

  // 2. Unique coin IDs from last 90 days (keep CoinGecko request small)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const recentCoinIds = [
    ...new Set(
      picks
        .filter((p) => new Date(p.pick_date) >= cutoff)
        .map((p) => p.coin_id)
    ),
  ];

  // 3. Fetch live prices from CoinGecko
  let currentPrices: Record<string, number> = {};
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${recentCoinIds.join(",")}&vs_currencies=usd`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      currentPrices = Object.fromEntries(
        Object.entries(data).map(([id, v]) => [id, (v as { usd: number }).usd])
      );
    }
  } catch (err) {
    console.error("CoinGecko price fetch failed:", err);
  }

  // 4. Enrich each pick with live P&L
  const today = new Date();
  const enriched: TrackerPickEnriched[] = picks.map((pick) => {
    const currentPrice = currentPrices[pick.coin_id] ?? null;
    const currentValue = currentPrice !== null ? pick.coins_held * currentPrice : null;
    const pnlUsd = currentValue !== null ? currentValue - pick.amount_usd : null;
    const pnlPct = pnlUsd !== null ? (pnlUsd / pick.amount_usd) * 100 : null;
    const pickDate = new Date(pick.pick_date);
    const daysSincePick = Math.floor(
      (today.getTime() - pickDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return { ...pick, currentPrice, currentValue, pnlUsd, pnlPct, daysSincePick };
  });

  // 5. Portfolio-level summary (only picks with live prices)
  const priced = enriched.filter((p) => p.pnlUsd !== null);
  const totalInvested = priced.reduce((s, p) => s + p.amount_usd, 0);
  const totalCurrentValue = priced.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const totalPnlUsd = totalCurrentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnlUsd / totalInvested) * 100 : 0;
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
