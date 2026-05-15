// Pure technical indicator calculations — no API calls here

// ─── RSI ────────────────────────────────────────────────────────────────────
export function calcRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// ─── EMA ────────────────────────────────────────────────────────────────────
export function calcEMA(closes: number[], period: number): number[] {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(ema);

  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

// ─── SMA ────────────────────────────────────────────────────────────────────
export function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ─── MACD ───────────────────────────────────────────────────────────────────
export function calcMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): { macd: number; signal: number; histogram: number } | null {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  if (!emaFast.length || !emaSlow.length) return null;

  // Align: slow EMA starts later
  const offset = slow - fast;
  const macdLine: number[] = [];

  for (let i = 0; i < emaSlow.length; i++) {
    macdLine.push(emaFast[i + offset] - emaSlow[i]);
  }

  if (macdLine.length < signal) return null;

  const signalEMA = calcEMA(macdLine, signal);
  if (!signalEMA.length) return null;

  const lastMACD = macdLine[macdLine.length - 1];
  const lastSignal = signalEMA[signalEMA.length - 1];

  return {
    macd: lastMACD,
    signal: lastSignal,
    histogram: lastMACD - lastSignal,
  };
}

// ─── Bollinger Bands ────────────────────────────────────────────────────────
export function calcBollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2
): { upper: number; middle: number; lower: number } | null {
  if (closes.length < period) return null;

  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: middle + stdDevMultiplier * stdDev,
    middle,
    lower: middle - stdDevMultiplier * stdDev,
  };
}

// ─── Volume breakout ────────────────────────────────────────────────────────
// Returns % that today's volume exceeds the rolling average
export function calcVolumeBreakout(volumes: number[], period = 30): number {
  if (volumes.length < period + 1) return 0;
  const recent = volumes[volumes.length - 1];
  const avg = volumes.slice(-period - 1, -1).reduce((a, b) => a + b, 0) / period;
  if (avg === 0) return 0;
  return ((recent - avg) / avg) * 100;
}

// ─── Momentum score (0-100) ─────────────────────────────────────────────────
// Aggregates all technical signals into a single 0-100 score
export function calcMomentumScore(params: {
  rsi: number | null;
  macdHistogram: number | null;
  priceVsSma20: number;
  priceVsSma50: number;
  volumeBreakout: number;
  priceChange7d: number;
  priceChange30d: number;
}): number {
  let score = 50; // start neutral

  const { rsi, macdHistogram, priceVsSma20, priceVsSma50, volumeBreakout, priceChange7d, priceChange30d } = params;

  // RSI: sweet spot 45-65 for momentum, penalty for overbought/oversold
  if (rsi !== null) {
    if (rsi >= 45 && rsi <= 65) score += 10;
    else if (rsi > 65 && rsi <= 75) score += 5;
    else if (rsi > 75) score -= 10; // overbought
    else if (rsi < 35) score -= 5;  // oversold (could be reversal, but risky)
    else if (rsi >= 35 && rsi < 45) score += 2;
  }

  // MACD histogram positive = bullish momentum
  if (macdHistogram !== null) {
    if (macdHistogram > 0) score += 8;
    else score -= 5;
  }

  // Price vs moving averages
  if (priceVsSma20 > 0 && priceVsSma20 < 10) score += 6;
  else if (priceVsSma20 >= 10) score += 2; // already extended
  else score -= 6; // below 20d MA

  if (priceVsSma50 > 0) score += 4;
  else score -= 4;

  // Volume breakout
  if (volumeBreakout > 50) score += 10;
  else if (volumeBreakout > 20) score += 5;
  else if (volumeBreakout < -20) score -= 5;

  // Short-term price momentum
  if (priceChange7d > 5) score += 5;
  else if (priceChange7d < -10) score -= 8;

  if (priceChange30d > 15) score += 3;
  else if (priceChange30d < -20) score -= 5;

  return Math.max(0, Math.min(100, score));
}
