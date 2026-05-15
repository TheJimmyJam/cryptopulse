"use client";
import { useState, useEffect, ReactNode } from "react";
import { TrackerPickEnriched } from "@/types/crypto";
import clsx from "clsx";

interface Summary {
  totalPicks: number;
  pricedPicks: number;
  totalInvested: number;
  totalCurrentValue: number;
  totalPnlUsd: number;
  totalPnlPct: number;
  winRate: number;
  winners: number;
  losers: number;
}

interface TrackerData {
  picks: TrackerPickEnriched[];
  summary: Summary | null;
}

const STRATEGY_OPTIONS = [
  { key: "all",          label: "All Strategies" },
  { key: "conservative", label: "Conservative" },
  { key: "growth",       label: "Growth" },
  { key: "speculative",  label: "Speculative" },
];

const STRATEGY_COLORS: Record<string, string> = {
  conservative: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  growth:       "bg-violet-500/10 text-violet-400 border-violet-500/20",
  speculative:  "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

function fmt$(n: number, decimals = 2) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function PnlChip({ usd, pct }: { usd: number; pct: number }) {
  const pos = usd > 0;
  const neg = usd < 0;
  return (
    <div className={clsx("font-semibold text-xs leading-tight", pos ? "text-emerald-400" : neg ? "text-red-400" : "text-slate-400")}>
      <div>{fmt$(usd)}</div>
      <div className="text-[10px] opacity-80">{fmtPct(pct)}</div>
    </div>
  );
}

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
          highlight === "green" ? "text-emerald-400" : highlight === "red" ? "text-red-400" : "text-white"
        )}
      >
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5">{sub}</div>}
    </div>
  );
}

