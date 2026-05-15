import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { DailySnapshot } from "@/types/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildSystemPrompt(snapshot: DailySnapshot | null): string {
  const base = `You are CryptoPulse AI, an expert crypto market analyst embedded inside the CryptoPulse daily signal dashboard.

Your job is to help users understand today's top-5 signals, explain the scoring methodology, discuss the market regime, and answer questions about crypto strategy — always grounded in the data provided.

Rules:
- Only reference data from the snapshot provided. Never invent prices, scores, or signals.
- Do not give personalized financial advice or tell anyone to buy or sell.
- Keep answers concise and direct. Use bullet points when listing factors.
- If asked about a coin not in today's top 5, you can explain why it may not have qualified based on the scoring model.
- Always remind users this is a quantitative signal tool, not financial advice, when relevant.
- Today's date: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

  if (!snapshot) return base + "\n\nNo snapshot data is available yet — tell the user to hit Refresh on the dashboard first.";

  const regime = snapshot.marketRegime;
  const top5Summary = snapshot.top5.map((a, i) =>
    `${i + 1}. ${a.symbol} (${a.name})
   - Score: ${a.scores.total}/100 | Signal: ${a.signal} | Risk: ${a.riskLevel}
   - Price: $${a.price.toLocaleString()} | 24h: ${a.priceChange24h >= 0 ? "+" : ""}${a.priceChange24h.toFixed(2)}% | 7d: ${a.priceChange7d >= 0 ? "+" : ""}${a.priceChange7d.toFixed(2)}%
   - Market cap: $${(a.marketCap / 1e9).toFixed(2)}B | Volume: $${(a.volume24h / 1e9).toFixed(2)}B
   - Score breakdown: Momentum ${a.scores.momentum}/20, Liquidity ${a.scores.liquidity}/15, On-chain ${a.scores.onChain}/15, Fundamental ${a.scores.fundamental}/15, Sentiment ${a.scores.sentiment}/15, Regime ${a.scores.marketRegime}/5, Risk penalty -${a.scores.riskPenalty}
   - RSI: ${a.technicals.rsi14?.toFixed(1) ?? "N/A"} | vs 20D MA: ${a.technicals.priceVsSma20.toFixed(1)}% | vs 50D MA: ${a.technicals.priceVsSma50.toFixed(1)}%
   - MACD: ${a.technicals.macd ? (a.technicals.macd.histogram >= 0 ? "Bullish" : "Bearish") : "N/A"}
   - Bullish: ${a.bullishFactors.join("; ") || "none"}
   - Bearish: ${a.bearishFactors.join("; ") || "none"}
   - Entry zone: ${a.suggestedEntryZone}
   - Invalidation: ${a.invalidationLevel}
   - Narrative tags: ${a.narrativeTags.join(", ")}
   ${a.tvl ? `- TVL: $${(a.tvl / 1e9).toFixed(2)}B` : ""}`
  ).join("\n\n");

  return `${base}

--- TODAY'S MARKET REGIME ---
BTC Trend: ${regime.btcTrend} | ETH Trend: ${regime.ethTrend} | Total Market: ${regime.totalMcapTrend}
Fear & Greed: ${regime.fearGreedValue}/100 (${regime.fearGreedLabel})
BTC Dominance: ${regime.dominanceBTC.toFixed(1)}%
Risk environment: ${regime.riskLabel}
Altcoin season: ${regime.altcoinSeason ? "Yes" : "No"}
Strategy: ${snapshot.strategy}

--- TODAY'S TOP 5 SIGNALS ---
${top5Summary}

--- SCORING MODEL REFERENCE ---
Total score = Momentum (0-20) + Liquidity (0-15) + On-chain (0-15) + Fundamental (0-15) + Sentiment (0-15) + Market Regime (0-5) - Risk Penalty (0-15)
Data sources: CoinGecko (price/volume/technicals), DefiLlama (TVL/fees), Alternative.me (Fear & Greed)`;
}

export async function POST(req: NextRequest) {
  const { messages, snapshot } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    snapshot: DailySnapshot | null;
  };

  const systemPrompt = buildSystemPrompt(snapshot);

  // Stream the response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = await client.messages.stream({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          messages,
        });

        for await (const chunk of anthropicStream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[Error: ${String(err)}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
