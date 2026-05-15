"use client";
import { useState } from "react";
import { ScoredAsset } from "@/types/crypto";
import { SignalBadge, RiskBadge } from "./SignalBadge";
import { ScoreRing } from "./ScoreRing";
import { Sparkline } from "./Sparkline";
import clsx from "clsx";

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${fmt(Math.abs(n), 2)}%`;
}
function fmtPrice(n: number) {
  return n < 1 ? `$${n.toFixed(4)}` : `$${fmt(n)}`;
}
function fmtLarge(n: number) {
  if (n >= 1e12) return `$${fmt(n / 1e12, 2)}T`;
  if (n >= 1e9)  return `$${fmt(n / 1e9,  2)}B`;
  if (n >= 1e6)  return `$${fmt(n / 1e6,  2)}M`;
  return `$${fmt(n, 0)}`;
}

// ─── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ scores }: { scores: ScoredAsset["scores"] }) {
  const segments = [
    { val: scores.momentum,    max: 20, color: "bg-blue-500",    label: "Momentum" },
    { val: scores.liquidity,   max: 15, color: "bg-cyan-500",    label: "Liquidity" },
    { val: scores.onChain,     max: 15, color: "bg-violet-500",  label: "On-chain" },
    { val: scores.fundamental, max: 15, color: "bg-emerald-500", label: "Fundamental" },
    { val: scores.sentiment,   max: 15, color: "bg-amber-500",   label: "Sentiment" },
    { val: scores.marketRegime,max:  5, color: "bg-slate-400",   label: "Regime" },
  ];
  return (
    <div className="space-y-1.5">
      {segments.map(({ val, max, color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 w-20 flex-shrink-0">{label}</span>
          <div className="flex-1 h-1.5 bg-[#1e2535] rounded overflow-hidden">
            <div className={`${color} h-full rounded`} style={{ width: `${(val / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-slate-400 w-8 text-right tabular-nums">{val}/{max}</span>
        </div>
      ))}
      {scores.riskPenalty > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-red-400 w-20 flex-shrink-0">Risk penalty</span>
          <div className="flex-1 h-1.5 bg-[#1e2535] rounded overflow-hidden">
            <div className="bg-red-500 h-full rounded" style={{ width: `${(scores.riskPenalty / 15) * 100}%` }} />
          </div>
          <span className="text-[10px] text-red-400 w-8 text-right tabular-nums">−{scores.riskPenalty}</span>
        </div>
      )}
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ asset, onClose }: { asset: ScoredAsset; onClose: () => void }) {
  const pos = asset.priceChange24h >= 0;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal panel */}
      <div
        className="modal-panel relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#161b27] border border-[#2e3a55] rounded-2xl shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#161b27] border-b border-[#1e2535] px-6 py-4 flex items-center gap-4 rounded-t-2xl z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.image} alt={asset.name} width={40} height={40} className="rounded-full ring-1 ring-white/10 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black text-white">{asset.symbol}</span>
              <span className="text-sm text-slate-400">{asset.name}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">{asset.reasoning}</p>
          </div>
          <ScoreRing score={asset.scores.total} size={56} />
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full bg-[#252d40] hover:bg-[#2e3a55] flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* Price + sparkline row */}
          <div className="flex items-center gap-6">
            <div>
              <div className="text-2xl font-black text-white tabular-nums">{fmtPrice(asset.price)}</div>
              <div className={clsx("text-sm font-semibold tabular-nums mt-0.5", pos ? "text-green-400" : "text-red-400")}>
                {fmtPct(asset.priceChange24h)} today
                <span className="text-slate-500 font-normal ml-2">{fmtPct(asset.priceChange7d)} 7d</span>
                <span className="text-slate-500 font-normal ml-2">{fmtPct(asset.priceChange30d)} 30d</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <Sparkline data={asset.sparkline} positive={pos} />
            </div>
            <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
              <SignalBadge signal={asset.signal} />
              <RiskBadge risk={asset.riskLevel} />
            </div>
          </div>

          {/* Market stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Market Cap", value: fmtLarge(asset.marketCap) },
              { label: "24h Volume",  value: fmtLarge(asset.volume24h) },
              { label: "MCap Rank",   value: `#${asset.rank}` },
              ...(asset.tvl ? [{ label: "TVL", value: fmtLarge(asset.tvl) }] : []),
              { label: "Confidence",  value: `${asset.confidence}%` },
              { label: "Score",       value: `${asset.scores.total}/100` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0f1117] rounded-lg p-3 text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">{label}</div>
                <div className="text-sm font-bold text-slate-200">{value}</div>
              </div>
            ))}
          </div>

          {/* Score breakdown */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Score Breakdown</div>
            <ScoreBar scores={asset.scores} />
          </div>

          {/* Bullish / Bearish */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] font-semibold text-green-400 uppercase tracking-widest mb-2">Bullish Factors</div>
              <ul className="space-y-1.5">
                {asset.bullishFactors.length > 0
                  ? asset.bullishFactors.map((f, i) => (
                      <li key={i} className="text-xs text-slate-300 flex gap-2 leading-snug">
                        <span className="text-green-400 flex-shrink-0">+</span>{f}
                      </li>
                    ))
                  : <li className="text-xs text-slate-600">None identified</li>}
              </ul>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-2">Bearish Factors</div>
              <ul className="space-y-1.5">
                {asset.bearishFactors.length > 0
                  ? asset.bearishFactors.map((f, i) => (
                      <li key={i} className="text-xs text-slate-300 flex gap-2 leading-snug">
                        <span className="text-red-400 flex-shrink-0">−</span>{f}
                      </li>
                    ))
                  : <li className="text-xs text-slate-600">None identified</li>}
              </ul>
            </div>
          </div>

          {/* Entry / Invalidation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0f1117] rounded-xl p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Suggested Entry</div>
              <p className="text-xs text-slate-200 leading-snug">{asset.suggestedEntryZone}</p>
            </div>
            <div className="bg-[#0f1117] rounded-xl p-4">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Invalidation Level</div>
              <p className="text-xs text-slate-200 leading-snug">{asset.invalidationLevel}</p>
            </div>
          </div>

          {/* Technicals */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Technical Indicators</div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "RSI 14",     value: asset.technicals.rsi14?.toFixed(1) ?? "—" },
                { label: "vs 20D MA",  value: asset.technicals.priceVsSma20 ? fmtPct(asset.technicals.priceVsSma20) : "—" },
                { label: "vs 50D MA",  value: asset.technicals.priceVsSma50 ? fmtPct(asset.technicals.priceVsSma50) : "—" },
                { label: "Vol vs Avg", value: asset.technicals.volumeChangeVsAvg ? fmtPct(asset.technicals.volumeChangeVsAvg) : "—" },
                { label: "MACD",       value: asset.technicals.macd ? (asset.technicals.macd.histogram >= 0 ? "↑ Bullish" : "↓ Bearish") : "—" },
                { label: "From ATH",   value: fmtPct(asset.technicals.distanceFromATH) },
                { label: "20D MA",     value: asset.technicals.sma20 ? fmtPrice(asset.technicals.sma20) : "—" },
                { label: "50D MA",     value: asset.technicals.sma50 ? fmtPrice(asset.technicals.sma50) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#0f1117] rounded-lg p-2.5 text-center">
                  <div className="text-[9px] text-slate-500 mb-0.5">{label}</div>
                  <div className="text-xs font-semibold text-slate-200">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* DeFi row */}
          {asset.tvl && (
            <div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">DeFi Metrics</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#0f1117] rounded-lg p-2.5 text-center">
                  <div className="text-[9px] text-slate-500 mb-0.5">TVL</div>
                  <div className="text-xs font-semibold text-emerald-400">{fmtLarge(asset.tvl)}</div>
                </div>
                {asset.tvlChange24h != null && (
                  <div className="bg-[#0f1117] rounded-lg p-2.5 text-center">
                    <div className="text-[9px] text-slate-500 mb-0.5">TVL 24h</div>
                    <div className={clsx("text-xs font-semibold", asset.tvlChange24h >= 0 ? "text-green-400" : "text-red-400")}>
                      {fmtPct(asset.tvlChange24h)}
                    </div>
                  </div>
                )}
                {asset.revenueToMcap != null && (
                  <div className="bg-[#0f1117] rounded-lg p-2.5 text-center">
                    <div className="text-[9px] text-slate-500 mb-0.5">Rev/MCap</div>
                    <div className="text-xs font-semibold text-violet-400">{(asset.revenueToMcap * 100).toFixed(2)}%</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags + freshness */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {asset.narrativeTags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-[#252d40] text-slate-500 rounded text-[9px] uppercase tracking-widest">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-slate-700 italic">
            Data: {new Date(asset.dataFreshness).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card (compact front face) ───────────────────────────────────────────
export function AssetCard({ asset, rank }: { asset: ScoredAsset; rank: number }) {
  const [open, setOpen] = useState(false);
  const pos = asset.priceChange24h >= 0;

  const signalColor =
    asset.signal === "BUY"            ? "from-green-500/10 to-transparent border-green-500/20" :
    asset.signal === "WATCH"          ? "from-amber-500/10 to-transparent border-amber-500/20" :
    asset.signal === "BUY_ON_PULLBACK"? "from-indigo-500/10 to-transparent border-indigo-500/20" :
                                        "from-red-500/10 to-transparent border-red-500/20";

  return (
    <>
      {/* ── KPI card tile ── */}
      <div
        onClick={() => setOpen(true)}
        className={clsx(
          "kanban-card group relative cursor-pointer select-none",
          "bg-gradient-to-b border rounded-2xl overflow-hidden",
          "transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40",
          signalColor
        )}
      >
        {/* Rank badge */}
        <div className="absolute top-3 left-3 w-5 h-5 rounded-full bg-black/30 flex items-center justify-center">
          <span className="text-[10px] font-black text-slate-400">{rank}</span>
        </div>

        {/* Expand hint */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-500">
            <path d="M8.5 1.5H12.5V5.5M5.5 12.5H1.5V8.5M12.5 1.5L8 7M1.5 12.5L6 7"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <div className="px-4 pt-8 pb-4 flex flex-col items-center gap-3">

          {/* Coin logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.image} alt={asset.name} width={48} height={48}
            className="rounded-full ring-2 ring-white/10 shadow-lg" />

          {/* Name */}
          <div className="text-center">
            <div className="text-base font-black text-white tracking-tight">{asset.symbol}</div>
            <div className="text-[11px] text-slate-500 truncate max-w-[120px]">{asset.name}</div>
          </div>

          {/* Price */}
          <div className="text-center">
            <div className="text-lg font-bold text-white tabular-nums">{fmtPrice(asset.price)}</div>
            <div className={clsx("text-xs font-semibold tabular-nums", pos ? "text-green-400" : "text-red-400")}>
              {fmtPct(asset.priceChange24h)}
            </div>
          </div>

          {/* Score ring */}
          <ScoreRing score={asset.scores.total} size={52} />

          {/* Signal + risk */}
          <div className="flex flex-col items-center gap-1.5 w-full">
            <SignalBadge signal={asset.signal} />
            <RiskBadge risk={asset.riskLevel} />
          </div>

          {/* Mini sparkline */}
          <div className="w-full h-8">
            <Sparkline data={asset.sparkline} positive={pos} />
          </div>
        </div>
      </div>

      {/* ── Detail modal ── */}
      {open && <DetailModal asset={asset} onClose={() => setOpen(false)} />}
    </>
  );
}
