'use client';

import { useEffect } from 'react';

/**
 * Listens for ribbon-action CustomEvents and calls the handler
 * when the event's key matches the given actionKey.
 *
 * Usage in a page:
 *   useRibbonAction('export', handleExport);
 *   useRibbonAction('delete', handleDelete);
 */
export function useRibbonAction(actionKey: string, handler: () => void): void {
  useEffect(() => {
    const listener = (e: Event) => {
      const detail = (e as CustomEvent<{ key: string }>).detail;
      if (detail?.key === actionKey) {
        handler();
      }
    };
    window.addEventListener('ribbon-action', listener);
    return () => window.removeEventListener('ribbon-action', listener);
  }, [actionKey, handler]);
}

/** Dispatch a ribbon action event (used by OutlookRibbon) */
export function dispatchRibbonAction(key: string): void {
  window.dispatchEvent(
    new CustomEvent('ribbon-action', { detail: { key } })
  );
}
