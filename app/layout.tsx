import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CryptoPulse — Daily Crypto Intelligence",
  description:
    "Daily top-5 crypto opportunity signals based on market data, on-chain analytics, DeFi fundamentals, and sentiment scoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0f1117] text-slate-200 antialiased">
        <header className="border-b border-[#1e2535] bg-[#0f1117]/95 sticky top-0 z-50 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                CP
              </div>
              <span className="font-bold text-lg text-white tracking-tight">CryptoPulse</span>
              <span className="text-xs text-slate-500 hidden sm:block">Daily Crypto Intelligence</span>
            </div>
            <div className="text-xs text-slate-500">
              Not financial advice · Use stop losses · Do your own research
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
        <footer className="border-t border-[#1e2535] mt-16 py-8 text-center text-xs text-slate-600">
          <p>CryptoPulse surfaces quantitative signals, not financial advice.</p>
          <p className="mt-1">The model may be wrong. Use position sizing, stop losses, and independent research.</p>
        </footer>
      </body>
    </html>
  );
}
