"use client";
import { useState, useCallback } from "react";
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

      // Add the new iteration to the current history
      const updatedHistory = RefinementUtils.addIteration(currentHistory, result.iteration);
      
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
      console.error("Refinement error:", error);
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
        <h4 style={{ margin: 0, color: "var(--nb-accent)" }}>Current Version</h4>
        <div style={{ 
          display: "flex", 
          gap: 16, 
          alignItems: "flex-start",
          flexWrap: "wrap" 
        }}>
          <div style={{ 
            border: "3px solid var(--nb-accent)", 
            borderRadius: 8, 
            overflow: "hidden",
            maxWidth: 320 
          }}>
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

            {/* Refine Button */}
            <button
              onClick={handleRefine}
              disabled={
                refinementState.isRefining || 
                !refinementState.feedbackPrompt.trim() ||
                (!isAuthed) ||
                (credits < 1)
              }
              style={{
                padding: "12px 24px",
                backgroundColor: refinementState.isRefining ? "#ccc" : "var(--nb-accent)",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: refinementState.isRefining ? "not-allowed" : "pointer",
                fontWeight: "bold"
              }}
            >
              {refinementState.isRefining 
                ? "Refining..." 
                : `Refine Thumbnail (uses 1 credit)`
              }
            </button>

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
                        <div style={{ 
                          marginTop: 4, 
                          color: "var(--nb-accent)", 
                          fontWeight: "bold" 
                        }}>
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
