// Types for thumbnail refinement feature

export interface RefinementIteration {
  id: string;
  parentId?: string; // ID of the iteration this was refined from
  originalPrompt: string; // The original generation prompt
  feedbackPrompt: string; // The refinement feedback prompt
  combinedPrompt: string; // The full prompt sent to the API
  imageUrl: string; // The resulting refined image (data URL or blob URL)
  imageData?: string; // Base64 image data for API calls
  templateId: string; // Which template was used for the original generation
  createdAt: number; // Timestamp
  creditsUsed: number; // Credits consumed for this refinement (should be 1)
}

export interface RefinementHistory {
  id: string; // Unique ID for this refinement chain
  originalGenerationId?: string; // Link to original generation if available
  templateId: string; // Template used for original generation
  originalPrompt: string; // Original generation prompt
  iterations: RefinementIteration[]; // All iterations in chronological order
  currentIterationId: string; // Currently selected iteration
  createdAt: number; // When refinement chain started
  updatedAt: number; // Last modification time
}

export interface RefinementState {
  isRefinementMode: boolean; // Whether we're in refinement mode
  selectedThumbnailIndex?: number; // Index of selected thumbnail from generation results
  selectedThumbnailUrl?: string; // URL of selected thumbnail
  currentHistory?: RefinementHistory; // Current refinement chain
  histories: RefinementHistory[]; // All refinement histories
  isRefining: boolean; // Whether a refinement is in progress
  refinementError?: string; // Any refinement errors
  feedbackPrompt: string; // Current feedback prompt input
  isCopying: boolean; // Whether a copy operation is in progress
  isDownloading: boolean; // Whether a download operation is in progress
  referenceImages: string[]; // Reference images (base64 data) for refinement
}

// Fal AI models for image editing
export const FAL_MODEL_FLUX = "fal-ai/flux-2-pro/edit" as const; // FLUX.2 [pro] from Black Forest Labs
export const FAL_MODEL_QWEN = "fal-ai/qwen-image-edit/image-to-image" as const; // Qwen Image Edit
export type FalModel = typeof FAL_MODEL_FLUX | typeof FAL_MODEL_QWEN;

// Provider types
export type Provider = 'gemini' | 'fal-flux' | 'fal-qwen' | 'all';
export type SingleProvider = Exclude<Provider, 'all'>;

export interface RefinementRequest {
  baseImageUrl: string; // The base thumbnail to refine
  baseImageData: string; // Base64 data of the base image
  originalPrompt: string; // Original generation prompt
  feedbackPrompt: string; // User's refinement feedback
  templateId: string; // Template ID for context
  parentIterationId?: string; // ID of parent iteration if continuing a chain
  provider?: SingleProvider; // AI provider to use for refinement (default: gemini)
  referenceImages?: string[]; // Optional reference images (base64 data) for Fal AI
  model?: FalModel; // Optional Fal model selection
}

export interface RefinementResponse {
  success: boolean;
  iteration?: RefinementIteration;
  error?: string;
  creditsRemaining?: number;
}

// Utility type for managing refinement UI state
export interface RefinementUIState {
  showHistory: boolean; // Whether to show the history panel
  selectedHistoryId?: string; // Currently selected history for viewing
  isHistoryExpanded: boolean; // Whether history panel is expanded
  showRollbackConfirm?: string; // ID of iteration to confirm rollback to
}

// Helper functions for working with refinement data
export const RefinementUtils = {
  // Create a new refinement history from a generated thumbnail
  createHistoryFromThumbnail: (
    thumbnailUrl: string,
    thumbnailData: string,
    originalPrompt: string,
    templateId: string
  ): RefinementHistory => {
    const now = Date.now();
    const historyId = `history_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const initialIterationId = `iter_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    const initialIteration: RefinementIteration = {
      id: initialIterationId,
      originalPrompt,
      feedbackPrompt: '', // No feedback for initial iteration
      combinedPrompt: originalPrompt,
      imageUrl: thumbnailUrl,
      imageData: thumbnailData,
      templateId,
      createdAt: now,
      creditsUsed: 0, // Initial iteration doesn't consume refinement credits
    };

    return {
      id: historyId,
      templateId,
      originalPrompt,
      iterations: [initialIteration],
      currentIterationId: initialIterationId,
      createdAt: now,
      updatedAt: now,
    };
  },

  // Add a new iteration to a history
  addIteration: (
    history: RefinementHistory,
    iteration: RefinementIteration
  ): RefinementHistory => {
    return {
      ...history,
      iterations: [...history.iterations, iteration],
      currentIterationId: iteration.id,
      updatedAt: Date.now(),
    };
  },

  // Get the current iteration from a history
  getCurrentIteration: (history: RefinementHistory): RefinementIteration | undefined => {
    return history.iterations.find(iter => iter.id === history.currentIterationId);
  },

  // Set the current iteration (for rollback)
  setCurrentIteration: (
    history: RefinementHistory,
    iterationId: string
  ): RefinementHistory => {
    const iteration = history.iterations.find(iter => iter.id === iterationId);
    if (!iteration) return history;

    return {
      ...history,
      currentIterationId: iterationId,
      updatedAt: Date.now(),
    };
  },

  // Get iteration by ID
  getIterationById: (
    history: RefinementHistory,
    iterationId: string
  ): RefinementIteration | undefined => {
    return history.iterations.find(iter => iter.id === iterationId);
  },

  // Generate a unique iteration ID
  generateIterationId: (): string => {
    return `iter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Generate a unique history ID
  generateHistoryId: (): string => {
    return `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  // Convert data URL to base64 data (remove data:image/png;base64, prefix)
  dataUrlToBase64: (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    return parts.length > 1 ? parts[1] : dataUrl;
  },

  // Convert base64 to data URL
  base64ToDataUrl: (base64: string, mimeType: string = 'image/png'): string => {
    if (base64.startsWith('data:')) return base64;
    return `data:${mimeType};base64,${base64}`;
  },

  // Clean up localStorage by removing old refinement data
  cleanupStorage: (): void => {
    try {
      // Remove old refinement histories
      localStorage.removeItem('thumbnail_refinement_histories');

      // Also clean up any other large data that might be stored
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('thumbnail_') || key.startsWith('refinement_')) {
          try {
            const value = localStorage.getItem(key);
            // Remove items larger than 100KB
            if (value && value.length > 100000) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // If we can't access the item, remove it
            localStorage.removeItem(key);
          }
        }
      });

    } catch (error) {
    }
  },
};
