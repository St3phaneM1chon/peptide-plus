'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';
import { folderSections, type NavFolderItem } from '@/lib/admin/outlook-nav';

/* ── Static page index built from outlook-nav config ───────── */

interface SearchItem {
  label: string;
  path: string;
  section: string;
  keywords: string[];
}

function buildSearchItems(): SearchItem[] {
  const items: SearchItem[] = [];
  const seen = new Set<string>();

  for (const section of Object.values(folderSections)) {
    for (const group of section.groups) {
      const walk = (node: NavFolderItem) => {
        const key = node.href;
        if (seen.has(key)) return;
        seen.add(key);
        // Extract readable label from the i18n key (last segment, camelCase to words)
        const raw = node.labelKey.split('.').pop() || '';
        const label = raw.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
        items.push({
          label,
          path: node.href,
          section: section.title.split('.').pop()?.replace(/([A-Z])/g, ' $1').trim() || '',
          keywords: [label.toLowerCase(), node.href.toLowerCase()],
        });
        node.children?.forEach(walk);
      };
      group.items.forEach(walk);
    }
  }
  return items;
}

const SEARCH_ITEMS = buildSearchItems();

/* ── Component ─────────────────────────────────────────────── */

export default function AdminCommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  // Filter results
  const results = useMemo(() => {
    if (!query.trim()) return SEARCH_ITEMS;
    const q = query.toLowerCase();
    return SEARCH_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q) ||
        item.keywords.some((kw) => kw.includes(q)),
    );
  }, [query]);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Delay focus to next tick so the dialog is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Clamp active index when results change
  useEffect(() => {
    setActiveIndex((prev) => Math.min(prev, Math.max(results.length - 1, 0)));
  }, [results.length]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const navigate = useCallback(
    (path: string) => {
      onClose();
      router.push(path);
    },
    [router, onClose],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((i) => (i + 1) % (results.length || 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((i) => (i - 1 + (results.length || 1)) % (results.length || 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[activeIndex]) navigate(results[activeIndex].path);
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, activeIndex, navigate, onClose],
  );

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Search admin pages..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">No results found.</p>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  idx === activeIndex ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded flex-shrink-0">
                  {item.section}
                </span>
                {idx === activeIndex && (
                  <CornerDownLeft className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">&uarr;&darr;</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">&crarr;</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px]">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );
}
