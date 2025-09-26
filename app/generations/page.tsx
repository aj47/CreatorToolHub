"use client";

import { useState, useEffect } from "react";
import { useHybridStorage } from "@/lib/storage/useHybridStorage";
import { CloudGeneration } from "@/lib/storage/client";
import AuthGuard from "@/components/AuthGuard";
import { Input } from "@/components/ui/input";

export default function GenerationsPage() {
  const hybridStorage = useHybridStorage();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedGeneration, setSelectedGeneration] = useState<CloudGeneration | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Initial load
  useEffect(() => {
    if (hybridStorage.isCloudEnabled && hybridStorage.generations.length === 0) {
      hybridStorage.refreshGenerations({ limit: 20 });
    }
  }, [hybridStorage.isCloudEnabled]);

  // Filter generations based on status and search
  const filteredGenerations = hybridStorage.generations.filter(gen => {
    const matchesStatus = statusFilter === "all" || gen.status === statusFilter;
    const matchesSearch = searchQuery === "" ||
      gen.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleRefresh = async () => {
    await hybridStorage.refreshGenerations({ limit: 20 });
  };

  const handleLoadMore = async () => {
    if (!hybridStorage.isCloudEnabled || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const lastGen = hybridStorage.generations[hybridStorage.generations.length - 1];
      if (lastGen) {
        await hybridStorage.refreshGenerations({
          limit: 20,
          before: lastGen.created_at
        });
        // If we got fewer than requested, there are no more
        setHasMore(hybridStorage.generations.length % 20 === 0);
      }
    } catch (error) {
      console.error("Failed to load more generations:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleSelectGeneration = (gen: CloudGeneration) => {
    setSelectedGeneration(gen);
  };

  const handleCloseDetail = () => {
    setSelectedGeneration(null);
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

  return (
    <div className="min-h-screen">
      <main className="max-w-[1400px] mx-auto px-4 py-8">
        <AuthGuard>
          {/* Header */}
          <div className="flex justify-between items-start mb-8 gap-4 flex-wrap">
            <div>
              <h1 className="text-4xl font-extrabold mb-2 text-[var(--nb-fg)]">Generation History</h1>
              <p className="text-lg text-gray-600">
                Browse and access all your past thumbnail generations
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={hybridStorage.isLoading}
              className="nb-btn nb-btn--accent"
            >
              {hybridStorage.isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Filters */}
          <div className="nb-card mb-8">
            <div className="flex gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <label htmlFor="status-filter" className="font-semibold text-[var(--nb-fg)]">
                  Status:
                </label>
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border-3 border-[var(--nb-border)] rounded-lg px-4 py-2 bg-white cursor-pointer"
                >
                  <option value="all">All</option>
                  <option value="complete">Complete</option>
                  <option value="failed">Failed</option>
                  <option value="running">Running</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[250px]">
                <label htmlFor="search-input" className="font-semibold text-[var(--nb-fg)]">
                  Search:
                </label>
                <Input
                  id="search-input"
                  type="text"
                  placeholder="Search by prompt..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border-3 border-[var(--nb-border)]"
                />
              </div>
            </div>
          </div>

          {/* Generations Grid */}
          {!hybridStorage.isCloudEnabled ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-xl">Please sign in to view your generation history.</p>
            </div>
          ) : filteredGenerations.length === 0 ? (
            <div className="text-center py-16 text-gray-600">
              <p className="text-xl mb-2">No generations found.</p>
              {hybridStorage.generations.length > 0 && (
                <p className="opacity-70">
                  Try adjusting your filters or search query.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-6 mb-8">
                {filteredGenerations.map((gen) => {
                  const preview = gen.preview_url || gen.outputs?.[0]?.url;
                  return (
                    <div
                      key={gen.id}
                      className="nb-card cursor-pointer transition-transform hover:-translate-y-1 p-0 overflow-hidden"
                      onClick={() => handleSelectGeneration(gen)}
                    >
                      {/* Preview Image */}
                      {preview ? (
                        <div className="relative w-full h-[180px] overflow-hidden bg-gray-100">
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
                        <div className="w-full h-[180px] flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
                          <span>No preview</span>
                        </div>
                      )}

                      {/* Generation Info */}
                      <div className="p-4">
                        <div className="text-sm font-semibold text-[var(--nb-fg)] mb-2">
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

              {/* Load More Button */}
              {hasMore && statusFilter === "all" && searchQuery === "" && (
                <div className="flex justify-center py-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore || hybridStorage.isLoading}
                    className="nb-btn"
                  >
                    {isLoadingMore || hybridStorage.isLoading ? "Loading..." : "Load More"}
                  </button>
                </div>
              )}
            </>
          )}
        </AuthGuard>
      </main>

      {/* Generation Detail Modal */}
      {selectedGeneration && (
        <GenerationDetailModal
          generation={selectedGeneration}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}

// Generation Detail Modal Component
function GenerationDetailModal({
  generation,
  onClose,
}: {
  generation: CloudGeneration;
  onClose: () => void;
}) {
  const handleDownload = async (url: string, index: number) => {
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
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                {generation.outputs.map((output, index) => (
                  <div key={output.id} className="nb-card p-0 overflow-hidden">
                    <img
                      src={output.url}
                      alt={`Variant ${index + 1}`}
                      className="w-full h-[150px] object-cover block"
                    />
                    <button
                      onClick={() => handleDownload(output.url!, index)}
                      className="nb-btn nb-btn--accent w-full rounded-none"
                    >
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
