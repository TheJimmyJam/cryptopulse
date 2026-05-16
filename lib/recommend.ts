import { getTopMarkets, getCoinHistory } from "@/lib/coingecko";
import { buildDefiMap } from "@/lib/defillama";
import { buildMarketRegime } from "@/lib/feargreed";
import { scoreCoin, pickDailyBasket, isBasketExcluded } from "@/lib/scoring";
import { getSnapshotsByDate, saveSnapshot } from "@/lib/supabase";
import { DailySnapshot, Strategy } from "@/types/crypto";

const ALL_STRATEGIES: Strategy[] = ["conservative", "growth", "speculative"];

export type DailyPicks = Record<Strategy, DailySnapshot>;

/**
 * Returns today's picks for all 3 strategies. Reads from cached
 * daily_snapshots if all 3 strategies exist for the date; otherwise runs the
 * full scoring pipeline once (markets + DeFi + regime + score 100 coins +
 * pickDailyBasket), saves all 3 snapshots, and returns the freshly-generated
 * picks.
 *
 * This is the SINGLE source of truth for "what does the system recommend
 * today." Both the dashboard (/api/recommendations) and the tracker buy
 * (/api/baskets/buy) call this so they can never diverge.
 */
export async function ensureTodayPicks(today: string): Promise<DailyPicks> {
  // 1. Try cache: all 3 strategies must already exist for today
  const existingSnapshots = await getSnapshotsByDate(today);
  if (existingSnapshots.length >= 3) {
    const byStrat: Partial<Record<Strategy, DailySnapshot>> = {};
    for (const row of existingSnapshots) {
      byStrat[row.strategy] = row.snapshot;
    }
    if (byStrat.conservative && byStrat.growth && byStrat.speculative) {
      return {
        conservative: byStrat.conservative,
        growth: byStrat.growth,
        speculative: byStrat.speculative,
      };
    }
  }

  // 2. Cache miss — full regeneration
  const [markets, defiMap, regime] = await Promise.all([
    getTopMarkets(250),
    buildDefiMap(),
    buildMarketRegime(),
  ]);

  // Pre-filter stablecoins / commodities / tokenized RWAs so we don't waste
  // history calls on coins that will be excluded anyway.
  const TOP_N_HISTORY = 100;
  const topCoins = markets.filter((c) => !isBasketExcluded(c)).slice(0, TOP_N_HISTORY);

  const scoredResults = await Promise.allSettled(
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
  const scored = scoredResults
    .filter((r) => r.status === "fulfilled")
    .map((r) => (r as PromiseFulfilledResult<ReturnType<typeof scoreCoin>>).value);

  // Pick all 3 strategies at once (cross-strategy dedup + backfill applied)
  const basket = pickDailyBasket(scored, regime);
  const generatedAt = new Date().toISOString();

  // Persist all 3 snapshots in parallel
  const snapshots: DailyPicks = {
    conservative: { date: today, top5: basket.conservative, marketRegime: regime, generatedAt, strategy: "conservative" },
    growth:       { date: today, top5: basket.growth,       marketRegime: regime, generatedAt, strategy: "growth"       },
    speculative:  { date: today, top5: basket.speculative,  marketRegime: regime, generatedAt, strategy: "speculative"  },
  };
  await Promise.all(
    ALL_STRATEGIES.map(async (s) => {
      try {
        await saveSnapshot(snapshots[s]);
      } catch (err) {
        console.error(`Snapshot save failed for ${s}:`, err);
      }
    })
  );

  return snapshots;
}
