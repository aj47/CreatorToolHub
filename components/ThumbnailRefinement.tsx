"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import styles from "@/app/thumbnails/page.module.css";
import {
  RefinementHistory,
  RefinementIteration,
  RefinementState,
  RefinementUIState,
  RefinementRequest,
  RefinementResponse,
  RefinementUtils
} from "@/lib/types/refinement";
import { enforceYouTubeDimensions, YOUTUBE_THUMBNAIL } from "@/lib/utils/thumbnailDimensions";

interface ThumbnailRefinementProps {
  refinementState: RefinementState;
  onUpdateRefinementState: (update: Partial<RefinementState>) => void;
  originalPrompt: string;
  templateId: string;
  credits: number;
  isAuthed: boolean;
  onAuthRequired: () => void;
}

export default function ThumbnailRefinement({
  refinementState,
  onUpdateRefinementState,
  originalPrompt,
  templateId,
  credits,
  isAuthed,
  onAuthRequired
}: ThumbnailRefinementProps) {
  const [uiState, setUIState] = useState<RefinementUIState>({
    showHistory: false,
    isHistoryExpanded: false,
  });

  const currentHistory = refinementState.currentHistory;
  const currentIteration = currentHistory ? RefinementUtils.getCurrentIteration(currentHistory) : undefined;

  // Handle refinement generation
  const handleRefine = useCallback(async () => {
    if (!isAuthed) {
      onAuthRequired();
      return;
    }

    if (!currentHistory || !currentIteration) {
      onUpdateRefinementState({ refinementError: "No thumbnail selected for refinement" });
      return;
    }

    if (credits < 1) {
      onUpdateRefinementState({ refinementError: "You need 1 credit to refine this thumbnail." });
      return;
    }

    if (!refinementState.feedbackPrompt.trim()) {
      onUpdateRefinementState({ refinementError: "Please enter feedback for the refinement." });
      return;
    }

    onUpdateRefinementState({ 
      isRefining: true, 
      refinementError: undefined 
    });

    try {
      // Ensure we have proper base64 data
      let baseImageData = currentIteration.imageData;

      if (!baseImageData || baseImageData.startsWith('blob:')) {
        // Convert blob URL or missing data to base64
        if (currentIteration.imageUrl.startsWith('blob:')) {
          // Convert blob URL to base64 using canvas method
          const img = new Image();
          img.crossOrigin = 'anonymous';

          baseImageData = await new Promise<string>((resolve, reject) => {
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  reject(new Error('Could not get canvas context'));
                  return;
                }

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const dataUrl = canvas.toDataURL('image/png');
                const base64Data = dataUrl.split(',')[1] || dataUrl;
                resolve(base64Data);
              } catch (error) {
                reject(error);
              }
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = currentIteration.imageUrl;
          });
        } else if (currentIteration.imageUrl.startsWith('data:')) {
          // Extract base64 data from data URL
          baseImageData = RefinementUtils.dataUrlToBase64(currentIteration.imageUrl);
        } else {
          throw new Error('Invalid image format for refinement');
        }
      }

      const request: RefinementRequest = {
        baseImageUrl: currentIteration.imageUrl,
        baseImageData,
        originalPrompt,
        feedbackPrompt: refinementState.feedbackPrompt,
        templateId,
        parentIterationId: currentIteration.id,
      };

      const response = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const result: RefinementResponse = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          onAuthRequired();
          return;
        }
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (!result.success || !result.iteration) {
        throw new Error(result.error || "Refinement failed");
      }

      // Enforce YouTube thumbnail dimensions on the refined image
      let processedIteration = result.iteration;
      try {
        if (result.iteration.imageData) {
          const processedBase64 = await enforceYouTubeDimensions(result.iteration.imageData, YOUTUBE_THUMBNAIL.QUALITY);
          const processedDataUrl = `data:${YOUTUBE_THUMBNAIL.MIME_TYPE};base64,${processedBase64}`;

          processedIteration = {
            ...result.iteration,
            imageData: processedBase64,
            imageUrl: processedDataUrl
          };
        }
      } catch (error) {
        // Continue with original iteration if dimension enforcement fails
      }

      // Add the new iteration to the current history
      const updatedHistory = RefinementUtils.addIteration(currentHistory, processedIteration);
      
      // Update refinement state
      onUpdateRefinementState({
        currentHistory: updatedHistory,
        histories: refinementState.histories.map(h => 
          h.id === updatedHistory.id ? updatedHistory : h
        ),
        feedbackPrompt: "", // Clear the feedback prompt
        refinementError: undefined,
      });

    } catch (error) {
      onUpdateRefinementState({
        refinementError: error instanceof Error ? error.message : "Refinement failed"
      });
    } finally {
      onUpdateRefinementState({ isRefining: false });
    }
  }, [
    isAuthed, 
    currentHistory, 
    currentIteration, 
    credits, 
    refinementState.feedbackPrompt, 
    refinementState.histories,
    originalPrompt, 
    templateId, 
    onAuthRequired, 
    onUpdateRefinementState
  ]);

  // Handle rollback to a previous iteration
  const handleRollback = useCallback((iterationId: string) => {
    if (!currentHistory) return;

    const updatedHistory = RefinementUtils.setCurrentIteration(currentHistory, iterationId);
    onUpdateRefinementState({
      currentHistory: updatedHistory,
      histories: refinementState.histories.map(h => 
        h.id === updatedHistory.id ? updatedHistory : h
      ),
    });

    setUIState(prev => ({ ...prev, showRollbackConfirm: undefined }));
  }, [currentHistory, refinementState.histories, onUpdateRefinementState]);

  // Handle starting a new refinement chain from a specific iteration
  const handleNewChainFromIteration = useCallback((iteration: RefinementIteration) => {
    const newHistory = RefinementUtils.createHistoryFromThumbnail(
      iteration.imageUrl,
      iteration.imageData || RefinementUtils.dataUrlToBase64(iteration.imageUrl),
      iteration.originalPrompt,
      iteration.templateId
    );

    onUpdateRefinementState({
      currentHistory: newHistory,
      histories: [...refinementState.histories, newHistory],
    });
  }, [refinementState.histories, onUpdateRefinementState]);

  // Helper functions for copy and download (similar to main page)
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [head, b64raw] = (dataUrl || "").split(",");
    const mime = /^data:([^;]+);base64$/i.exec(head || "")?.[1] || "image/png";
    const b64 = (b64raw || "").replace(/[^A-Za-z0-9+/=]/g, "");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  const blobFromBlobUrlViaCanvas = async (blobUrl: string): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          }, 'image/png');
        } catch (error) {
          reject(error);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = blobUrl;
    });
  };

  const handleDownload = async (src: string) => {
    onUpdateRefinementState({ isDownloading: true });
    try {
      let href = src;
      let revokeTemp: string | null = null;

      // Handle different source types
      if (src.startsWith('data:')) {
        const blob = dataUrlToBlob(src);
        href = URL.createObjectURL(blob);
        revokeTemp = href;
      } else if (src.startsWith('blob:')) {
        // Use blob URL directly
        href = src;
      }

      const a = document.createElement("a");
      a.href = href;
      a.download = `refined_thumbnail_iteration_${(currentHistory?.iterations.findIndex(i => i.id === currentIteration?.id) ?? -1) + 1}.png`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up temporary blob URL
      if (revokeTemp) {
        setTimeout(() => URL.revokeObjectURL(revokeTemp!), 100);
      }
    } catch (e) {
      // Fallback: try simple download
      const a = document.createElement("a");
      a.href = src;
      a.download = `refined_thumbnail_iteration_${(currentHistory?.iterations.findIndex(i => i.id === currentIteration?.id) ?? -1) + 1}.png`;
      a.click();
    } finally {
      onUpdateRefinementState({ isDownloading: false });
    }
  };

  const handleCopy = async (src: string) => {
    onUpdateRefinementState({ isCopying: true });
    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.write) {
        throw new Error('Clipboard API not available');
      }

      let blob: Blob;
      if (src.startsWith('blob:')) {
        blob = await blobFromBlobUrlViaCanvas(src);
      } else if (src.startsWith('data:')) {
        blob = dataUrlToBlob(src);
      } else if (/^https?:/i.test(src)) {
        const resp = await fetch(src);
        if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
        blob = await resp.blob();
      } else {
        // Assume raw base64
        const toDataUrlString = (u: string, mime: string = "image/png") => {
          const s = (u || "").trim();
          if (s.startsWith("data:")) return s;
          const clean = s.replace(/[^A-Za-z0-9+/=]/g, "");
          return `data:${mime};base64,${clean}`;
        };
        blob = dataUrlToBlob(toDataUrlString(src));
      }

      // Ensure blob is valid
      if (!blob || blob.size === 0) {
        throw new Error('Invalid image data');
      }

      // Create clipboard item with proper MIME type
      const mimeType = blob.type || 'image/png';
      const clipboardItem = new ClipboardItem({ [mimeType]: blob });

      await navigator.clipboard.write([clipboardItem]);

    } catch (error) {

      // Fallback: try to copy as text (data URL)
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(src);
        } else {
          throw new Error('No clipboard access available');
        }
      } catch (fallbackError) {
      }
    } finally {
      onUpdateRefinementState({ isCopying: false });
    }
  };

  if (!currentHistory || !currentIteration) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <p>No thumbnail selected for refinement.</p>
      </div>
    );
  }

  return (
    <div className={styles.refinementMode}>
      {/* Refinement Header */}
      <div className={styles.refinementHeader}>
        <h3 style={{ margin: 0 }}>Refining Thumbnail</h3>
        <span className={styles.refinementBadge}>Refinement Mode</span>
      </div>

	      {/* Current Thumbnail Display */}
	      <div style={{ display: "grid", gap: 12 }}>
	        <h4 className="text-sm font-semibold text-primary">Current Version</h4>
	        <div
	          style={{
	            display: "flex",
	            gap: 16,
	            alignItems: "flex-start",
	            flexWrap: "wrap",
	          }}
	        >
	          <div className="max-w-xs overflow-hidden rounded-lg border-2 border-primary">
            <img 
              src={currentIteration.imageUrl} 
              alt="Current thumbnail" 
              style={{ display: "block", width: "100%" }} 
            />
          </div>
          
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ marginBottom: 12 }}>
              <strong>Iteration {currentHistory.iterations.findIndex(i => i.id === currentIteration.id) + 1}</strong>
              {currentIteration.feedbackPrompt && (
                <div style={{ 
                  marginTop: 8, 
                  padding: 8, 
                  background: "#f8f9fa", 
                  borderRadius: 4,
                  fontSize: 14 
                }}>
                  <strong>Last feedback:</strong> {currentIteration.feedbackPrompt}
                </div>
              )}
            </div>

            {/* Feedback Input */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", marginBottom: 4, fontWeight: "bold" }}>
                Refinement Feedback:
              </label>
              <textarea
                value={refinementState.feedbackPrompt}
                onChange={(e) => onUpdateRefinementState({ feedbackPrompt: e.target.value })}
                placeholder="e.g., make the text larger, change background to blue, add more contrast..."
                className={styles.feedbackInput}
                disabled={refinementState.isRefining}
              />
            </div>

            {/* Action Buttons */}
	            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
	              <Button
	                onClick={handleRefine}
	                disabled={
	                  refinementState.isRefining ||
	                  !refinementState.feedbackPrompt.trim() ||
	                  !isAuthed ||
	                  credits < 1
	                }
	                size="lg"
	              >
	                {refinementState.isRefining
	                  ? "Refining..."
	                  : "Refine thumbnail (uses 1 credit)"}
	              </Button>

	              <Button
	                onClick={() => handleDownload(currentIteration.imageUrl)}
	                disabled={refinementState.isDownloading}
	                size="lg"
	                variant="outline"
	              >
	                {refinementState.isDownloading ? "Downloading..." : "Download"}
	              </Button>

	              <Button
	                onClick={() => handleCopy(currentIteration.imageUrl)}
	                disabled={refinementState.isCopying}
	                size="lg"
	                variant="outline"
	              >
	                {refinementState.isCopying ? "Copying..." : "Copy"}
	              </Button>
            </div>

            {refinementState.refinementError && (
              <div className={styles.refinementError}>
                {refinementState.refinementError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Panel */}
      {currentHistory.iterations.length > 1 && (
        <div style={{ border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => setUIState(prev => ({ 
              ...prev, 
              isHistoryExpanded: !prev.isHistoryExpanded 
            }))}
            style={{
              width: "100%",
              padding: 12,
              background: "#f8f9fa",
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              fontWeight: "bold"
            }}
          >
            Version History ({currentHistory.iterations.length} iterations) 
            {uiState.isHistoryExpanded ? " ▼" : " ▶"}
          </button>
          
          {uiState.isHistoryExpanded && (
            <div style={{ padding: 16 }}>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
                gap: 12 
              }}>
                {currentHistory.iterations.map((iteration, index) => (
                  <div
                    key={iteration.id}
                    className={`${styles.iterationCard} ${
                      iteration.id === currentIteration.id ? styles.iterationCardCurrent : ""
                    }`}
                    onClick={() => handleRollback(iteration.id)}
                  >
                    <img 
                      src={iteration.imageUrl} 
                      alt={`Iteration ${index + 1}`}
                      style={{ display: "block", width: "100%" }}
                    />
                    <div style={{ padding: 8, fontSize: 12 }}>
                      <div><strong>Iteration {index + 1}</strong></div>
                      {iteration.feedbackPrompt && (
                        <div style={{ marginTop: 4, opacity: 0.7 }}>
                          {iteration.feedbackPrompt.length > 50 
                            ? `${iteration.feedbackPrompt.substring(0, 50)}...`
                            : iteration.feedbackPrompt
                          }
                        </div>
                      )}
	                      {iteration.id === currentIteration.id && (
	                        <div className="mt-1 text-xs font-semibold text-primary">
	                          Current
	                        </div>
	                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
