"use client";
import { useState, useRef } from "react";
import { ScoredAsset } from "@/types/crypto";
import { SignalBadge, RiskBadge } from "./SignalBadge";
import { ScoreRing } from "./ScoreRing";
import { Sparkline } from "./Sparkline";
import clsx from "clsx";

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${fmt(Math.abs(n), 2)}%`;
}
function fmtPrice(n: number) {
  return n < 1 ? `$${n.toFixed(6)}` : `$${fmt(n)}`;
}
function fmtLarge(n: number) {
  if (n >= 1e12) return `$${fmt(n / 1e12, 2)}T`;
  if (n >= 1e9)  return `$${fmt(n / 1e9,  2)}B`;
  if (n >= 1e6)  return `$${fmt(n / 1e6,  2)}M`;
  return `$${fmt(n, 0)}`;
}

// ─── Mini score bar (collapsed) ───────────────────────────────────────────────
function MiniScoreBar({ scores }: { scores: ScoredAsset["scores"] }) {
  return (
    <div className="flex gap-px rounded overflow-hidden h-1 w-full">
      <div className="bg-blue-500"    style={{ width: `${(scores.momentum    / 20) * 100}%` }} />
      <div className="bg-cyan-500"    style={{ width: `${(scores.liquidity   / 15) * 100}%` }} />
      <div className="bg-violet-500"  style={{ width: `${(scores.onChain     / 15) * 100}%` }} />
      <div className="bg-emerald-500" style={{ width: `${(scores.fundamental / 15) * 100}%` }} />
      <div className="bg-amber-500"   style={{ width: `${(scores.sentiment   / 15) * 100}%` }} />
    </div>
  );
}

// ─── Expanded detail panel ────────────────────────────────────────────────────
function ExpandedDetail({ asset }: { asset: ScoredAsset }) {
  return (
    <div className="border-t border-[#1e2535] mt-3 pt-4 space-y-4">

      {/* Score breakdown */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Score Breakdown</div>
        <div className="space-y-1.5">
          {[
            { label: "Momentum",    val: asset.scores.momentum,    max: 20, color: "bg-blue-500" },
            { label: "Liquidity",   val: asset.scores.liquidity,   max: 15, color: "bg-cyan-500" },
            { label: "On-chain",    val: asset.scores.onChain,     max: 15, color: "bg-violet-500" },
            { label: "Fundamental", val: asset.scores.fundamental, max: 15, color: "bg-emerald-500" },
            { label: "Sentiment",   val: asset.scores.sentiment,   max: 15, color: "bg-amber-500" },
            { label: "Regime",      val: asset.scores.marketRegime,max:  5, color: "bg-slate-400" },
          ].map(({ label, val, max, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-20 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-[#1e2535] rounded overflow-hidden">
                <div className={`${color} h-full rounded transition-all duration-700`}
                  style={{ width: `${(val / max) * 100}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 w-8 text-right tabular-nums">{val}/{max}</span>
            </div>
          ))}
          {asset.scores.riskPenalty > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-red-400 w-20 flex-shrink-0">Risk penalty</span>
              <div className="flex-1 h-1.5 bg-[#1e2535] rounded overflow-hidden">
                <div className="bg-red-500 h-full rounded transition-all duration-700"
                  style={{ width: `${(asset.scores.riskPenalty / 15) * 100}%` }} />
              </div>
              <span className="text-[10px] text-red-400 w-8 text-right tabular-nums">−{asset.scores.riskPenalty}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bullish / Bearish */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-semibold text-green-400 uppercase tracking-widest mb-1.5">Bullish</div>
          <ul className="space-y-1">
            {asset.bullishFactors.length > 0
              ? asset.bullishFactors.map((f, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-1.5 leading-tight">
                    <span className="text-green-400 flex-shrink-0 mt-0.5">+</span>{f}
                  </li>
                ))
              : <li className="text-xs text-slate-600">None identified</li>}
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-1.5">Bearish</div>
          <ul className="space-y-1">
            {asset.bearishFactors.length > 0
              ? asset.bearishFactors.map((f, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-1.5 leading-tight">
                    <span className="text-red-400 flex-shrink-0 mt-0.5">−</span>{f}
                  </li>
                ))
              : <li className="text-xs text-slate-600">None identified</li>}
          </ul>
        </div>
      </div>

      {/* Entry / Invalidation */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#0f1117] rounded-lg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Entry Zone</div>
          <p className="text-xs text-slate-200 leading-snug">{asset.suggestedEntryZone}</p>
        </div>
        <div className="bg-[#0f1117] rounded-lg p-3">
          <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Invalidation</div>
          <p className="text-xs text-slate-200 leading-snug">{asset.invalidationLevel}</p>
        </div>
      </div>

      {/* Technicals grid */}
      <div>
        <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1.5">Technicals</div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: "RSI 14",     value: asset.technicals.rsi14?.toFixed(1) ?? "—" },
            { label: "vs 20D MA",  value: asset.technicals.priceVsSma20 ? fmtPct(asset.technicals.priceVsSma20) : "—" },
            { label: "vs 50D MA",  value: asset.technicals.priceVsSma50 ? fmtPct(asset.technicals.priceVsSma50) : "—" },
            { label: "Vol vs Avg", value: asset.technicals.volumeChangeVsAvg ? fmtPct(asset.technicals.volumeChangeVsAvg) : "—" },
            { label: "MACD",       value: asset.technicals.macd ? (asset.technicals.macd.histogram >= 0 ? "↑ Bull" : "↓ Bear") : "—" },
            { label: "From ATH",   value: fmtPct(asset.technicals.distanceFromATH) },
            { label: "Confidence", value: `${asset.confidence}%` },
            { label: "Score",      value: `${asset.scores.total}/100` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#0f1117] rounded p-2 text-center">
              <div className="text-[9px] text-slate-500 mb-0.5">{label}</div>
              <div className="text-xs font-semibold text-slate-200">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* DeFi stats if available */}
      {asset.tvl && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0f1117] rounded-lg p-2 text-center">
            <div className="text-[9px] text-slate-500 mb-0.5">TVL</div>
            <div className="text-xs font-semibold text-emerald-400">{fmtLarge(asset.tvl)}</div>
          </div>
          {asset.tvlChange24h != null && (
            <div className="bg-[#0f1117] rounded-lg p-2 text-center">
              <div className="text-[9px] text-slate-500 mb-0.5">TVL 24h</div>
              <div className={clsx("text-xs font-semibold", asset.tvlChange24h >= 0 ? "text-green-400" : "text-red-400")}>
                {fmtPct(asset.tvlChange24h)}
              </div>
            </div>
          )}
          {asset.revenueToMcap != null && (
            <div className="bg-[#0f1117] rounded-lg p-2 text-center">
              <div className="text-[9px] text-slate-500 mb-0.5">Rev/MCap</div>
              <div className="text-xs font-semibold text-violet-400">{(asset.revenueToMcap * 100).toFixed(2)}%</div>
            </div>
          )}
        </div>
      )}

      {/* Narrative tags */}
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
  );
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
export function AssetCard({ asset, rank }: { asset: ScoredAsset; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const pos = asset.priceChange24h >= 0;

  return (
    <div
      ref={cardRef}
      onClick={() => setExpanded((v) => !v)}
      className={clsx(
        "kanban-card group relative cursor-pointer select-none",
        "bg-[#161b27] border rounded-xl overflow-hidden",
        "transition-[border-color,box-shadow] duration-300",
        expanded
          ? "border-blue-500/50 shadow-lg shadow-blue-500/10"
          : "border-[#1e2535] hover:border-[#2e3a55] hover:shadow-md hover:shadow-black/30"
      )}
    >
      {/* Rank accent bar on left edge */}
      <div className={clsx(
        "absolute left-0 top-0 bottom-0 w-0.5 transition-all duration-300",
        expanded ? "bg-blue-500" : "bg-transparent group-hover:bg-[#2e3a55]"
      )} />

      {/* ── Always-visible header ── */}
      <div className="p-4 pl-5">
        <div className="flex items-center gap-3">

          {/* Rank number */}
          <span className="text-xl font-black text-slate-700 w-5 text-center flex-shrink-0 tabular-nums">
            {rank}
          </span>

          {/* Coin logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.image} alt={asset.name} width={34} height={34}
            className="rounded-full flex-shrink-0 ring-1 ring-white/10" />

          {/* Name + mini bar */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-white text-base leading-none">{asset.symbol}</span>
              <span className="text-xs text-slate-500 truncate leading-none">{asset.name}</span>
            </div>
            <div className="mt-2">
              <MiniScoreBar scores={asset.scores} />
            </div>
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0 hidden sm:block">
            <div className="text-sm font-bold text-white tabular-nums">{fmtPrice(asset.price)}</div>
            <div className={clsx("text-xs font-semibold tabular-nums", pos ? "text-green-400" : "text-red-400")}>
              {fmtPct(asset.priceChange24h)}
            </div>
          </div>

          {/* Sparkline */}
          <div className="w-20 flex-shrink-0 hidden md:block">
            <Sparkline data={asset.sparkline} positive={pos} />
          </div>

          {/* Score ring */}
          <ScoreRing score={asset.scores.total} size={52} />

          {/* Signal + risk */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[90px]">
            <SignalBadge signal={asset.signal} />
            <RiskBadge risk={asset.riskLevel} />
          </div>

          {/* Chevron */}
          <div className={clsx(
            "flex-shrink-0 w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-transform duration-300",
            expanded && "rotate-180 !text-blue-400"
          )}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 10.5L3 5.5h10L8 10.5z" />
            </svg>
          </div>
        </div>

        {/* Reasoning — single line collapsed, full on expand */}
        <p className={clsx(
          "text-xs text-slate-400 mt-2.5 ml-10 leading-snug transition-all duration-300",
          expanded ? "" : "line-clamp-1"
        )}>
          {asset.reasoning}
        </p>
      </div>

      {/* ── Expanded detail ── */}
      <div
        className={clsx(
          "overflow-hidden transition-all duration-500 ease-in-out",
          expanded ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-5">
          <ExpandedDetail asset={asset} />
        </div>
      </div>
    </div>
  );
}
