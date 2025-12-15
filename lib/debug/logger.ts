/**
 * Extensive Debug Logger
 * 
 * Enable by setting NEXT_PUBLIC_DEBUG=true in your .env.local
 * 
 * Usage:
 *   import { debug } from '@/lib/debug/logger';
 *   debug.log('MyComponent', 'Rendering with props', props);
 *   debug.api('GET', '/api/user', { status: 200 });
 *   debug.state('thumbnails', { before, after });
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface DebugConfig {
  enabled: boolean;
  showTimestamps: boolean;
  showStackTrace: boolean;
  logLevel: LogLevel;
  categories: Set<string> | 'all';
}

const config: DebugConfig = {
  enabled: typeof window !== 'undefined' 
    ? process.env.NEXT_PUBLIC_DEBUG === 'true' 
    : process.env.DEBUG === 'true' || process.env.NEXT_PUBLIC_DEBUG === 'true',
  showTimestamps: true,
  showStackTrace: false,
  logLevel: 'debug',
  categories: 'all',
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  log: 1,
  info: 2,
  warn: 3,
  error: 4,
};

const COLORS = {
  api: '#4CAF50',
  state: '#2196F3',
  render: '#9C27B0',
  error: '#F44336',
  auth: '#FF9800',
  storage: '#00BCD4',
  worker: '#795548',
  general: '#607D8B',
};

function shouldLog(level: LogLevel): boolean {
  if (!config.enabled) return false;
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.logLevel];
}

function formatTimestamp(): string {
  if (!config.showTimestamps) return '';
  return `[${new Date().toISOString()}]`;
}

function formatCategory(category: string): string {
  return `[${category.toUpperCase()}]`;
}

function getColor(category: string): string {
  return COLORS[category as keyof typeof COLORS] || COLORS.general;
}

function createLogFn(category: string, level: LogLevel = 'log') {
  return (source: string, message: string, ...data: unknown[]) => {
    if (!shouldLog(level)) return;
    if (config.categories !== 'all' && !config.categories.has(category)) return;

    const timestamp = formatTimestamp();
    const cat = formatCategory(category);
    const prefix = `${timestamp} ${cat} [${source}]`;
    
    if (typeof window !== 'undefined') {
      // Browser console with colors
      const color = getColor(category);
      console[level](
        `%c${prefix}%c ${message}`,
        `color: ${color}; font-weight: bold`,
        'color: inherit',
        ...data
      );
    } else {
      // Server-side logging
      console[level](prefix, message, ...data);
    }

    if (config.showStackTrace && level === 'error') {
      console.trace('Stack trace:');
    }
  };
}

export const debug = {
  // General logging
  log: createLogFn('general', 'log'),
  info: createLogFn('general', 'info'),
  warn: createLogFn('general', 'warn'),
  error: createLogFn('general', 'error'),

  // Category-specific logging
  api: (method: string, url: string, data?: unknown) => {
    createLogFn('api', 'debug')('API', `${method} ${url}`, data ?? '');
  },
  
  state: (source: string, state: unknown) => {
    createLogFn('state', 'debug')(source, 'State update:', state);
  },

  render: (component: string, props?: unknown) => {
    createLogFn('render', 'debug')(component, 'Rendering', props ?? '');
  },

  auth: (action: string, details?: unknown) => {
    createLogFn('auth', 'info')('Auth', action, details ?? '');
  },

  storage: (operation: string, details?: unknown) => {
    createLogFn('storage', 'debug')('Storage', operation, details ?? '');
  },

  worker: (action: string, details?: unknown) => {
    createLogFn('worker', 'debug')('Worker', action, details ?? '');
  },

  // Performance timing
  time: (label: string) => {
    if (!config.enabled) return { end: () => {} };
    const start = performance.now();
    return {
      end: (metadata?: unknown) => {
        const duration = performance.now() - start;
        createLogFn('general', 'debug')('PERF', `${label}: ${duration.toFixed(2)}ms`, metadata ?? '');
      }
    };
  },

  // Group logs
  group: (label: string, fn: () => void) => {
    if (!config.enabled) return fn();
    console.group(`🔍 ${label}`);
    fn();
    console.groupEnd();
  },

  // Table output
  table: (source: string, data: unknown) => {
    if (!config.enabled) return;
    console.log(`📊 [${source}]`);
    console.table(data);
  },

  // Configuration
  configure: (options: Partial<DebugConfig>) => {
    Object.assign(config, options);
  },

  isEnabled: () => config.enabled,
};

// Export for convenience
export default debug;

