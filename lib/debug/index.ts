/**
 * Debug utilities for CreatorToolHub
 * 
 * Enable debug mode by adding to .env.local:
 *   NEXT_PUBLIC_DEBUG=true
 * 
 * This will enable:
 * - Verbose console logging with categories
 * - API request/response logging
 * - State change tracking
 * - Component render logging
 * - Performance timing
 */

export { debug, default } from './logger';
export { useDebugPanel } from './useDebugPanel';
export { DebugPanel } from './DebugPanel';

