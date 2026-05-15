import {
  CoinGeckoMarket,
  DefiLlamaProtocol,
  MarketRegime,
  ScoreBreakdown,
  ScoredAsset,
  SignalType,
  RiskLevel,
  Strategy,
  TechnicalIndicators,
} from "@/types/crypto";
import {
  calcRSI,
  calcMACD,
  calcSMA,
  calcBollingerBands,
  calcVolumeBreakout,
  calcMomentumScore,
} from "./indicators";

// ─── Minimum filters ────────────────────────────────────────────────────────

const FILTERS = {
  conservative: { minMcap: 10_000_000_000, minVolume: 500_000_000, maxRsi: 78 },
  growth:       { minMcap: 1_000_000_000,  minVolume: 100_000_000, maxRsi: 80 },
  speculative:  { minMcap: 100_000_000,    minVolume: 20_000_000,  maxRsi: 85 },
};

// Narrative category mapper
const NARRATIVE_MAP: Record<string, string[]> = {
  bitcoin:   ["store-of-value", "digital-gold"],
  ethereum:  ["smart-contracts", "l1", "defi"],
  solana:    ["l1", "defi", "nft", "meme-host"],
  chainlink: ["oracle", "rwa", "infrastructure"],
  uniswap:   ["defi", "dex"],
  aave:      ["defi", "lending"],
  "render-token": ["ai", "depin", "gpu"],
  "fetch-ai": ["ai", "agent"],
  "the-graph": ["ai", "infrastructure"],
  arbitrum:  ["l2"],
  optimism:  ["l2"],
  polygon:   ["l2", "scaling"],
};

function getNarrativeTags(id: string): string[] {
  return NARRATIVE_MAP[id] ?? ["altcoin"];
}

function getCategory(coin: CoinGeckoMarket): string {
  const rank = coin.market_cap_rank;
  if (rank <= 2) return "Bitcoin / Ethereum";
  if (rank <= 10) return "Large Cap";
  if (rank <= 50) return "Mid Cap";
  return "Small Cap";
}

// ─── Sub-score calculators ──────────────────────────────────────────────────

function liquidityScore(coin: CoinGeckoMarket): number {
  // 0-15 points
  const volToMcap = coin.total_volume / coin.market_cap;
  let score = 0;
  if (volToMcap > 0.1) score = 15;
  else if (volToMcap > 0.05) score = 12;
  else if (volToMcap > 0.02) score = 8;
  else if (volToMcap > 0.01) score = 5;
  else score = 2;
  return score;
}

function fundamentalScore(
  coin: CoinGeckoMarket,
  defi?: DefiLlamaProtocol
): number {
  // 0-15 points
  if (!defi) return 7; // no defi data = neutral
  let score = 7;

  const tvl = defi.tvl;
  const mcap = coin.market_cap;

  if (tvl && mcap) {
    const tvlToMcap = tvl / mcap;
    if (tvlToMcap > 1) score += 5;
    else if (tvlToMcap > 0.5) score += 3;
    else if (tvlToMcap > 0.2) score += 1;
  }

  if (defi.change_7d > 10) score += 3;
  else if (defi.change_7d < -10) score -= 3;

  return Math.max(0, Math.min(15, score));
}

function onChainScore(coin: CoinGeckoMarket): number {
  // Approximation from available data (real on-chain needs Santiment/Glassnode)
  // 0-15 points based on volume consistency and market activity
  let score = 8;

  // Proxy: sustained volume relative to market cap suggests real activity
  const volToMcap = coin.total_volume / coin.market_cap;
  if (volToMcap > 0.05) score += 4;
  if (volToMcap > 0.1) score += 2;

  // Supply on exchanges proxy: if price isn't moving much despite high volume,
  // possibly distribution — small penalty
  if (coin.price_change_percentage_24h < 0.5 && volToMcap > 0.15) score -= 2;

  return Math.max(0, Math.min(15, score));
}

function sentimentScore(
  coin: CoinGeckoMarket,
  fearGreedValue: number
): number {
  // 0-15 points
  let score = 7;

  // Market is risk-on
  if (fearGreedValue > 60) score += 3;
  else if (fearGreedValue < 30) score -= 3;

  // Price vs ATH: if coin is recovering from deep discount, bullish narrative potential
  const distFromAth = coin.ath_change_percentage; // negative number
  if (distFromAth > -20) score += 2; // near ATH = still in narrative
  else if (distFromAth > -50) score += 1;
  else score -= 1; // very far from ATH = narrative exhausted

  // 30d momentum as a sentiment proxy
  const p30 = coin.price_change_percentage_30d_in_currency ?? 0;
  if (p30 > 20) score += 3;
  else if (p30 > 5) score += 1;
  else if (p30 < -20) score -= 3;

  return Math.max(0, Math.min(15, score));
}

function marketRegimeScore(regime: MarketRegime): number {
  // 0-5 points
  if (regime.riskLabel === "RISK_ON") return 5;
  if (regime.riskLabel === "NEUTRAL") return 3;
  return 1; // RISK_OFF
}

