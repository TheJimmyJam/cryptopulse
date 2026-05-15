"use client";
import { useState } from "react";
import { ScoredAsset } from "@/types/crypto";
import { SignalBadge, RiskBadge } from "./SignalBadge";
import { ScoreRing } from "./ScoreRing";
import { Sparkline } from "./Sparkline";

function fmt(n: number, digits = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtPct(n: number) {
  const s = fmt(Math.abs(n), 2);
  return n >= 0 ? `+${s}%` : `-${s}%`;
}
function fmtLarge(n: number) {
  if (n >= 1e12) return `$${fmt(n / 1e12, 2)}T`;
  if (n >= 1e9)  return `$${fmt(n / 1e9, 2)}B`;
  if (n >= 1e6)  return `$${fmt(n / 1e6, 2)}M`;
  return `$${fmt(n, 0)}`;
}

export function AssetCard({ asset, rank }: { asset: ScoredAsset; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const pos = asset.priceChange24h >= 0;

  return (
    <div className="bg-[#161b27] border border-[#1e2535] rounded-xl overflow-hidden hover:border-blue-500/40 transition-colors">
      {/* Header row */}
      <div className="p-4 flex items-start gap-4">
        {/* Rank */}
        <div className="text-2xl font-black text-slate-700 w-6 text-center flex-shrink-0 mt-1">
          {rank}
        </div>

        {/* Coin icon + name */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset.image} alt={asset.name} width={36} height={36} className="rounded-full flex-shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white text-base">{asset.symbol}</div>
            <div className="text-xs text-slate-400 truncate">{asset.name}</div>
          </div>
        </div>

        {/* Score ring */}
        <ScoreRing score={asset.scores.total} />

        {/* Signal */}
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <SignalBadge signal={asset.signal} />
          <RiskBadge risk={asset.riskLevel} />
        </div>
      </div>

      {/* Price + sparkline */}
      <div className="px-4 pb-3 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-lg font-bold text-white">
            ${asset.price < 1 ? asset.price.toFixed(6) : fmt(asset.price)}
          </div>
          <div className={`text-sm font-semibold ${pos ? "text-green-400" : "text-red-400"}`}>
            {fmtPct(asset.priceChange24h)} 24h
            <span className="text-slate-500 font-normal ml-2">{fmtPct(asset.priceChange7d)} 7d</span>
          </div>
        </div>
        <div className="w-28 flex-shrink-0">
          <Sparkline data={asset.sparkline} positive={pos} />
        </div>
      </div>

      {/* Market stats row */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-slate-500">Market Cap</div>
          <div className="text-slate-200 font-medium">{fmtLarge(asset.marketCap)}</div>
        </div>
        <div>
          <div className="text-slate-500">24h Volume</div>
          <div className="text-slate-200 font-medium">{fmtLarge(asset.volume24h)}</div>
        </div>
        {asset.tvl ? (
          <div>
            <div className="text-slate-500">TVL</div>
            <div className="text-slate-200 font-medium">{fmtLarge(asset.tvl)}</div>
          </div>
        ) : (
          <div>
            <div className="text-slate-500">Rank</div>
            <div className="text-slate-200 font-medium">#{asset.rank}</div>
          </div>
        )}
      </div>

      {/* Score breakdown bar */}
      <div className="px-4 pb-3">
        <div className="flex gap-0.5 rounded overflow-hidden h-2">
          <div className="bg-blue-500" style={{ width: `${(asset.scores.momentum / 20) * 100}%` }} title="Momentum" />
          <div className="bg-cyan-500" style={{ width: `${(asset.scores.liquidity / 15) * 100}%` }} title="Liquidity" />
          <div className="bg-violet-500" style={{ width: `${(asset.scores.onChain / 15) * 100}%` }} title="On-chain" />
          <div className="bg-emerald-500" style={{ width: `${(asset.scores.fundamental / 15) * 100}%` }} title="Fundamental" />
          <div className="bg-amber-500" style={{ width: `${(asset.scores.sentiment / 15) * 100}%` }} title="Sentiment" />
          <div className="bg-slate-500" style={{ width: `${(asset.scores.marketRegime / 5) * 100}%` }} title="Regime" />
        </div>
        <div className="flex gap-3 mt-1 text-[10px] text-slate-600">
          <span className="text-blue-400">Momentum</span>
          <span className="text-cyan-400">Liquidity</span>
          <span className="text-violet-400">On-chain</span>
          <span className="text-emerald-400">Fundamental</span>
          <span className="text-amber-400">Sentiment</span>
        </div>
      </div>

      {/* Reason summary */}
      <div className="px-4 pb-3">
        <p className="text-sm text-slate-300 leading-relaxed">{asset.reasoning}</p>
      </div>

      {/* Expand button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 text-xs text-slate-500 hover:text-slate-300 border-t border-[#1e2535] flex items-center justify-center gap-1 transition-colors"
      >
        {expanded ? "▲ Less detail" : "▼ Full analysis"}
      </button>

      {/* Expanded section */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#1e2535] pt-4">
          {/* Bullish / Bearish */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-green-400 mb-2 uppercase tracking-wide">Bullish Factors</div>
              <ul className="space-y-1">
                {asset.bullishFactors.map((f, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-1.5">
                    <span className="text-green-400 flex-shrink-0">+</span>{f}
                  </li>
                ))}
                {asset.bullishFactors.length === 0 && <li className="text-xs text-slate-500">None identified</li>}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-red-400 mb-2 uppercase tracking-wide">Bearish Factors</div>
              <ul className="space-y-1">
                {asset.bearishFactors.map((f, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-1.5">
                    <span className="text-red-400 flex-shrink-0">−</span>{f}
                  </li>
                ))}
                {asset.bearishFactors.length === 0 && <li className="text-xs text-slate-500">None identified</li>}
              </ul>
            </div>
          </div>

          {/* Entry / Invalidation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0f1117] rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Suggested Entry</div>
              <p className="text-xs text-slate-200">{asset.suggestedEntryZone}</p>
            </div>
            <div className="bg-[#0f1117] rounded-lg p-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Invalidation Level</div>
              <p className="text-xs text-slate-200">{asset.invalidationLevel}</p>
            </div>
          </div>

          {/* Technicals grid */}
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Technical Indicators</div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {[
                { label: "RSI 14", value: asset.technicals.rsi14?.toFixed(1) ?? "—" },
                { label: "vs 20D MA", value: asset.technicals.priceVsSma20 ? fmtPct(asset.technicals.priceVsSma20) : "—" },
                { label: "vs 50D MA", value: asset.technicals.priceVsSma50 ? fmtPct(asset.technicals.priceVsSma50) : "—" },
                { label: "Vol vs Avg", value: asset.technicals.volumeChangeVsAvg ? fmtPct(asset.technicals.volumeChangeVsAvg) : "—" },
                { label: "MACD", value: asset.technicals.macd ? (asset.technicals.macd.histogram >= 0 ? "Bullish" : "Bearish") : "—" },
                { label: "From ATH", value: fmtPct(asset.technicals.distanceFromATH) },
                { label: "Confidence", value: `${asset.confidence}%` },
                { label: "Score", value: `${asset.scores.total}/100` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#0f1117] rounded p-2 text-center">
                  <div className="text-[10px] text-slate-500">{label}</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            {asset.narrativeTags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-[#252d40] text-slate-400 rounded text-[10px] uppercase tracking-wide">
                {tag}
              </span>
            ))}
          </div>

          <p className="text-[10px] text-slate-600 italic">
            Data freshness: {new Date(asset.dataFreshness).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
