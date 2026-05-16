import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { ensureTodayPicks } from "@/lib/recommend";
import {
  createBasket,
  getBasketRowByDate,
  NewBasketHoldingInput,
} from "@/lib/supabase";
import { Strategy } from "@/types/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STRATEGIES: Strategy[] = ["conservative", "growth", "speculative"];
const PER_COIN_USD = 200;

// Realistic retail buying fee for small spot purchases. Most US retail users
// buy through Coinbase Simple/Kraken Instant/Gemini at ~1.49%. Configurable
// via PAPER_TRADE_FEE_PCT env var (e.g. "0.005" for 0.5% Coinbase Advanced).
const DEFAULT_FEE_PCT = 0.015;
function getFeePct(): number {
  const raw = process.env.PAPER_TRADE_FEE_PCT;
  if (!raw) return DEFAULT_FEE_PCT;
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0 || n > 0.1) return DEFAULT_FEE_PCT;
  return n;
}

/**
 * POST /api/baskets/buy
 *
 * Records today's $3,000 paper-traded basket. CRITICAL: this endpoint does
 * NOT compute its own picks — it reads the EXACT same recommendations the
 * dashboard shows (via ensureTodayPicks, which also writes to daily_snapshots).
 * If snapshots don't exist for today yet, ensureTodayPicks generates them
 * once and persists them, so the dashboard sees the same coins the tracker
 * just bought.
 *
 * Idempotent — re-calling on a day with an existing basket is a no-op.
 */
export async function POST(req: NextRequest) {
  const dateParam = req.nextUrl.searchParams.get("date");
  const basketDate = dateParam ?? format(new Date(), "yyyy-MM-dd");

  try {
    // 0. Idempotency: if today's basket already exists, return it without
    //    re-fetching anything.
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

    // 1. Get today's recommendations (creates snapshots if missing).
    //    These are the EXACT picks shown on the dashboard.
    const picks = await ensureTodayPicks(basketDate);

    // 2. Build holdings from the snapshot top5 entries. Use snapshot entry
    //    prices so the tracker records what the dashboard recommended at
    //    the moment the picks were locked in.
    const feePct = getFeePct();
    const feeUsd = (PER_COIN_USD * feePct) / (1 + feePct);
    const cryptoCost = PER_COIN_USD - feeUsd;

    const holdings: NewBasketHoldingInput[] = [];
    const strategyResults: Record<Strategy, { count: number; picks: string[] }> = {
      conservative: { count: 0, picks: [] },
      growth: { count: 0, picks: [] },
      speculative: { count: 0, picks: [] },
    };

    for (const strategy of STRATEGIES) {
      const snapshot = picks[strategy];
      const top5 = snapshot.top5;
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
          fee_pct: feePct,
          fee_usd: feeUsd,
          coins_held: cryptoCost / asset.price,
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

    // 3. Persist
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

// GET = convenience for triggering from a browser / scheduled task
export async function GET(req: NextRequest) {
  return POST(req);
}
