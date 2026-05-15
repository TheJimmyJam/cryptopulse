import { NavLinks } from "@/components/NavLinks";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-[#1e2535] bg-[#0f1117]/95 sticky top-0 z-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-0.5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="CryptoPulse" className="h-8 w-auto" />
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
    </>
  );
}
