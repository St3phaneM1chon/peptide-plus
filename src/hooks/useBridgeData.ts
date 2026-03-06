'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BridgeResponse } from '@/lib/bridges/types';

interface UseBridgeDataOptions {
  /** Skip fetching (e.g. when a required ID is not yet available) */
  skip?: boolean;
  /** Fetch lazily — only when `fetch()` is called manually */
  lazy?: boolean;
}

interface UseBridgeDataResult<T> {
  data: BridgeResponse<T> | null;
  loading: boolean;
  error: string | null;
  enabled: boolean;
  /** Manually trigger or re-trigger the fetch */
  fetch: () => Promise<void>;
}

/**
 * Shared hook for fetching cross-module bridge data.
 *
 * Encapsulates the fetch → parse → gate pattern used by every bridge.
 * Returns `{ enabled: false }` when the target module is disabled,
 * and the typed payload when enabled.
 *
 * @example
 * const { data, loading, enabled } = useBridgeData<AccountingBridgeData>(
 *   `/api/admin/orders/${orderId}/accounting`
 * );
 * if (!enabled) return null; // module disabled
 */
export function useBridgeData<T>(
  endpoint: string | null,
  options: UseBridgeDataOptions = {}
): UseBridgeDataResult<T> {
  const { skip = false, lazy = false } = options;
  const [data, setData] = useState<BridgeResponse<T> | null>(null);
  const [loading, setLoading] = useState(!lazy && !skip);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(async () => {
    if (!endpoint) return;

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      // API routes return { success, data } or just the bridge payload
      const payload = json.data ?? json;
      setData(payload as BridgeResponse<T>);
      fetchedRef.current = true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  // Auto-fetch on mount (unless lazy or skipped)
  useEffect(() => {
    if (skip || lazy || !endpoint || fetchedRef.current) return;
    doFetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [endpoint, skip, lazy, doFetch]);

  // Reset when endpoint changes
  useEffect(() => {
    fetchedRef.current = false;
    setData(null);
    setError(null);
  }, [endpoint]);

  const enabled = data !== null && 'enabled' in data ? data.enabled : false;

  return { data, loading, error, enabled, fetch: doFetch };
}

/**
 * Fetch multiple bridge endpoints in parallel.
 * Returns a keyed record of bridge responses.
 *
 * @example
 * const bridges = useBridgeDataMulti({
 *   accounting: `/api/admin/orders/${id}/accounting`,
 *   loyalty: `/api/admin/orders/${id}/loyalty`,
 *   marketing: `/api/admin/orders/${id}/marketing`,
 * });
 * // bridges.accounting.data, bridges.loyalty.enabled, etc.
 */
export function useBridgeDataMulti<
  K extends string,
  T extends Record<K, unknown>
>(
  endpoints: Record<K, string | null>,
  options: UseBridgeDataOptions = {}
): Record<K, UseBridgeDataResult<T[K]>> {
  const keys = Object.keys(endpoints) as K[];
  const [results, setResults] = useState<Record<K, UseBridgeDataResult<T[K]>>>(() => {
    const initial = {} as Record<K, UseBridgeDataResult<T[K]>>;
    for (const key of keys) {
      initial[key] = {
        data: null,
        loading: !options.skip && !options.lazy,
        error: null,
        enabled: false,
        fetch: async () => {},
      };
    }
    return initial;
  });

  const fetchAll = useCallback(async () => {
    const promises = keys.map(async (key) => {
      const endpoint = endpoints[key];
      if (!endpoint) return { key, data: null, error: null };
      try {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const payload = json.data ?? json;
        return { key, data: payload, error: null };
      } catch (err) {
        return { key, data: null, error: err instanceof Error ? err.message : String(err) };
      }
    });

    const settled = await Promise.all(promises);
    setResults((prev) => {
      const next = { ...prev };
      for (const { key, data, error } of settled) {
        const enabled = data !== null && typeof data === 'object' && 'enabled' in data ? (data as { enabled: boolean }).enabled : false;
        next[key] = {
          data: data as BridgeResponse<T[K]>,
          loading: false,
          error,
          enabled,
          fetch: async () => {},
        };
      }
      return next;
    });
  }, [endpoints, keys]);

  useEffect(() => {
    if (options.skip || options.lazy) return;
    fetchAll();
  }, [fetchAll, options.skip, options.lazy]);

  return results;
}
