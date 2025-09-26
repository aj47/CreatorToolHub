"use client";

import { useState, useEffect } from "react";
import { useHybridStorage } from "@/lib/storage/useHybridStorage";
import { CloudGeneration } from "@/lib/storage/client";
import AuthGuard from "@/components/AuthGuard";
import styles from "./page.module.css";

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
    <div className={styles.container}>
      <main className={styles.main}>
        <AuthGuard>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Generation History</h1>
              <p className={styles.subtitle}>
                Browse and access all your past thumbnail generations
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={hybridStorage.isLoading}
              className={styles.refreshButton}
            >
              {hybridStorage.isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Filters */}
          <div className={styles.filters}>
            <div className={styles.filterGroup}>
              <label htmlFor="status-filter">Status:</label>
              <select 
                id="status-filter"
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
                className={styles.select}
              >
                <option value="all">All</option>
                <option value="complete">Complete</option>
                <option value="failed">Failed</option>
                <option value="running">Running</option>
                <option value="pending">Pending</option>
              </select>
            </div>
            <div className={styles.filterGroup}>
              <label htmlFor="search-input">Search:</label>
              <input
                id="search-input"
                type="text"
                placeholder="Search by prompt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          {/* Generations Grid */}
          {!hybridStorage.isCloudEnabled ? (
            <div className={styles.emptyState}>
              <p>Please sign in to view your generation history.</p>
            </div>
          ) : filteredGenerations.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No generations found.</p>
              {hybridStorage.generations.length > 0 && (
                <p className={styles.emptyHint}>
                  Try adjusting your filters or search query.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className={styles.grid}>
                {filteredGenerations.map((gen) => {
                  const preview = gen.preview_url || gen.outputs?.[0]?.url;
                  return (
                    <div
                      key={gen.id}
                      className={styles.card}
                      onClick={() => handleSelectGeneration(gen)}
                    >
                      {/* Preview Image */}
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

                      {/* Generation Info */}
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

              {/* Load More Button */}
              {hasMore && statusFilter === "all" && searchQuery === "" && (
                <div className={styles.loadMoreContainer}>
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore || hybridStorage.isLoading}
                    className={styles.loadMoreButton}
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
                    <button
                      onClick={() => handleDownload(output.url!, index)}
                      className={styles.downloadButton}
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
