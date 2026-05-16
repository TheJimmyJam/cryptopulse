import { NextRequest, NextResponse } from "next/server";
import { getTopMarkets, getCoinHistory } from "@/lib/coingecko";
import { buildDefiMap } from "@/lib/defillama";
import { buildMarketRegime } from "@/lib/feargreed";
import { scoreCoin, pickDailyBasket, isStablecoin } from "@/lib/scoring";
import { saveSnapshot, getLatestSnapshot } from "@/lib/supabase";
import { DailySnapshot, Strategy } from "@/types/crypto";
import { format } from "date-fns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_STRATEGIES: Strategy[] = ["conservative", "growth", "speculative"];

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

  // 3. Pre-filter stablecoins + commodity tokens BEFORE scoring (saves API calls).
  //    Score the top 100 non-excluded coins.
  const TOP_N_HISTORY = 100;
  const topCoins = markets.filter((c) => !isStablecoin(c)).slice(0, TOP_N_HISTORY);

  const scoredCoins = await Promise.allSettled(
    topCoins.map(async (coin) => {
      try {
        const history = await getCoinHistory(coin.id, 90);
        const closes = history.prices.map(([, p]) => p);
        const volumes = history.volumes.map(([, v]) => v);
        const defi = defiMap.get(coin.symbol.toLowerCase());
        return scoreCoin(coin, closes, volumes, regime, defi);
      } catch {
        const closes = coin.sparkline_in_7d?.price ?? [];
        const defi = defiMap.get(coin.symbol.toLowerCase());
        return scoreCoin(coin, closes, [], regime, defi);
      }
    })
  );

  const validScores = scoredCoins
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<ReturnType<typeof scoreCoin>>).value);

  // 4. Pick all 3 strategies at once so cross-strategy dedup applies.
  //    pickDailyBasket() handles backfill from looser tiers + 15 unique coins.
  const basket = pickDailyBasket(validScores, regime);

  const generatedAt = new Date().toISOString();
  const snapshots: Record<Strategy, DailySnapshot> = {
    conservative: { date: today, top5: basket.conservative, marketRegime: regime, generatedAt, strategy: "conservative" },
    growth:       { date: today, top5: basket.growth,       marketRegime: regime, generatedAt, strategy: "growth"       },
    speculative:  { date: today, top5: basket.speculative,  marketRegime: regime, generatedAt, strategy: "speculative"  },
  };

  // 5. Persist all 3 snapshots in parallel so dashboard reads stay in sync
  await Promise.all(
    ALL_STRATEGIES.map(async (s) => {
      try {
        await saveSnapshot(snapshots[s]);
      } catch (err) {
        console.error(`Snapshot save failed for ${s}:`, err);
      }
    })
  );

  return NextResponse.json(snapshots[strategy]);
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
