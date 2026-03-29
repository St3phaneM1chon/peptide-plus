'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

interface StockPhoto {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  alt: string;
  photographer: string;
  source: 'unsplash' | 'pexels';
  sourceUrl: string;
}

interface PhotoBrowserProps {
  onSelect: (url: string, alt: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_SEARCHES = [
  'Restaurant', 'Bureau', 'Nature', 'Technologie', 'Architecture', 'Santé',
];

export default function PhotoBrowser({ onSelect, isOpen, onClose }: PhotoBrowserProps) {
  const [query, setQuery] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPhotos = useCallback(async (q: string, p: number, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set('q', q);
      const res = await fetch(`/api/admin/page-builder/photos?${params}`);
      if (!res.ok) throw new Error('Fetch failed');
      const data: { photos: StockPhoto[]; query: string; page: number } = await res.json();
      setPhotos(prev => append ? [...prev, ...data.photos] : data.photos);
      setHasMore(data.photos.length >= 20);
    } catch {
      if (!append) setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchPhotos(query, 1, false);
    }
  }, [isOpen, query, fetchPhotos]);

  const handleSearch = () => {
    const q = inputValue.trim();
    setQuery(q);
    setPage(1);
  };

  const handleQuickSearch = (term: string) => {
    setInputValue(term);
    setQuery(term);
    setPage(1);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPhotos(query, next, true);
  };

  const handleSelect = (photo: StockPhoto) => {
    onSelect(photo.url, photo.alt);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative flex flex-col w-full max-w-md h-full bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">Photos</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100 transition-colors"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-zinc-700 shrink-0 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Rechercher des photos..."
              className="flex-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-600 rounded-md text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-400"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 text-sm bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md transition-colors"
            >
              OK
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_SEARCHES.map(term => (
              <button
                key={term}
                onClick={() => handleQuickSearch(term)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  query === term
                    ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                    : 'border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200'
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && photos.length === 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[4/3] bg-zinc-800 rounded animate-pulse" />
              ))}
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-sm gap-2">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Aucune photo trouvée
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {photos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => handleSelect(photo)}
                    className="group relative aspect-[4/3] rounded overflow-hidden bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                  >
                    <Image
                      src={photo.thumbUrl}
                      alt={photo.alt}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-200"
                      sizes="(max-width: 448px) 50vw, 224px"
                      unoptimized
                    />
                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-zinc-200 truncate">{photo.photographer}</p>
                      <p className="text-[9px] text-zinc-400 capitalize">{photo.source}</p>
                    </div>
                  </button>
                ))}
              </div>

              {hasMore && (
                <div className="mt-3 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Chargement…' : 'Charger plus'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
