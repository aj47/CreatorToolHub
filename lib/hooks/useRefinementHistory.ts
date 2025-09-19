"use client";
import { useState, useEffect, useCallback } from "react";
import { RefinementHistory, RefinementIteration } from "@/lib/types/refinement";

const STORAGE_KEY = "thumbnail_refinement_histories";
const MAX_HISTORIES = 50; // Limit stored histories to prevent localStorage bloat

interface UseRefinementHistoryReturn {
  histories: RefinementHistory[];
  saveHistory: (history: RefinementHistory) => void;
  updateHistory: (historyId: string, updates: Partial<RefinementHistory>) => void;
  deleteHistory: (historyId: string) => void;
  getHistoryById: (historyId: string) => RefinementHistory | undefined;
  clearAllHistories: () => void;
  isLoading: boolean;
  error: string | null;
}

export function useRefinementHistory(): UseRefinementHistoryReturn {
  const [histories, setHistories] = useState<RefinementHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load histories from localStorage on mount (skip in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Skipping refinement history loading from localStorage');
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RefinementHistory[];
        // Sort by most recent first
        const sorted = parsed.sort((a, b) => b.updatedAt - a.updatedAt);
        setHistories(sorted);
      }
    } catch (err) {
      console.error("Failed to load refinement histories:", err);
      setError("Failed to load refinement history");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save histories to localStorage whenever they change
  const persistHistories = useCallback((newHistories: RefinementHistory[]) => {
    // Skip persistence in development mode to avoid localStorage quota issues
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode: Skipping refinement history persistence');
      setError(null);
      return;
    }

    try {
      // Create lightweight versions without large base64 image data to avoid localStorage quota issues
      const lightweightHistories = newHistories.slice(0, MAX_HISTORIES).map(history => ({
        ...history,
        iterations: history.iterations.map(iteration => ({
          ...iteration,
          // Only keep imageData for the current iteration to save space
          imageData: iteration.id === history.currentIterationId ? iteration.imageData : undefined
        }))
      }));

      localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweightHistories));
      setError(null);
    } catch (err) {
      console.error("Failed to save refinement histories:", err);
      setError("Storage quota exceeded - refinement history may not be saved");
    }
  }, []);

  // Save or update a history
  const saveHistory = useCallback((history: RefinementHistory) => {
    setHistories(prev => {
      const existingIndex = prev.findIndex(h => h.id === history.id);
      let newHistories: RefinementHistory[];
      
      if (existingIndex >= 0) {
        // Update existing history
        newHistories = [...prev];
        newHistories[existingIndex] = history;
      } else {
        // Add new history at the beginning
        newHistories = [history, ...prev];
      }
      
      // Sort by most recent first
      newHistories.sort((a, b) => b.updatedAt - a.updatedAt);
      
      persistHistories(newHistories);
      return newHistories;
    });
  }, [persistHistories]);

  // Update a specific history
  const updateHistory = useCallback((historyId: string, updates: Partial<RefinementHistory>) => {
    setHistories(prev => {
      const newHistories = prev.map(h => 
        h.id === historyId 
          ? { ...h, ...updates, updatedAt: Date.now() }
          : h
      );
      
      // Sort by most recent first
      newHistories.sort((a, b) => b.updatedAt - a.updatedAt);
      
      persistHistories(newHistories);
      return newHistories;
    });
  }, [persistHistories]);

  // Delete a history
  const deleteHistory = useCallback((historyId: string) => {
    setHistories(prev => {
      const newHistories = prev.filter(h => h.id !== historyId);
      persistHistories(newHistories);
      return newHistories;
    });
  }, [persistHistories]);

  // Get a specific history by ID
  const getHistoryById = useCallback((historyId: string): RefinementHistory | undefined => {
    return histories.find(h => h.id === historyId);
  }, [histories]);

  // Clear all histories
  const clearAllHistories = useCallback(() => {
    setHistories([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      setError(null);
    } catch (err) {
      console.error("Failed to clear refinement histories:", err);
      setError("Failed to clear refinement history");
    }
  }, []);

  return {
    histories,
    saveHistory,
    updateHistory,
    deleteHistory,
    getHistoryById,
    clearAllHistories,
    isLoading,
    error,
  };
}

// Utility functions for working with refinement histories
export const RefinementHistoryUtils = {
  // Get all iterations from a history in chronological order
  getIterationsChronological: (history: RefinementHistory): RefinementIteration[] => {
    return [...history.iterations].sort((a, b) => a.createdAt - b.createdAt);
  },

  // Get the iteration chain leading to a specific iteration
  getIterationChain: (history: RefinementHistory, iterationId: string): RefinementIteration[] => {
    const iterations = history.iterations;
    const chain: RefinementIteration[] = [];
    
    let currentId: string | undefined = iterationId;
    while (currentId) {
      const iteration = iterations.find(i => i.id === currentId);
      if (!iteration) break;
      
      chain.unshift(iteration); // Add to beginning to maintain order
      currentId = iteration.parentId;
    }
    
    return chain;
  },

  // Get statistics about a history
  getHistoryStats: (history: RefinementHistory) => {
    const totalIterations = history.iterations.length;
    const totalCreditsUsed = history.iterations.reduce((sum, iter) => sum + iter.creditsUsed, 0);
    const lastModified = new Date(history.updatedAt);
    const created = new Date(history.createdAt);
    
    return {
      totalIterations,
      totalCreditsUsed,
      lastModified,
      created,
      duration: history.updatedAt - history.createdAt,
    };
  },

  // Export history as JSON for backup/sharing
  exportHistory: (history: RefinementHistory): string => {
    return JSON.stringify(history, null, 2);
  },

  // Import history from JSON
  importHistory: (jsonString: string): RefinementHistory => {
    const parsed = JSON.parse(jsonString);
    
    // Validate the structure
    if (!parsed.id || !parsed.iterations || !Array.isArray(parsed.iterations)) {
      throw new Error("Invalid refinement history format");
    }
    
    return parsed as RefinementHistory;
  },

  // Create a summary of a history for display
  createHistorySummary: (history: RefinementHistory) => {
    const stats = RefinementHistoryUtils.getHistoryStats(history);
    const currentIteration = history.iterations.find(i => i.id === history.currentIterationId);
    
    return {
      id: history.id,
      templateId: history.templateId,
      totalIterations: stats.totalIterations,
      totalCreditsUsed: stats.totalCreditsUsed,
      lastModified: stats.lastModified,
      currentIterationFeedback: currentIteration?.feedbackPrompt || "Original",
      previewImageUrl: currentIteration?.imageUrl || history.iterations[0]?.imageUrl,
    };
  },
};
