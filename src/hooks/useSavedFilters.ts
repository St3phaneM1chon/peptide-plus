'use client';

import { useState, useCallback, useEffect } from 'react';

interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

export function useSavedFilters(pageKey: string) {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const storageKey = `admin-filters-${pageKey}`;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setSavedFilters(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const saveFilter = useCallback(
    (name: string, filters: Record<string, unknown>) => {
      const newFilter: SavedFilter = {
        id: Date.now().toString(36),
        name,
        filters,
        createdAt: new Date().toISOString(),
      };
      setSavedFilters((prev) => {
        const updated = [...prev, newFilter];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
      return newFilter;
    },
    [storageKey]
  );

  const deleteFilter = useCallback(
    (id: string) => {
      setSavedFilters((prev) => {
        const updated = prev.filter((f) => f.id !== id);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [storageKey]
  );

  const updateFilter = useCallback(
    (id: string, name: string, filters: Record<string, unknown>) => {
      setSavedFilters((prev) => {
        const updated = prev.map((f) => (f.id === id ? { ...f, name, filters } : f));
        localStorage.setItem(storageKey, JSON.stringify(updated));
        return updated;
      });
    },
    [storageKey]
  );

  return { savedFilters, saveFilter, deleteFilter, updateFilter };
}
