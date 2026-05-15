import { FearGreedData, MarketRegime } from "@/types/crypto";
import { getGlobalData, getCoinSparkline } from "./coingecko";

interface FearGreedResponse {
  name: string;
  data: FearGreedData[];
  metadata: { error: null | string };
}

export async function getFearGreedIndex(): Promise<FearGreedData> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Fear & Greed API ${res.status}`);
  const json: FearGreedResponse = await res.json();
  return json.data[0];
}

// Returns last 30 days for trend analysis
export async function getFearGreedHistory(days = 30): Promise<FearGreedData[]> {
  const res = await fetch(`https://api.alternative.me/fng/?limit=${days}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Fear & Greed API ${res.status}`);
  const json: FearGreedResponse = await res.json();
  return json.data;
}

function trendFromSparkline(prices: number[]): "bullish" | "bearish" | "neutral" {
  if (prices.length < 3) return "neutral";
  const first = prices[0];
  const last = prices[prices.length - 1];
  const pct = ((last - first) / first) * 100;
  if (pct > 3) return "bullish";
  if (pct < -3) return "bearish";
  return "neutral";
}

export async function buildMarketRegime(): Promise<MarketRegime> {
  const [fearGreed, globalData, btcSparkline, ethSparkline] = await Promise.all([
    getFearGreedIndex(),
    getGlobalData(),
    getCoinSparkline("bitcoin"),
    getCoinSparkline("ethereum"),
  ]);

  const btcTrend = trendFromSparkline(btcSparkline);
  const ethTrend = trendFromSparkline(ethSparkline);

  const totalMcapChange = globalData.data.market_cap_change_percentage_24h_usd;
  const totalMcapTrend: "bullish" | "bearish" | "neutral" =
    totalMcapChange > 2 ? "bullish" : totalMcapChange < -2 ? "bearish" : "neutral";

  const fgValue = parseInt(fearGreed.value, 10);

  const dominanceBTC = globalData.data.market_cap_percentage["btc"] ?? 50;

  // Altcoin season: BTC dominance below 50% AND total market trending up
  const altcoinSeason = dominanceBTC < 50 && totalMcapTrend !== "bearish";

  let riskLabel: MarketRegime["riskLabel"] = "NEUTRAL";
  if (btcTrend === "bullish" && fgValue > 50) riskLabel = "RISK_ON";
  if (btcTrend === "bearish" && fgValue < 40) riskLabel = "RISK_OFF";

  return {
    btcTrend,
    ethTrend,
    totalMcapTrend,
    fearGreedValue: fgValue,
    fearGreedLabel: fearGreed.value_classification,
    altcoinSeason,
    riskLabel,
    dominanceBTC,
  };
}
