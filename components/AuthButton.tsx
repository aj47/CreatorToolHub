"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCustomer } from "autumn-js/react";
import { useAuth } from "@/lib/auth/AuthProvider";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

// Component that safely handles Autumn customer data
function CreditsDisplay({ isDevelopment }: { isDevelopment: boolean }) {
  // Always call hooks at the top level - never conditionally
  const { customer } = useCustomer({ errorOnNotFound: false });
  const credits = useMemo(() => {
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

  return credits.toString();
}

export default function AuthButton() {
  const { user, loading, signIn } = useAuth();
  const isDevelopment = process.env.NODE_ENV === 'development';



  if (loading) {
    return <span style={{ marginLeft: "auto", fontSize: 12, color: "#666" }}>Loading…</span>;
  }

  return (
    <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
      {user ? (
        <>
          <Link href="/dashboard" className="nb-btn nb-btn--accent" title="Open dashboard">
            Dashboard
          </Link>
          <span
            aria-label="credits remaining"
            style={{
              color: "#111",
              fontWeight: 600,
              whiteSpace: "nowrap"
            }}
          >
            credits: <CreditsDisplay isDevelopment={isDevelopment} />
          </span>
        </>
      ) : (
        <button onClick={signIn} className="nb-btn nb-btn--accent">Sign in with Google</button>
      )}
    </div>
  );
}

