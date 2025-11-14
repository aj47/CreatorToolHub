"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCustomer } from "autumn-js/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

function useCredits(isDevelopment: boolean) {
  const { customer } = useCustomer({ errorOnNotFound: false });
  return useMemo(() => {
    if (isDevelopment) return 999;
    if (!customer) return 0;

    // Handle flat balance structure (from Autumn API)
    const customerAny = customer as any;
    if (typeof customerAny.balance === "number") return customerAny.balance;

    // Handle nested features structure (expected by autumn-js)
    if (customer.features) {
      const feature = customer.features[FEATURE_ID as string] as {
        balance?: number;
        included_usage?: number;
        usage?: number;
      } | undefined;
      if (!feature) return 0;
      if (typeof feature.balance === "number") return feature.balance;
      if (typeof feature.included_usage === "number" && typeof feature.usage === "number") {
        return Math.max(0, (feature.included_usage ?? 0) - (feature.usage ?? 0));
      }
    }
    return 0;
  }, [customer, isDevelopment]);
}

export function CreditsBadge() {
  const { user, loading } = useAuth();
  const isDevelopment = process.env.NODE_ENV === "development";
  const credits = useCredits(isDevelopment);

  if (loading) {
    return (
      <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
        Loading…
      </span>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
      aria-label="credits remaining"
    >
      <span className="uppercase tracking-wide">Credits</span>
      <span className="font-semibold text-foreground">{credits}</span>
    </span>
  );
}

export interface AuthMenuItemsProps {
  onNavigate?: () => void;
}

export default function AuthMenuItems({ onNavigate }: AuthMenuItemsProps) {
	const { user, loading, signIn } = useAuth();
	const isDevelopment = process.env.NODE_ENV === "development";
	const credits = useCredits(isDevelopment);

	if (loading) {
		return (
			<span className="inline-flex items-center text-xs font-medium text-muted-foreground">
				Loading…
			</span>
		);
	}

	if (user) {
		return (
			<div className="flex items-center gap-3">
				<CreditsBadge />
				<Link
						href="/dashboard"
						className={buttonVariants({ size: "sm" })}
						title="Open dashboard"
						onClick={onNavigate}
				>
					Dashboard
				</Link>
			</div>
		);
	}

	return (
		<Button
			type="button"
			size="sm"
			onClick={() => {
				onNavigate?.();
				signIn();
			}}
		>
			Sign in with Google
		</Button>
	);
}
