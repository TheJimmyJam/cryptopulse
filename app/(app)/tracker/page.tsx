"use client";
import { useState, useEffect, useCallback, ReactNode } from "react";
import clsx from "clsx";
import {
  BasketDetail,
  BasketHoldingEnriched,
  DailyBasketSummary,
  Strategy,
} from "@/types/crypto";

// ─── Types specific to the page ─────────────────────────────────────────────

interface PickKpi {
  symbol: string;
  name: string;
  image_url: string | null;
  pnl_pct: number;
  pnl_usd: number;
  basket_date: string;
  strategy: Strategy;
}

interface BasketsKpis {
  best_pick_pct: PickKpi | null;
  worst_pick_pct: PickKpi | null;
  best_pick_usd: PickKpi | null;
  worst_pick_usd: PickKpi | null;
  most_picked: { symbol: string; name: string; image_url: string | null; count: number } | null;
  win_rate: number;
  total_winners: number;
  total_losers: number;
  avg_pick_pnl_pct: number | null;
  avg_daily_pnl_pct: number | null;
  strategy_rankings: Array<{ strategy: Strategy; pnl_pct: number; pnl_usd: number }>;
  current_streak: { type: "W" | "L" | "—"; count: number };
  total_unique_coins: number;
  best_day_usd: { basket_date: string; pnl_usd: number | null; pnl_pct: number | null } | null;
  worst_day_usd: { basket_date: string; pnl_usd: number | null; pnl_pct: number | null } | null;
  total_fees: number;
}

interface BasketsListResponse {
  baskets: DailyBasketSummary[];
  portfolio?: {
    total_invested: number;
    total_fees?: number;
    current_value: number;
    pnl_usd: number;
    pnl_pct: number;
    num_baskets: number;
  };
  kpis?: BasketsKpis;
}

// ─── Formatters ─────────────────────────────────────────────────────────────

