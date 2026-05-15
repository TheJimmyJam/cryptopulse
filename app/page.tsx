"use client";
import { useState, useEffect, useCallback } from "react";
import { DailySnapshot, Strategy } from "@/types/crypto";
import { KanbanBoard } from "@/components/KanbanBoard";
import { MarketRegimePanel } from "@/components/MarketRegimePanel";
import { StrategySelector } from "@/components/StrategySelector";
import { ChatPanel } from "@/components/ChatPanel";
import { format } from "date-fns";

export default function Home() {
  const [strategy, setStrategy]     = useState<Strategy>("growth");
  const [snapshot, setSnapshot]     = useState<DailySnapshot | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  // Changes whenever new data arrives — tells KanbanBoard to re-run GSAP
  const [animKey, setAnimKey]       = useState("init");

  const fetchData = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/recommendations?strategy=${strategy}${forceRefresh ? "&refresh=true" : ""}`
      );
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data: DailySnapshot = await res.json();
      setSnapshot(data);
      setLastUpdated(new Date().toLocaleTimeString());
      setAnimKey(`${strategy}-${Date.now()}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [strategy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = format(new Date(), "MMMM d, yyyy");

  return (
    <>
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Daily Signal</h1>
          <p className="text-slate-500 text-sm mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="text-xs text-slate-500">Updated {lastUpdated}</span>}
          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning...
              </>
            ) : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Strategy selector */}
      <StrategySelector current={strategy} onChange={setStrategy} />

      {/* Market regime */}
      {snapshot?.marketRegime && <MarketRegimePanel regime={snapshot.marketRegime} />}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
          <strong>Error loading signals:</strong> {error}
          <button onClick={() => fetchData()} className="ml-3 underline hover:no-underline">
            Try again
          </button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && !snapshot && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-[#161b27] border border-[#1e2535] rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Top 5 Kanban board */}
      {snapshot && !loading && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">
              Top 5 Daily Opportunities
              <span className="ml-2 text-sm font-normal text-slate-400 capitalize">
                · {strategy} strategy
              </span>
            </h2>
            <span className="text-xs text-slate-600">Click any card to expand</span>
          </div>

          {snapshot.top5.length > 0 ? (
            <KanbanBoard assets={snapshot.top5} animKey={animKey} />
          ) : (
            <div className="bg-[#161b27] border border-[#1e2535] rounded-xl p-8 text-center text-slate-500">
              <p className="text-lg mb-2">No qualifying assets found</p>
              <p className="text-sm">
                The current market regime or filters excluded all candidates.
                Try switching to a different strategy.
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
            <p className="text-xs text-amber-200/60 leading-relaxed">
              <strong className="text-amber-400">Disclaimer:</strong> CryptoPulse surfaces
              quantitative signals based on publicly available market data, technical indicators,
              and sentiment scores. This is <strong>not financial advice</strong>. The model may be
              wrong. Crypto markets are highly volatile. Always use position sizing, stop-losses,
              and conduct your own research before making any investment decisions.
            </p>
          </div>
        </>
      )}
    </div>

    {/* Floating AI chat — always present, has access to current snapshot */}
    <ChatPanel snapshot={snapshot} />
    </>
  );
}
