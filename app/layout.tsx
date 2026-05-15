import type { Metadata } from "next";
import "./globals.css";

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
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0f1117] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
