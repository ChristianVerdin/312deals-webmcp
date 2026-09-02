/**
 * 312Deals WebMCP Analytics & Telemetry
 * ======================================
 * Tracks how AI agents interact with 312Deals WebMCP tools.
 *
 * Architecture:
 *   Agent calls tool → wrapWithAnalytics() intercepts
 *     → Logs to in-memory buffer
 *     → Flushes to /api/v1/analytics/webmcp (batched, 30s intervals)
 *     → Exposes real-time stats via getAnalyticsSummary()
 *
 * Soft Navigation Support (Chrome 145+):
 *   Next.js SPA route changes trigger "soft navigations", no full page reload.
 *   Without handling these, analytics would be lost between routes.
 *   observeSoftNavigations() uses PerformanceObserver to detect these and
 *   flush the buffer + re-enhance declarative forms on the new page.
 */

// ============================================================
// EVENT BUFFER & CONFIG
// ============================================================

const ANALYTICS_CONFIG = {
  enabled: true,
  flushIntervalMs: 30_000,
  maxBufferSize: 100,
  endpoint: '/api/v1/analytics/webmcp',
  debug: typeof process !== 'undefined' && process.env?.NODE_ENV === 'development',
};

let eventBuffer = [];
let flushTimer = null;
let sessionStartedAt = null;
let sessionId = null;
let currentNavigationType = 'hard'; // 'hard' | 'soft'

// ============================================================
// SESSION MANAGEMENT
// ============================================================

