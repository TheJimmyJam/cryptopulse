import { CoinGeckoMarket } from "@/types/crypto";

const BASE = "https://api.coingecko.com/api/v3";
const PRO_BASE = "https://pro-api.coingecko.com/api/v3";

function getBase() {
  return process.env.COINGECKO_API_KEY ? PRO_BASE : BASE;
}

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (process.env.COINGECKO_API_KEY) {
    headers["x-cg-pro-api-key"] = process.env.COINGECKO_API_KEY;
  }
  return headers;
}

async function cgFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    headers: getHeaders(),
    next: { revalidate: 300 }, // 5-min cache
  });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// Top N coins with market data + sparkline
export async function getTopMarkets(limit = 250): Promise<CoinGeckoMarket[]> {
  const pages = Math.ceil(limit / 250);
  const results: CoinGeckoMarket[] = [];

  for (let page = 1; page <= pages; page++) {
    const coins = await cgFetch<CoinGeckoMarket[]>(
      `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}` +
      `&sparkline=true&price_change_percentage=7d,30d`
    );
    results.push(...coins);
  }

  return results.slice(0, limit);
}

// 30-day daily OHLCV for a single coin (used for RSI / MA calculations)
export async function getCoinHistory(
  id: string,
  days = 90
): Promise<{ prices: [number, number][]; volumes: [number, number][] }> {
  return cgFetch(`/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`);
}

// Global market dominance / market cap
export async function getGlobalData(): Promise<{
  data: {
    total_market_cap: Record<string, number>;
    total_volume: Record<string, number>;
    market_cap_percentage: Record<string, number>;
    market_cap_change_percentage_24h_usd: number;
  };
}> {
  return cgFetch("/global");
}

// BTC / ETH 7d chart for regime panel
export async function getCoinSparkline(id: string): Promise<number[]> {
  const data = await cgFetch<{ prices: [number, number][] }>(
    `/coins/${id}/market_chart?vs_currency=usd&days=7&interval=daily`
  );
  return data.prices.map(([, price]) => price);
}
