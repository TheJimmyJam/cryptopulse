"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tracker",   label: "Tracker"   },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={clsx(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
            pathname === href
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white hover:bg-[#161b27]"
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
