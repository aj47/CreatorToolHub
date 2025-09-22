"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCustomer } from "autumn-js/react";
import { useAuth } from "@/lib/auth/AuthProvider";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

function useCredits(isDevelopment: boolean) {
  const { customer } = useCustomer({ errorOnNotFound: false });
  return useMemo(() => {
    if (isDevelopment) return 999;
    if (!customer?.features) return 0;
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
    return 0;
  }, [customer, isDevelopment]);
}

export function CreditsBadge() {
  const { user, loading } = useAuth();
  const isDevelopment = process.env.NODE_ENV === "development";
  const credits = useCredits(isDevelopment);

  if (loading) {
    return <span className="nb-credits nb-credits--loading">Loading…</span>;
  }

  if (!user) {
    return null;
  }

  return (
    <span className="nb-credits" aria-label="credits remaining">
      credits: {credits}
    </span>
  );
}

export interface AuthMenuItemsProps {
  onNavigate?: () => void;
}

export default function AuthMenuItems({ onNavigate }: AuthMenuItemsProps) {
  const { user, loading, signIn } = useAuth();

  if (loading) {
    return <span className="nb-navlink nb-navlink--loading">Loading…</span>;
  }

  if (user) {
    return (
      <Link
        href="/dashboard"
        className="nb-btn nb-btn--accent nb-navlink-btn"
        title="Open dashboard"
        onClick={onNavigate}
      >
        Dashboard
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onNavigate?.();
        signIn();
      }}
      className="nb-btn nb-btn--accent nb-navlink-btn"
    >
      Sign in with Google
    </button>
  );
}
