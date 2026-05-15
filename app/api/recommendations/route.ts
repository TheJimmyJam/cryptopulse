import { NextRequest, NextResponse } from "next/server";
import { getTopMarkets, getCoinHistory } from "@/lib/coingecko";
import { buildDefiMap } from "@/lib/defillama";
import { buildMarketRegime } from "@/lib/feargreed";
import { scoreCoin, filterAndRank } from "@/lib/scoring";
import { saveSnapshot, getLatestSnapshot, saveTrackerPicks } from "@/lib/supabase";
import { DailySnapshot, Strategy } from "@/types/crypto";
import { format } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/recommendations?strategy=growth&refresh=false
export async function GET(req: NextRequest) {
  const strategy = (req.nextUrl.searchParams.get("strategy") ?? "growth") as Strategy;
  const forceRefresh = req.nextUrl.searchParams.get("refresh") === "true";
  const today = format(new Date(), "yyyy-MM-dd");

  // 1. Try cache from Supabase first
  if (!forceRefresh) {
    const cached = await getLatestSnapshot(strategy);
    if (cached && cached.date === today) {
      return NextResponse.json(cached);
    }
  }

  // 2. Fetch all needed data in parallel
  const [markets, defiMap, regime] = await Promise.all([
    getTopMarkets(250),
    buildDefiMap(),
    buildMarketRegime(),
  ]);

  // 3. Score each coin
  // We only fetch full OHLCV history for top 100 (to stay within rate limits)
  const TOP_N_HISTORY = 100;
  const topCoins = markets.slice(0, TOP_N_HISTORY);

  const scoredCoins = await Promise.allSettled(
    topCoins.map(async (coin) => {
      try {
        const history = await getCoinHistory(coin.id, 90);
        const closes = history.prices.map(([, p]) => p);
        const volumes = history.volumes.map(([, v]) => v);
        const defi = defiMap.get(coin.symbol.toLowerCase());
        return scoreCoin(coin, closes, volumes, regime, defi);
      } catch {
        // If history fetch fails, score with sparkline data only
        const closes = coin.sparkline_in_7d?.price ?? [];
        const defi = defiMap.get(coin.symbol.toLowerCase());
        return scoreCoin(coin, closes, [], regime, defi);
      }
    })
  );

  const validScores = scoredCoins
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<ReturnType<typeof scoreCoin>>).value);

  // 4. Filter + rank to top 5
  const top5 = filterAndRank(validScores, strategy, regime);

  const snapshot: DailySnapshot = {
    date: today,
    top5,
    marketRegime: regime,
    generatedAt: new Date().toISOString(),
    strategy,
  };

  // 5. Persist snapshot to Supabase
  try {
    await saveSnapshot(snapshot);
  } catch (err) {
    console.error("Supabase snapshot save failed:", err);
  }

  // 6. Auto-record $200 paper trades into tracker
  try {
    const picks = top5.map((asset, idx) => ({
      pick_date: today,
      strategy,
      rank: idx + 1,
      coin_id: asset.id,
      symbol: asset.symbol.toUpperCase(),
      name: asset.name,
      entry_price: asset.price,
      amount_usd: 200,
      coins_held: 200 / asset.price,
      image_url: asset.image ?? null,
      signal: asset.signal,
      score_total: asset.scores.total,
      narrative_tags: asset.narrativeTags ?? [],
    }));
    await saveTrackerPicks(picks);
  } catch (err) {
    console.error("Tracker save failed:", err);
  }

  return NextResponse.json(snapshot);
}

// POST /api/recommendations — manual trigger (for cron job)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run all three strategies
  const strategies: Strategy[] = ["conservative", "growth", "speculative"];
  const results: Record<string, string> = {};

  for (const strategy of strategies) {
    try {
      const url = new URL(`/api/recommendations?strategy=${strategy}&refresh=true`, req.url);
      const r = await fetch(url.toString());
      results[strategy] = r.ok ? "ok" : `error ${r.status}`;
    } catch (err) {
      results[strategy] = `failed: ${String(err)}`;
    }
  }

  return NextResponse.json({ status: "done", results });
}
