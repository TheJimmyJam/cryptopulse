"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const SCRAMBLE_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*[]{}|<>?/\\~";

function scrambleText(el: HTMLElement, finalText: string, duration = 2000): () => void {
  const totalFrames = 60;
  const frameMs = duration / totalFrames;
  let frame = 0;
  const timer = setInterval(() => {
    frame++;
    const resolved = Math.floor((frame / totalFrames) * finalText.length);
    el.textContent = finalText
      .split("")
      .map((char, i) => {
        if (char === " ") return " ";
        if (i < resolved) return char;
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      })
      .join("");
    if (frame >= totalFrames) {
      el.textContent = finalText;
      clearInterval(timer);
    }
  }, frameMs);
  return () => clearInterval(timer);
}

const COINS = [
  { s: "BTC",   img: "https://assets.coingecko.com/coins/images/1/small/bitcoin.png" },
  { s: "ETH",   img: "https://assets.coingecko.com/coins/images/279/small/ethereum.png" },
  { s: "SOL",   img: "https://assets.coingecko.com/coins/images/4128/small/solana.png" },
  { s: "XRP",   img: "https://assets.coingecko.com/coins/images/44/small/xrp-symbol-white-128.png" },
  { s: "ADA",   img: "https://assets.coingecko.com/coins/images/975/small/cardano.png" },
  { s: "BNB",   img: "https://assets.coingecko.com/coins/images/825/small/binance-coin-logo.png" },
  { s: "AVAX",  img: "https://assets.coingecko.com/coins/images/12559/small/Avalanche_Circle_RedWhite_Trans.png" },
  { s: "DOGE",  img: "https://assets.coingecko.com/coins/images/5/small/dogecoin.png" },
  { s: "DOT",   img: "https://assets.coingecko.com/coins/images/12171/small/polkadot.png" },
  { s: "LINK",  img: "https://assets.coingecko.com/coins/images/877/small/chainlink-new-logo.png" },
  { s: "MATIC", img: "https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png" },
  { s: "UNI",   img: "https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png" },
  { s: "LTC",   img: "https://assets.coingecko.com/coins/images/2/small/litecoin.png" },
  { s: "ATOM",  img: "https://assets.coingecko.com/coins/images/1481/small/cosmos_hub.png" },
  { s: "NEAR",  img: "https://assets.coingecko.com/coins/images/10365/small/near.png" },
  { s: "SHIB",  img: "https://assets.coingecko.com/coins/images/11939/small/shiba.png" },
  { s: "TRX",   img: "https://assets.coingecko.com/coins/images/1094/small/tron-logo.png" },
  { s: "XLM",   img: "https://assets.coingecko.com/coins/images/100/small/Stellar_symbol_black_RGB.png" },
  { s: "AAVE",  img: "https://assets.coingecko.com/coins/images/12645/small/AAVE.png" },
  { s: "OP",    img: "https://assets.coingecko.com/coins/images/25244/small/Optimism.png" },
];

const LANE_CFG = [
  { offset: 0,  top: "5%",  size: 44, gap: 52, dur: 50, dir:  1, opacity: 0.20 },
  { offset: 6,  top: "23%", size: 56, gap: 64, dur: 36, dir: -1, opacity: 0.26 },
  { offset: 11, top: "43%", size: 38, gap: 46, dur: 62, dir:  1, opacity: 0.15 },
  { offset: 15, top: "63%", size: 50, gap: 58, dur: 44, dir: -1, opacity: 0.22 },
  { offset: 4,  top: "83%", size: 34, gap: 42, dur: 70, dir:  1, opacity: 0.13 },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Quantitative Scoring",
    desc: "7-factor model across momentum, liquidity, on-chain data, DeFi fundamentals, volatility, and market sentiment.",
  },
  {
    icon: "🎯",
    title: "Top 5 Daily Picks",
    desc: "Three strategies — Conservative, Growth, and Speculative — with ranked picks refreshed every morning.",
  },
  {
    icon: "📊",
    title: "Signal Tracker",
    desc: "Every pick is paper-traded at $200. Track live P&L and validate model accuracy over time.",
  },
];

function laneCoins(offset: number) {
  const shifted = [...COINS.slice(offset), ...COINS.slice(0, offset)];
  return [...shifted, ...shifted];
}

export default function LandingPage() {
  const titleRef    = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const laneRefs    = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    if (titleRef.current) {
      cleanups.push(scrambleText(titleRef.current, "CryptoPulse", 2200));
    }
    const t1 = setTimeout(() => {
      if (subtitleRef.current) {
        cleanups.push(scrambleText(subtitleRef.current, "AI-Powered Daily Crypto Signals", 1800));
      }
    }, 500);
    cleanups.push(() => clearTimeout(t1));

    import("gsap").then(({ gsap }) => {
      laneRefs.current.forEach((lane, i) => {
        if (!lane) return;
        const { dur, dir } = LANE_CFG[i];
        if (dir === 1) {
          gsap.to(lane, { x: "-50%", duration: dur, ease: "none", repeat: -1 });
        } else {
          gsap.fromTo(lane, { x: "-50%" }, { x: "0%", duration: dur, ease: "none", repeat: -1 });
        }
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center bg-[#0a0e1a]">

      {/* ── Background crypto lanes ── */}
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        {LANE_CFG.map((lane, i) => (
          <div
            key={i}
            className="absolute left-0"
            style={{ top: lane.top, opacity: lane.opacity }}
          >
            <div
              ref={(el) => { laneRefs.current[i] = el; }}
              className="flex items-center"
              style={{ gap: `${lane.gap}px` }}
            >
              {laneCoins(lane.offset).map((coin, j) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${i}-${j}`}
                  src={coin.img}
                  alt={coin.s}
                  className="rounded-full flex-shrink-0 object-cover"
                  style={{ width: lane.size, height: lane.size }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Radial vignette — center readable ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 75% 85% at 50% 50%, rgba(10,14,26,0.93) 0%, rgba(10,14,26,0.68) 55%, rgba(10,14,26,0.15) 100%)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-3xl w-full py-20">

        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="CryptoPulse" className="h-14 w-auto mb-8" />

        {/* Title scramble */}
        <h1
          ref={titleRef}
          className="text-6xl sm:text-8xl font-black text-white tracking-tight leading-none mb-5 font-mono"
        >
          CryptoPulse
        </h1>

        {/* Subtitle scramble */}
        <p
          ref={subtitleRef}
          className="text-base sm:text-xl text-blue-400 font-mono tracking-wide mb-5"
        >
          AI-Powered Daily Crypto Signals
        </p>

        <p className="text-slate-400 text-sm sm:text-base max-w-lg mb-12 leading-relaxed">
          A quantitative scoring engine that surfaces the top&nbsp;5 crypto opportunities every
          day — ranked by momentum, liquidity, on-chain data, DeFi fundamentals, and market
          sentiment.
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-12">
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left backdrop-blur-sm"
            >
              <div className="text-2xl mb-3">{icon}</div>
              <div className="text-sm font-bold text-white mb-2">{title}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/dashboard"
          className="group inline-flex items-center gap-3 px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xl rounded-2xl transition-all duration-200 shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-100"
        >
          Provide Today&apos;s Picks
          <span className="text-2xl group-hover:translate-x-1.5 transition-transform duration-200">
            →
          </span>
        </Link>

        <p className="mt-8 text-xs text-slate-600 max-w-sm">
          Not financial advice. Always conduct your own research and use stop-losses.
        </p>
      </div>
    </div>
  );
}
