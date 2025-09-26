"use client";
import { useMemo, useState, useEffect } from "react";
import { useCustomer } from "autumn-js/react";
import { useHybridStorage } from "@/lib/storage/useHybridStorage";
import { CloudGeneration, CloudGenerationOutput } from "@/lib/storage/client";
import AuthGuard from "@/components/AuthGuard";

import ThumbnailRefinement from "@/components/ThumbnailRefinement";
import { RefinementState, RefinementHistory, RefinementUtils } from "@/lib/types/refinement";
import { useRefinementHistory } from "@/lib/hooks/useRefinementHistory";
import { useAuth } from "@/lib/auth/AuthProvider";

const FEATURE_ID = process.env.NEXT_PUBLIC_AUTUMN_THUMBNAIL_FEATURE_ID || "credits";

// Safe wrapper component for dashboard that handles Autumn provider
function DashboardContent() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hybridStorage = useHybridStorage();

  // State for download/copy operations
  const [copyingIndex, setCopyingIndex] = useState<string | null>(null);
  const [downloadingIndex, setDownloadingIndex] = useState<string | null>(null);

  // Authentication
  const { user } = useAuth();
  const isAuthenticated = isDevelopment || !!user; // In development, always consider authenticated

  // Refinement history management
  const refinementHistory = useRefinementHistory();

  // Refinement state - track which thumbnail is being refined
  const [refinementState, setRefinementState] = useState<RefinementState>({
    isRefinementMode: false,
    histories: [],
    isRefining: false,
    feedbackPrompt: "",
    isCopying: false,
    isDownloading: false,
  });

  // Track which specific thumbnail is in refinement mode (generation-output pair)
  const [refiningThumbnail, setRefiningThumbnail] = useState<{
    generationId: string;
    outputId: string;
  } | null>(null);


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

  // Sync refinement histories from persistent storage
  useEffect(() => {
    if (!refinementHistory.isLoading) {
      setRefinementState(prev => ({
        ...prev,
        histories: refinementHistory.histories,
      }));
    }
  }, [refinementHistory.histories, refinementHistory.isLoading]);

  // Helper function to find existing refinement history for a generation output
  const findExistingRefinementHistory = (generationId: string, outputId: string): RefinementHistory | undefined => {
    // Look for histories that match this generation and output
    // We'll use a combination of generation ID and output ID to create a unique identifier
    const searchKey = `${generationId}-${outputId}`;
    return refinementState.histories.find(history =>
      history.originalGenerationId === searchKey
    );
  };



  // Download handler for individual thumbnails
  const handleDownload = async (url: string, index: string) => {
    setDownloadingIndex(index);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `thumbnail-${index}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setDownloadingIndex(null);
    }
  };

  // Copy handler for individual thumbnails
  const handleCopy = async (url: string, index: string) => {
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

      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback: try to copy the URL as text
      try {
        await navigator.clipboard.writeText(url);
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
    } finally {
      setCopyingIndex(null);
    }
  };

  // Refine handler - creates refinement history and enters refinement mode
  const handleRefineClick = async (generation: CloudGeneration, output: CloudGenerationOutput, index: number) => {
    if (!isAuthenticated) {
      // Redirect to sign in if not authenticated
      window.location.href = '/auth/signin';
      return;
    }

    // Check for existing refinement history first
    const existingHistory = findExistingRefinementHistory(generation.id, output.id);

    if (existingHistory) {
      // Use existing history
      setRefinementState({
        isRefinementMode: true,
        selectedThumbnailIndex: index,
        selectedThumbnailUrl: output.url!,
        currentHistory: existingHistory,
        histories: refinementState.histories,
        isRefining: false,
        feedbackPrompt: "",
        isCopying: false,
        isDownloading: false,
      });
      setRefiningThumbnail({ generationId: generation.id, outputId: output.id });
      return;
    }

    try {
      // Convert the output URL to base64 data for refinement
      let thumbnailData: string;
      const thumbnailUrl = output.url!;

      if (output.url!.startsWith('data:')) {
        thumbnailData = RefinementUtils.dataUrlToBase64(output.url!);
      } else if (isDevelopment && output.url!.includes('picsum.photos')) {
        // In development mode, for external URLs that can't be fetched due to CORS,
        // create a placeholder base64 for API calls but keep the original URL for display
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Create a simple placeholder for API calls
          ctx.fillStyle = '#f0f0f0';
          ctx.fillRect(0, 0, 1280, 720);
        }

        const placeholderDataUrl = canvas.toDataURL('image/png');
        thumbnailData = RefinementUtils.dataUrlToBase64(placeholderDataUrl);
        // Keep the original picsum.photos URL for display - don't override thumbnailUrl
      } else {
        // Try to fetch the image and convert to base64
        const response = await fetch(output.url!);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            resolve(RefinementUtils.dataUrlToBase64(result));
          };
          reader.readAsDataURL(blob);
        });
        thumbnailData = base64;
      }

      // Create refinement history from the selected thumbnail
      const history = RefinementUtils.createHistoryFromThumbnail(
        thumbnailUrl,
        thumbnailData,
        generation.prompt,
        generation.template_id || 'default'
      );

      // Set the originalGenerationId to link this history to the generation output
      const searchKey = `${generation.id}-${output.id}`;
      history.originalGenerationId = searchKey;

      // Enter refinement mode
      setRefinementState({
        isRefinementMode: true,
        selectedThumbnailIndex: index,
        selectedThumbnailUrl: thumbnailUrl,
        currentHistory: history,
        histories: [...refinementState.histories, history],
        isRefining: false,
        feedbackPrompt: "",
        isCopying: false,
        isDownloading: false,
      });
      setRefiningThumbnail({ generationId: generation.id, outputId: output.id });
    } catch (error) {
      console.error('Failed to prepare thumbnail for refinement:', error);
      // Could add error state here if needed
    }
  };

  // Handle refinement state updates
  const handleUpdateRefinementState = (update: Partial<RefinementState>) => {
    setRefinementState(prev => {
      const newState = { ...prev, ...update };

      // If currentHistory is updated, save it to persistent storage (skip in development)
      if (update.currentHistory && process.env.NODE_ENV !== 'development') {
        try {
          refinementHistory.saveHistory(update.currentHistory);
        } catch (error) {
          console.error('Storage quota exceeded, attempting cleanup:', error);
          // Try to clean up storage and retry
          RefinementUtils.cleanupStorage();
          try {
            refinementHistory.saveHistory(update.currentHistory);
          } catch (retryError) {
            console.error('Failed to save even after cleanup:', retryError);
            // Could add error state here if needed
          }
        }
      }

      return newState;
    });
  };

  // Exit refinement mode
  const handleExitRefinementMode = () => {
    setRefinementState(prev => ({
      ...prev,
      isRefinementMode: false,
      selectedThumbnailIndex: undefined,
      selectedThumbnailUrl: undefined,
      currentHistory: undefined,
      feedbackPrompt: "",
      refinementError: undefined,
    }));
    setRefiningThumbnail(null);
  };

  // Auth required handler
  const handleAuthRequired = () => {
    window.location.href = '/auth/signin';
  };

  // Show development mode notice but still render the full dashboard
  const showDevNotice = isDevelopment;

  return (
    <main className="nb-main">
      <section className="nb-section">
        <div className="nb-card" style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 className="nb-feature-title">Your account</h2>
          {showDevNotice && (
            <div className="nb-card" style={{ background: "#e3f2fd", border: "1px solid #2196f3", marginBottom: "1rem" }}>
              <p style={{ margin: 0, color: "#1976d2" }}>
                <strong>Development Mode:</strong> Using mock credits (999) and test data. Autumn billing is disabled.
              </p>
            </div>
          )}
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
            <div className="mb-6">
              <h2 className="nb-feature-title">Recent Generations</h2>
              <p className="nb-muted">Your latest thumbnail generations</p>
            </div>

            {!hybridStorage.isCloudEnabled ? (
              <div className="text-center py-12 text-gray-600">
                <p className="text-lg">Please sign in to view your generation history.</p>
              </div>
            ) : hybridStorage.generations.length === 0 ? (
              <div className="text-center py-12 text-gray-600">
                <p className="text-lg">No generations yet. Create your first thumbnail!</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {hybridStorage.generations.slice(0, 6).flatMap((gen) => {
                    // Show all outputs for each generation, similar to thumbnail page
                    if (!gen.outputs || gen.outputs.length === 0) {
                      // Show placeholder if no outputs
                      const preview = gen.preview_url;
                      return [(
                        <div
                          key={gen.id}
                          style={{
                            border: "1px solid #ddd",
                            padding: 8,
                            borderRadius: 8,
                            maxWidth: 320
                          }}
                        >
                          {preview ? (
                            <img src={preview} alt={`Generation ${gen.id}`} style={{ width: 320 }} />
                          ) : (
                            <div style={{ width: 320, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5', color: '#666', fontSize: 14 }}>
                              No preview available
                            </div>
                          )}
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                              {new Date(gen.created_at).toLocaleDateString()} at{" "}
                              {new Date(gen.created_at).toLocaleTimeString()}
                            </div>
                            {gen.prompt && (
                              <div style={{ fontSize: 12, color: '#666', lineHeight: 1.4 }}>
                                {gen.prompt.length > 60
                                  ? `${gen.prompt.substring(0, 60)}...`
                                  : gen.prompt}
                              </div>
                            )}
                          </div>
                        </div>
                      )];
                    }

                    // Show each output as a separate thumbnail, similar to thumbnail page results
                    return gen.outputs.map((output, index) => {
                      // Check if this specific thumbnail is being refined
                      const isRefining = refiningThumbnail?.generationId === gen.id && refiningThumbnail?.outputId === output.id;

                      if (isRefining && refinementState.isRefinementMode) {
                        // Show refinement interface in place of the thumbnail
                        return (
                          <div
                            key={`${gen.id}-${output.id}-refining`}
                            style={{
                              border: "2px solid var(--nb-accent)",
                              padding: 16,
                              borderRadius: 8,
                              maxWidth: 600,
                              backgroundColor: "#f9f9f9"
                            }}
                          >
                            <div style={{ marginBottom: 16 }}>
                              <h4 style={{ margin: "0 0 8px 0", color: "var(--nb-accent)" }}>Refining Thumbnail</h4>
                              <button
                                onClick={handleExitRefinementMode}
                                style={{
                                  padding: "4px 8px",
                                  border: "1px solid #ccc",
                                  borderRadius: 4,
                                  backgroundColor: "white",
                                  cursor: "pointer",
                                  fontSize: 12
                                }}
                              >
                                ← Back to Gallery
                              </button>
                            </div>
                            <ThumbnailRefinement
                              refinementState={refinementState}
                              onUpdateRefinementState={handleUpdateRefinementState}
                              originalPrompt={refinementState.currentHistory?.originalPrompt || gen.prompt}
                              templateId={refinementState.currentHistory?.templateId || gen.template_id || "default"}
                              credits={credits}
                              isAuthed={isAuthenticated}
                              onAuthRequired={handleAuthRequired}
                            />
                          </div>
                        );
                      }

                      // Show normal thumbnail
                      return (
                        <div
                          key={`${gen.id}-${output.id}`}
                          style={{
                            border: "1px solid #ddd",
                            padding: 8,
                            borderRadius: 8,
                            maxWidth: 320
                          }}
                        >
                          <img src={output.url} alt={`Generation ${gen.id} - Variant ${index + 1}`} style={{ width: 320 }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          <button
                            onClick={() => handleDownload(output.url!, `${gen.id}-${index}`)}
                            disabled={downloadingIndex === `${gen.id}-${index}`}
                            style={{
                              padding: "6px 12px",
                              border: "2px solid var(--nb-border)",
                              borderRadius: 6,
                              backgroundColor: "var(--nb-card)",
                              color: "var(--nb-fg)",
                              cursor: downloadingIndex === `${gen.id}-${index}` ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 500,
                              opacity: downloadingIndex === `${gen.id}-${index}` ? 0.6 : 1,
                              transition: "all 0.2s ease"
                            }}
                            onMouseOver={(e) => {
                              if (!downloadingIndex) {
                                e.currentTarget.style.backgroundColor = "var(--nb-accent)";
                                e.currentTarget.style.color = "white";
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!downloadingIndex) {
                                e.currentTarget.style.backgroundColor = "var(--nb-card)";
                                e.currentTarget.style.color = "var(--nb-fg)";
                              }
                            }}
                          >
                            {downloadingIndex === `${gen.id}-${index}` ? "Downloading..." : "Download"}
                          </button>
                          <button
                            onClick={() => handleCopy(output.url!, `${gen.id}-${index}`)}
                            disabled={copyingIndex === `${gen.id}-${index}`}
                            style={{
                              padding: "6px 12px",
                              border: "2px solid var(--nb-border)",
                              borderRadius: 6,
                              backgroundColor: "var(--nb-card)",
                              color: "var(--nb-fg)",
                              cursor: copyingIndex === `${gen.id}-${index}` ? "not-allowed" : "pointer",
                              fontSize: 12,
                              fontWeight: 500,
                              opacity: copyingIndex === `${gen.id}-${index}` ? 0.6 : 1,
                              transition: "all 0.2s ease"
                            }}
                            onMouseOver={(e) => {
                              if (!copyingIndex) {
                                e.currentTarget.style.backgroundColor = "var(--nb-accent)";
                                e.currentTarget.style.color = "white";
                              }
                            }}
                            onMouseOut={(e) => {
                              if (!copyingIndex) {
                                e.currentTarget.style.backgroundColor = "var(--nb-card)";
                                e.currentTarget.style.color = "var(--nb-fg)";
                              }
                            }}
                          >
                            {copyingIndex === `${gen.id}-${index}` ? "Copying..." : "Copy"}
                          </button>
                          <button
                            onClick={() => handleRefineClick(gen, output, index)}
                            style={{
                              padding: "6px 12px",
                              border: "2px solid var(--nb-border)",
                              borderRadius: 6,
                              backgroundColor: "var(--nb-card)",
                              color: "var(--nb-fg)",
                              cursor: "pointer",
                              fontSize: 12,
                              fontWeight: 500,
                              transition: "all 0.2s ease"
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--nb-accent)";
                              e.currentTarget.style.color = "white";
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = "var(--nb-card)";
                              e.currentTarget.style.color = "var(--nb-fg)";
                            }}
                          >
                            Refine
                          </button>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
                            {new Date(gen.created_at).toLocaleDateString()} at{" "}
                            {new Date(gen.created_at).toLocaleTimeString()}
                          </div>
                          <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
                            Variant {index + 1} of {gen.outputs?.length || 0}
                          </div>
                          {gen.prompt && (
                            <div style={{ fontSize: 11, color: '#666', lineHeight: 1.3 }}>
                              {gen.prompt.length > 50
                                ? `${gen.prompt.substring(0, 50)}...`
                                : gen.prompt}
                            </div>
                          )}
                        </div>
                      </div>
                      );
                    });
                  })}
                </div>

                {hybridStorage.generations.length > 6 && (
                  <div className="text-center mt-4">
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


    </main>
  );
}


export default function DashboardPage() {
  return <DashboardContent />;
}

