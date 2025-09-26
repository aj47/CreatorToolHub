"use client";

import { useEffect, useState, type MouseEvent } from "react";
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

  const handleNavClick = (event: MouseEvent<HTMLElement>) => {
    const interactiveTarget = (event.target as HTMLElement | null)?.closest("a,button");
    if (interactiveTarget) {
      handleNavSelection();
    }
  };

  return (
    <header className="nb-header">
      <button
        type="button"
        className="nb-menu-toggle"
        aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isMenuOpen}
        aria-controls={NAV_ID}
        onClick={() => setIsMenuOpen((prev) => !prev)}
      >
        <span className="nb-menu-icon" aria-hidden="true" />
      </button>
      <nav
        id={NAV_ID}
        className={`nb-nav${isMenuOpen ? " nb-nav--open" : ""}`}
        onClick={handleNavClick}
      >
        <Link href="/" className="nb-brand" onClick={handleNavSelection}>
          Creator Tool Hub
        </Link>
        <NavLinks />
        <AuthMenuItems onNavigate={handleNavSelection} />
      </nav>
    </header>
  );
}

