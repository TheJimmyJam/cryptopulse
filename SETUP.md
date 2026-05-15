# CannonSignal — Setup Guide

## Quick Start (5 steps)

### 1. Install dependencies
```bash
cd cannonsignal
npm install
```

### 2. Set up Supabase
1. Go to [supabase.com](https://supabase.com) → New project
2. In SQL Editor, paste and run the contents of `supabase/schema.sql`
3. Copy your project URL and keys from Settings → API

### 3. Configure environment variables
```bash
cp .env.local.example .env.local
# Fill in your Supabase URL, anon key, and service role key
```

### 4. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Netlify
1. Push to GitHub
2. Connect repo in Netlify dashboard
3. Add the same env vars in Netlify → Site settings → Environment variables
4. Deploy

---

## Project Structure

```
cannonsignal/
├── app/
│   ├── page.tsx                    ← Main dashboard page
│   ├── layout.tsx                  ← App shell + header
│   ├── globals.css                 ← Global styles
│   └── api/
│       ├── recommendations/route.ts ← Main data pipeline + scoring
│       └── scores/route.ts          ← Historical snapshot reader
├── components/
│   ├── AssetCard.tsx               ← Individual coin card (expandable)
│   ├── MarketRegimePanel.tsx       ← BTC/ETH trend + Fear & Greed
│   ├── StrategySelector.tsx        ← Conservative / Growth / Speculative tabs
│   ├── ScoreRing.tsx               ← Circular score visualization
│   ├── SignalBadge.tsx             ← BUY / WATCH / AVOID badge
│   └── Sparkline.tsx               ← 7-day price sparkline
├── lib/
│   ├── coingecko.ts                ← CoinGecko API client
│   ├── defillama.ts                ← DefiLlama TVL/fees client
│   ├── feargreed.ts                ← Fear & Greed + market regime builder
│   ├── indicators.ts               ← RSI, MACD, MA, Bollinger calculations
│   ├── scoring.ts                  ← Weighted scoring engine + top-5 selector
│   └── supabase.ts                 ← Database read/write helpers
├── types/
│   └── crypto.ts                   ← All TypeScript types
└── supabase/
    └── schema.sql                  ← Database tables + RLS policies
```

## Scoring Model

| Category         | Max Score | Source                     |
|-----------------|-----------|----------------------------|
| Momentum/Trend  | 20        | RSI, MACD, MAs, price pct  |
| Liquidity       | 15        | Vol/MCap ratio             |
| On-chain (proxy)| 15        | Volume consistency         |
| Fundamentals    | 15        | DefiLlama TVL, revenue     |
| Sentiment       | 15        | Fear & Greed, ATH distance |
| Market Regime   | 5         | BTC trend, risk-on/off     |
| Risk Penalty    | -15       | Volatility, thin liquidity |
| **Total**       | **100**   |                            |

## Data Sources (all free, no API keys required for MVP)

| Source          | Data                             | Rate limit     |
|----------------|----------------------------------|----------------|
| CoinGecko      | Price, volume, history, sparkline | ~30 req/min    |
| DefiLlama      | TVL, fees, revenue               | No limit       |
| Alternative.me | Fear & Greed Index               | No limit       |

## Roadmap (Phase 2)

- [ ] OpenAI integration for richer AI explanations
- [ ] Santiment on-chain data (whale flows, active addresses)
- [ ] Historical performance tracking (actual vs predicted)
- [ ] Email/push alerts when a new top-5 is generated
- [ ] User accounts + watchlists
- [ ] Mobile app (React Native)
- [ ] "Why not?" panel for excluded assets