function initSession() {
  if (sessionId) return;
  sessionId = `wmcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  sessionStartedAt = new Date().toISOString();
}

// ============================================================
// EVENT TRACKING
// ============================================================

/**
 * Record an agent tool call event.
 */
function trackToolCall(toolName, params, result, durationMs) {
  if (!ANALYTICS_CONFIG.enabled) return;
  initSession();

  const event = {
    type: 'tool_call',
    session_id: sessionId,
    tool_name: toolName,
    params_keys: Object.keys(params || {}),
    param_count: Object.keys(params || {}).length,
    has_result: !!result && !result?.error,
    result_size: result ? JSON.stringify(result).length : 0,
    duration_ms: durationMs,
    timestamp: new Date().toISOString(),
    page_url: typeof window !== 'undefined' ? window.location.pathname : null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    navigation_type: currentNavigationType,
  };

  eventBuffer.push(event);

  if (ANALYTICS_CONFIG.debug) {
    console.log(`[WebMCP Analytics] ${toolName}`, {
      params: Object.keys(params || {}),
      duration: `${durationMs}ms`,
      success: !result?.error,
      nav: currentNavigationType,
    });
  }

  if (eventBuffer.length >= ANALYTICS_CONFIG.maxBufferSize) {
    flushEvents();
  }
}

/**
 * Record tool registration events.
 */
export function trackRegistration(toolName, success) {
  if (!ANALYTICS_CONFIG.enabled) return;
  initSession();
  eventBuffer.push({
    type: 'tool_registration',
    session_id: sessionId,
    tool_name: toolName,
    success,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Record context provision.
 */
export function trackContextProvision(success) {
  if (!ANALYTICS_CONFIG.enabled) return;
  initSession();
  eventBuffer.push({
    type: 'context_provided',
    session_id: sessionId,
    success,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Record a soft navigation event (for analytics continuity).
 */
function trackSoftNavigation(url) {
  if (!ANALYTICS_CONFIG.enabled) return;
  initSession();
  eventBuffer.push({
    type: 'soft_navigation',
    session_id: sessionId,
    page_url: url,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================
// HANDLER WRAPPER
// ============================================================

/**
 * Wrap a tool handler with analytics tracking.
 */
export function wrapWithAnalytics(toolName, handler) {
  return async function instrumentedHandler(params) {
    const startTime = performance.now();
    let result;
    let error;

    try {
      result = await handler(params);
      return result;
    } catch (e) {
      error = e;
      throw e;
    } finally {
      const durationMs = Math.round(performance.now() - startTime);
      trackToolCall(toolName, params, error ? { error: error.message } : result, durationMs);
    }
  };
}

// ============================================================
// FLUSH TO SERVER
// ============================================================

async function flushEvents() {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0);

  try {
    const resp = await fetch(ANALYTICS_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        session_started_at: sessionStartedAt,
        events: batch,
        flushed_at: new Date().toISOString(),
      }),
      keepalive: true,
    });

    if (!resp.ok && ANALYTICS_CONFIG.debug) {
      console.warn('[WebMCP Analytics] Flush failed:', resp.status);
    }
  } catch (e) {
    if (ANALYTICS_CONFIG.debug) {
      console.warn('[WebMCP Analytics] Flush error:', e.message);
    }
    if (eventBuffer.length < ANALYTICS_CONFIG.maxBufferSize * 2) {
      eventBuffer.unshift(...batch);
    }
  }
}

// ============================================================
// SOFT NAVIGATION OBSERVER (Chrome 145+)
// ============================================================

/**
 * Observe soft navigations (Next.js SPA route changes) to:
 *   1. Flush analytics buffer (prevent data loss)
 *   2. Track navigation events for funnel analysis
 *   3. Re-enhance declarative forms on new page content
 *
 * Chrome 145+ exposes soft navigations in the Performance panel.
 * PerformanceObserver with type 'soft-navigation' detects these.
 *
 * @returns {PerformanceObserver|null} The observer instance (for disconnect on teardown)
 */
export function observeSoftNavigations() {
  if (typeof PerformanceObserver === 'undefined') return null;

  // Check if soft-navigation is a supported entry type
  try {
    const supported = PerformanceObserver.supportedEntryTypes;
    if (!supported || !supported.includes('soft-navigation')) {
      // Fallback: use popstate + pushState for older browsers
      if (typeof window !== 'undefined') {
        _setupPushStateFallback();
      }
      return null;
    }
  } catch (_) {
    return null;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        currentNavigationType = 'soft';

        if (ANALYTICS_CONFIG.debug) {
          console.log(`[WebMCP Analytics] Soft navigation detected: ${entry.name}`);
        }

        // Flush current buffer before the new "page"
        flushEvents();

        // Track the navigation itself
        trackSoftNavigation(entry.name);

        // Re-enhance declarative forms on the new page content
        // Use requestAnimationFrame to wait for DOM update
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            import('./webmcp_tools.js').then(({ enhanceFormsForWebMCP }) => {
              enhanceFormsForWebMCP();
            }).catch(() => {});
          });
        }
      }
    });

    observer.observe({ type: 'soft-navigation', buffered: true });
    return observer;
  } catch (e) {
    if (ANALYTICS_CONFIG.debug) {
      console.warn('[WebMCP Analytics] Soft navigation observer failed:', e.message);
    }
    return null;
  }
}

/**
 * Fallback for browsers without soft-navigation PerformanceObserver.
 * Listens for pushState/replaceState/popstate to detect SPA navigations.
 */
function _setupPushStateFallback() {
  if (typeof window === 'undefined') return;

  let lastUrl = window.location.href;

  const checkNavigation = () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      currentNavigationType = 'soft';

      if (ANALYTICS_CONFIG.debug) {
        console.log(`[WebMCP Analytics] SPA navigation detected (fallback): ${currentUrl}`);
      }

      flushEvents();
      trackSoftNavigation(window.location.pathname);
    }
  };

  // Listen for popstate (back/forward)
  window.addEventListener('popstate', checkNavigation);

  // Intercept pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    checkNavigation();
  };

  history.replaceState = function (...args) {
    originalReplaceState.apply(this, args);
    checkNavigation();
  };
}

// ============================================================
// REAL-TIME SUMMARY
// ============================================================

/**
 * Get real-time analytics summary for the current session.
 */
export function getAnalyticsSummary() {
  const toolCalls = eventBuffer.filter(e => e.type === 'tool_call');
  const softNavs = eventBuffer.filter(e => e.type === 'soft_navigation');
  const toolCounts = {};

  for (const call of toolCalls) {
    toolCounts[call.tool_name] = (toolCounts[call.tool_name] || 0) + 1;
  }

  return {
    session_id: sessionId,
    session_started_at: sessionStartedAt,
    total_events: eventBuffer.length,
    total_tool_calls: toolCalls.length,
    tool_call_counts: toolCounts,
    soft_navigations: softNavs.length,
    avg_duration_ms: toolCalls.length > 0
      ? Math.round(toolCalls.reduce((sum, c) => sum + (c.duration_ms || 0), 0) / toolCalls.length)
      : 0,
    buffer_size: eventBuffer.length,
    last_event_at: eventBuffer.length > 0
      ? eventBuffer[eventBuffer.length - 1].timestamp
      : null,
  };
}

// ============================================================
// LIFECYCLE
// ============================================================

/**
 * Start the analytics flush timer.
 */
export function startAnalytics() {
  if (!ANALYTICS_CONFIG.enabled) return;
  initSession();

  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(flushEvents, ANALYTICS_CONFIG.flushIntervalMs);

  // Flush on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flushEvents);

    // sendBeacon for reliable page-exit analytics
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        const batch = eventBuffer.splice(0);
        if (batch.length > 0 && navigator.sendBeacon) {
          navigator.sendBeacon(
            ANALYTICS_CONFIG.endpoint,
            JSON.stringify({ session_id: sessionId, events: batch })
          );
        }
      }
    });
  }

  if (ANALYTICS_CONFIG.debug) {
    console.log(`[WebMCP Analytics] Started. Session: ${sessionId}`);
  }
}

/**
 * Stop analytics and flush remaining events.
 */
export function stopAnalytics() {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  flushEvents();
}

export default {
  wrapWithAnalytics,
  startAnalytics,
  stopAnalytics,
  getAnalyticsSummary,
  trackRegistration,
  trackContextProvision,
  observeSoftNavigations,
};
