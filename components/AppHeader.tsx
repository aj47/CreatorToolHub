"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthMenuItems from "@/components/AuthButton";
import { NavLinks } from "@/components/NavLinks";

const NAV_ID = "nb-primary-navigation";

export default function AppHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  const handleNavSelection = () => setIsMenuOpen(false);

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 md:py-4">
        <div className="flex flex-1 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:hidden"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            aria-controls={NAV_ID}
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <span className="sr-only">Toggle navigation</span>
            <span className="flex h-4 w-4 flex-col justify-between">
              <span className="h-[2px] w-full rounded bg-slate-800" />
              <span className="h-[2px] w-full rounded bg-slate-800" />
              <span className="h-[2px] w-full rounded bg-slate-800" />
            </span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-900"
            onClick={handleNavSelection}
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-xs font-bold text-white shadow-sm">
              CTH
            </span>
            <span className="hidden sm:inline">Creator Tool Hub</span>
            <span className="sm:hidden">Creator Hub</span>
          </Link>
        </div>

        <div className="hidden flex-1 items-center justify-end gap-6 md:flex">
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <NavLinks variant="desktop" />
          </div>
          <AuthMenuItems onNavigate={handleNavSelection} />
        </div>
      </div>

      <div
        id={NAV_ID}
        className={`md:hidden border-t border-slate-200 bg-white ${isMenuOpen ? "block" : "hidden"}`}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 space-y-4">
          <div className="flex flex-col gap-1 text-sm text-slate-700">
            <NavLinks variant="mobile" />
          </div>
          <div className="border-t border-slate-100 pt-3">
            <AuthMenuItems onNavigate={handleNavSelection} />
          </div>
        </div>
      </div>
    </header>
  );
}

