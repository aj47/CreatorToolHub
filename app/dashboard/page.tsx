"use client";
import { useMemo, useState, useEffect } from "react";
import { useCustomer } from "autumn-js/react";
import { useHybridStorage } from "@/lib/storage/useHybridStorage";
import { CloudGeneration } from "@/lib/storage/client";
import AuthGuard from "@/components/AuthGuard";
import { Textarea } from "@/components/ui/textarea";

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
            <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
              <div>
                <h2 className="nb-feature-title">Recent Generations</h2>
                <p className="nb-muted">Your latest thumbnail generations</p>
              </div>
              <button
                onClick={handleRefreshGenerations}
                disabled={hybridStorage.isLoading}
                className="nb-btn nb-btn--accent"
              >
                {hybridStorage.isLoading ? "Loading..." : "Refresh"}
              </button>
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 mb-6">
                  {hybridStorage.generations.slice(0, 6).map((gen) => {
                    const preview = gen.preview_url || gen.outputs?.[0]?.url;
                    return (
                      <div
                        key={gen.id}
                        className="nb-card cursor-pointer transition-transform hover:-translate-y-1 p-0 overflow-hidden"
                        onClick={() => setSelectedGeneration(gen)}
                      >
                        {preview ? (
                          <div className="relative w-full h-[160px] overflow-hidden bg-gray-100">
                            <img
                              src={preview}
                              alt={gen.prompt ? gen.prompt.slice(0, 60) : `Generation ${gen.id}`}
                              className="w-full h-full object-cover"
                            />
                            <div
                              className="absolute top-2 right-2 px-3 py-1 rounded text-white text-xs font-semibold uppercase"
                              style={{ backgroundColor: getStatusColor(gen.status) }}
                            >
                              {gen.status}
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-[160px] flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                            <span>No preview</span>
                          </div>
                        )}

                        <div className="p-4">
                          <div className="text-[13px] font-semibold text-[var(--nb-fg)] mb-2">
                            {new Date(gen.created_at).toLocaleDateString()} at{" "}
                            {new Date(gen.created_at).toLocaleTimeString()}
                          </div>
                          <div className="text-xs text-gray-600 mb-2">
                            Variants: {gen.outputs?.length ?? gen.variants_requested ?? 0}
                          </div>
                          {gen.prompt && (
                            <div className="text-xs text-gray-600 leading-relaxed">
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
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="nb-card max-w-[900px] w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center pb-6 border-b-3 border-[var(--nb-border)] mb-6">
          <h2 className="text-2xl font-bold text-[var(--nb-fg)]">Generation Details</h2>
          <button
            onClick={onClose}
            className="text-4xl leading-none text-gray-600 hover:text-gray-900 w-8 h-8 flex items-center justify-center border-0 bg-transparent cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Modal Content */}
        <div className="space-y-4">
          <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
            <strong className="text-[var(--nb-fg)]">Created:</strong>
            <span>
              {new Date(generation.created_at).toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
            <strong className="text-[var(--nb-fg)]">Status:</strong>
            <span style={{
              color: generation.status === "complete" ? "#28a745" :
                     generation.status === "failed" ? "#dc3545" : "#6c757d"
            }}>
              {generation.status}
            </span>
          </div>
          {generation.error_message && (
            <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
              <strong className="text-[var(--nb-fg)]">Error:</strong>
              <span className="text-red-600">{generation.error_message}</span>
            </div>
          )}
          <div className="grid grid-cols-[120px_1fr] gap-4 items-start">
            <strong className="text-[var(--nb-fg)]">Prompt:</strong>
            <p className="m-0 leading-relaxed text-gray-600">{generation.prompt}</p>
          </div>

          {/* Outputs */}
          {generation.outputs && generation.outputs.length > 0 && (
            <div className="mt-8 pt-6 border-t-3 border-[var(--nb-border)]">
              <strong className="block mb-4 text-lg text-[var(--nb-fg)]">
                Generated Images ({generation.outputs.length}):
              </strong>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 mb-8">
                {generation.outputs.map((output, index) => (
                  <div key={output.id} className="nb-card p-0 overflow-hidden">
                    <img
                      src={output.url}
                      alt={`Variant ${index + 1}`}
                      className="w-full h-[150px] object-cover block"
                    />
                    <div className="flex flex-col gap-2 p-2">
                      <button
                        onClick={() => handleDownload(output.url!, index)}
                        disabled={downloadingIndex === index}
                        className="nb-btn nb-btn--accent w-full"
                      >
                        {downloadingIndex === index ? "Downloading..." : "Download"}
                      </button>
                      <button
                        onClick={() => handleCopy(output.url!, index)}
                        disabled={copyingIndex === index}
                        className="nb-btn w-full"
                      >
                        {copyingIndex === index ? "Copying..." : "Copy"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Refinement Section */}
              <div className="mt-8 pt-6 border-t-3 border-[var(--nb-border)]">
                <h3 className="text-lg font-bold text-[var(--nb-fg)] mb-2">Refine a Variant</h3>
                <p className="nb-muted text-sm mb-4">
                  Enter feedback to refine any of the variants above
                </p>
                <Textarea
                  value={feedbackPrompt}
                  onChange={(e) => setFeedbackPrompt(e.target.value)}
                  placeholder="e.g., make the text larger, change background to blue, add more contrast..."
                  disabled={isRefining}
                  rows={3}
                  className="border-3 border-[var(--nb-border)] mb-4"
                />
                {refinementError && (
                  <div className="text-red-600 text-sm mb-4">
                    {refinementError}
                  </div>
                )}
                <div className="flex gap-3 flex-wrap">
                  {generation.outputs.map((output, index) => (
                    <button
                      key={output.id}
                      onClick={() => handleRefine(output.url!, index)}
                      disabled={isRefining || !feedbackPrompt.trim()}
                      className="nb-btn"
                      style={{
                        background: isRefining || !feedbackPrompt.trim() ? "#6c757d" : "#28a745",
                        color: "white",
                        opacity: isRefining || !feedbackPrompt.trim() ? 0.6 : 1
                      }}
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

