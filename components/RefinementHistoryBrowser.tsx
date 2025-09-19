"use client";
import { useState } from "react";
import { RefinementHistory, RefinementState } from "@/lib/types/refinement";
import { RefinementHistoryUtils } from "@/lib/hooks/useRefinementHistory";

interface RefinementHistoryBrowserProps {
  histories: RefinementHistory[];
  onSelectHistory: (history: RefinementHistory) => void;
  onDeleteHistory: (historyId: string) => void;
  onClearAllHistories: () => void;
  currentHistoryId?: string;
}

export default function RefinementHistoryBrowser({
  histories,
  onSelectHistory,
  onDeleteHistory,
  onClearAllHistories,
  currentHistoryId
}: RefinementHistoryBrowserProps) {
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<string | null>(null);

  if (histories.length === 0) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: "center", 
        color: "#666",
        border: "1px dashed #ddd",
        borderRadius: 8
      }}>
        <p>No refinement histories yet.</p>
        <p style={{ fontSize: 14, opacity: 0.8 }}>
          Generate some thumbnails and refine them to see your history here.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Refinement History ({histories.length})</h3>
        <button
          onClick={() => setShowConfirmClear(true)}
          style={{
            padding: "6px 12px",
            border: "1px solid #d33",
            background: "white",
            color: "#d33",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 12
          }}
        >
          Clear All
        </button>
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", 
        gap: 12 
      }}>
        {histories.map(history => {
          const summary = RefinementHistoryUtils.createHistorySummary(history);
          const isSelected = currentHistoryId === history.id;
          
          return (
            <div
              key={history.id}
              style={{
                border: isSelected ? "2px solid var(--nb-accent)" : "1px solid #ddd",
                borderRadius: 8,
                overflow: "hidden",
                cursor: "pointer",
                background: isSelected ? "#f0f8ff" : "white"
              }}
              onClick={() => onSelectHistory(history)}
            >
              {/* Preview Image */}
              {summary.previewImageUrl && (
                <div style={{ position: "relative" }}>
                  <img 
                    src={summary.previewImageUrl} 
                    alt="Refinement preview"
                    style={{ 
                      display: "block", 
                      width: "100%", 
                      height: 160, 
                      objectFit: "cover" 
                    }}
                  />
                  <div style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: 4,
                    fontSize: 12
                  }}>
                    {summary.totalIterations} iteration{summary.totalIterations === 1 ? '' : 's'}
                  </div>
                </div>
              )}

              {/* History Info */}
              <div style={{ padding: 12 }}>
                <div style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "flex-start",
                  marginBottom: 8
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>
                      Template: {summary.templateId}
                    </div>
                    <div style={{ fontSize: 12, color: "#666" }}>
                      {summary.lastModified.toLocaleDateString()} at {summary.lastModified.toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirmDelete(history.id);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#d33",
                      cursor: "pointer",
                      padding: 4,
                      fontSize: 16
                    }}
                    title="Delete history"
                  >
                    ×
                  </button>
                </div>

                <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                  <div>Credits used: {summary.totalCreditsUsed}</div>
                  {summary.currentIterationFeedback && summary.currentIterationFeedback !== "Original" && (
                    <div style={{ marginTop: 4 }}>
                      <strong>Current:</strong> {
                        summary.currentIterationFeedback.length > 60 
                          ? `${summary.currentIterationFeedback.substring(0, 60)}...`
                          : summary.currentIterationFeedback
                      }
                    </div>
                  )}
                </div>

                {isSelected && (
                  <div style={{ 
                    padding: "6px 8px", 
                    background: "var(--nb-accent)", 
                    color: "white", 
                    borderRadius: 4, 
                    fontSize: 12,
                    textAlign: "center",
                    fontWeight: "bold"
                  }}>
                    Currently Selected
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm Clear All Dialog */}
      {showConfirmClear && (
        <div 
          role="dialog" 
          aria-modal="true" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            display: 'grid', 
            placeItems: 'center', 
            zIndex: 1000 
          }}
        >
          <div style={{ 
            background: '#fff', 
            color: '#111', 
            padding: 20, 
            borderRadius: 10, 
            border: '3px solid var(--nb-border)', 
            boxShadow: '8px 8px 0 var(--nb-border)', 
            maxWidth: 420 
          }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              Clear All Refinement History?
            </div>
            <p style={{ marginTop: 0, marginBottom: 16 }}>
              This will permanently delete all {histories.length} refinement histories. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => {
                  onClearAllHistories();
                  setShowConfirmClear(false);
                }}
                style={{
                  padding: "8px 16px",
                  background: "#d33",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Clear All
              </button>
              <button 
                onClick={() => setShowConfirmClear(false)}
                style={{
                  padding: "8px 16px",
                  background: "white",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {showConfirmDelete && (
        <div 
          role="dialog" 
          aria-modal="true" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0,0,0,0.5)', 
            display: 'grid', 
            placeItems: 'center', 
            zIndex: 1000 
          }}
        >
          <div style={{ 
            background: '#fff', 
            color: '#111', 
            padding: 20, 
            borderRadius: 10, 
            border: '3px solid var(--nb-border)', 
            boxShadow: '8px 8px 0 var(--nb-border)', 
            maxWidth: 420 
          }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
              Delete Refinement History?
            </div>
            <p style={{ marginTop: 0, marginBottom: 16 }}>
              This will permanently delete this refinement history and all its iterations. This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => {
                  onDeleteHistory(showConfirmDelete);
                  setShowConfirmDelete(null);
                }}
                style={{
                  padding: "8px 16px",
                  background: "#d33",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Delete
              </button>
              <button 
                onClick={() => setShowConfirmDelete(null)}
                style={{
                  padding: "8px 16px",
                  background: "white",
                  color: "#333",
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
