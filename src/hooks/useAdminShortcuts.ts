'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Returns true when the active element is a text-entry field. */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useAdminShortcuts({ onCommandPalette }: { onCommandPalette?: () => void } = {}) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearG = useCallback(() => {
    pendingG.current = false;
    if (gTimer.current) {
      clearTimeout(gTimer.current);
      gTimer.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl/Cmd+K: open command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onCommandPalette?.();
        return;
      }

      // Don't fire shortcuts while typing in inputs
      if (isTyping()) return;

      // "?" opens help dialog
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        clearG();
        return;
      }

      // "g then X" sequences
      if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        pendingG.current = true;
        gTimer.current = setTimeout(clearG, 500);
        return;
      }

      if (pendingG.current) {
        clearG();
        const nav: Record<string, string> = {
          h: '/admin',
          o: '/admin/commandes',
          p: '/admin/produits',
          c: '/admin/clients',
          i: '/admin/inventaire',
        };
        const dest = nav[e.key];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearG();
    };
  }, [router, clearG, onCommandPalette]);

  return { helpOpen, setHelpOpen };
}
