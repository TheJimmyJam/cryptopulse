import { createClient } from "@supabase/supabase-js";
import { DailySnapshot, PerformanceRow, SnapshotRow, Strategy, TrackerPick } from "@/types/crypto";

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
