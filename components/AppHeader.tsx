"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthMenuItems from "@/components/AuthButton";
import { NavLinks } from "@/components/NavLinks";

export default function AppHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-background/70">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-14 items-center justify-between gap-3">
          <Link href="/" className="font-extrabold tracking-tight text-lg">
            Creator Tool Hub
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            <NavLinks />
            <AuthMenuItems onNavigate={() => setOpen(false)} />
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border bg-background text-foreground md:hidden"
            aria-label={open ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>

        <div className={`${open ? "block" : "hidden"} border-t pb-3 pt-3 md:hidden`}>
          <div className="flex flex-col gap-2">
            <NavLinks />
            <AuthMenuItems onNavigate={() => setOpen(false)} />
          </div>
        </div>
      </div>
    </header>
  );
}
