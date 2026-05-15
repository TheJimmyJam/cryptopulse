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

// Canvas pixel-noise → logo reveal
function runLogoScramble(canvas: HTMLCanvasElement) {
  const img = new Image();
  img.src = "/logo.png";

  img.onload = () => {
    const DISPLAY_H = 336;
    const DISPLAY_W = Math.round((img.naturalWidth / img.naturalHeight) * DISPLAY_H);
    const BLOCK     = 3; // 3×3 pixel blocks — digital feel, good performance

    canvas.width        = DISPLAY_W;
    canvas.height       = DISPLAY_H;
    canvas.style.width  = DISPLAY_W + "px";
    canvas.style.height = DISPLAY_H + "px";

    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    // Capture real pixel data at display resolution
    const off  = document.createElement("canvas");
    off.width  = DISPLAY_W;
    off.height = DISPLAY_H;
    off.getContext("2d")!.drawImage(img, 0, 0, DISPLAY_W, DISPLAY_H);
    const real = off.getContext("2d")!.getImageData(0, 0, DISPLAY_W, DISPLAY_H).data;

    // Working image data buffer
    const work = ctx.createImageData(DISPLAY_W, DISPLAY_H);

    // Block grid dimensions
    const blocksX = Math.ceil(DISPLAY_W / BLOCK);
    const blocksY = Math.ceil(DISPLAY_H / BLOCK);
    const total   = blocksX * blocksY;

    // Fisher-Yates shuffle → randomised reveal order
    const order = Array.from({ length: total }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    // Helper: write one block into the work buffer
    const writeBlock = (bi: number, r: number, g: number, b: number, useReal: boolean) => {
      const bx = (bi % blocksX) * BLOCK;
      const by = Math.floor(bi / blocksX) * BLOCK;
      for (let dy = 0; dy < BLOCK && by + dy < DISPLAY_H; dy++) {
        for (let dx = 0; dx < BLOCK && bx + dx < DISPLAY_W; dx++) {
          const i = ((by + dy) * DISPLAY_W + (bx + dx)) * 4;
          if (real[i + 3] > 0) {              // only paint visible logo pixels
            work.data[i]     = useReal ? real[i]     : r;
            work.data[i + 1] = useReal ? real[i + 1] : g;
            work.data[i + 2] = useReal ? real[i + 2] : b;
            work.data[i + 3] = real[i + 3];   // always preserve alpha
          }
        }
      }
    };

    // Initialise every block as flickering noise
    for (let b = 0; b < total; b++) {
      writeBlock(order[b], Math.random() * 255 | 0, Math.random() * 255 | 0, Math.random() * 255 | 0, false);
    }

    const DURATION   = 2600; // ms for full reveal
    const start      = performance.now();
    let   numRevealed = 0;

    const frame = (now: number) => {
      const progress = Math.min((now - start) / DURATION, 1);
      const target   = Math.floor(progress * total);

      // Lock in newly-revealed blocks
      while (numRevealed < target) {
        writeBlock(order[numRevealed], 0, 0, 0, true);
        numRevealed++;
      }

      // Flicker ~40 % of still-unrevealed blocks each frame
      for (let b = numRevealed; b < total; b++) {
        if (Math.random() > 0.4) continue;
        writeBlock(order[b], Math.random() * 255 | 0, Math.random() * 255 | 0, Math.random() * 255 | 0, false);
      }

      ctx.putImageData(work, 0, 0);
      if (progress < 1) requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  };
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

function laneCoins(offset: number) {
  const shifted = [...COINS.slice(offset), ...COINS.slice(0, offset)];
  return [...shifted, ...shifted];
}

export default function LandingPage() {
  const logoRef     = useRef<HTMLCanvasElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const descRef     = useRef<HTMLParagraphElement>(null);
  const laneRefs    = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const cleanups: (() => void)[] = [];

    // Canvas logo scramble
    if (logoRef.current) runLogoScramble(logoRef.current);

    // Subtitle scramble — starts as logo is resolving
    const t0 = setTimeout(() => {
      if (subtitleRef.current)
        cleanups.push(scrambleText(subtitleRef.current, "AI-Powered Daily Crypto Signals", 1800));
    }, 300);
    // Description scramble — staggered after subtitle
    const t1 = setTimeout(() => {
      if (descRef.current)
        cleanups.push(scrambleText(
          descRef.current,
          "A quantitative scoring engine that surfaces the top 5 crypto opportunities every day — ranked by momentum, liquidity, on-chain data, DeFi fundamentals, and market sentiment.",
          2400
        ));
    }, 900);
    cleanups.push(() => clearTimeout(t0), () => clearTimeout(t1));

    // GSAP lane animations
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

      {/* ── Radial vignette ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 75% 85% at 50% 50%, rgba(10,14,26,0.93) 0%, rgba(10,14,26,0.68) 55%, rgba(10,14,26,0.15) 100%)",
        }}
      />

      {/* ── Content ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl w-full pt-2 pb-20">

        {/* Logo — canvas pixel-noise reveal */}
        <canvas ref={logoRef} className="mb-1" />

        {/* Subtitle scramble */}
        <p
          ref={subtitleRef}
          className="text-base sm:text-xl text-blue-400 font-mono tracking-wide mb-4"
        >
          AI-Powered Daily Crypto Signals
        </p>

        {/* Description scramble */}
        <p ref={descRef} className="text-slate-400 text-sm sm:text-base max-w-lg mb-12 leading-relaxed">
          A quantitative scoring engine that surfaces the top 5 crypto opportunities every
          day — ranked by momentum, liquidity, on-chain data, DeFi fundamentals, and market
          sentiment.
        </p>

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
