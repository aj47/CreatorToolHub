"use client";
import { useMemo } from "react";
import { useCustomer } from "autumn-js/react";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

// Safe wrapper component for dashboard that handles Autumn provider
function DashboardContent() {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Always call hooks unconditionally, even in development
  const { customer, isLoading, error, openBillingPortal, refetch } = useCustomer({
    errorOnNotFound: !isDevelopment, // Don't error in development
    expand: ["invoices", "entities"]
  });

  const credits = useMemo(() => {
    if (isDevelopment) return 999; // Mock credits in development
    if (!customer?.features) return 0;
    const f = customer.features[FEATURE_ID];
    // Prefer balance; if null/undefined, fall back to included_usage - usage
    if (typeof f?.balance === "number") return f.balance;
    if (typeof f?.included_usage === "number" && typeof f?.usage === "number") {
      return Math.max(0, (f.included_usage ?? 0) - (f.usage ?? 0));
    }
    return 0;
  }, [customer, isDevelopment]);

  if (isDevelopment) {
    // Mock dashboard for development
    return (
      <main className="nb-main">
        <section className="nb-section">
          <div className="nb-card" style={{ maxWidth: 600, margin: "0 auto" }}>
            <h1>Dashboard (Development Mode)</h1>
            <p>Credits: {credits} (mock)</p>
            <p>Development mode - Autumn billing is disabled.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="nb-main">
      <section className="nb-section">
        <div className="nb-card" style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 className="nb-feature-title">Your account</h2>
          {isLoading && <p className="nb-muted">Loading…</p>}
          {error && <p className="nb-error">{error.message}</p>}
          {customer && (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <div className="nb-muted">Signed in as</div>
                <div>{customer.name || customer.email || customer.id}</div>
              </div>

              <div className="nb-card" style={{ background: "#fff" }}>
                <div className="nb-feature-title">Thumbnail credits</div>
                <div className="nb-kpis">
                  <div className="nb-kpi">
                    <div className="nb-kpi-value">{credits}</div>
                    <div className="nb-kpi-label">Credits remaining</div>
                  </div>
                </div>
                <div className="nb-actions" style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="nb-btn nb-btn--accent" href="/pricing">Upgrade / Buy credits</a>
                  <button className="nb-btn" onClick={async () => { const res = await openBillingPortal({}); if (res?.data?.url) window.location.href = res.data.url; }}>Billing portal</button>
                  <button className="nb-btn" onClick={() => refetch()}>Refresh</button>
                  <button
                    className="nb-btn"
                    onClick={async () => {
                      try {
                        await fetch('/api/auth/signout', { method: 'POST' });
                      } finally {
                        // Force a hard refresh to clear all cached state
                        window.location.replace('/');
                      }
                    }}
                    title="Sign out"
                  >
                    Sign out
                  </button>
                </div>
              </div>

              <div className="nb-card" style={{ background: "#fff" }}>
                <div className="nb-feature-title">Products</div>
                {customer.products?.length ? (
                  <ul className="nb-list">
                    {customer.products.map((p) => (
                      <li key={p.id} className="nb-list-item">
                        <span>{p.name || p.id}</span>
                        <span className="nb-badge">{p.status}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="nb-muted">No active products.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}

