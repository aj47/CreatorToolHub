"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/thumbnails", label: "Thumbnails", desc: "Design AI thumbnails" },
  { href: "/video-seo", label: "Video SEO", desc: "Titles, descriptions, timestamps" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname() || "/";

  return (
    <>
      {NAV_LINKS.map((link) => {
        const active = isActivePath(pathname, link.href);
        const base = "rounded-md px-3 py-2 transition-colors";
        const cls = active
          ? "bg-primary text-primary-foreground"
          : "text-foreground/80 hover:bg-accent hover:text-accent-foreground";
        return (
          <Link key={link.href} href={link.href} className={`${base} ${cls}`} title={link.desc}>
            <span className="block text-sm font-medium leading-tight">{link.label}</span>
            <span className="hidden lg:block text-xs text-muted-foreground leading-tight">
              {link.desc}
            </span>
          </Link>
        );
      })}
    </>
  );
}
