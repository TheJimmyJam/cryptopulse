import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { getTopMarkets, getCoinHistory } from "@/lib/coingecko";
import { buildDefiMap } from "@/lib/defillama";
import { buildMarketRegime } from "@/lib/feargreed";
import { scoreCoin, filterAndRank } from "@/lib/scoring";
import {
  createBasket,
  getBasketRowByDate,
  NewBasketHoldingInput,
} from "@/lib/supabase";
import { Strategy } from "@/types/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — heavy CoinGecko fetches

const STRATEGIES: Strategy[] = ["conservative", "growth", "speculative"];
const PER_COIN_USD = 200;

/**
 * POST /api/baskets/buy
 *
 * Daily buy hook: builds today's $3000 paper-traded basket.
 *   • Top 5 coins from each of 3 strategies → 15 holdings
 *   • $200 per holding × 15 = $3000 total
 *   • Idempotent: re-calling on the same day returns the existing basket
 *
 * No auth required — paper trades only, idempotent by date.
 */
export async function POST(req: NextRequest) {
  // Allow overriding the basket date via ?date=YYYY-MM-DD (for backfills / testing)
  const dateParam = req.nextUrl.searchParams.get("date");
  const basketDate = dateParam ?? format(new Date(), "yyyy-MM-dd");

  try {
    // 0. Idempotency short-circuit: if today's basket already exists,
    //    return it without hitting CoinGecko (saves rate-limit headroom).
    const existing = await getBasketRowByDate(basketDate);
    if (existing) {
      return NextResponse.json({
        ok: true,
        created: false,
        basket_date: existing.basket_date,
        basket_id: existing.id,
        total_invested: existing.total_invested,
        num_holdings: existing.num_coins,
        message: `Basket for ${existing.basket_date} already exists — no changes`,
      });
    }

    // 1. Pull market data once for all strategies
    const [markets, defiMap, regime] = await Promise.all([
      getTopMarkets(250),
      buildDefiMap(),
      buildMarketRegime(),
    ]);

    // 2. Score top 100 coins (rate-limit guard)
    const topCoins = markets.slice(0, 100);
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

    // 3. For each strategy, take its top 5 and build holding inputs
    const holdings: NewBasketHoldingInput[] = [];
    const strategyResults: Record<Strategy, { count: number; picks: string[] }> = {
      conservative: { count: 0, picks: [] },
      growth: { count: 0, picks: [] },
      speculative: { count: 0, picks: [] },
    };

    for (const strategy of STRATEGIES) {
      const top5 = filterAndRank(scored, strategy, regime);
      strategyResults[strategy] = {
        count: top5.length,
        picks: top5.map((a) => a.symbol),
      };

      top5.forEach((asset, idx) => {
        holdings.push({
          strategy,
          strategy_rank: idx + 1,
          coin_id: asset.id,
          symbol: asset.symbol.toUpperCase(),
          name: asset.name,
          image_url: asset.image ?? null,
          entry_price: asset.price,
          amount_usd: PER_COIN_USD,
          coins_held: PER_COIN_USD / asset.price,
          signal: asset.signal,
          score_total: asset.scores.total,
          narrative_tags: asset.narrativeTags ?? [],
        });
      });
    }

    if (holdings.length === 0) {
      return NextResponse.json(
        { error: "No qualifying coins from any strategy", strategyResults },
        { status: 422 }
      );
    }

    // 4. Persist
    const { basket, created } = await createBasket(basketDate, holdings);

    return NextResponse.json({
      ok: true,
      created,
      basket_date: basket.basket_date,
      basket_id: basket.id,
      total_invested: basket.total_invested,
      num_holdings: holdings.length,
      strategyResults,
      message: created
        ? `Bought $${basket.total_invested} basket for ${basket.basket_date}`
        : `Basket for ${basket.basket_date} already exists — no changes`,
    });
  } catch (err) {
    console.error("Basket buy failed:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}

// GET = convenience for triggering from a browser / scheduled task that prefers GET
export async function GET(req: NextRequest) {
  return POST(req);
}
