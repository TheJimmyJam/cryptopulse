"use client";
import { Strategy } from "@/types/crypto";
import clsx from "clsx";

const STRATEGIES: { value: Strategy; label: string; desc: string }[] = [
  { value: "conservative", label: "Conservative", desc: "Large caps only · Lower volatility" },
  { value: "growth", label: "Growth", desc: "Mid-large caps · Momentum focus" },
  { value: "speculative", label: "Speculative", desc: "Small-mid caps · High upside + risk" },
];

export function StrategySelector({
  current,
  onChange,
}: {
  current: Strategy;
  onChange: (s: Strategy) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {STRATEGIES.map(({ value, label, desc }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={clsx(
            "px-4 py-2.5 rounded-lg border text-sm font-medium transition-all text-left",
            current === value
              ? "bg-blue-600/20 border-blue-500/60 text-blue-300"
              : "bg-[#161b27] border-[#1e2535] text-slate-400 hover:border-slate-500"
          )}
        >
          <div>{label}</div>
          <div className="text-xs opacity-70 mt-0.5">{desc}</div>
        </button>
      ))}
    </div>
  );
}
