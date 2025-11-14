"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
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
	        <Button
	          onClick={() => setShowConfirmClear(true)}
	          size="sm"
	          variant="outline"
	        >
	          Clear all
	        </Button>
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
	              className={`cursor-pointer overflow-hidden rounded-lg border transition-colors ${
	                isSelected
	                  ? "border-primary bg-primary/5"
	                  : "border-slate-200 bg-white hover:bg-slate-50"
	              }`}
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
	                  <div className="mt-2 rounded-md bg-primary px-2 py-1 text-center text-xs font-semibold text-primary-foreground">
	                    Currently selected
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
	          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
	        >
	          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
	            <div className="text-lg font-semibold tracking-tight">
	              Clear all refinement history?
	            </div>
	            <p className="mt-2 text-sm text-muted-foreground">
	              This will permanently delete all {histories.length} refinement histories. This action cannot be undone.
	            </p>
	            <div className="mt-4 flex items-center gap-3">
	              <Button
	                variant="destructive"
	                size="sm"
	                onClick={() => {
	                  onClearAllHistories();
	                  setShowConfirmClear(false);
	                }}
	              >
	                Clear all
	              </Button>
	              <Button
	                variant="outline"
	                size="sm"
	                onClick={() => setShowConfirmClear(false)}
	              >
	                Cancel
	              </Button>
	            </div>
	          </div>
	        </div>
	      )}

	      {/* Confirm Delete Dialog */}
	      {showConfirmDelete && (
	        <div
	          role="dialog"
	          aria-modal="true"
	          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
	        >
	          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
	            <div className="text-lg font-semibold tracking-tight">
	              Delete refinement history?
	            </div>
	            <p className="mt-2 text-sm text-muted-foreground">
	              This will permanently delete this refinement history and all its iterations. This action cannot be undone.
	            </p>
	            <div className="mt-4 flex items-center gap-3">
	              <Button
	                variant="destructive"
	                size="sm"
	                onClick={() => {
	                  onDeleteHistory(showConfirmDelete);
	                  setShowConfirmDelete(null);
	                }}
	              >
	                Delete
	              </Button>
	              <Button
	                variant="outline"
	                size="sm"
	                onClick={() => setShowConfirmDelete(null)}
	              >
	                Cancel
	              </Button>
	            </div>
	          </div>
	        </div>
	      )}
    </div>
  );
}
