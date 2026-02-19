'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import { useCurrency } from '@/contexts/CurrencyContext';

interface SearchResult {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  purity?: number;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();
  const { t, locale } = useI18n();
  const { formatPrice } = useCurrency();

  // Focus input when modal opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!open) {
      setQuery('');
      setResults([]);
    }
  }, [open]);

  // Search products
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(query)}&locale=${locale}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.products || []);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, locale]);

  // Close on Escape + Focus trap
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (!open) previousFocusRef.current?.focus();
    };
  }, [open, handleKeyDown]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const popularSearches = [
    'BPC-157',
    'TB-500',
    'Semaglutide',
    'Tirzepatide',
    'Ipamorelin',
    'GHK-Cu',
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('shop.aria.searchProducts')}
        className="fixed inset-x-4 top-20 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-white rounded-xl shadow-2xl z-50 overflow-hidden"
      >
        {/* Search Input */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-neutral-200">
          <svg className="w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            aria-label={t('shop.aria.searchProducts')}
            className="flex-1 text-lg outline-none placeholder:text-neutral-400"
          />
          <button
            onClick={onClose}
            aria-label={t('shop.aria.closeSearch')}
            className="p-2 text-neutral-400 hover:text-neutral-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="max-h-96 overflow-y-auto" aria-live="polite" aria-atomic="false">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length > 0 ? (
            <>
              <div className="py-2">
                {results.slice(0, 5).map((result) => (
                  <Link
                    key={result.id}
                    href={`/product/${result.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-4 px-6 py-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">🧬</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-neutral-900">{result.name}</p>
                      <p className="text-sm text-neutral-500">{result.category}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-semibold text-neutral-900">{formatPrice(result.price)}</p>
                      {result.purity && (
                        <p className="text-xs text-emerald-600">{t('search.purityPercent').replace('{purity}', String(result.purity))}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
              {/* View all results link */}
              <div className="border-t border-neutral-200 px-6 py-3">
                <button
                  onClick={() => {
                    router.push(`/search?q=${encodeURIComponent(query)}`);
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors"
                >
                  {t('search.viewAllResults').replace('{count}', String(results.length))}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </>
          ) : query ? (
            <div className="py-12 text-center">
              <p className="text-neutral-500 mb-3">{t('search.noResultsFor').replace('{query}', query)}</p>
              <button
                onClick={() => {
                  router.push(`/search?q=${encodeURIComponent(query)}`);
                  onClose();
                }}
                className="text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                {t('search.tryAdvancedSearch')}
              </button>
            </div>
          ) : (
            <div className="p-6">
              <p className="text-sm font-medium text-neutral-500 mb-3">{t('search.popularSearches')}</p>
              <div className="flex flex-wrap gap-2">
                {popularSearches.map((term) => (
                  <button
                    key={term}
                    onClick={() => setQuery(term)}
                    aria-label={t('shop.aria.popularSearchFor', { term })}
                    className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-full text-sm hover:bg-neutral-200 transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
