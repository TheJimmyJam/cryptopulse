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
