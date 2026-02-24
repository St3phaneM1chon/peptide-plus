'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

/**
 * Persist filter / search state in URL query parameters.
 * Uses Next.js App Router navigation (shallow).
 *
 * @param keys - Filter keys to sync with URL (e.g. ['status', 'search', 'tab'])
 * @param defaults - Default values for each key (omitted from URL when matching default)
 */
export function useUrlFilters(
  keys: string[],
  defaults?: Record<string, string>
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => {
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = searchParams.get(key) || defaults?.[key] || '';
    }
    return result;
  }, [searchParams, keys, defaults]);

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const defaultVal = defaults?.[key] || '';
      if (value === defaultVal || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [searchParams, pathname, router, defaults]
  );

  const resetFilters = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [pathname, router]);

  return { filters, setFilter, resetFilters };
}
