"use client";

import { useState, useEffect, useCallback } from "react";
import { CloudGeneration } from "@/lib/storage/client";
import GenerationDetail from "./GenerationDetail";
import styles from "./GenerationsList.module.css";

const PAGE_SIZE = 12;

interface GenerationsListProps {
  onRefresh?: () => void;
}

export default function GenerationsList({ onRefresh }: GenerationsListProps) {
  const [generations, setGenerations] = useState<CloudGeneration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGeneration, setSelectedGeneration] = useState<CloudGeneration | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchGenerations = useCallback(async (before?: string, append = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({ limit: String(PAGE_SIZE + 1) }); // +1 to check if there are more
      if (before) {
        params.set('before', before);
      }

      const response = await fetch(`/api/user/generations?${params}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch generations: ${response.statusText}`);
      }

      const data: CloudGeneration[] = await response.json();

      // Check if there are more results
      const hasMoreResults = data.length > PAGE_SIZE;
      setHasMore(hasMoreResults);

      // Only keep PAGE_SIZE items
      const pageData = hasMoreResults ? data.slice(0, PAGE_SIZE) : data;

      if (append) {
        setGenerations(prev => [...prev, ...pageData]);
      } else {
        setGenerations(pageData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load generations");
      if (!append) {
        setGenerations([]);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  const handleLoadMore = useCallback(() => {
    if (generations.length > 0 && hasMore && !isLoadingMore) {
      const lastGeneration = generations[generations.length - 1];
      fetchGenerations(lastGeneration.created_at, true);
    }
  }, [generations, hasMore, isLoadingMore, fetchGenerations]);

  const handleDelete = async (generationId: string) => {
    if (!confirm("Are you sure you want to delete this generation?")) return;

    try {
      const url = `/api/user/generations/${generationId}`;

      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete generation");
      }

      setGenerations((prev) => prev.filter((g) => g.id !== generationId));
      setSelectedGeneration(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete generation");
    }
  };

  const handleRefresh = () => {
    fetchGenerations();
    onRefresh?.();
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading generations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <p>{error}</p>
          <button className="nb-btn" onClick={handleRefresh}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.empty}>
          <p>No generations yet. Start by creating a thumbnail or SEO content!</p>
          <div style={{ marginTop: 16 }}>
            <a className="nb-btn nb-btn--accent" href="/thumbnails">
              Create Thumbnail
            </a>
            <a className="nb-btn" href="/video-seo" style={{ marginLeft: 8 }}>
              Generate SEO Content
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className="nb-feature-title">Generation History</h2>
        <button className="nb-btn" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <div className={styles.grid}>
        {generations.map((generation) => (
          <div
            key={generation.id}
            className={styles.card}
            onClick={() => setSelectedGeneration(generation)}
          >
            {generation.preview_url && (
              <div className={styles.preview}>
                <img src={generation.preview_url} alt="Generation preview" />
              </div>
            )}
            <div className={styles.content}>
              <div className={styles.meta}>
                <span className={`nb-badge ${styles[`status-${generation.status}`]}`}>
                  {generation.status}
                </span>
                <span className="nb-muted" style={{ fontSize: "0.85em" }}>
                  {new Date(generation.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className={styles.prompt}>{generation.prompt}</p>
              <div className={styles.stats}>
                <span>{generation.outputs?.length || 0} outputs</span>
                {generation.model && (
                  <span title="AI Model(s) used">
                    • {generation.model.split(',').map(m =>
                      m === 'gemini' ? 'Gemini' :
                      m === 'fal-flux' ? 'Flux' :
                      m === 'fal-qwen' ? 'Qwen' : m
                    ).join(', ')}
                  </span>
                )}
                {generation.template_name && (
                  <span title="Template used">• {generation.template_name}</span>
                )}
                {generation.refinement_prompt && (
                  <span title="Refinement applied">• Refined</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {hasMore && (
        <div className={styles.pagination}>
          <button
            className="nb-btn"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {!hasMore && generations.length > 0 && (
        <div className={styles.pagination}>
          <span className="nb-muted">All generations loaded</span>
        </div>
      )}

      {selectedGeneration && (
        <GenerationDetail
          generation={selectedGeneration}
          onClose={() => setSelectedGeneration(null)}
          onDelete={() => {
            handleDelete(selectedGeneration.id);
          }}
        />
      )}
    </div>
  );
}

