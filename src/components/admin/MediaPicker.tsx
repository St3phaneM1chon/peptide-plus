/**
 * MediaPicker — Unified media selection component
 * Chantier 3.1: Modal with search, filters, preview, and upload.
 */
'use client';

import { useState, useCallback, useEffect } from 'react';
import NextImage from 'next/image';
import {
  Search, X, ImageIcon, Film, FileText, Upload,
  Check, Loader2, FolderOpen,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MediaItem {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  alt: string | null;
  folder: string;
  createdAt: string;
}

interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
  multiple?: boolean;
  onSelectMultiple?: (media: MediaItem[]) => void;
  accept?: 'image' | 'video' | 'document' | 'all';
  title?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MediaPicker({
  open,
  onClose,
  onSelect,
  multiple = false,
  onSelectMultiple,
  accept = 'all',
  title,
}: MediaPickerProps) {
  const { t } = useI18n();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<MediaItem | null>(null);

  const mimeFilter = accept === 'image' ? 'image' : accept === 'video' ? 'video' : accept === 'document' ? 'application' : '';

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '24' });
      if (search) params.set('search', search);
      if (folder) params.set('folder', folder);
      if (mimeFilter) params.set('mimeType', mimeFilter);
      params.set('sortBy', 'createdAt');
      params.set('sortDir', 'desc');

      const res = await fetch(`/api/admin/medias?${params}`);
      const data = await res.json();
      setMedia(data.media || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      toast.error('Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [page, search, folder, mimeFilter]);

  useEffect(() => {
    if (open) {
      loadMedia();
      setSelected(new Set());
      setPreview(null);
    }
  }, [open, loadMedia]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleSelect = (item: MediaItem) => {
    if (!multiple) {
      onSelect(item);
      onClose();
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  };

  const confirmMultiple = () => {
    if (onSelectMultiple) {
      const selectedMedia = media.filter((m) => selected.has(m.id));
      onSelectMultiple(selectedMedia);
    }
    onClose();
  };

  const isImage = (mime: string) => mime.startsWith('image/');
  const isVideo = (mime: string) => mime.startsWith('video/');

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold">
            {title || t('admin.media.selectMedia') || 'Select Media'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 p-4 border-b dark:border-gray-700">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search') || 'Search...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm"
            />
          </div>
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Folder..."
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm w-40"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : media.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Upload className="w-12 h-12 mb-2" />
              <p>{t('admin.media.noMedia') || 'No media found'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {media.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleSelect(item)}
                  onDoubleClick={() => setPreview(item)}
                  className={`relative group rounded-lg border-2 overflow-hidden aspect-square transition-all ${
                    selected.has(item.id)
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {isImage(item.mimeType) ? (
                    <NextImage
                      src={item.url}
                      alt={item.alt || item.originalName}
                      fill
                      className="object-cover"
                      sizes="120px"
                    />
                  ) : isVideo(item.mimeType) ? (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                      <Film className="w-8 h-8 text-gray-400" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                      <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                  )}

                  {/* Selection indicator */}
                  {selected.has(item.id) && (
                    <div className="absolute top-1 right-1 bg-blue-500 rounded-full p-0.5">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.originalName}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Preview panel */}
        {preview && (
          <div className="border-t dark:border-gray-700 p-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800 relative">
              {isImage(preview.mimeType) ? (
                <NextImage src={preview.url} alt={preview.alt || ''} fill className="object-cover" sizes="64px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                </div>
              )}
            </div>
            <div className="flex-1 text-sm">
              <p className="font-medium truncate">{preview.originalName}</p>
              <p className="text-gray-500">{preview.mimeType} · {formatSize(preview.size)}</p>
            </div>
            <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t dark:border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {page > 1 && (
              <button onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                ←
              </button>
            )}
            <span>{page} / {totalPages}</span>
            {page < totalPages && (
              <button onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                →
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              {t('common.cancel') || 'Cancel'}
            </button>
            {multiple && selected.size > 0 && (
              <button
                onClick={confirmMultiple}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('common.select') || 'Select'} ({selected.size})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
