'use client';

import { useEffect } from 'react';

type SSEHandler = (data: unknown) => void;

// Module-level singleton state
let sharedEventSource: EventSource | null = null;
let refCount = 0;

/**
 * Get or create a shared EventSource singleton for the given URL.
 * Multiple callers share a single connection; the connection closes
 * only when every consumer has unmounted.
 */
function getSharedSSE(url: string): EventSource {
  if (!sharedEventSource || sharedEventSource.readyState === EventSource.CLOSED) {
    sharedEventSource = new EventSource(url);
  }
  refCount++;
  return sharedEventSource;
}

function releaseSharedSSE() {
  refCount--;
  if (refCount <= 0 && sharedEventSource) {
    sharedEventSource.close();
    sharedEventSource = null;
    refCount = 0;
  }
}

/**
 * Hook that subscribes to a shared Server-Sent Events connection.
 *
 * All components using the same URL share a single EventSource.
 * The connection is opened when the first consumer mounts and
 * closed when the last consumer unmounts.
 *
 * @param url       - SSE endpoint URL
 * @param handlers  - Map of event names to handler functions.
 *                    Use 'message' for the default `onmessage` event.
 *                    Data is automatically JSON-parsed when possible.
 *
 * @example
 * ```tsx
 * useAdminSSE('/api/admin/notifications/stream', {
 *   message: (data) => setCounts(data as NotificationCounts),
 * });
 * ```
 */
export function useAdminSSE(
  url: string,
  handlers: Record<string, SSEHandler>,
) {
  useEffect(() => {
    const es = getSharedSSE(url);

    const listeners: Array<[string, (e: MessageEvent) => void]> = [];

    for (const [event, handler] of Object.entries(handlers)) {
      const listener = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handler(data);
        } catch {
          handler(e.data);
        }
      };

      if (event === 'message') {
        // Default onmessage - use addEventListener so multiple subscribers work
        es.addEventListener('message', listener);
      } else {
        es.addEventListener(event, listener);
      }
      listeners.push([event, listener]);
    }

    return () => {
      for (const [event, listener] of listeners) {
        es.removeEventListener(event, listener);
      }
      releaseSharedSSE();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);
}
