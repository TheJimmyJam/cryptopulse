import { NextRequest, NextResponse } from "next/server";
import { getBasketByDate } from "@/lib/supabase";
import {
  BasketDetail,
  BasketHoldingEnriched,
  Strategy,
} from "@/types/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/baskets/[date]
 * Full drill-in for a single day's $3000 basket:
 *   { basket, holdings: [{...entry, current, pnl}], summary: {...} }
 *
 * `date` must be YYYY-MM-DD.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { date: string } }
) {
  const { date } = params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const result = await getBasketByDate(date);
    if (!result) {
      return NextResponse.json({ error: `No basket exists for ${date}` }, { status: 404 });
    }
    const { basket, holdings } = result;

    // Pull current prices in one call
    const coinIds = Array.from(new Set(holdings.map((h) => h.coin_id)));
    const currentPrices: Record<string, number> = {};
    if (coinIds.length > 0) {
      try {
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd`;
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
    }

    const enriched: BasketHoldingEnriched[] = holdings.map((h) => {
      const cp = currentPrices[h.coin_id] ?? null;
      const cv = cp !== null ? h.coins_held * cp : null;
      const pnl = cv !== null ? cv - h.amount_usd : null;
      const pnlPct = pnl !== null ? (pnl / h.amount_usd) * 100 : null;
      return {
        ...h,
        currentPrice: cp,
        currentValue: cv,
        pnlUsd: pnl,
        pnlPct,
      };
    });

    // Totals
    let totalInvested = 0;
    let totalFees = 0;
    let totalCurrent = 0;
    let winners = 0;
    let losers = 0;
    let priced = 0;
    const byStrategy: Record<Strategy, { invested: number; fees: number; current_value: number; pnl_usd: number; pnl_pct: number }> = {
      conservative: { invested: 0, fees: 0, current_value: 0, pnl_usd: 0, pnl_pct: 0 },
      growth: { invested: 0, fees: 0, current_value: 0, pnl_usd: 0, pnl_pct: 0 },
      speculative: { invested: 0, fees: 0, current_value: 0, pnl_usd: 0, pnl_pct: 0 },
    };

    for (const h of enriched) {
      totalInvested += h.amount_usd;
      totalFees += h.fee_usd ?? 0;
      byStrategy[h.strategy].invested += h.amount_usd;
      byStrategy[h.strategy].fees += h.fee_usd ?? 0;
      if (h.currentValue !== null) {
        totalCurrent += h.currentValue;
        byStrategy[h.strategy].current_value += h.currentValue;
        priced += 1;
        // Win/loss measured against GROSS paid — true after-fee P&L
        if (h.currentValue > h.amount_usd) winners += 1;
        else if (h.currentValue < h.amount_usd) losers += 1;
      } else {
        byStrategy[h.strategy].current_value += h.amount_usd;
      }
    }

    // Finalize per-strategy pnl
    (Object.keys(byStrategy) as Strategy[]).forEach((s) => {
      const row = byStrategy[s];
      row.pnl_usd = row.current_value - row.invested;
      row.pnl_pct = row.invested > 0 ? (row.pnl_usd / row.invested) * 100 : 0;
    });

    // current = priced sum + (entry amount for unpriced — neutral assumption)
    const investedOfPriced = enriched
      .filter((h) => h.currentValue !== null)
      .reduce((s, h) => s + h.amount_usd, 0);
    const investedOfUnpriced = totalInvested - investedOfPriced;
    const currentValue = totalCurrent + investedOfUnpriced;
    const pnlUsd = currentValue - totalInvested;
    const pnlPct = totalInvested > 0 ? (pnlUsd / totalInvested) * 100 : 0;

    const detail: BasketDetail = {
      basket,
      holdings: enriched,
      summary: {
        total_invested: totalInvested,
        total_fees: totalFees,
        total_crypto_cost: totalInvested - totalFees,
        current_value: currentValue,
        pnl_usd: pnlUsd,
        pnl_pct: pnlPct,
        num_holdings: enriched.length,
        num_priced: priced,
        winners,
        losers,
        by_strategy: byStrategy,
      },
    };

    return NextResponse.json(detail);
  } catch (err) {
    console.error("Get basket failed:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
