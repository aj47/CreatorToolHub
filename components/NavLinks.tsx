"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
	{
		href: "/thumbnails",
		label: "Thumbnail Creator",
		description: "AI thumbnail generator tuned for higher CTR.",
	},
	{
		href: "/video-seo",
		label: "Video SEO",
		description: "Titles, descriptions & timestamps from one transcript.",
	},
];

type NavVariant = "desktop" | "mobile";

function isActivePath(pathname: string, href: string): boolean {
	if (href === "/") {
		return pathname === "/";
	}
	return pathname === href || pathname.startsWith(`${href}/`);
}

interface NavLinksProps {
	variant?: NavVariant;
}

export function NavLinks({ variant = "desktop" }: NavLinksProps) {
	const pathname = usePathname() || "/";

	return (
		<>
			{NAV_LINKS.map((link) => {
				const active = isActivePath(pathname, link.href);

				const baseClasses =
					variant === "desktop"
						? "group flex min-w-[9rem] flex-col rounded-md px-2 py-1 text-xs"
						: "flex flex-col rounded-md px-2 py-2 text-sm";

				const stateClasses = active
					? variant === "desktop"
						? "bg-red-50 text-red-700"
						: "bg-slate-900 text-white"
					: variant === "desktop"
					? "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
					: "text-slate-700 hover:bg-slate-50";

				return (
					<Link
						key={link.href}
						href={link.href}
						className={`${baseClasses} ${stateClasses}`}
					>
						<span className="font-medium">{link.label}</span>
						{link.description && (
							<span
								className={
									variant === "desktop"
										? "mt-0.5 text-[11px] text-slate-500 group-hover:text-slate-600"
										: "mt-0.5 text-xs text-slate-500"
								}
							>
								{link.description}
							</span>
						)}
					</Link>
				);
			})}
		</>
	);
}
