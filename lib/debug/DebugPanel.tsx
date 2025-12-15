'use client';

import React from 'react';
import { useDebugPanel, DebugLogEntry } from './useDebugPanel';

function safeStringify(value: unknown, indent?: number): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return '[Unserializable data]';
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  api: 'bg-green-500',
  state: 'bg-blue-500',
  render: 'bg-purple-500',
  error: 'bg-red-500',
  auth: 'bg-orange-500',
  storage: 'bg-cyan-500',
  worker: 'bg-amber-700',
  general: 'bg-gray-500',
};

function LogEntry({ entry }: { entry: DebugLogEntry }) {
  const [expanded, setExpanded] = React.useState(false);
  const colorClass = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.general;

  return (
    <div 
      className={`border-b border-gray-700 py-1 px-2 text-xs cursor-pointer hover:bg-gray-800 ${
        entry.level === 'error' ? 'bg-red-900/20' : entry.level === 'warn' ? 'bg-yellow-900/20' : ''
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className="text-gray-500 font-mono">
          {entry.timestamp.toLocaleTimeString()}
        </span>
        <span className={`${colorClass} text-white px-1.5 py-0.5 rounded text-[10px] uppercase`}>
          {entry.category}
        </span>
        <span className="text-gray-400">[{entry.source}]</span>
        <span className="text-gray-200 truncate flex-1">{entry.message}</span>
      </div>
      {expanded && entry.data !== undefined && (
        <pre className="mt-1 p-2 bg-gray-900 rounded text-[10px] overflow-auto max-h-40">
          {typeof entry.data === 'string' ? entry.data : safeStringify(entry.data, 2)}
        </pre>
      )}
    </div>
  );
}

export function DebugPanel() {
  const {
    isOpen,
    logs,
    filter,
    categoryFilter,
    categories,
    toggle,
    setFilter,
    setCategoryFilter,
    clear,
    isEnabled,
  } = useDebugPanel();

  if (!isEnabled) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={toggle}
        className="fixed bottom-4 right-4 z-[9999] bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Toggle Debug Panel (Ctrl+Shift+D)"
      >
        🔍
      </button>

      {/* Debug Panel */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 z-[9998] w-[600px] max-w-[90vw] h-[400px] bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
            <span className="font-semibold text-white text-sm">🔍 Debug Panel</span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter logs..."
                className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white w-32"
              />
              <select
                value={categoryFilter || ''}
                onChange={(e) => setCategoryFilter(e.target.value || null)}
                className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                ))}
              </select>
              <button
                onClick={clear}
                className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Clear
              </button>
              <button
                onClick={toggle}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Logs */}
          <div className="flex-1 overflow-auto font-mono">
            {logs.length === 0 ? (
              <div className="p-4 text-gray-500 text-center text-sm">
                No logs yet. Interactions will appear here.
              </div>
            ) : (
              logs.map(entry => <LogEntry key={entry.id} entry={entry} />)
            )}
          </div>

          {/* Footer */}
          <div className="p-1 bg-gray-800 border-t border-gray-700 text-[10px] text-gray-500 text-center">
            {logs.length} entries | Press Ctrl+Shift+D to toggle
          </div>
        </div>
      )}
    </>
  );
}

