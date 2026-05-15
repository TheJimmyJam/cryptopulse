import { MarketRegime } from "@/types/crypto";
import clsx from "clsx";

function TrendDot({ trend }: { trend: "bullish" | "bearish" | "neutral" }) {
  return (
    <span
      className={clsx(
        "inline-block w-2 h-2 rounded-full mr-1.5",
        trend === "bullish" && "bg-green-400",
        trend === "bearish" && "bg-red-400",
        trend === "neutral" && "bg-slate-500"
      )}
    />
  );
}

function FearGauge({ value, label }: { value: number; label: string }) {
  const color =
    value <= 25 ? "#ef4444" :
    value <= 45 ? "#fb923c" :
    value <= 55 ? "#f59e0b" :
    value <= 75 ? "#84cc16" :
    "#22c55e";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-8 overflow-hidden">
        <svg viewBox="0 0 64 32" className="w-full">
          {/* Track */}
          <path d="M 8 28 A 24 24 0 0 1 56 28" stroke="#1e2535" strokeWidth="6" fill="none" strokeLinecap="round" />
          {/* Fill */}
          <path
            d="M 8 28 A 24 24 0 0 1 56 28"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 75.4} 75.4`}
          />
          {/* Needle */}
          <line
            x1="32" y1="28"
            x2={32 + 18 * Math.cos(Math.PI - (value / 100) * Math.PI)}
            y2={28 + 18 * Math.sin(Math.PI - (value / 100) * Math.PI) * -1}
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="32" cy="28" r="2.5" fill="white" />
        </svg>
      </div>
      <div className="text-xl font-black" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-400 text-center leading-tight">{label}</div>
    </div>
  );
}

export function MarketRegimePanel({ regime }: { regime: MarketRegime }) {
  const riskColors = {
    RISK_ON: "text-green-400 bg-green-400/10 border-green-400/20",
    NEUTRAL: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    RISK_OFF: "text-red-400 bg-red-400/10 border-red-400/20",
  };

  return (
    <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-4">
      <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
        Market Regime
      </h2>

      <div className="flex flex-wrap gap-4 items-start">
        {/* Fear & Greed */}
        <FearGauge value={regime.fearGreedValue} label={regime.fearGreedLabel} />

        {/* Trend indicators */}
        <div className="flex-1 min-w-[160px] space-y-2">
          {[
            { label: "BTC Trend", trend: regime.btcTrend },
            { label: "ETH Trend", trend: regime.ethTrend },
            { label: "Total Market", trend: regime.totalMcapTrend },
          ].map(({ label, trend }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{label}</span>
              <span className={clsx("font-semibold capitalize flex items-center",
                trend === "bullish" && "text-green-400",
                trend === "bearish" && "text-red-400",
                trend === "neutral" && "text-slate-400"
              )}>
                <TrendDot trend={trend} />{trend}
              </span>
            </div>
          ))}

          {/* BTC Dominance */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">BTC Dominance</span>
            <span className="font-semibold text-slate-200">{regime.dominanceBTC.toFixed(1)}%</span>
          </div>
        </div>

        {/* Risk label + altcoin season */}
        <div className="flex flex-col gap-2">
          <span
            className={clsx(
              "px-3 py-1.5 rounded-lg text-sm font-bold border",
              riskColors[regime.riskLabel]
            )}
          >
            {regime.riskLabel.replace("_", " ")}
          </span>

          {regime.altcoinSeason && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-violet-400/10 text-violet-400 border-violet-400/20 text-center">
              🌊 ALTSEASON
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
