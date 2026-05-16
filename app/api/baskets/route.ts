import { NextResponse } from "next/server";
import {
  getAllBasketHoldings,
  listBaskets,
} from "@/lib/supabase";
import { DailyBasketSummary } from "@/types/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/baskets
 * Returns a summary card per daily basket:
 *   { basket_date, total_invested, current_value, pnl_usd, pnl_pct,
 *     num_holdings, num_priced, days_since, winners, losers }
 */
export async function GET() {
  try {
    const baskets = await listBaskets(120);
    if (!baskets.length) {
      return NextResponse.json({ baskets: [] });
    }

    const holdings = await getAllBasketHoldings(baskets.map((b) => b.id));

    // Build coin → current price map (one CoinGecko call)
    const uniqueCoinIds = Array.from(new Set(holdings.map((h) => h.coin_id)));
    const currentPrices: Record<string, number> = {};
    if (uniqueCoinIds.length > 0) {
      try {
        // CoinGecko simple/price accepts ~250 ids per call comfortably
        const chunks: string[][] = [];
        const CHUNK = 100;
        for (let i = 0; i < uniqueCoinIds.length; i += CHUNK) {
          chunks.push(uniqueCoinIds.slice(i, i + CHUNK));
        }
        for (const chunk of chunks) {
          const url = `https://api.coingecko.com/api/v3/simple/price?ids=${chunk.join(",")}&vs_currencies=usd`;
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (res.ok) {
            const raw = (await res.json()) as Record<string, { usd: number }>;
            for (const [id, val] of Object.entries(raw)) {
              currentPrices[id] = val.usd;
            }
          }
        }
      } catch (err) {
        console.error("CoinGecko price fetch failed:", err);
      }
    }

    // Build summary per basket
    const now = Date.now();
    const summaries: DailyBasketSummary[] = baskets.map((b) => {
      const basketHoldings = holdings.filter((h) => h.basket_id === b.id);
      let currentValue = 0;
      let priced = 0;
      let winners = 0;
      let losers = 0;
      let anyMissing = false;
      let totalFees = 0;
      let totalCryptoCost = 0;

      for (const h of basketHoldings) {
        totalFees += h.fee_usd ?? 0;
        totalCryptoCost += h.amount_usd - (h.fee_usd ?? 0);
        const cp = currentPrices[h.coin_id];
        if (typeof cp === "number" && cp > 0) {
          const cv = h.coins_held * cp;
          currentValue += cv;
          priced += 1;
          // Win/loss measured against GROSS paid (amount_usd) — true after-fee P&L
          if (cv > h.amount_usd) winners += 1;
          else if (cv < h.amount_usd) losers += 1;
        } else {
          anyMissing = true;
        }
      }

      const fullyPriced = !anyMissing && basketHoldings.length > 0;
      const invested = b.total_invested;
      const pnlUsd = fullyPriced ? currentValue - invested : null;
      const pnlPct = fullyPriced && invested > 0 ? (pnlUsd! / invested) * 100 : null;
      const daysSince = Math.floor(
        (now - new Date(b.basket_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        basket_date: b.basket_date,
        total_invested: invested,
        total_fees: totalFees,
        total_crypto_cost: totalCryptoCost,
        current_value: fullyPriced ? currentValue : priced > 0 ? currentValue : null,
        pnl_usd: pnlUsd,
        pnl_pct: pnlPct,
        num_holdings: basketHoldings.length,
        num_priced: priced,
        days_since: daysSince,
        winners,
        losers,
      };
    });

    // Portfolio-level summary across all baskets
    const totalInvested = summaries.reduce((s, b) => s + b.total_invested, 0);
    const totalFeesAll = summaries.reduce((s, b) => s + (b.total_fees ?? 0), 0);
    const totalCurrent = summaries.reduce(
      (s, b) => s + (b.current_value ?? b.total_invested),
      0
    );
    const totalPnl = totalCurrent - totalInvested;
    const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    return NextResponse.json({
      baskets: summaries,
      portfolio: {
        total_invested: totalInvested,
        total_fees: totalFeesAll,
        current_value: totalCurrent,
        pnl_usd: totalPnl,
        pnl_pct: totalPnlPct,
        num_baskets: summaries.length,
      },
    });
  } catch (err) {
    console.error("List baskets failed:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err), baskets: [] },
      { status: 500 }
    );
  }
}
