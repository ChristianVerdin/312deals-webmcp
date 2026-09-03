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
import { TONIGHT_TOOLS } from './tonight_tools.js';

// Data tools proxy the public API; Tonight tools act on the shared plan
// rendered in the page — the part a person and their agent build together.
const ALL_TOOLS = [...TOOLS, ...TONIGHT_TOOLS];
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
let _apiSurface = null; // 'document' | 'navigator' | null

/**
 * The spec moved the entry point from navigator.modelContext (Chrome 146–148
 * Canary, Feb 2026) to document.modelContext (W3C WebML CG draft; ChatGPT
 * desktop browser and Chrome 149+ implement this one). Prefer document, fall
 * back to navigator, so both generations of agent browsers see the tools.
 */
export function getModelContext() {
  if (typeof document !== 'undefined' && typeof document.modelContext?.registerTool === 'function') {
    _apiSurface = 'document';
    return document.modelContext;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.modelContext?.registerTool === 'function') {
    _apiSurface = 'navigator';
    return navigator.modelContext;
  }
  _apiSurface = null;
  return null;
}

export function getApiSurface() {
  if (_apiSurface === null) getModelContext();
  return _apiSurface;
}

export function detectWebMCP() {
  let mc = getModelContext();

  // Polyfill (@mcp-b/global) may be loaded but not yet initialized
  if (!mc && typeof window !== 'undefined' && window.__mcpbGlobalInit) {
    try { window.__mcpbGlobalInit(); mc = getModelContext(); } catch (_) {}
  }

  if (!mc) {
    _detectionSource = 'unavailable';
    return { available: false, source: 'unavailable', surface: null };
  }
  _detectionSource = mc.__polyfill ? 'polyfill' : 'native';
  return { available: true, source: _detectionSource, surface: _apiSurface };
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
      if (getModelContext()) {
        _detectionSource = 'polyfill';
        return { available: true, source: 'polyfill', surface: _apiSurface };
      }
    } catch (_) {
      // @mcp-b/global not installed or import failed
    }
  }

  _detectionSource = 'unavailable';
  return { available: false, source: 'unavailable', surface: null };
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
let _abortController = null;

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
        '[312Deals WebMCP] modelContext not available on document or navigator.\n' +
        '  ChatGPT desktop browser: supported out of the box.\n' +
        '  Chrome 149+: enable chrome://flags/#enable-webmcp-testing or the origin trial.\n' +
        '  Tools will not be registered.'
      );
    }
    return { available: false, registered: 0, tools: [], detectionSource: 'unavailable', apiSurface: null };
  }

  const mc = getModelContext();
  _abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const registerOptions = _abortController ? { signal: _abortController.signal } : undefined;

  if (debug) {
    console.log(`[312Deals WebMCP] Initializing... (source: ${detection.source}, surface: ${detection.surface}.modelContext)`);
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

  for (const tool of ALL_TOOLS) {
    try {
      const execute = analytics
        ? wrapWithAnalytics(tool.name, tool.execute)
        : tool.execute;

      mc.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: tool.readOnly !== false,
          ...(tool.annotations || {}),
        },
        execute: execute,
      }, registerOptions);

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
    console.log(`[312Deals WebMCP] ${registered}/${ALL_TOOLS.length} tools registered. Source: ${detection.source}`);
  }

  return { available: true, registered, tools: toolNames, detectionSource: detection.source, apiSurface: detection.surface };
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

  // Current spec unregisters via the AbortSignal passed at registration;
  // older Canary builds expose unregisterTool/clearContext. Do both.
  if (_abortController) {
    try { _abortController.abort(); } catch (_) {}
    _abortController = null;
  }
  const mc = getModelContext();
  if (mc) {
    for (const name of _registeredTools) {
      try { mc.unregisterTool?.(name); } catch (_) {}
    }
    try { mc.clearContext?.(); } catch (_) {}
  }

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
    api_surface: getApiSurface(),
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
export { TONIGHT_TOOLS } from './tonight_tools.js';
export { useWebMCP } from './useWebMCP.js';
export { wrapWithAnalytics, getAnalyticsSummary } from './webmcp_analytics.js';
export { MockModelContext, validateToolSchema, runToolTests, generateReport } from './webmcp_inspector.js';

export default init312DealsWebMCP;
