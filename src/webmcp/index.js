/**
 * 312Deals WebMCP Module, Main Entry Point
 * ===========================================
 * Single import that initializes all WebMCP functionality:
 *   - Native API detection (Chrome 146+) with polyfill fallback (@mcp-b/global)
 *   - Tool registration (Imperative API)
 *   - Form enhancement (Declarative API, ⚠️ attrs unverified, no getTools/listTools to confirm)
 *   - Agent interaction analytics with soft navigation support
 *   - Context provision
 *   - Human-in-the-loop support
 *   - Cleanup on unmount / route change
 *
 * Dual API Strategy (Feb 2026):
 *   Declarative API: Form-based tools auto-discovered by agents via HTML attributes
 *   Imperative API: Complex tools registered via navigator.modelContext.registerTool()
 *   See CLAUDE.md Section 8 for the full Dual API architecture.
 *
 * Usage in Next.js:
 *   import { init312DealsWebMCP, teardown312DealsWebMCP } from '@/webmcp';
 *
 *   useEffect(() => {
 *     const result = init312DealsWebMCP();
 *     return () => teardown312DealsWebMCP();
 *   }, []);
 *
 * Or use the React hook:
 *   import { useWebMCP } from '@/webmcp/useWebMCP';
 *
 * Files in this module:
 *   index.js, This file. Orchestrator.
 *   webmcp_tools.js, Tool definitions with schemas, handlers, Declarative forms
 *   useWebMCP.js, React hook for Next.js integration
 *   webmcp_analytics.js, Agent interaction tracking + soft navigation support
 *   webmcp_inspector.js, Dev/test utility for schema validation
 *   webmcp_middleware.py, Server-side agent detection (FastAPI)
 */

import { TOOLS, CHIDEALS_CONTEXT, enhanceFormsForWebMCP, isAgentSubmission } from './webmcp_tools.js';
import {
  wrapWithAnalytics, startAnalytics, stopAnalytics,
  trackRegistration, trackContextProvision, getAnalyticsSummary,
  observeSoftNavigations,
} from './webmcp_analytics.js';

// ============================================================
// FEATURE DETECTION, Native vs Polyfill
// ============================================================

/**
 * Detection result: where did navigator.modelContext come from?
 *   'native'      → Chrome 146+ with WebMCP flag or native support
 *   'polyfill'    → @mcp-b/global polyfill injected it
 *   'unavailable' → Neither present
 *
 * Strategy (per Chrome blog Feb 10, 2026):
 *   1. Check for native navigator.modelContext FIRST
 *   2. Only if absent, attempt to activate @mcp-b/global polyfill
 *   3. If neither, degrade gracefully
 */
let _detectionSource = 'unknown';

export function detectWebMCP() {
  if (typeof navigator === 'undefined') {
    _detectionSource = 'unavailable';
    return { available: false, source: 'unavailable' };
  }

  // Step 1: Check for native API (Chrome 146+ with flag or stable support)
  if ('modelContext' in navigator && !navigator.modelContext?.__polyfill) {
    _detectionSource = 'native';
    return { available: true, source: 'native' };
  }

  // Step 2: Check for polyfill (@mcp-b/global sets navigator.modelContext)
  // The polyfill may mark itself with __polyfill or __mcp_b_global
  if ('modelContext' in navigator) {
    _detectionSource = 'polyfill';
    return { available: true, source: 'polyfill' };
  }

  // Step 3: Try to activate polyfill if loaded but not yet initialized
  if (typeof window !== 'undefined' && window.__mcpbGlobalInit) {
    try {
      window.__mcpbGlobalInit();
      if ('modelContext' in navigator) {
        _detectionSource = 'polyfill';
        return { available: true, source: 'polyfill' };
      }
    } catch (_) {}
  }

  _detectionSource = 'unavailable';
  return { available: false, source: 'unavailable' };
}

/**
 * Async detection that attempts dynamic polyfill import if native API absent.
 * Use this when you want to auto-load @mcp-b/global as a fallback.
 */
export async function detectWebMCPAsync() {
  // First try synchronous detection
  const sync = detectWebMCP();
  if (sync.available) return sync;

  // Attempt dynamic polyfill import
  if (typeof window !== 'undefined') {
    try {
      await import(/* webpackIgnore: true */ '@mcp-b/global');
      if ('modelContext' in navigator) {
        _detectionSource = 'polyfill';
        return { available: true, source: 'polyfill' };
      }
    } catch (_) {
      // @mcp-b/global not installed or import failed
    }
  }

  _detectionSource = 'unavailable';
  return { available: false, source: 'unavailable' };
}

/**
 * Quick boolean check, is WebMCP available (native or polyfill)?
 */
export function isWebMCPAvailable() {
  if (_detectionSource === 'unknown') detectWebMCP();
  return _detectionSource !== 'unavailable';
}

/**
 * Get the detection source: 'native', 'polyfill', or 'unavailable'.
 */
export function getDetectionSource() {
  if (_detectionSource === 'unknown') detectWebMCP();
  return _detectionSource;
}

/**
 * Check if Chrome's testing API is available (Model Context Tool Inspector).
 */
export function isWebMCPTestingAvailable() {
  return typeof navigator !== 'undefined' && 'modelContextTesting' in navigator;
}

// ============================================================
// INITIALIZATION
// ============================================================

let _initialized = false;
let _registeredTools = [];
let _softNavObserver = null;

