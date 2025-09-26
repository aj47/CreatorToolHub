"use client";
import { useMemo, useState, useEffect } from "react";
import { useCustomer } from "autumn-js/react";
import { useHybridStorage } from "@/lib/storage/useHybridStorage";
import { CloudGeneration } from "@/lib/storage/client";
import AuthGuard from "@/components/AuthGuard";
import styles from "./page.module.css";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

// Safe wrapper component for dashboard that handles Autumn provider
function DashboardContent() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hybridStorage = useHybridStorage();
  const [selectedGeneration, setSelectedGeneration] = useState<CloudGeneration | null>(null);

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

  // Initial load of generations
  useEffect(() => {
    if (hybridStorage.isCloudEnabled && hybridStorage.generations.length === 0) {
      hybridStorage.refreshGenerations({ limit: 10 });
    }
  }, [hybridStorage.isCloudEnabled, hybridStorage.generations.length, hybridStorage]);

  const handleRefreshGenerations = async () => {
    await hybridStorage.refreshGenerations({ limit: 10 });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "complete": return "#28a745";
      case "failed": return "#dc3545";
      case "running": return "#ffc107";
      case "pending": return "#6c757d";
      default: return "#6c757d";
    }
  };

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
        <div className="nb-card" style={{ maxWidth: 1400, margin: "0 auto" }}>
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

        {/* Recent Generations Section */}
        <AuthGuard>
          <div className="nb-card" style={{ maxWidth: 1400, margin: "2rem auto 0" }}>
            <div className={styles.generationsHeader}>
              <div>
                <h2 className="nb-feature-title">Recent Generations</h2>
                <p className="nb-muted">Your latest thumbnail generations</p>
              </div>
              <button
                onClick={handleRefreshGenerations}
                disabled={hybridStorage.isLoading}
                className={styles.refreshButton}
              >
                {hybridStorage.isLoading ? "Loading..." : "Refresh"}
              </button>
            </div>

            {!hybridStorage.isCloudEnabled ? (
              <div className={styles.emptyState}>
                <p>Please sign in to view your generation history.</p>
              </div>
            ) : hybridStorage.generations.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No generations yet. Create your first thumbnail!</p>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {hybridStorage.generations.slice(0, 6).map((gen) => {
                    const preview = gen.preview_url || gen.outputs?.[0]?.url;
                    return (
                      <div
                        key={gen.id}
                        className={styles.card}
                        onClick={() => setSelectedGeneration(gen)}
                      >
                        {preview ? (
                          <div className={styles.imageContainer}>
                            <img
                              src={preview}
                              alt={gen.prompt ? gen.prompt.slice(0, 60) : `Generation ${gen.id}`}
                              className={styles.image}
                            />
                            <div
                              className={styles.statusBadge}
                              style={{ backgroundColor: getStatusColor(gen.status) }}
                            >
                              {gen.status}
                            </div>
                          </div>
                        ) : (
                          <div className={styles.noPreview}>
                            <span>No preview</span>
                          </div>
                        )}

                        <div className={styles.cardContent}>
                          <div className={styles.date}>
                            {new Date(gen.created_at).toLocaleDateString()} at{" "}
                            {new Date(gen.created_at).toLocaleTimeString()}
                          </div>
                          <div className={styles.meta}>
                            Variants: {gen.outputs?.length ?? gen.variants_requested ?? 0}
                          </div>
                          {gen.prompt && (
                            <div className={styles.prompt}>
                              {gen.prompt.length > 80
                                ? `${gen.prompt.substring(0, 80)}...`
                                : gen.prompt}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hybridStorage.generations.length > 6 && (
                  <div style={{ textAlign: "center", marginTop: "1rem" }}>
                    <a href="/generations" className="nb-btn">
                      View All Generations
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </AuthGuard>
      </section>

      {/* Generation Detail Modal */}
      {selectedGeneration && (
        <GenerationDetailModal
          generation={selectedGeneration}
          onClose={() => setSelectedGeneration(null)}
        />
      )}
    </main>
  );
}

// Generation Detail Modal Component with Copy, Download, and Refinement
function GenerationDetailModal({
  generation,
  onClose,
}: {
  generation: CloudGeneration;
  onClose: () => void;
}) {
  const [copyingIndex, setCopyingIndex] = useState<number | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refinementError, setRefinementError] = useState<string | null>(null);

  const handleDownload = async (url: string, index: number) => {
    setDownloadingIndex(index);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `generation-${generation.id}-variant-${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to download image:", error);
    } finally {
      setDownloadingIndex(null);
    }
  };

  const handleCopy = async (url: string, index: number) => {
    setCopyingIndex(index);
    try {
      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error('Clipboard API not available');
      }

      let blob: Blob;
      if (url.startsWith('data:')) {
        // Convert data URL to blob
        const [head, b64raw] = url.split(",");
        const mime = /^data:([^;]+);base64$/i.exec(head || "")?.[1] || "image/png";
        const b64 = (b64raw || "").replace(/[^A-Za-z0-9+/=]/g, "");
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes], { type: mime });
      } else {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
        blob = await resp.blob();
      }

      if (!blob || blob.size === 0) {
        throw new Error('Invalid image data');
      }

      const mimeType = blob.type || 'image/png';
      const clipboardItem = new ClipboardItem({ [mimeType]: blob });
      await navigator.clipboard.write([clipboardItem]);
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        }
      } catch (fallbackError) {
        console.error('Clipboard fallback also failed:', fallbackError);
      }
    } finally {
      setCopyingIndex(null);
    }
  };

  const handleRefine = async (imageUrl: string, index: number) => {
    if (!feedbackPrompt.trim()) {
      setRefinementError("Please enter feedback for the refinement.");
      return;
    }

    setIsRefining(true);
    setRefinementError(null);

    try {
      // Fetch the image and convert to base64
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1] || '';
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const refinementRequest = {
        baseImageUrl: imageUrl,
        baseImageData: base64Data,
        originalPrompt: generation.prompt,
        feedbackPrompt: feedbackPrompt,
        templateId: generation.template_id,
        parentIterationId: `${generation.id}-${index}`,
      };

      const refineResponse = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refinementRequest),
      });

      if (!refineResponse.ok) {
        const errorData = await refineResponse.json();
        throw new Error(errorData.error || "Refinement failed");
      }

      await refineResponse.json();

      // Success - could redirect to thumbnails page or show success message
      alert("Refinement successful! Check your thumbnails page for the result.");
      setFeedbackPrompt("");
      onClose();
    } catch (error) {
      console.error("Refinement error:", error);
      setRefinementError(error instanceof Error ? error.message : "Refinement failed");
    } finally {
      setIsRefining(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Generation Details</h2>
          <button onClick={onClose} className={styles.closeButton}>
            ×
          </button>
        </div>

        <div className={styles.modalContent}>
          <div className={styles.detailRow}>
            <strong>Created:</strong>
            <span>
              {new Date(generation.created_at).toLocaleString()}
            </span>
          </div>
          <div className={styles.detailRow}>
            <strong>Status:</strong>
            <span style={{
              color: generation.status === "complete" ? "#28a745" :
                     generation.status === "failed" ? "#dc3545" : "#6c757d"
            }}>
              {generation.status}
            </span>
          </div>
          {generation.error_message && (
            <div className={styles.detailRow}>
              <strong>Error:</strong>
              <span style={{ color: "#dc3545" }}>{generation.error_message}</span>
            </div>
          )}
          <div className={styles.detailRow}>
            <strong>Prompt:</strong>
            <p className={styles.fullPrompt}>{generation.prompt}</p>
          </div>

          {/* Outputs */}
          {generation.outputs && generation.outputs.length > 0 && (
            <div className={styles.outputsSection}>
              <strong>Generated Images ({generation.outputs.length}):</strong>
              <div className={styles.outputsGrid}>
                {generation.outputs.map((output, index) => (
                  <div key={output.id} className={styles.outputCard}>
                    <img
                      src={output.url}
                      alt={`Variant ${index + 1}`}
                      className={styles.outputImage}
                    />
                    <div className={styles.outputActions}>
                      <button
                        onClick={() => handleDownload(output.url!, index)}
                        disabled={downloadingIndex === index}
                        className={styles.actionButton}
                      >
                        {downloadingIndex === index ? "Downloading..." : "Download"}
                      </button>
                      <button
                        onClick={() => handleCopy(output.url!, index)}
                        disabled={copyingIndex === index}
                        className={styles.actionButton}
                      >
                        {copyingIndex === index ? "Copying..." : "Copy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Refinement Section */}
              <div className={styles.refinementSection}>
                <h3>Refine a Variant</h3>
                <p className="nb-muted" style={{ fontSize: "14px", marginBottom: "12px" }}>
                  Enter feedback to refine any of the variants above
                </p>
                <textarea
                  value={feedbackPrompt}
                  onChange={(e) => setFeedbackPrompt(e.target.value)}
                  placeholder="e.g., make the text larger, change background to blue, add more contrast..."
                  className={styles.feedbackInput}
                  disabled={isRefining}
                  rows={3}
                />
                {refinementError && (
                  <div style={{ color: "#dc3545", fontSize: "14px", marginTop: "8px" }}>
                    {refinementError}
                  </div>
                )}
                <div className={styles.refinementButtons}>
                  {generation.outputs.map((output, index) => (
                    <button
                      key={output.id}
                      onClick={() => handleRefine(output.url!, index)}
                      disabled={isRefining || !feedbackPrompt.trim()}
                      className={styles.refineButton}
                    >
                      {isRefining ? "Refining..." : `Refine Variant ${index + 1}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}

