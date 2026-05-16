-- CannonSignal — Supabase Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard → SQL Editor

-- ─── Daily snapshots ─────────────────────────────────────────────────────────
create table if not exists daily_snapshots (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  strategy    text not null check (strategy in ('conservative', 'growth', 'speculative')),
  snapshot    jsonb not null,
  created_at  timestamptz default now(),
  unique (date, strategy)
);

-- Index for fast latest-day lookups
create index if not exists idx_snapshots_date_strategy
  on daily_snapshots (date desc, strategy);

-- ─── Performance tracking ─────────────────────────────────────────────────────
create table if not exists performance_tracking (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  coin_id     text not null,
  symbol      text not null,
  entry_price numeric not null,
  signal      text not null,
  price_24h   numeric,
  price_7d    numeric,
  price_30d   numeric,
  return_24h  numeric,
  return_7d   numeric,
  return_30d  numeric,
  created_at  timestamptz default now(),
  unique (date, coin_id)
);

create index if not exists idx_perf_date
  on performance_tracking (date desc);

create index if not exists idx_perf_coin
  on performance_tracking (coin_id, date desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Snapshots and performance are read-only for public (anon key)
alter table daily_snapshots enable row level security;
alter table performance_tracking enable row level security;

-- Allow anonymous reads (dashboard is public)
create policy "Public read snapshots"
  on daily_snapshots for select
  using (true);

create policy "Public read performance"
  on performance_tracking for select
  using (true);

-- Writes require service role key (only your API can write)
-- No insert/update policy = blocked for anon key = safe

-- ─── Daily Baskets ($3000/day paper-trade portfolios) ───────────────────────
-- Every day, the system buys $3000 worth of paper-traded crypto:
--   • Top 5 from each of 3 strategies (conservative, growth, speculative) = 15 coins
--   • $200 per coin × 15 coins = $3000 per daily basket
-- Each day's basket is tracked independently with its entry prices frozen.

create table if not exists daily_baskets (
  id                uuid primary key default gen_random_uuid(),
  basket_date       date not null unique,
  total_invested    numeric not null default 3000,
  per_coin_amount   numeric not null default 200,
  num_coins         int not null default 15,
  notes             text,
  created_at        timestamptz default now()
);

create index if not exists idx_baskets_date
  on daily_baskets (basket_date desc);

create table if not exists basket_holdings (
  id              uuid primary key default gen_random_uuid(),
  basket_id       uuid not null references daily_baskets(id) on delete cascade,
  basket_date     date not null,
  strategy        text not null check (strategy in ('conservative', 'growth', 'speculative')),
  strategy_rank   int  not null check (strategy_rank between 1 and 5),
  coin_id         text not null,
  symbol          text not null,
  name            text not null,
  image_url       text,
  entry_price     numeric not null,
  amount_usd      numeric not null default 200,   -- gross paid (fee + crypto)
  fee_pct         numeric not null default 0,     -- % of amount_usd that was fee
  fee_usd         numeric not null default 0,     -- $ amount of fee
  coins_held      numeric not null,               -- (amount_usd - fee_usd) / entry_price
  signal          text,
  score_total     numeric,
  narrative_tags  text[],
  created_at      timestamptz default now(),
  unique (basket_date, strategy, strategy_rank)
);

create index if not exists idx_holdings_basket
  on basket_holdings (basket_id);

create index if not exists idx_holdings_date
  on basket_holdings (basket_date desc);

create index if not exists idx_holdings_coin
  on basket_holdings (coin_id);

alter table daily_baskets   enable row level security;
alter table basket_holdings enable row level security;

create policy "Public read baskets"
  on daily_baskets for select using (true);

create policy "Public read basket_holdings"
  on basket_holdings for select using (true);
