import { DefiLlamaProtocol } from "@/types/crypto";

const BASE = "https://api.llama.fi";

async function llamaFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    next: { revalidate: 3600 }, // 1-hour cache — TVL data doesn't change that fast
  });
  if (!res.ok) throw new Error(`DefiLlama ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

// All protocols with TVL data
export async function getAllProtocols(): Promise<DefiLlamaProtocol[]> {
  return llamaFetch<DefiLlamaProtocol[]>("/protocols");
}

// Build a symbol → protocol map for quick lookups
export async function buildDefiMap(): Promise<Map<string, DefiLlamaProtocol>> {
  const protocols = await getAllProtocols();
  const map = new Map<string, DefiLlamaProtocol>();

  for (const p of protocols) {
    if (p.symbol) {
      map.set(p.symbol.toLowerCase(), p);
    }
  }
  return map;
}

// Fees / revenue from DefiLlama Fees API
export async function getProtocolFees(protocol: string): Promise<{
  total24h: number | null;
  revenue24h: number | null;
}> {
  try {
    const data = await llamaFetch<{
      total24h: number;
      revenue24h: number;
    }>(`/summary/fees/${protocol}`);
    return { total24h: data.total24h ?? null, revenue24h: data.revenue24h ?? null };
  } catch {
    return { total24h: null, revenue24h: null };
  }
}

// Overall DeFi TVL trend
export async function getTotalTvl(): Promise<{ date: number; totalLiquidityUSD: number }[]> {
  return llamaFetch("/v2/historicalChainTvl");
}
