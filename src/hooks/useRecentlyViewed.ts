'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'biocycle-recently-viewed';
const MAX_ITEMS = 10;

/**
 * Hook to manage recently viewed product slugs in localStorage.
 * Stores up to 10 slugs, deduplicated, most recent first.
 */
export function useRecentlyViewed() {
  const [recentSlugs, setRecentSlugs] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSlugs(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Add a viewed product slug (deduplicates, most recent first)
  const addViewed = useCallback((slug: string) => {
    setRecentSlugs((prev) => {
      // Remove slug if already present, then prepend it
      const filtered = prev.filter((s) => s !== slug);
      const updated = [slug, ...filtered].slice(0, MAX_ITEMS);

      // Persist to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage errors (e.g. quota exceeded)
      }

      return updated;
    });
  }, []);

  return { recentSlugs, addViewed };
}
