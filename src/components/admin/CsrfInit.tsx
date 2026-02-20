'use client';

import { useEffect } from 'react';

/**
 * CsrfInit - Auto-injects CSRF tokens into all admin mutation requests.
 *
 * On mount:
 * 1. Calls GET /api/csrf to set the csrf-token cookie
 * 2. Overrides window.fetch to automatically add X-CSRF-Token header
 *    for POST/PUT/PATCH/DELETE requests to same-origin API routes.
 *
 * This means no individual admin page needs to handle CSRF manually.
 */

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CSRF_COOKIE_NAME = 'csrf-token';

function readTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME && value) {
      try {
        const decoded = JSON.parse(atob(decodeURIComponent(value)));
        return decoded?.token || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export default function CsrfInit() {
  useEffect(() => {
    let mounted = true;

    // Step 1: Fetch CSRF token to set the cookie
    fetch('/api/csrf')
      .then(res => res.json())
      .catch(() => {
        // Silently fail - the cookie might already exist
      });

    // Step 2: Override window.fetch to auto-inject CSRF header
    const originalFetch = window.fetch;

    window.fetch = function patchedFetch(
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      // Determine the method
      const method = (init?.method || 'GET').toUpperCase();

      // Only intercept mutation methods
      if (!MUTATION_METHODS.has(method)) {
        return originalFetch.call(window, input, init);
      }

      // Only intercept same-origin API requests
      let url: string;
      if (typeof input === 'string') {
        url = input;
      } else if (input instanceof URL) {
        url = input.toString();
      } else if (input instanceof Request) {
        url = input.url;
      } else {
        return originalFetch.call(window, input, init);
      }

      // Only intercept /api/ routes (relative or same-origin)
      const isRelativeApi = url.startsWith('/api/');
      const isSameOriginApi = url.startsWith(window.location.origin + '/api/');
      if (!isRelativeApi && !isSameOriginApi) {
        return originalFetch.call(window, input, init);
      }

      // Read token from cookie
      const token = readTokenFromCookie();
      if (!token) {
        return originalFetch.call(window, input, init);
      }

      // Inject the CSRF header
      const headers = new Headers(init?.headers);
      if (!headers.has('X-CSRF-Token') && !headers.has('x-csrf-token')) {
        headers.set('X-CSRF-Token', token);
      }

      return originalFetch.call(window, input, { ...init, headers });
    };

    // Refresh token every 50 minutes (token expires in 60 minutes)
    const refreshInterval = setInterval(() => {
      if (mounted) {
        fetch('/api/csrf').catch(() => {});
      }
    }, 50 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(refreshInterval);
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