/**
 * Initialize all 312Deals WebMCP functionality.
 *
 * @param {Object} options
 * @param {boolean} options.analytics - Enable analytics tracking (default: true)
 * @param {boolean} options.declarativeForms - Enhance HTML forms (default: true)
 * @param {boolean} options.humanInTheLoop - Enable requestUserInteraction for sensitive tools (default: true)
 * @param {boolean} options.softNavigations - Observe soft navigations for analytics flush (default: true)
 * @param {boolean} options.debug - Enable console logging (default: NODE_ENV === 'development')
 *
 * @returns {Promise<{ available: boolean, registered: number, tools: string[], detectionSource: string }>}
 */
export async function init312DealsWebMCP(options = {}) {
  const {
    analytics = true,
    declarativeForms = true,
    humanInTheLoop = true,
    softNavigations = true,
    debug = typeof process !== 'undefined' && process.env?.NODE_ENV === 'development',
  } = options;

  // Guard: already initialized
  if (_initialized) {
    if (debug) console.log('[312Deals WebMCP] Already initialized');
    return {
      available: isWebMCPAvailable(),
      registered: _registeredTools.length,
      tools: _registeredTools,
      detectionSource: _detectionSource,
    };
  }

  // Detect native vs polyfill (with async fallback to dynamic polyfill import)
  const detection = await detectWebMCPAsync();

  if (!detection.available) {
    if (debug) {
      console.log(
        '[312Deals WebMCP] navigator.modelContext not available.\n' +
        '  Native: Requires Chrome 146+ with "WebMCP for testing" flag.\n' +
        '  Polyfill: Install @mcp-b/global and import before this module.\n' +
        '  Tools will not be registered.'
      );
    }
    return { available: false, registered: 0, tools: [], detectionSource: 'unavailable' };
  }

  if (debug) {
    console.log(`[312Deals WebMCP] Initializing... (source: ${detection.source})`);
  }

  // Start analytics
  if (analytics) {
    startAnalytics();
  }

  // Observe soft navigations (Next.js SPA route changes)
  if (softNavigations && analytics) {
    _softNavObserver = observeSoftNavigations();
    if (debug && _softNavObserver) console.log('  ✓ Soft navigation observer active');
  }

  // Register imperative tools
  let registered = 0;
  const toolNames = [];

  for (const tool of TOOLS) {
    try {
      const execute = analytics
        ? wrapWithAnalytics(tool.name, tool.execute)
        : tool.execute;

      navigator.modelContext.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        execute: execute,
      });

      registered++;
      toolNames.push(tool.name);
      trackRegistration(tool.name, true);
      if (debug) console.log(`  ✓ ${tool.name} (${tool.registrationType})`);
    } catch (e) {
      trackRegistration(tool.name, false);
      if (debug) console.warn(`  ✗ ${tool.name}:`, e.message);
    }
  }

  // EMPIRICALLY CONFIRMED (2026-02-19): provideContext() only accepts { tools: [...] }.
  // Passing { description } throws. Our tools are registered via registerTool() above.
  // Full native API surface: registerTool, unregisterTool, provideContext, clearContext.
  // NOT available: requestUserInteraction, getTools, listTools, respondWith.
  trackContextProvision(true);
  if (debug) console.log('  ✓ Context: ' + registered + ' tools registered (provideContext skipped, tools already registered individually)');

  // Enhance declarative forms
  if (declarativeForms) {
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enhanceFormsForWebMCP);
      } else {
        enhanceFormsForWebMCP();
      }
      if (debug) console.log('  ✓ Declarative forms enhanced (⚠️ attribute names pending EPP verification)');
    }
  }

  _initialized = true;
  _registeredTools = toolNames;

  if (debug) {
    console.log(`[312Deals WebMCP] ${registered}/${TOOLS.length} tools registered. Source: ${detection.source}`);
  }

  return { available: true, registered, tools: toolNames, detectionSource: detection.source };
}

// ============================================================
// TEARDOWN
// ============================================================

/**
 * Unregister all tools, clean up observers, and flush analytics.
 * Call on page unmount or full navigation.
 */
export function teardown312DealsWebMCP() {
  if (!isWebMCPAvailable() || !_initialized) return;

  // Unregister tools
  for (const name of _registeredTools) {
    try { navigator.modelContext.unregisterTool(name); } catch (_) {}
  }

  // Clear context
  try { navigator.modelContext.clearContext(); } catch (_) {}

  // Stop soft navigation observer
  if (_softNavObserver) {
    _softNavObserver.disconnect();
    _softNavObserver = null;
  }

  // Stop analytics
  stopAnalytics();

  _initialized = false;
  _registeredTools = [];
}

// ============================================================
// STATUS & DIAGNOSTICS
// ============================================================

/**
 * Get current WebMCP status for admin dashboards.
 */
export function getWebMCPStatus() {
  return {
    available: isWebMCPAvailable(),
    detection_source: getDetectionSource(),
    testing_api_available: isWebMCPTestingAvailable(),
    initialized: _initialized,
    registered_tools: _registeredTools,
    tool_count: _registeredTools.length,
    analytics: getAnalyticsSummary(),
    chrome_version: typeof navigator !== 'undefined'
      ? navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'
      : 'N/A',
    soft_navigation_observer: !!_softNavObserver,
  };
}

// ============================================================
// RE-EXPORTS
// ============================================================

export { TOOLS, CHIDEALS_CONTEXT, isAgentSubmission, DECLARATIVE_ATTRS } from './webmcp_tools.js';
export { useWebMCP } from './useWebMCP.js';
export { wrapWithAnalytics, getAnalyticsSummary } from './webmcp_analytics.js';
export { MockModelContext, validateToolSchema, runToolTests, generateReport } from './webmcp_inspector.js';

export default init312DealsWebMCP;
