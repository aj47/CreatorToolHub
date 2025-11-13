"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCustomer } from "autumn-js/react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

function useCredits(isDevelopment: boolean) {
  const { customer } = useCustomer({ errorOnNotFound: false });
  return useMemo(() => {
    if (isDevelopment) return 999;
    if (!customer) return 0;

    const customerAny = customer as any;
    if (typeof customerAny.balance === "number") return customerAny.balance;

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
      <Button variant="secondary" size="sm" disabled aria-busy>
        Loading…
      </Button>
    );
  }

  if (!user) return null;

  return (
    <span className="text-sm text-muted-foreground" aria-label="credits remaining">
      credits: {credits}
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
      <Button variant="secondary" size="sm" disabled aria-busy>
        Loading…
      </Button>
    );
  }

  if (user) {
    return (
      <Link href="/dashboard" title="Open dashboard" onClick={onNavigate}>
        <Button size="sm">credits: {credits}</Button>
      </Link>
    );
  }

  return (
    <Button
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
