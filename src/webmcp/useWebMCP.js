/**
 * 312Deals WebMCP React Hook
 * ============================
 * Drop-in hook for Next.js App Router or Pages Router.
 * Handles init, teardown, and soft navigation re-registration.
 *
 * Usage (App Router, in a client component):
 *   'use client';
 *   import { useWebMCP } from '@/webmcp/useWebMCP';
 *
 *   export default function WebMCPProvider({ children }) {
 *     const { available, registered, status } = useWebMCP();
 *     return children;
 *   }
 *
 * Usage (Pages Router, in _app.js):
 *   import { useWebMCP } from '@/webmcp/useWebMCP';
 *
 *   export default function MyApp({ Component, pageProps }) {
 *     useWebMCP();
 *     return <Component {...pageProps} />;
 *   }
 */

import { useState, useEffect, useRef } from 'react';
import { init312DealsWebMCP, teardown312DealsWebMCP, getWebMCPStatus } from './index.js';

/**
 * @param {Object} options, passed through to init312DealsWebMCP()
 * @param {boolean} options.analytics - Enable analytics (default: true)
 * @param {boolean} options.declarativeForms - Enhance HTML forms (default: true)
 * @param {boolean} options.humanInTheLoop - Enable requestUserInteraction (default: true)
 * @param {boolean} options.debug - Console logging (default: NODE_ENV === 'development')
 *
 * @returns {{ available: boolean, registered: number, tools: string[], status: object }}
 */
export function useWebMCP(options = {}) {
  const [state, setState] = useState({
    available: false,
    registered: 0,
    tools: [],
    detectionSource: 'unknown', // 'native' | 'polyfill' | 'unavailable'
  });

  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    init312DealsWebMCP({
      analytics: true,
      declarativeForms: true,
      humanInTheLoop: true,
      debug: typeof process !== 'undefined' && process.env?.NODE_ENV === 'development',
      ...options,
    }).then((result) => {
      setState({
        available: result.available,
        registered: result.registered,
        tools: result.tools,
        detectionSource: result.detectionSource || 'unknown',
      });
    }).catch(() => {
      // WebMCP init failed, degrade gracefully
    });

    return () => {
      teardown312DealsWebMCP();
      initRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    status: typeof navigator !== 'undefined' ? getWebMCPStatus() : null,
  };
}

export default useWebMCP;
