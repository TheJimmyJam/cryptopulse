import { NextResponse } from "next/server";
import {
  getAllBasketHoldings,
  listBaskets,
} from "@/lib/supabase";
import { BasketHoldingRow, DailyBasketSummary, Strategy } from "@/types/crypto";

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

    // ─── Cross-basket KPI computation ────────────────────────────────────────
    type PricedHolding = BasketHoldingRow & {
      currentValue: number;
      pnlUsd: number;
      pnlPct: number;
    };

    const pricedHoldings: PricedHolding[] = holdings
      .map((h) => {
        const cp = currentPrices[h.coin_id];
        if (typeof cp !== "number" || cp <= 0) return null;
        const cv = h.coins_held * cp;
        const pnlUsd = cv - h.amount_usd;
        const pnlPct = (pnlUsd / h.amount_usd) * 100;
        return { ...h, currentValue: cv, pnlUsd, pnlPct };
      })
      .filter(Boolean) as PricedHolding[];

    // Best & worst picks by % and by $
    const sortedByPct = [...pricedHoldings].sort((a, b) => b.pnlPct - a.pnlPct);
    const sortedByUsd = [...pricedHoldings].sort((a, b) => b.pnlUsd - a.pnlUsd);
    const bestPickPct = sortedByPct[0] ?? null;
    const worstPickPct = sortedByPct[sortedByPct.length - 1] ?? null;
    const bestPickUsd = sortedByUsd[0] ?? null;
    const worstPickUsd = sortedByUsd[sortedByUsd.length - 1] ?? null;

    // Most frequently picked coin (across all holdings, not just priced)
    const pickCounts: Record<string, { symbol: string; name: string; image_url: string | null; count: number }> = {};
    for (const h of holdings) {
      if (!pickCounts[h.coin_id]) {
        pickCounts[h.coin_id] = { symbol: h.symbol, name: h.name, image_url: h.image_url, count: 0 };
      }
      pickCounts[h.coin_id].count++;
    }
    const mostPickedEntry = Object.values(pickCounts).sort((a, b) => b.count - a.count)[0] ?? null;

    // Win rate across all priced holdings
    const totalWinners = pricedHoldings.filter((h) => h.pnlUsd > 0).length;
    const totalLosers = pricedHoldings.filter((h) => h.pnlUsd < 0).length;
    const winRate = pricedHoldings.length > 0 ? (totalWinners / pricedHoldings.length) * 100 : 0;

    // Avg pick P&L %
    const avgPickPnlPct =
      pricedHoldings.length > 0
        ? pricedHoldings.reduce((s, h) => s + h.pnlPct, 0) / pricedHoldings.length
        : null;

    // Avg daily basket P&L %
    const pricedSummaries = summaries.filter((s) => s.pnl_pct !== null);
    const avgDailyPnlPct =
      pricedSummaries.length > 0
        ? pricedSummaries.reduce((s, b) => s + (b.pnl_pct ?? 0), 0) / pricedSummaries.length
        : null;

    // Best strategy all-time by P&L %
    const strategyTotals: Record<Strategy, { invested: number; current: number }> = {
      conservative: { invested: 0, current: 0 },
      growth: { invested: 0, current: 0 },
      speculative: { invested: 0, current: 0 },
    };
    for (const h of pricedHoldings) {
      strategyTotals[h.strategy].invested += h.amount_usd;
      strategyTotals[h.strategy].current += h.currentValue;
    }
    const strategyRankings = (Object.entries(strategyTotals) as [Strategy, { invested: number; current: number }][])
      .map(([strategy, v]) => ({
        strategy,
        pnl_usd: v.current - v.invested,
        pnl_pct: v.invested > 0 ? ((v.current - v.invested) / v.invested) * 100 : 0,
      }))
      .sort((a, b) => b.pnl_pct - a.pnl_pct);

    // Current W/L streak (most recent baskets first)
    const sortedSummaries = [...summaries].sort(
      (a, b) => new Date(b.basket_date).getTime() - new Date(a.basket_date).getTime()
    );
    let currentStreak: { type: "W" | "L" | "—"; count: number } = { type: "—", count: 0 };
    if (sortedSummaries.length > 0 && sortedSummaries[0].pnl_pct !== null) {
      const firstType = sortedSummaries[0].pnl_pct >= 0 ? "W" : "L";
      let streakCount = 0;
      for (const s of sortedSummaries) {
        if (s.pnl_pct === null) break;
        const t = s.pnl_pct >= 0 ? "W" : "L";
        if (t !== firstType) break;
        streakCount++;
      }
      currentStreak = { type: firstType, count: streakCount };
    }

    // Total unique coins ever picked
    const totalUniqueCoins = new Set(holdings.map((h) => h.coin_id)).size;

    // Largest single-day $ swing (best and worst basket by pnl_usd)
    const pricedByUsd = summaries.filter((s) => s.pnl_usd !== null);
    const bestDayUsd = pricedByUsd.sort((a, b) => (b.pnl_usd ?? 0) - (a.pnl_usd ?? 0))[0] ?? null;
    const worstDayUsd = pricedByUsd.sort((a, b) => (a.pnl_usd ?? 0) - (b.pnl_usd ?? 0))[0] ?? null;

    function pickKpi(h: PricedHolding | null) {
      if (!h) return null;
      return {
        symbol: h.symbol,
        name: h.name,
        image_url: h.image_url,
        pnl_pct: h.pnlPct,
        pnl_usd: h.pnlUsd,
        basket_date: h.basket_date,
        strategy: h.strategy,
      };
    }

    const kpis = {
      best_pick_pct: pickKpi(bestPickPct),
      worst_pick_pct: pickKpi(worstPickPct),
      best_pick_usd: pickKpi(bestPickUsd),
      worst_pick_usd: pickKpi(worstPickUsd),
      most_picked: mostPickedEntry,
      win_rate: winRate,
      total_winners: totalWinners,
      total_losers: totalLosers,
      avg_pick_pnl_pct: avgPickPnlPct,
      avg_daily_pnl_pct: avgDailyPnlPct,
      strategy_rankings: strategyRankings,
      current_streak: currentStreak,
      total_unique_coins: totalUniqueCoins,
      best_day_usd: bestDayUsd
        ? { basket_date: bestDayUsd.basket_date, pnl_usd: bestDayUsd.pnl_usd, pnl_pct: bestDayUsd.pnl_pct }
        : null,
      worst_day_usd: worstDayUsd
        ? { basket_date: worstDayUsd.basket_date, pnl_usd: worstDayUsd.pnl_usd, pnl_pct: worstDayUsd.pnl_pct }
        : null,
      total_fees: totalFeesAll,
    };

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
      kpis,
    });
  } catch (err) {
    console.error("List baskets failed:", err);
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err), baskets: [] },
      { status: 500 }
    );
  }
}
