'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Generic hook for fetching, filtering, paginating admin list data.
 * Reusable across admin pages (customers, clients, orders, products, etc.)
 *
 * @template T - The shape of each item in the list
 * @param apiEndpoint - The API endpoint to fetch from (e.g. '/api/admin/users?role=CUSTOMER')
 * @param options - Optional configuration
 * @param options.dataKey - The key in the JSON response that holds the array (default: auto-detect)
 * @param options.defaultFilters - Default filter values
 */
export interface UseAdminListOptions {
  /** Key in the API JSON response containing the items array. If not set, auto-detects first array value. */
  dataKey?: string;
  /** Default filter values keyed by filter name */
  defaultFilters?: Record<string, string>;
}

export interface UseAdminListReturn<T> {
  /** The full unfiltered list of items */
  items: T[];
  /** Whether the initial fetch is in progress */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Current search string */
  search: string;
  /** Update the search string */
  setSearch: (value: string) => void;
  /** Current filter values keyed by filter name */
  filters: Record<string, string>;
  /** Set a single filter value */
  setFilter: (key: string, value: string) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;
  /** Re-fetch data from the API */
  refresh: () => Promise<void>;
  /** Currently selected item ID */
  selectedId: string | null;
  /** Set the selected item ID */
  setSelectedId: (id: string | null) => void;
  /** The currently selected item (derived from items + selectedId) */
  selectedItem: T | null;
}

export function useAdminList<T extends { id: string }>(
  apiEndpoint: string,
  options?: UseAdminListOptions
): UseAdminListReturn<T> {
  const { dataKey, defaultFilters = {} } = options || {};

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiEndpoint);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const json = await res.json();

      // Extract the array from the response
      let list: T[];
      if (dataKey && json[dataKey]) {
        list = json[dataKey];
      } else if (Array.isArray(json)) {
        list = json;
      } else {
        // Auto-detect: find the first array value in the response object
        const arrayKey = Object.keys(json).find((k) => Array.isArray(json[k]));
        list = arrayKey ? json[arrayKey] : [];
      }

      setItems(list);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Error fetching ${apiEndpoint}:`, message);
      setError(message);
      setItems([]);
    }
    setLoading(false);
  }, [apiEndpoint, dataKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSearch('');
  }, [defaultFilters]);

  const selectedItem = useMemo(
    () => (selectedId ? items.find((item) => item.id === selectedId) ?? null : null),
    [items, selectedId]
  );

  return {
    items,
    loading,
    error,
    search,
    setSearch,
    filters,
    setFilter,
    resetFilters,
    refresh: fetchData,
    selectedId,
    setSelectedId,
    selectedItem,
  };
}
