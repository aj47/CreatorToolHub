"use client";
import { useMemo, useState, useEffect } from "react";
import { useCustomer } from "autumn-js/react";
import GenerationsList from "@/components/GenerationsList";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

type DashboardTab = "generations" | "account";

// Safe wrapper component for dashboard that handles Autumn provider
function DashboardContent() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const [activeTab, setActiveTab] = useState<DashboardTab>("generations");
  const [isDeleting, setIsDeleting] = useState(false);

  // Always call hooks unconditionally, even in development
  const { customer, isLoading, error, openBillingPortal, refetch } = useCustomer({
    errorOnNotFound: !isDevelopment, // Don't error in development
    expand: ["invoices", "entities"]
  });

  const handleDeleteAccount = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/user/account', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        // Account deleted successfully
        alert('Your account has been deleted successfully.');
        // Force a hard refresh to clear all cached state and redirect to home
        window.location.replace('/');
      } else {
        const data = await response.json();
        alert(`Failed to delete account: ${data.error || 'Unknown error'}`);
        setIsDeleting(false);
      }
    } catch (err) {
      alert('Network error during account deletion. Please try again.');
      setIsDeleting(false);
    }
  };


  const credits = useMemo(() => {
    if (isDevelopment) return 999; // Mock credits in development

    const c = customer as any;
    if (!c) {
      return 0;
    }


    // Handle flat/minimal balance structure first
    if (typeof c.balance === "number" && !c.features) {
      return c.balance;
    }

    // Handle nested features structure (expected by autumn-js)
    if (c.features) {
      const f = c.features[FEATURE_ID];
      if (typeof f?.balance === "number") {
        return f.balance;
      }
      if (typeof f?.included_usage === "number" && typeof f?.usage === "number") {
        const calculated = Math.max(0, (f.included_usage ?? 0) - (f.usage ?? 0));
        return calculated;
      }
    }

    return 0;
  }, [customer, isDevelopment]);

  if (isDevelopment) {
    // Mock dashboard for development
    return (
      <main className="nb-main">
        <section className="nb-section">
          <div className="nb-card" style={{ maxWidth: 1200, margin: "0 auto" }}>
            <h1>Dashboard (Development Mode)</h1>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e0e0e0", marginBottom: 16 }}>
                <button
                  onClick={() => setActiveTab("generations")}
                  style={{
                    padding: "8px 16px",
                    background: activeTab === "generations" ? "#333" : "transparent",
                    color: activeTab === "generations" ? "white" : "#666",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1em",
                  }}
                >
                  Generations
                </button>
                <button
                  onClick={() => setActiveTab("account")}
                  style={{
                    padding: "8px 16px",
                    background: activeTab === "account" ? "#333" : "transparent",
                    color: activeTab === "account" ? "white" : "#666",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1em",
                  }}
                >
                  Account
                </button>
              </div>

              {activeTab === "generations" && <GenerationsList />}

              {activeTab === "account" && (
                <div>
                  <p>Credits: {credits} (mock)</p>
                  <p>Development mode - Autumn billing is disabled.</p>
                  <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #e0e0e0" }}>
                    <h3 style={{ color: "#d32f2f", marginBottom: 8 }}>Delete Account</h3>
                    <p style={{ fontSize: "0.9em", color: "#666", marginBottom: 16 }}>
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <button
                      className="nb-btn"
                      style={{ background: "#d32f2f", color: "white", opacity: isDeleting ? 0.6 : 1 }}
                      disabled={isDeleting}
                      onClick={() => {
                        if (window.confirm(
                          "Are you sure you want to delete your account?\n\n" +
                          "This will permanently delete:\n" +
                          "• All your templates\n" +
                          "• All your generated thumbnails\n" +
                          "• All your settings and preferences\n\n" +
                          "This action cannot be undone!"
                        )) {
                          handleDeleteAccount();
                        }
                      }}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete My Account'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="nb-main">
      <section className="nb-section">
        <div className="nb-card" style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #e0e0e0", marginBottom: 24 }}>
            <button
              onClick={() => setActiveTab("generations")}
              style={{
                padding: "8px 16px",
                background: activeTab === "generations" ? "#333" : "transparent",
                color: activeTab === "generations" ? "white" : "#666",
                border: "none",
                cursor: "pointer",
                fontSize: "1em",
              }}
            >
              Generations
            </button>
            <button
              onClick={() => setActiveTab("account")}
              style={{
                padding: "8px 16px",
                background: activeTab === "account" ? "#333" : "transparent",
                color: activeTab === "account" ? "white" : "#666",
                border: "none",
                cursor: "pointer",
                fontSize: "1em",
              }}
            >
              Account
            </button>
          </div>

          {activeTab === "generations" && <GenerationsList onRefresh={() => refetch()} />}

          {activeTab === "account" && (
            <>
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

                  <div className="nb-card" style={{ background: "#fff", borderColor: "#d32f2f" }}>
                    <div className="nb-feature-title" style={{ color: "#d32f2f" }}>Delete Account</div>
                    <p className="nb-muted" style={{ marginBottom: 16 }}>
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <button
                      className="nb-btn"
                      style={{ background: "#d32f2f", color: "white", opacity: isDeleting ? 0.6 : 1 }}
                      disabled={isDeleting}
                      onClick={() => {
                        if (window.confirm(
                          "Are you sure you want to delete your account?\n\n" +
                          "This will permanently delete:\n" +
                          "• All your templates\n" +
                          "• All your generated thumbnails\n" +
                          "• All your settings and preferences\n" +
                          "• Your billing information\n\n" +
                          "This action cannot be undone!"
                        )) {
                          handleDeleteAccount();
                        }
                      }}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete My Account'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}