function fmt$(n: number | null | undefined, decimals = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
function fmtPct(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}
function fmtDate(iso: string) {
  // YYYY-MM-DD → "May 16, 2026"
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Small reusables ────────────────────────────────────────────────────────

const STRATEGY_COLORS: Record<Strategy, string> = {
  conservative: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  growth: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  speculative: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

function StatCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  highlight?: "green" | "red";
}) {
  return (
    <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div
        className={clsx(
          "text-xl font-black",
          highlight === "green"
            ? "text-emerald-400"
            : highlight === "red"
            ? "text-red-400"
            : "text-white"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

/** Coin-avatar Hall-of-Fame card for best/worst/most-picked picks */
function PickHofCard({
  label,
  icon,
  pick,
  sub,
  accent,
}: {
  label: string;
  icon: string;
  pick: PickKpi | { symbol: string; name: string; image_url: string | null } | null;
  sub: string;
  accent: "green" | "red" | "blue" | "violet";
}) {
  const accentCls = {
    green: "border-emerald-500/20 bg-emerald-500/5",
    red: "border-red-500/20 bg-red-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    violet: "border-violet-500/20 bg-violet-500/5",
  }[accent];
  const textCls = {
    green: "text-emerald-400",
    red: "text-red-400",
    blue: "text-blue-400",
    violet: "text-violet-400",
  }[accent];

  return (
    <div className={clsx("rounded-xl border p-4", accentCls)}>
      <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {pick ? (
        <div className="flex items-center gap-3">
          {pick.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pick.image_url} alt={pick.symbol} className="w-8 h-8 rounded-full flex-shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#252d40] flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-black text-white text-sm">{pick.symbol}</div>
            <div className="text-slate-500 text-[10px] truncate">{pick.name}</div>
          </div>
          <div className={clsx("ml-auto text-right font-black text-sm", textCls)}>
            {sub}
          </div>
        </div>
      ) : (
        <div className="text-slate-600 text-sm">No data yet</div>
      )}
    </div>
  );
}

function PnlText({
  usd,
  pct,
  size = "sm",
}: {
  usd: number | null;
  pct: number | null;
  size?: "sm" | "md";
}) {
  const isPos = (usd ?? 0) > 0;
  const isNeg = (usd ?? 0) < 0;
  const color = isPos ? "text-emerald-400" : isNeg ? "text-red-400" : "text-slate-400";
  return (
    <div className={clsx("font-semibold leading-tight", color, size === "md" ? "text-sm" : "text-xs")}>
      <div>{fmt$(usd)}</div>
      <div className={clsx("opacity-80", size === "md" ? "text-xs" : "text-[10px]")}>
        {fmtPct(pct)}
      </div>
    </div>
  );
}

// ─── Drill-in detail view ───────────────────────────────────────────────────

function BasketDetailView({
  date,
  onBack,
}: {
  date: string;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<BasketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setErr(null);
    fetch(`/api/baskets/${date}`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(setDetail)
      .catch((e) => setErr(String(e.message ?? e)))
      .finally(() => setLoading(false));
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="text-xs text-slate-400 hover:text-white"
        >
          ← Back to all baskets
        </button>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 bg-[#161b27] border border-[#1e2535] rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (err || !detail) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-xs text-slate-400 hover:text-white">
          ← Back to all baskets
        </button>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 text-center">
          <p className="text-red-300 font-semibold mb-1">Could not load basket</p>
          <p className="text-red-400/70 text-sm">{err ?? "Unknown error"}</p>
        </div>
      </div>
    );
  }

  const { basket, holdings, summary } = detail;
  const isUp = summary.pnl_usd > 0;
  const isDown = summary.pnl_usd < 0;

  // Group holdings by strategy
  const byStrategy: Record<Strategy, BasketHoldingEnriched[]> = {
    conservative: [],
    growth: [],
    speculative: [],
  };
  holdings.forEach((h) => byStrategy[h.strategy].push(h));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            onClick={onBack}
            className="text-xs text-slate-400 hover:text-white mb-2"
          >
            ← Back to all baskets
          </button>
          <h1 className="text-2xl font-black text-white">
            Basket: {fmtDate(basket.basket_date)}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {basket.num_coins} coins · ${basket.per_coin_amount} each · ${basket.total_invested.toLocaleString()} total
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors self-start"
        >
          ↻ Refresh Prices
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Gross Paid"
          value={fmt$(summary.total_invested, 0)}
          sub={
            <span className="text-slate-500">
              {fmt$(summary.total_fees)} fees · {fmt$(summary.total_crypto_cost)} crypto
            </span>
          }
        />
        <StatCard
          label="Current Value"
          value={fmt$(summary.current_value, 2)}
          highlight={isUp ? "green" : isDown ? "red" : undefined}
          sub={
            <span className={isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-400"}>
              {fmt$(summary.pnl_usd)} ({fmtPct(summary.pnl_pct)})
            </span>
          }
        />
        <StatCard
          label="Winners / Losers"
          value={`${summary.winners}W / ${summary.losers}L`}
          sub={<span className="text-slate-500">{summary.num_priced}/{summary.num_holdings} priced</span>}
        />
        <StatCard
          label="Best Strategy"
          value={(() => {
            const entries = Object.entries(summary.by_strategy) as [Strategy, typeof summary.by_strategy[Strategy]][];
            const best = entries.reduce((a, b) => (b[1].pnl_pct > a[1].pnl_pct ? b : a));
            return best[0].slice(0, 1).toUpperCase() + best[0].slice(1);
          })()}
          sub={(() => {
            const entries = Object.entries(summary.by_strategy) as [Strategy, typeof summary.by_strategy[Strategy]][];
            const best = entries.reduce((a, b) => (b[1].pnl_pct > a[1].pnl_pct ? b : a));
            return <span className={best[1].pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"}>{fmtPct(best[1].pnl_pct)}</span>;
          })()}
        />
      </div>

      {/* Per-strategy breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(Object.keys(byStrategy) as Strategy[]).map((s) => {
          const ss = summary.by_strategy[s];
          const sIsUp = ss.pnl_usd > 0;
          const sIsDown = ss.pnl_usd < 0;
          return (
            <div
              key={s}
              className={clsx(
                "rounded-xl p-3 border",
                "bg-[#161b27] border-[#1e2535]"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={clsx(
                    "px-2 py-0.5 rounded border text-[10px] font-semibold capitalize",
                    STRATEGY_COLORS[s]
                  )}
                >
                  {s}
                </span>
                <span className="text-[10px] text-slate-500">${ss.invested} → ${ss.current_value.toFixed(0)}</span>
              </div>
              <div className={clsx("text-lg font-black", sIsUp ? "text-emerald-400" : sIsDown ? "text-red-400" : "text-white")}>
                {fmtPct(ss.pnl_pct)}
              </div>
              <div className={clsx("text-xs", sIsUp ? "text-emerald-400/70" : sIsDown ? "text-red-400/70" : "text-slate-500")}>
                {fmt$(ss.pnl_usd)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Holdings table */}
      <div className="overflow-x-auto rounded-xl border border-[#1e2535]">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="bg-[#0f1117] border-b border-[#1e2535]">
              {[
                ["Strategy", "text-left"],
                ["#", "text-left"],
                ["Coin", "text-left"],
                ["Entry Price", "text-right"],
                ["Fee", "text-right"],
                ["Current Price", "text-right"],
                ["$200 → Value", "text-right"],
                ["P&L", "text-right"],
              ].map(([label, cls]) => (
                <th
                  key={label}
                  className={clsx(
                    "px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider",
                    cls
                  )}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {holdings.map((h, i) => {
              const isW = (h.pnlUsd ?? 0) > 0;
              const isL = (h.pnlUsd ?? 0) < 0;
              return (
                <tr
                  key={h.id}
                  className={clsx(
                    "border-b border-[#1e2535] transition-colors hover:bg-[#1a2234]",
                    i % 2 === 0 ? "bg-[#161b27]" : "bg-[#0f1117]"
                  )}
                >
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "px-2 py-0.5 rounded border text-[10px] font-semibold capitalize",
                        STRATEGY_COLORS[h.strategy]
                      )}
                    >
                      {h.strategy}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">
                      {h.strategy_rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {h.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={h.image_url}
                          alt={h.symbol}
                          className="w-6 h-6 rounded-full flex-shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-[#252d40] flex-shrink-0" />
                      )}
                      <div>
                        <div className="font-bold text-white text-xs">{h.symbol}</div>
                        <div className="text-slate-500 text-[10px]">{h.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300 text-xs font-mono whitespace-nowrap">
                    {fmt$(h.entry_price, h.entry_price < 1 ? 6 : 2)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                    <div className="text-slate-400 font-mono">{fmt$(h.fee_usd)}</div>
                    <div className="text-slate-600 text-[10px]">{(h.fee_pct * 100).toFixed(2)}%</div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono whitespace-nowrap">
                    {h.currentPrice !== null ? (
                      <span
                        className={clsx(
                          isW ? "text-emerald-400" : isL ? "text-red-400" : "text-slate-300"
                        )}
                      >
                        {fmt$(h.currentPrice, h.currentPrice < 1 ? 6 : 2)}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                    {h.currentValue !== null ? (
                      <div className="text-right">
                        <span className="text-slate-500 text-[10px]">$200 →</span>
                        <span
                          className={clsx(
                            "ml-1 font-semibold",
                            isW ? "text-emerald-400" : isL ? "text-red-400" : "text-slate-300"
                          )}
                        >
                          {fmt$(h.currentValue)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <PnlText usd={h.pnlUsd} pct={h.pnlPct} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── List view (all baskets) ────────────────────────────────────────────────

function BasketsListView({
  onSelectDate,
}: {
  onSelectDate: (date: string) => void;
}) {
  const [data, setData] = useState<BasketsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [buyMsg, setBuyMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/baskets")
      .then((r) => r.json())
      .then(setData)
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function buyToday() {
    setBuying(true);
    setBuyMsg(null);
    try {
      const r = await fetch("/api/baskets/buy", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
      setBuyMsg(j.message ?? "Done");
      load();
    } catch (err) {
      setBuyMsg(`Failed: ${String(err instanceof Error ? err.message : err)}`);
    } finally {
      setBuying(false);
    }
  }

  const baskets = data?.baskets ?? [];
  const portfolio = data?.portfolio;
  const kpis = data?.kpis;
  const isUp = (portfolio?.pnl_usd ?? 0) > 0;
  const isDown = (portfolio?.pnl_usd ?? 0) < 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Daily Baskets</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            $3,000/day paper-traded · $200 per coin (~1.5% retail fee included) across 15 unique picks · Click a day to drill in
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <button
            onClick={buyToday}
            disabled={buying}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {buying ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Buying…
              </>
            ) : (
              "+ Buy Today's $3K Basket"
            )}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {loading ? "…" : "↻"}
          </button>
        </div>
      </div>

      {buyMsg && (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-sm text-blue-300">
          {buyMsg}
        </div>
      )}

      {/* Portfolio summary */}
      {portfolio && portfolio.num_baskets > 0 && (
        <div className="space-y-4">

          {/* Row 1 — core portfolio stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Total Paid"
              value={fmt$(portfolio.total_invested, 0)}
              sub={
                <span className="text-slate-500">
                  {portfolio.num_baskets} days
                  {portfolio.total_fees ? ` · ${fmt$(portfolio.total_fees, 0)} fees` : ""}
                </span>
              }
            />
            <StatCard
              label="Current Value"
              value={fmt$(portfolio.current_value, 0)}
              highlight={isUp ? "green" : isDown ? "red" : undefined}
              sub={
                <span className={isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-400"}>
                  {fmt$(portfolio.pnl_usd)} ({fmtPct(portfolio.pnl_pct)})
                </span>
              }
            />
            <StatCard
              label="Best Day (%)"
              value={(() => {
                const best = [...baskets].sort((a, b) => (b.pnl_pct ?? -9999) - (a.pnl_pct ?? -9999))[0];
                return best ? fmtPct(best.pnl_pct) : "—";
              })()}
              highlight="green"
              sub={(() => {
                const best = [...baskets].sort((a, b) => (b.pnl_pct ?? -9999) - (a.pnl_pct ?? -9999))[0];
                return best ? <span className="text-slate-500">{fmtDate(best.basket_date)}</span> : null;
              })()}
            />
            <StatCard
              label="Worst Day (%)"
              value={(() => {
                const w = [...baskets].sort((a, b) => (a.pnl_pct ?? 9999) - (b.pnl_pct ?? 9999))[0];
                return w ? fmtPct(w.pnl_pct) : "—";
              })()}
              highlight="red"
              sub={(() => {
                const w = [...baskets].sort((a, b) => (a.pnl_pct ?? 9999) - (b.pnl_pct ?? 9999))[0];
                return w ? <span className="text-slate-500">{fmtDate(w.basket_date)}</span> : null;
              })()}
            />
          </div>

          {/* Row 2 — pick-level stats */}
          {kpis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="All-Time Win Rate"
                value={kpis.win_rate > 0 ? `${kpis.win_rate.toFixed(1)}%` : "—"}
                highlight={kpis.win_rate >= 50 ? "green" : "red"}
                sub={
                  <span className="text-slate-500">
                    {kpis.total_winners}W / {kpis.total_losers}L across all picks
                  </span>
                }
              />
              <StatCard
                label="Avg Pick Return"
                value={kpis.avg_pick_pnl_pct !== null ? fmtPct(kpis.avg_pick_pnl_pct) : "—"}
                highlight={
                  kpis.avg_pick_pnl_pct !== null
                    ? kpis.avg_pick_pnl_pct >= 0 ? "green" : "red"
                    : undefined
                }
                sub={
                  <span className="text-slate-500">
                    avg daily {kpis.avg_daily_pnl_pct !== null ? fmtPct(kpis.avg_daily_pnl_pct) : "—"}
                  </span>
                }
              />
              <StatCard
                label="Current Streak"
                value={
                  kpis.current_streak.type === "—"
                    ? "—"
                    : `${kpis.current_streak.count} ${kpis.current_streak.type}`
                }
                highlight={
                  kpis.current_streak.type === "W"
                    ? "green"
                    : kpis.current_streak.type === "L"
                    ? "red"
                    : undefined
                }
                sub={
                  <span className="text-slate-500">
                    {kpis.current_streak.type === "W"
                      ? "winning days in a row"
                      : kpis.current_streak.type === "L"
                      ? "losing days in a row"
                      : "no streak yet"}
                  </span>
                }
              />
              <StatCard
                label="Coins Tried"
                value={kpis.total_unique_coins > 0 ? String(kpis.total_unique_coins) : "—"}
                sub={
                  <span className="text-slate-500">
                    {fmt$(kpis.total_fees, 0)} total fees paid
                  </span>
                }
              />
            </div>
          )}

          {/* Hall of Fame — best/worst individual picks */}
          {kpis && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest pt-1">
                Picks Record Book
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <PickHofCard
                  label="Best Pick Ever (%)"
                  icon="🏆"
                  pick={kpis.best_pick_pct}
                  sub={kpis.best_pick_pct ? fmtPct(kpis.best_pick_pct.pnl_pct) : "—"}
                  accent="green"
                />
                <PickHofCard
                  label="Worst Pick Ever (%)"
                  icon="💀"
                  pick={kpis.worst_pick_pct}
                  sub={kpis.worst_pick_pct ? fmtPct(kpis.worst_pick_pct.pnl_pct) : "—"}
                  accent="red"
                />
                <PickHofCard
                  label="Biggest Single Win ($)"
                  icon="💰"
                  pick={kpis.best_pick_usd}
                  sub={kpis.best_pick_usd ? fmt$(kpis.best_pick_usd.pnl_usd) : "—"}
                  accent="green"
                />
                <PickHofCard
                  label="Most Picked Coin"
                  icon="🔁"
                  pick={kpis.most_picked ?? null}
                  sub={kpis.most_picked ? `${kpis.most_picked.count}× picked` : "—"}
                  accent="blue"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <PickHofCard
                  label="Biggest Single Loss ($)"
                  icon="🩸"
                  pick={kpis.worst_pick_usd}
                  sub={kpis.worst_pick_usd ? fmt$(kpis.worst_pick_usd.pnl_usd) : "—"}
                  accent="red"
                />
                {/* Strategy standings — top 3 */}
                {kpis.strategy_rankings.slice(0, 3).map((sr, i) => (
                  <div
                    key={sr.strategy}
                    className={clsx(
                      "rounded-xl border p-4",
                      i === 0
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : i === 1
                        ? "border-blue-500/20 bg-blue-500/5"
                        : "border-slate-700/40 bg-slate-800/20"
                    )}
                  >
                    <div className="text-xs text-slate-500 mb-2 flex items-center gap-1">
                      <span>{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
                      <span>
                        {sr.strategy.charAt(0).toUpperCase() + sr.strategy.slice(1)} Strategy
                      </span>
                    </div>
                    <div
                      className={clsx(
                        "text-xl font-black",
                        sr.pnl_pct >= 0 ? "text-emerald-400" : "text-red-400"
                      )}
                    >
                      {fmtPct(sr.pnl_pct)}
                    </div>
                    <div
                      className={clsx(
                        "text-xs mt-0.5",
                        sr.pnl_pct >= 0 ? "text-emerald-400/70" : "text-red-400/70"
                      )}
                    >
                      {fmt$(sr.pnl_usd)} all-time
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-[#161b27] border border-[#1e2535] rounded-xl animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && baskets.length === 0 && (
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-slate-300 text-lg font-semibold mb-2">No baskets yet</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            Hit <strong className="text-emerald-400">Buy Today's $3K Basket</strong> above
            to record your first day. Set up the scheduled task to auto-buy every morning.
          </p>
        </div>
      )}

      {/* Baskets list */}
      {!loading && baskets.length > 0 && (
        <div className="space-y-2">
          {baskets.map((b) => {
            const up = (b.pnl_usd ?? 0) > 0;
            const down = (b.pnl_usd ?? 0) < 0;
            const isToday = b.days_since === 0;
            return (
              <button
                key={b.basket_date}
                onClick={() => onSelectDate(b.basket_date)}
                className="w-full text-left bg-[#161b27] border border-[#1e2535] hover:border-blue-500/40 hover:bg-[#1a2234] rounded-xl p-4 transition-all"
              >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex-shrink-0">
                      <div className="text-base font-black text-white">
                        {fmtDate(b.basket_date)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {isToday ? (
                          <span className="text-blue-400 font-semibold">Today</span>
                        ) : (
                          `${b.days_since}d ago`
                        )}{" "}
                        · {b.num_holdings} coins
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right flex-wrap">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                        Invested
                      </div>
                      <div className="text-sm font-bold text-slate-200">
                        {fmt$(b.total_invested, 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                        Worth Today
                      </div>
                      <div
                        className={clsx(
                          "text-sm font-bold",
                          up ? "text-emerald-400" : down ? "text-red-400" : "text-slate-200"
                        )}
                      >
                        {fmt$(b.current_value)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                        P&L
                      </div>
                      <PnlText usd={b.pnl_usd} pct={b.pnl_pct} size="md" />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">
                        W / L
                      </div>
                      <div className="text-sm font-mono text-slate-300">
                        <span className="text-emerald-400">{b.winners}</span>
                        {" / "}
                        <span className="text-red-400">{b.losers}</span>
                      </div>
                    </div>
                    <div className="text-slate-500 text-lg">›</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <p className="text-xs text-amber-200/60 leading-relaxed">
          <strong className="text-amber-400">Paper Trading Only:</strong> Each daily basket
          simulates buying $200 of the top 5 coins from each of the conservative, growth, and
          speculative strategies at their prices when the basket was created. A retail
          exchange fee (~1.5% — Coinbase Simple / Kraken Instant level) is baked into every
          purchase, so the $200 reflects what you'd actually pay at checkout. P&L is measured
          against gross paid, not the post-fee crypto amount. No real money involved. Past
          performance ≠ future results.
        </p>
      </div>
    </div>
  );
}

// ─── Top-level page ─────────────────────────────────────────────────────────

export default function TrackerPage() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (selectedDate) {
    return (
      <BasketDetailView
        date={selectedDate}
        onBack={() => setSelectedDate(null)}
      />
    );
  }

  return <BasketsListView onSelectDate={setSelectedDate} />;
}
