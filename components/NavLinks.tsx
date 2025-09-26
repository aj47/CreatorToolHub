"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/thumbnails", label: "Thumbnail Creator" },
  { href: "/video-seo", label: "Video SEO" },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks() {
  const pathname = usePathname() || "/";

  return (
    <>
      {NAV_LINKS.map((link) => {
        const active = isActivePath(pathname, link.href);
        const className = active ? "nb-navlink nb-navlink--active" : "nb-navlink";
        return (
          <Link key={link.href} href={link.href} className={className}>
            {link.label}
          </Link>
        );
      })}
    </>
  );
}