export default function TrackerPage() {
  const [data, setData] = useState<TrackerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [strategyFilter, setStrategyFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "pnl_pct">("date");

  useEffect(() => {
    fetch("/api/tracker")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = (data?.picks ?? []).filter(
    (p) => strategyFilter === "all" || p.strategy === strategyFilter
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "pnl_pct") return (b.pnlPct ?? -9999) - (a.pnlPct ?? -9999);
    // date desc, then rank asc
    const dateDiff = new Date(b.pick_date).getTime() - new Date(a.pick_date).getTime();
    return dateDiff !== 0 ? dateDiff : a.rank - b.rank;
  });

  const { summary } = data ?? {};
  const hasData = !loading && sorted.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Signal Tracker</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            $200 paper-traded on every top-5 pick · Validates the model over time
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetch("/api/tracker")
              .then((r) => r.json())
              .then(setData)
              .catch(console.error)
              .finally(() => setLoading(false));
          }}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 self-start"
        >
          {loading ? (
            <>
              <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Loading…
            </>
          ) : "↻ Refresh Prices"}
        </button>
      </div>

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Total Invested"
            value={fmt$(summary.totalInvested)}
            sub={<span className="text-slate-500">{summary.pricedPicks} picks priced</span>}
          />
          <StatCard
            label="Current Value"
            value={fmt$(summary.totalCurrentValue)}
            highlight={summary.totalPnlUsd > 0 ? "green" : summary.totalPnlUsd < 0 ? "red" : undefined}
            sub={
              <span className={summary.totalPnlUsd >= 0 ? "text-emerald-400" : "text-red-400"}>
                {fmt$(summary.totalPnlUsd)} ({fmtPct(summary.totalPnlPct)})
              </span>
            }
          />
          <StatCard
            label="Win Rate"
            value={`${summary.winRate.toFixed(1)}%`}
            highlight={summary.winRate >= 50 ? "green" : "red"}
            sub={
              <span className="text-slate-500">
                <span className="text-emerald-400">{summary.winners}W</span>
                {" / "}
                <span className="text-red-400">{summary.losers}L</span>
              </span>
            }
          />
          <StatCard
            label="Total Picks"
            value={`${summary.totalPicks}`}
            sub={<span className="text-slate-500">{summary.totalPicks * 200 > 0 ? `${fmt$(summary.totalPicks * 200, 0)} simulated` : ""}</span>}
          />
        </div>
      )}

      {/* Filters + sort */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {STRATEGY_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStrategyFilter(key)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                strategyFilter === key
                  ? "bg-blue-600 text-white"
                  : "bg-[#161b27] text-slate-400 hover:text-white border border-[#1e2535]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-slate-600">Sort:</span>
          {(["date", "pnl_pct"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                sortBy === s
                  ? "bg-[#252d40] text-white"
                  : "text-slate-500 hover:text-slate-300"
              )}
            >
              {s === "date" ? "Date" : "P&L"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 bg-[#161b27] border border-[#1e2535] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && sorted.length === 0 && (
        <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-12 text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-slate-300 text-lg font-semibold mb-2">No picks tracked yet</p>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Go to the Dashboard and hit <strong className="text-slate-300">Refresh</strong> to generate
            today's signals. They'll automatically be paper-traded here for $200 each.
          </p>
        </div>
      )}

      {/* Picks table */}
      {hasData && (
        <div className="overflow-x-auto rounded-xl border border-[#1e2535]">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-[#0f1117] border-b border-[#1e2535]">
                {[
                  ["Date", "text-left"],
                  ["#", "text-left"],
                  ["Coin", "text-left"],
                  ["Strategy", "text-left hidden sm:table-cell"],
                  ["Entry Price", "text-right"],
                  ["Current Price", "text-right"],
                  ["$200 → Value", "text-right"],
                  ["P&L", "text-right"],
                  ["Days", "text-right hidden md:table-cell"],
                ].map(([label, cls]) => (
                  <th
                    key={label}
                    className={clsx("px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider", cls)}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((pick, i) => {
                const isWinner = (pick.pnlUsd ?? 0) > 0;
                const isLoser = (pick.pnlUsd ?? 0) < 0;
                return (
                  <tr
                    key={pick.id}
                    className={clsx(
                      "border-b border-[#1e2535] transition-colors hover:bg-[#1a2234]",
                      i % 2 === 0 ? "bg-[#161b27]" : "bg-[#0f1117]"
                    )}
                  >
                    {/* Date */}
                    <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap font-mono">
                      {pick.pick_date}
                    </td>

                    {/* Rank */}
                    <td className="px-4 py-3">
                      <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">
                        {pick.rank}
                      </span>
                    </td>

                    {/* Coin */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {pick.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={pick.image_url} alt={pick.symbol} className="w-6 h-6 rounded-full flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-[#252d40] flex-shrink-0" />
                        )}
                        <div>
                          <div className="font-bold text-white text-xs">{pick.symbol}</div>
                          <div className="text-slate-500 text-[10px]">{pick.name}</div>
                        </div>
                      </div>
                    </td>

                    {/* Strategy */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={clsx("px-2 py-0.5 rounded border text-[10px] font-semibold capitalize", STRATEGY_COLORS[pick.strategy])}>
                        {pick.strategy}
                      </span>
                    </td>

                    {/* Entry price */}
                    <td className="px-4 py-3 text-right text-slate-300 text-xs font-mono whitespace-nowrap">
                      {fmt$(pick.entry_price)}
                    </td>

                    {/* Current price */}
                    <td className="px-4 py-3 text-right text-xs font-mono whitespace-nowrap">
                      {pick.currentPrice !== null ? (
                        <span className={clsx(
                          "font-mono",
                          isWinner ? "text-emerald-400" : isLoser ? "text-red-400" : "text-slate-300"
                        )}>
                          {fmt$(pick.currentPrice)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* $200 → current value */}
                    <td className="px-4 py-3 text-right text-xs whitespace-nowrap">
                      {pick.currentValue !== null ? (
                        <div className="text-right">
                          <span className="text-slate-500 text-[10px]">$200 →</span>
                          <span className={clsx("ml-1 font-semibold", isWinner ? "text-emerald-400" : isLoser ? "text-red-400" : "text-slate-300")}>
                            {fmt$(pick.currentValue)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* P&L */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {pick.pnlUsd !== null ? (
                        <PnlChip usd={pick.pnlUsd} pct={pick.pnlPct!} />
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    {/* Days held */}
                    <td className="px-4 py-3 text-right text-slate-500 text-xs hidden md:table-cell whitespace-nowrap">
                      {pick.daysSincePick === 0 ? (
                        <span className="text-blue-400 font-semibold">today</span>
                      ) : (
                        `${pick.daysSincePick}d`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
        <p className="text-xs text-amber-200/60 leading-relaxed">
          <strong className="text-amber-400">Paper Trading Only:</strong> This tracker simulates
          $200 purchases at the exact price when signals are generated. No real money is involved.
          Past signal performance does not guarantee future results. This tool is for model
          validation only, not financial advice.
        </p>
      </div>
    </div>
  );
}
