import { createClient } from "@supabase/supabase-js";
import {
  BasketHoldingRow,
  DailyBasketRow,
  DailySnapshot,
  PerformanceRow,
  SnapshotRow,
  Strategy,
  TrackerPick,
} from "@/types/crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client for browser (anon key)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-only client with elevated permissions
export function getSupabaseAdmin() {
  if (!supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ─── Snapshot CRUD ───────────────────────────────────────────────────────────

export async function saveSnapshot(
  snapshot: DailySnapshot
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("daily_snapshots").upsert(
    {
      date: snapshot.date,
      strategy: snapshot.strategy,
      snapshot,
    },
    { onConflict: "date,strategy" }
  );
  if (error) throw error;
}

export async function getLatestSnapshot(
  strategy: Strategy = "growth"
): Promise<DailySnapshot | null> {
  const { data, error } = await supabase
    .from("daily_snapshots")
    .select("*")
    .eq("strategy", strategy)
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;
  return (data as SnapshotRow).snapshot;
}

export async function getSnapshotHistory(
  strategy: Strategy = "growth",
  limit = 30
): Promise<SnapshotRow[]> {
  const { data, error } = await supabase
    .from("daily_snapshots")
    .select("*")
    .eq("strategy", strategy)
    .order("date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as SnapshotRow[]) ?? [];
}

// ─── Performance tracking ─────────────────────────────────────────────────

export async function savePerformanceEntry(entries: Omit<PerformanceRow, "id">[]): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("performance_tracking").upsert(entries, {
    onConflict: "date,coin_id",
  });
  if (error) throw error;
}

export async function getPerformanceHistory(coinId?: string): Promise<PerformanceRow[]> {
  let query = supabase
    .from("performance_tracking")
    .select("*")
    .order("date", { ascending: false })
    .limit(90);

  if (coinId) query = query.eq("coin_id", coinId);

  const { data, error } = await query;
  if (error) throw error;
  return (data as PerformanceRow[]) ?? [];
}

// ─── Tracker picks ─────────────────────────────────────────────────────────

export async function saveTrackerPicks(
  picks: Omit<TrackerPick, "id" | "created_at">[]
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("tracker_picks").upsert(picks, {
    onConflict: "pick_date,strategy,rank",
    ignoreDuplicates: true,
  });
  if (error) throw error;
}

export async function getTrackerPicks(): Promise<TrackerPick[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("tracker_picks")
    .select("*")
    .order("pick_date", { ascending: false })
    .order("rank", { ascending: true });
  if (error) throw error;
  return (data as TrackerPick[]) ?? [];
}

// ─── Daily Baskets ($3000/day paper-trade portfolios) ──────────────────────

export interface NewBasketHoldingInput {
  strategy: Strategy;
  strategy_rank: number;
  coin_id: string;
  symbol: string;
  name: string;
  image_url: string | null;
  entry_price: number;
  amount_usd: number;
  coins_held: number;
  signal: string | null;
  score_total: number | null;
  narrative_tags: string[];
}

/**
 * Create today's $3000 basket (15 holdings × $200 each).
 * Idempotent: if a basket already exists for `basketDate`, it returns the
 * existing row and does NOT overwrite or duplicate holdings.
 */
export async function createBasket(
  basketDate: string,
  holdings: NewBasketHoldingInput[]
): Promise<{ basket: DailyBasketRow; created: boolean }> {
  const db = getSupabaseAdmin();

  // Check for existing basket on this date
  const { data: existing, error: selErr } = await db
    .from("daily_baskets")
    .select("*")
    .eq("basket_date", basketDate)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) {
    return { basket: existing as DailyBasketRow, created: false };
  }

  const totalInvested = holdings.reduce((s, h) => s + h.amount_usd, 0);
  const perCoinAmount = holdings[0]?.amount_usd ?? 200;

  // Insert basket
  const { data: basket, error: insErr } = await db
    .from("daily_baskets")
    .insert({
      basket_date: basketDate,
      total_invested: totalInvested,
      per_coin_amount: perCoinAmount,
      num_coins: holdings.length,
    })
    .select("*")
    .single();
  if (insErr) throw insErr;

  // Insert holdings linked to basket
  const holdingRows = holdings.map((h) => ({
    basket_id: (basket as DailyBasketRow).id,
    basket_date: basketDate,
    ...h,
  }));
  const { error: holdErr } = await db.from("basket_holdings").insert(holdingRows);
  if (holdErr) throw holdErr;

  return { basket: basket as DailyBasketRow, created: true };
}

export async function getBasketRowByDate(
  basketDate: string
): Promise<DailyBasketRow | null> {
  const { data, error } = await supabase
    .from("daily_baskets")
    .select("*")
    .eq("basket_date", basketDate)
    .maybeSingle();
  if (error) throw error;
  return (data as DailyBasketRow | null) ?? null;
}

export async function listBaskets(limit = 90): Promise<DailyBasketRow[]> {
  const { data, error } = await supabase
    .from("daily_baskets")
    .select("*")
    .order("basket_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as DailyBasketRow[]) ?? [];
}

export async function getBasketByDate(
  basketDate: string
): Promise<{ basket: DailyBasketRow; holdings: BasketHoldingRow[] } | null> {
  const { data: basket, error: bErr } = await supabase
    .from("daily_baskets")
    .select("*")
    .eq("basket_date", basketDate)
    .maybeSingle();
  if (bErr) throw bErr;
  if (!basket) return null;

  const { data: holdings, error: hErr } = await supabase
    .from("basket_holdings")
    .select("*")
    .eq("basket_id", (basket as DailyBasketRow).id)
    .order("strategy", { ascending: true })
    .order("strategy_rank", { ascending: true });
  if (hErr) throw hErr;

  return {
    basket: basket as DailyBasketRow,
    holdings: (holdings as BasketHoldingRow[]) ?? [],
  };
}

export async function getAllBasketHoldings(
  basketIds: string[]
): Promise<BasketHoldingRow[]> {
  if (!basketIds.length) return [];
  const { data, error } = await supabase
    .from("basket_holdings")
    .select("*")
    .in("basket_id", basketIds);
  if (error) throw error;
  return (data as BasketHoldingRow[]) ?? [];
}