function riskPenalty(coin: CoinGeckoMarket): number {
  // 0-15 penalty
  let penalty = 0;

  // Thin liquidity
  const volToMcap = coin.total_volume / coin.market_cap;
  if (volToMcap < 0.01) penalty += 5;

  // Extreme volatility (big 24h moves can mean pump-and-dump)
  if (Math.abs(coin.price_change_percentage_24h) > 30) penalty += 5;

  // Very high RSI not yet penalized in momentum (over 80)
  // This is a duplicate guard — handled in momentum but reinforced here
  // Approximation without full RSI data
  const p7 = coin.price_change_percentage_7d_in_currency ?? 0;
  if (p7 > 60) penalty += 5; // likely overextended in 7 days

  // Low market cap small caps get extra penalty in conservative mode
  if (coin.market_cap < 100_000_000) penalty += 3;

  return Math.min(15, penalty);
}

// ─── Signal classifier ───────────────────────────────────────────────────────

function classifySignal(total: number, rsi: number | null): SignalType {
  if (total >= 75) return "BUY";
  if (total >= 60) {
    if (rsi && rsi > 70) return "BUY_ON_PULLBACK";
    return "WATCH";
  }
  if (total >= 45) return "WATCH";
  return "AVOID";
}

function classifyRisk(coin: CoinGeckoMarket, penalty: number): RiskLevel {
  if (coin.market_cap > 50_000_000_000 && penalty < 5) return "LOW";
  if (coin.market_cap > 5_000_000_000 && penalty < 8) return "MEDIUM";
  if (coin.market_cap > 1_000_000_000 && penalty < 10) return "MEDIUM_HIGH";
  return "HIGH";
}

// ─── AI reasoning generator ─────────────────────────────────────────────────
// Deterministic template — no LLM call needed for MVP (save API costs)
// Phase 2: replace with OpenAI call using scores as context

function generateReasoning(
  coin: CoinGeckoMarket,
  scores: ScoreBreakdown,
  indicators: TechnicalIndicators,
  regime: MarketRegime,
  defi?: DefiLlamaProtocol
): { reasoning: string; bullish: string[]; bearish: string[]; entry: string; invalidation: string } {
  const bullish: string[] = [];
  const bearish: string[] = [];

  if (scores.momentum > 14) bullish.push("Strong price momentum with positive trend");
  else if (scores.momentum < 8) bearish.push("Momentum is weakening or negative");

  if (scores.liquidity > 12) bullish.push("High volume relative to market cap — well-traded");
  else if (scores.liquidity < 6) bearish.push("Thin liquidity increases execution risk");

  if (indicators.priceVsSma20 > 0) bullish.push("Trading above 20-day moving average");
  else bearish.push("Price is below 20-day moving average");

  if (indicators.priceVsSma50 > 0) bullish.push("Above 50-day MA — medium-term trend intact");
  else bearish.push("Below 50-day MA — medium-term trend under pressure");

  if (indicators.volumeChangeVsAvg > 30) bullish.push("Volume expanding well above 30-day average");

  if (indicators.rsi14 !== null && indicators.rsi14 < 70 && indicators.rsi14 > 45)
    bullish.push(`RSI at ${indicators.rsi14.toFixed(0)} — healthy, not overbought`);
  else if (indicators.rsi14 !== null && indicators.rsi14 > 72)
    bearish.push(`RSI at ${indicators.rsi14.toFixed(0)} — approaching overbought territory`);

  if (regime.riskLabel === "RISK_ON") bullish.push("Market regime is risk-on — favorable backdrop");
  if (regime.riskLabel === "RISK_OFF") bearish.push("Market regime is risk-off — proceed with caution");

  if (defi && defi.change_7d > 10) bullish.push(`DeFi TVL growing ${defi.change_7d.toFixed(1)}% in 7 days`);
  if (defi && defi.change_7d < -10) bearish.push("DeFi TVL declining — capital leaving the protocol");

  if (scores.riskPenalty > 8) bearish.push("Elevated risk score due to liquidity or volatility concerns");

  const entry = indicators.sma20
    ? `Near $${indicators.sma20.toLocaleString(undefined, { maximumFractionDigits: 4 })} (20D MA) — look for pullbacks to this level`
    : `Current market price $${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;

  const invalidation = indicators.sma50
    ? `Break and close below $${indicators.sma50.toLocaleString(undefined, { maximumFractionDigits: 4 })} (50D MA) invalidates the setup`
    : `Loss of recent support structure below -10% from current price`;

  const reasoning = `${coin.name} ranked in today's top 5 based on ${bullish.slice(0, 2).join(" and ").toLowerCase()}${bearish.length > 0 ? `, though ${bearish[0].toLowerCase()}` : ""}.`;

  return { reasoning, bullish, bearish, entry, invalidation };
}

// ─── Main scorer ────────────────────────────────────────────────────────────

