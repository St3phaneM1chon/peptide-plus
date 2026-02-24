'use client';

import useSWR, { type SWRConfiguration } from 'swr';

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}`);
    throw error;
  }
  return res.json();
};

/**
 * SWR-based data fetching hook for admin pages.
 * Provides automatic caching, revalidation, and deduplication.
 *
 * @param endpoint - API endpoint to fetch (e.g. '/api/admin/promotions')
 * @param dataKey - Key in JSON response holding the data array (auto-detects if omitted)
 * @param config - SWR configuration overrides
 */
export function useAdminSWR<T>(
  endpoint: string | null,
  dataKey?: string,
  config?: SWRConfiguration
) {
  const { data: raw, error, isLoading, mutate } = useSWR(
    endpoint,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      ...config,
    }
  );

  // Extract array from response
  let items: T[] = [];
  if (raw) {
    if (dataKey && raw[dataKey]) {
      items = raw[dataKey];
    } else if (Array.isArray(raw)) {
      items = raw;
    } else {
      const arrayKey = Object.keys(raw).find((k) => Array.isArray(raw[k]));
      items = arrayKey ? raw[arrayKey] : [];
    }
  }

  return {
    items,
    raw,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    refresh: () => mutate(),
    mutate,
  };
}
