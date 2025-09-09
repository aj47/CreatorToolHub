"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCustomer } from "autumn-js/react";

interface User {
  email: string;
  name: string;
  picture: string;
}

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check authentication status via session endpoint
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session');
        const data = await response.json();

        if (data.authenticated && data.user) {
          setUser({
            email: data.user.email,
            name: data.user.name || '',
            picture: data.user.picture || '',
          });
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = () => {
    window.location.href = '/api/auth/signin';
  };

  // Load Autumn customer to show credits badge when signed in
  const { customer } = useCustomer({ errorOnNotFound: true });
  const credits = useMemo(() => {
    if (!customer?.features) return 0;
    const f: any = customer.features[FEATURE_ID as string];
    if (!f) return 0;
    if (typeof f.balance === "number") return f.balance;
    if (typeof f.included_usage === "number" && typeof f.usage === "number") {
      return Math.max(0, (f.included_usage ?? 0) - (f.usage ?? 0));
    }
    return 0;
  }, [customer]);

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
            credits: {credits}
          </span>
        </>
      ) : (
        <button onClick={signIn} className="nb-btn nb-btn--accent">Sign in with Google</button>
      )}
    </div>
  );
}

