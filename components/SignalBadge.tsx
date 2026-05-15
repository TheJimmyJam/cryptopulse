import { SignalType, RiskLevel } from "@/types/crypto";
import clsx from "clsx";

const SIGNAL_LABELS: Record<SignalType, string> = {
  BUY: "BUY",
  WATCH: "WATCH",
  BUY_ON_PULLBACK: "BUY ON PULLBACK",
  AVOID: "AVOID",
};

export function SignalBadge({ signal }: { signal: SignalType }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border tracking-wide",
        signal === "BUY" && "signal-buy",
        signal === "WATCH" && "signal-watch",
        signal === "BUY_ON_PULLBACK" && "signal-pullback",
        signal === "AVOID" && "signal-avoid"
      )}
    >
      {SIGNAL_LABELS[signal]}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={clsx(
        "text-xs font-semibold",
        risk === "LOW" && "risk-low",
        risk === "MEDIUM" && "risk-medium",
        risk === "MEDIUM_HIGH" && "risk-medium-high",
        risk === "HIGH" && "risk-high"
      )}
    >
      {risk.replace("_", " ")} RISK
    </span>
  );
}
