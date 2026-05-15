import type { Metadata } from "next";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";

const BASE_URL = "https://cryptopulse-io.netlify.app";

export const metadata: Metadata = {
  title: "CryptoPulse — Daily Crypto Intelligence",
  description:
    "Daily top-5 crypto opportunity signals scored on momentum, liquidity, on-chain data, DeFi fundamentals, and sentiment. Not financial advice.",
  metadataBase: new URL(BASE_URL),
  openGraph: {
    title: "CryptoPulse — Daily Crypto Intelligence",
    description:
      "Daily top-5 crypto signals scored on momentum, liquidity, on-chain, DeFi fundamentals & sentiment.",
    url: BASE_URL,
    siteName: "CryptoPulse",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "CryptoPulse — Daily Crypto Intelligence",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CryptoPulse — Daily Crypto Intelligence",
    description:
      "Daily top-5 crypto signals scored on momentum, liquidity, on-chain, DeFi fundamentals & sentiment.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0f1117] text-slate-200 antialiased">
        <header className="border-b border-[#1e2535] bg-[#0f1117]/95 sticky top-0 z-50 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="CryptoPulse"
                height={44}
                className="h-11 w-auto"
              />
              <NavLinks />
            </div>
            <div className="text-xs text-slate-500 hidden sm:block">
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
