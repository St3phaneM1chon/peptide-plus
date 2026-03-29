'use client';

import React, { useState, useCallback } from 'react';

interface Photo {
  id: string;
  url: string;
  thumbUrl: string;
  alt: string;
  photographer: string;
  source: string;
}

interface ImagePickerFieldProps {
  value: string;
  onChange: (val: string) => void;
  field?: object;
}

const QUICK_CATEGORIES = ['Bureau', 'Restaurant', 'Nature', 'Tech'];

export function ImagePickerField({ value, onChange }: ImagePickerFieldProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [query, setQuery] = useState('');
  const [urlInputValue, setUrlInputValue] = useState(value || '');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPhotos = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/page-builder/photos?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPhotos(query);
  };

  const handleQuickCategory = (cat: string) => {
    setQuery(cat);
    fetchPhotos(cat);
    setShowSearch(true);
  };

  const handleSelectPhoto = (photo: Photo) => {
    onChange(photo.url);
    setShowSearch(false);
    setPhotos([]);
    setQuery('');
  };

  const handlePasteUrl = () => {
    if (showUrlInput) {
      onChange(urlInputValue);
      setShowUrlInput(false);
    } else {
      setUrlInputValue(value || '');
      setShowUrlInput(true);
      setShowSearch(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setUrlInputValue('');
    setShowSearch(false);
    setShowUrlInput(false);
    setPhotos([]);
  };

  const toggleBrowse = () => {
    setShowSearch((prev) => !prev);
    setShowUrlInput(false);
    if (!showSearch) setPhotos([]);
  };

  return (
    <div className="flex flex-col gap-2 text-sm text-zinc-100">
      {/* Thumbnail preview */}
      {value && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700">
          <img
            src={value}
            alt="Aperçu"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={toggleBrowse}
          className="px-2.5 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs font-medium transition-colors"
        >
          Parcourir photos
        </button>
        <button
          type="button"
          onClick={handlePasteUrl}
          className="px-2.5 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs font-medium transition-colors"
        >
          {showUrlInput ? 'Appliquer URL' : 'Coller URL'}
        </button>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2.5 py-1 rounded bg-red-900/60 hover:bg-red-800/80 text-xs font-medium transition-colors"
          >
            Supprimer
          </button>
        )}
      </div>

      {/* Manual URL input */}
      {showUrlInput && (
        <input
          type="text"
          value={urlInputValue}
          onChange={(e) => setUrlInputValue(e.target.value)}
          placeholder="https://exemple.com/image.jpg"
          className="w-full px-2.5 py-1.5 rounded bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-400"
          onKeyDown={(e) => { if (e.key === 'Enter') { onChange(urlInputValue); setShowUrlInput(false); } }}
        />
      )}

      {/* Search panel */}
      {showSearch && (
        <div className="flex flex-col gap-2 p-2 rounded-lg bg-zinc-900 border border-zinc-700">
          {/* Quick categories */}
          <div className="flex gap-1 flex-wrap">
            {QUICK_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => handleQuickCategory(cat)}
                className="px-2 py-0.5 rounded-full bg-zinc-700 hover:bg-zinc-600 text-xs transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search form */}
          <form onSubmit={handleSearch} className="flex gap-1.5">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher..."
              className="flex-1 px-2 py-1 rounded bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none focus:border-zinc-400"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-xs font-medium transition-colors"
            >
              OK
            </button>
          </form>

          {/* Results grid */}
          {loading ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-video rounded bg-zinc-700 animate-pulse" />
              ))}
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handleSelectPhoto(photo)}
                  className="relative aspect-video rounded overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all focus:outline-none focus:border-blue-400"
                  title={photo.alt || photo.photographer}
                >
                  <img
                    src={photo.thumbUrl || photo.url}
                    alt={photo.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : (
            photos !== null && query && !loading && (
              <p className="text-zinc-500 text-xs text-center py-2">Aucun résultat</p>
            )
          )}
        </div>
      )}
    </div>
  );
}
