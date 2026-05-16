// ─── Raw API shapes ──────────────────────────────────────────────────────────

export interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number | null;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  price_change_percentage_30d_in_currency: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  atl_change_percentage: number;
  last_updated: string;
  sparkline_in_7d?: { price: number[] };
}

export interface DefiLlamaProtocol {
  id: string;
  name: string;
  symbol: string;
  tvl: number;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  mcap: number;
  category: string;
  chains: string[];
  tvlChange24h?: number;
  volume24h?: number;
  fees24h?: number;
  revenue24h?: number;
}

export interface FearGreedData {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update: string;
}

// ─── Calculated / scored shapes ──────────────────────────────────────────────

export interface TechnicalIndicators {
  rsi14: number | null;
  macd: { macd: number; signal: number; histogram: number } | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  bollingerBands: { upper: number; middle: number; lower: number } | null;
  priceVsSma20: number; // % above/below
  priceVsSma50: number;
  volumeChangeVsAvg: number; // % vs 30d avg volume
  distanceFromATH: number; // % below ATH
  distanceFromATL: number; // % above ATL
}

export interface ScoreBreakdown {
  momentum: number;      // 0-20
  liquidity: number;     // 0-15
  onChain: number;       // 0-15
  fundamental: number;   // 0-15
  sentiment: number;     // 0-15
  marketRegime: number;  // 0-5
  riskPenalty: number;   // 0-15 (subtracted)
  total: number;         // 0-100
}

export type SignalType = "BUY" | "WATCH" | "BUY_ON_PULLBACK" | "AVOID";
export type RiskLevel = "LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HIGH";
export type Strategy = "conservative" | "growth" | "speculative";

export interface ScoredAsset {
  // identity
  id: string;
  symbol: string;
  name: string;
  image: string;
  rank: number;

  // price data
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  priceChange7d: number;
  priceChange30d: number;
  sparkline: number[];

  // technicals
  technicals: TechnicalIndicators;

  // defi (optional)
  tvl?: number;
  tvlChange24h?: number;
  fees24h?: number;
  revenue24h?: number;
  revenueToMcap?: number;

  // scoring
  scores: ScoreBreakdown;
  signal: SignalType;
  riskLevel: RiskLevel;
  confidence: number; // 0-100

  // AI reasoning
  reasoning: string;
  bullishFactors: string[];
  bearishFactors: string[];
  invalidationLevel: string;
  suggestedEntryZone: string;

  // meta
  category: string;
  narrativeTags: string[];
  dataFreshness: string;
}

export interface MarketRegime {
  btcTrend: "bullish" | "bearish" | "neutral";
  ethTrend: "bullish" | "bearish" | "neutral";
  totalMcapTrend: "bullish" | "bearish" | "neutral";
  fearGreedValue: number;
  fearGreedLabel: string;
  altcoinSeason: boolean;
  riskLabel: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  dominanceBTC: number;
}

export interface DailySnapshot {
  date: string;
  top5: ScoredAsset[];
  marketRegime: MarketRegime;
  generatedAt: string;
  strategy: Strategy;
}

// ─── Supabase table shapes ─────────────────────────────────────────────────

export interface SnapshotRow {
  id: string;
  date: string;
  strategy: Strategy;
  snapshot: DailySnapshot;
  created_at: string;
}

export interface PerformanceRow {
  id: string;
  date: string;
  coin_id: string;
  symbol: string;
  entry_price: number;
  price_24h: number | null;
  price_7d: number | null;
  price_30d: number | null;
  return_24h: number | null;
  return_7d: number | null;
  return_30d: number | null;
  signal: SignalType;
}

// ─── Tracker picks ─────────────────────────────────────────────────────────

export interface TrackerPick {
  id: string;
  pick_date: string;           // "2026-05-15"
  strategy: Strategy;
  rank: number;                // 1–5
  coin_id: string;
  symbol: string;
  name: string;
  entry_price: number;
  amount_usd: number;          // 200
  coins_held: number;          // amount_usd / entry_price
  image_url: string | null;
  signal: SignalType | null;
  score_total: number | null;
  narrative_tags: string[];
  created_at: string;
}

export interface TrackerPickEnriched extends TrackerPick {
  currentPrice: number | null;
  currentValue: number | null;  // coins_held * currentPrice
  pnlUsd: number | null;        // currentValue - amount_usd
  pnlPct: number | null;        // pnlUsd / amount_usd * 100
  daysSincePick: number;
}

// ─── Daily Baskets ($3000/day paper-trade portfolios) ──────────────────────

export interface DailyBasketRow {
  id: string;
  basket_date: string;           // "2026-05-16"
  total_invested: number;        // 3000
  per_coin_amount: number;       // 200
  num_coins: number;             // 15
  notes: string | null;
  created_at: string;
}

export interface BasketHoldingRow {
  id: string;
  basket_id: string;
  basket_date: string;
  strategy: Strategy;
  strategy_rank: number;         // 1–5
  coin_id: string;
  symbol: string;
  name: string;
  image_url: string | null;
  entry_price: number;
  amount_usd: number;            // 200
  coins_held: number;            // amount_usd / entry_price
  signal: SignalType | null;
  score_total: number | null;
  narrative_tags: string[];
  created_at: string;
}

export interface BasketHoldingEnriched extends BasketHoldingRow {
  currentPrice: number | null;
  currentValue: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
}

// Summary row shown in the "all baskets" list view
export interface DailyBasketSummary {
  basket_date: string;
  total_invested: number;
  current_value: number | null;
  pnl_usd: number | null;
  pnl_pct: number | null;
  num_holdings: number;
  num_priced: number;
  days_since: number;
  winners: number;
  losers: number;
}

// Full drill-in payload for /api/baskets/[date]
export interface BasketDetail {
  basket: DailyBasketRow;
  holdings: BasketHoldingEnriched[];
  summary: {
    total_invested: number;
    current_value: number;
    pnl_usd: number;
    pnl_pct: number;
    num_holdings: number;
    num_priced: number;
    winners: number;
    losers: number;
    by_strategy: Record<Strategy, {
      invested: number;
      current_value: number;
      pnl_usd: number;
      pnl_pct: number;
    }>;
  };
}
