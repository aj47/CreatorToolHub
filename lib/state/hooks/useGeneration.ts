"use client";

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { useUI } from '../providers/UIProvider';
import { useAppState } from '../providers/AppProvider';

// Generation types
export interface GenerationRequest {
  prompt: string;
  frames: string[];
  framesMime?: string;
  variants: number;
  headline?: string;
  additionalNotes?: string;
}

export interface GenerationResult {
  images: string[];
  metadata: {
    prompt: string;
    variants: number;
    creditsUsed: number;
    timestamp: number;
  };
}

export interface GenerationState {
  isGenerating: boolean;
  progress: {
    current: number;
    total: number;
  };
  results: string[];
  error: string | null;
  abortController: AbortController | null;
}

export interface UseGenerationReturn {
  state: GenerationState;
  generate: (request: GenerationRequest) => Promise<GenerationResult | null>;
  abort: () => void;
  clearResults: () => void;
  clearError: () => void;
}

export function useGeneration(): UseGenerationReturn {
  const { user } = useAuth();
  const { setGenerationLoading, setGenerationError, addNotification } = useUI();
  const { recordRequest } = useAppState();

  const [state, setState] = useState<GenerationState>({
    isGenerating: false,
    progress: { current: 0, total: 0 },
    results: [],
    error: null,
    abortController: null,
  });

  const startTimeRef = useRef<number>(0);

  // Generate thumbnails
  const generate = useCallback(async (request: GenerationRequest): Promise<GenerationResult | null> => {
    if (!user) {
      const error = 'Authentication required';
      setState(prev => ({ ...prev, error }));
      setGenerationError(error);
      return null;
    }

    if (state.isGenerating) {
      return null;
    }

    // Create abort controller
    const abortController = new AbortController();
    startTimeRef.current = Date.now();

    setState(prev => ({
      ...prev,
      isGenerating: true,
      progress: { current: 0, total: request.variants },
      results: [],
      error: null,
      abortController,
    }));

    setGenerationLoading(true);
    setGenerationError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: request.prompt,
          frames: request.frames,
          framesMime: request.framesMime,
          variants: request.variants,
          headline: request.headline,
          additionalNotes: request.additionalNotes,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Generation failed: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const results: string[] = [];
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim() === '' || line.startsWith(':')) {
            continue; // Skip empty lines and heartbeat comments
          }

          try {
            const data = JSON.parse(line);
            
            switch (data.type) {
              case 'start':
                setState(prev => ({
                  ...prev,
                  progress: { current: 0, total: data.total },
                }));
                break;

              case 'image':
                results.push(data.dataUrl);
                setState(prev => ({
                  ...prev,
                  results: [...results],
                }));
                break;

              case 'progress':
                setState(prev => ({
                  ...prev,
                  progress: { current: data.done, total: data.total },
                }));
                break;

              case 'done':
                // Generation completed successfully
                break;

              case 'error':
                throw new Error(data.message || 'Generation failed');

              case 'variant_error':
                // Continue processing other variants
                break;
            }
          } catch (parseError) {
          }
        }
      }

      // Record performance
      const responseTime = Date.now() - startTimeRef.current;
      recordRequest(responseTime);

      // Create result
      const result: GenerationResult = {
        images: results,
        metadata: {
          prompt: request.prompt,
          variants: request.variants,
          creditsUsed: request.variants,
          timestamp: Date.now(),
        },
      };

      // Show success notification
      addNotification({
        type: 'success',
        title: 'Generation Complete',
        message: `Generated ${results.length} thumbnail${results.length !== 1 ? 's' : ''}`,
        duration: 3000,
      });

      return result;

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Generation was aborted
        addNotification({
          type: 'info',
          title: 'Generation Cancelled',
          duration: 2000,
        });
        return null;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({ ...prev, error: errorMessage }));
      setGenerationError(errorMessage);

      addNotification({
        type: 'error',
        title: 'Generation Failed',
        message: errorMessage,
        duration: 5000,
      });

      return null;

    } finally {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        abortController: null,
      }));
      setGenerationLoading(false);
    }
  }, [user, state.isGenerating, setGenerationLoading, setGenerationError, addNotification, recordRequest]);

  // Abort generation
  const abort = useCallback(() => {
    if (state.abortController) {
      state.abortController.abort();
      setState(prev => ({
        ...prev,
        isGenerating: false,
        abortController: null,
      }));
      setGenerationLoading(false);
    }
  }, [state.abortController, setGenerationLoading]);

  // Clear results
  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      results: [],
      progress: { current: 0, total: 0 },
    }));
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
    setGenerationError(null);
  }, [setGenerationError]);

  return {
    state,
    generate,
    abort,
    clearResults,
    clearError,
  };
}
