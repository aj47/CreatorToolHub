'use client';

import { useState, useEffect, useCallback } from 'react';
import { debug } from './logger';

export interface DebugLogEntry {
  id: string;
  timestamp: Date;
  category: string;
  source: string;
  message: string;
  data?: unknown;
  level: 'log' | 'info' | 'warn' | 'error';
}

interface DebugPanelState {
  isOpen: boolean;
  logs: DebugLogEntry[];
  filter: string;
  categoryFilter: string | null;
}

const MAX_LOGS = 500;

// Global log storage for the debug panel
let globalLogs: DebugLogEntry[] = [];
let listeners: Set<(logs: DebugLogEntry[]) => void> = new Set();

export function addDebugLog(entry: Omit<DebugLogEntry, 'id' | 'timestamp'>) {
  if (!debug.isEnabled()) return;

  const fullEntry: DebugLogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date(),
  };

  globalLogs = [fullEntry, ...globalLogs].slice(0, MAX_LOGS);
  listeners.forEach(listener => listener(globalLogs));
}

export function clearDebugLogs() {
  globalLogs = [];
  listeners.forEach(listener => listener(globalLogs));
}

export function useDebugPanel() {
  const [state, setState] = useState<DebugPanelState>({
    isOpen: false,
    logs: globalLogs,
    filter: '',
    categoryFilter: null,
  });

  useEffect(() => {
    const handleLogs = (logs: DebugLogEntry[]) => {
      setState(prev => ({ ...prev, logs }));
    };
    listeners.add(handleLogs);
    return () => {
      listeners.delete(handleLogs);
    };
  }, []);

  // Keyboard shortcut: Ctrl+Shift+D to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggle = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const setFilter = useCallback((filter: string) => {
    setState(prev => ({ ...prev, filter }));
  }, []);

  const setCategoryFilter = useCallback((categoryFilter: string | null) => {
    setState(prev => ({ ...prev, categoryFilter }));
  }, []);

  const clear = useCallback(() => {
    clearDebugLogs();
  }, []);

  const filteredLogs = state.logs.filter(log => {
    if (state.categoryFilter && log.category !== state.categoryFilter) return false;
    if (state.filter) {
      const searchStr = `${log.source} ${log.message} ${JSON.stringify(log.data)}`.toLowerCase();
      return searchStr.includes(state.filter.toLowerCase());
    }
    return true;
  });

  const categories = [...new Set(state.logs.map(log => log.category))];

  return {
    isOpen: state.isOpen,
    logs: filteredLogs,
    filter: state.filter,
    categoryFilter: state.categoryFilter,
    categories,
    toggle,
    setFilter,
    setCategoryFilter,
    clear,
    isEnabled: debug.isEnabled(),
  };
}