export function scoreCoin(
  coin: CoinGeckoMarket,
  priceHistory: number[],
  volumeHistory: number[],
  regime: MarketRegime,
  defi?: DefiLlamaProtocol
): ScoredAsset {
  // Technical indicators
  const rsi14 = calcRSI(priceHistory);
  const macd = calcMACD(priceHistory);
  const sma20 = calcSMA(priceHistory, 20);
  const sma50 = calcSMA(priceHistory, 50);
  const sma200 = calcSMA(priceHistory, 200);
  const bb = calcBollingerBands(priceHistory);
  const volumeBreakout = calcVolumeBreakout(volumeHistory);

  const priceVsSma20 = sma20 ? ((coin.current_price - sma20) / sma20) * 100 : 0;
  const priceVsSma50 = sma50 ? ((coin.current_price - sma50) / sma50) * 100 : 0;

  const indicators: TechnicalIndicators = {
    rsi14,
    macd,
    sma20,
    sma50,
    sma200,
    bollingerBands: bb,
    priceVsSma20,
    priceVsSma50,
    volumeChangeVsAvg: volumeBreakout,
    distanceFromATH: coin.ath_change_percentage,
    distanceFromATL: coin.atl_change_percentage,
  };

  // Momentum score (0-100 scaled)
  const rawMomentum = calcMomentumScore({
    rsi: rsi14,
    macdHistogram: macd?.histogram ?? null,
    priceVsSma20,
    priceVsSma50,
    volumeBreakout,
    priceChange7d: coin.price_change_percentage_7d_in_currency ?? 0,
    priceChange30d: coin.price_change_percentage_30d_in_currency ?? 0,
  });

  const momentumFinal = Math.round((rawMomentum / 100) * 20); // scale to 0-20

  const liq = liquidityScore(coin);
  const onChain = onChainScore(coin);
  const fundamental = fundamentalScore(coin, defi);
  const sentiment = sentimentScore(coin, regime.fearGreedValue);
  const mktRegime = marketRegimeScore(regime);
  const penalty = riskPenalty(coin);

  const total = Math.max(
    0,
    Math.min(100, momentumFinal + liq + onChain + fundamental + sentiment + mktRegime - penalty)
  );

  const scores: ScoreBreakdown = {
    momentum: momentumFinal,
    liquidity: liq,
    onChain,
    fundamental,
    sentiment,
    marketRegime: mktRegime,
    riskPenalty: penalty,
    total,
  };

  const signal = classifySignal(total, rsi14);
  const riskLevel = classifyRisk(coin, penalty);
  const confidence = Math.round(
    (total / 100) * 80 + (priceHistory.length > 50 ? 20 : priceHistory.length * 0.4)
  );

  const { reasoning, bullish, bearish, entry, invalidation } = generateReasoning(
    coin,
    scores,
    indicators,
    regime,
    defi
  );

  return {
    id: coin.id,
    symbol: coin.symbol.toUpperCase(),
    name: coin.name,
    image: coin.image,
    rank: coin.market_cap_rank,
    price: coin.current_price,
    marketCap: coin.market_cap,
    volume24h: coin.total_volume,
    priceChange24h: coin.price_change_percentage_24h,
    priceChange7d: coin.price_change_percentage_7d_in_currency ?? 0,
    priceChange30d: coin.price_change_percentage_30d_in_currency ?? 0,
    sparkline: coin.sparkline_in_7d?.price ?? [],
    technicals: indicators,
    tvl: defi?.tvl,
    tvlChange24h: defi?.change_1d,
    revenueToMcap:
      defi?.revenue24h && coin.market_cap
        ? (defi.revenue24h * 365) / coin.market_cap
        : undefined,
    scores,
    signal,
    riskLevel,
    confidence: Math.min(99, confidence),
    reasoning,
    bullishFactors: bullish,
    bearishFactors: bearish,
    suggestedEntryZone: entry,
    invalidationLevel: invalidation,
    category: getCategory(coin),
    narrativeTags: getNarrativeTags(coin.id),
    dataFreshness: new Date().toISOString(),
  };
}

// ─── Filter + top 5 selector ─────────────────────────────────────────────────

export function filterAndRank(
  assets: ScoredAsset[],
  strategy: Strategy,
  regime: MarketRegime
): ScoredAsset[] {
  const f = FILTERS[strategy];

  let filtered = assets.filter((a) => {
    if (a.marketCap < f.minMcap) return false;
    if (a.volume24h < f.minVolume) return false;
    if (a.technicals.rsi14 && a.technicals.rsi14 > f.maxRsi) return false;
    if (a.scores.riskPenalty >= 12) return false; // hard exclude extreme risk
    if (a.signal === "AVOID") return false;
    // In risk-off regime, further restrict to lower-penalty assets for conservative
    if (regime.riskLabel === "RISK_OFF" && strategy === "conservative" && a.scores.riskPenalty > 5) return false;
    return true;
  });

  // Strategy-specific universe
  if (strategy === "conservative") {
    filtered = filtered.filter((a) => a.marketCap > 10_000_000_000);
  } else if (strategy === "speculative") {
    // No additional filter beyond minimums above
  }

  filtered.sort((a, b) => b.scores.total - a.scores.total);
  return filtered.slice(0, 5);
}
