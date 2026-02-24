'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Image as ImageIcon, Upload, Search, Copy, Check,
  Loader2, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import NextImage from 'next/image';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
// FIX: F59 - Use shared formatFileSize utility instead of local duplicate
import { formatFileSize } from '@/lib/format-utils';

interface MediaItem {
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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// FIX: F59 - formatSize replaced by shared formatFileSize from @/lib/format-utils
const formatSize = formatFileSize;

export default function MediaImagesPage() {
  const { t } = useI18n();
  const [images, setImages] = useState<MediaItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '24', mimeType: 'image' });
      if (search) params.set('search', search);
      const res = await fetch(`/api/admin/medias?${params}`);
      const data = await res.json();
      setImages(data.media || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Failed to load images:', err);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { loadImages(); }, [loadImages]);

  // F72 FIX: Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // F63 FIX: Close preview modal with Escape key
  useEffect(() => {
    if (!preview) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [preview]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      formData.append('folder', 'images');
      const res = await fetch('/api/admin/medias', { method: 'POST', body: formData });
      if (res.ok) {
        loadImages();
        toast.success(t('admin.media.uploadSuccess') || 'Upload successful');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.media.uploadFailed') || 'Upload failed');
      }
    } catch (err) {
      // FIX: F28 - Show toast error on upload failure instead of just console.error
      console.error('Upload failed:', err);
      toast.error(t('admin.media.uploadFailed') || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyUrl = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ---- Ribbon action handlers (media.management) ----
  const handleUploadRibbon = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleDeleteRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);
  const handleRenameRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);
  const handleOrganizeRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);
  const handleOptimizeRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);
  const handleExportRibbon = useCallback(() => toast.info(t('common.comingSoon')), [t]);

  useRibbonAction('upload', handleUploadRibbon);
  useRibbonAction('delete', handleDeleteRibbon);
  useRibbonAction('rename', handleRenameRibbon);
  useRibbonAction('organize', handleOrganizeRibbon);
  useRibbonAction('optimize', handleOptimizeRibbon);
  useRibbonAction('export', handleExportRibbon);

  return (
    <div className="p-6 max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.media.imagesTitle')}</h1>
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {/* FIX: F37 - Use i18n instead of hardcoded "Upload" */}
            {t('admin.media.upload') || 'Upload'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
          placeholder={t('common.search')}
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      {/* Image grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>
      ) : images.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>{t('admin.media.imagesDesc')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {images.map(img => (
            <div key={img.id} className="group relative bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-sky-300 transition-colors">
              {/* FIX: F3 - Use NextImage instead of native <img> */}
              <div className="aspect-square cursor-pointer relative" onClick={() => setPreview(img)}>
                <NextImage src={img.url} alt={img.alt || img.originalName} fill className="object-cover" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw" unoptimized />
              </div>
              <div className="p-2">
                <p className="text-xs text-slate-700 truncate" title={img.originalName}>{img.originalName}</p>
                <p className="text-xs text-slate-400">{formatSize(img.size)}</p>
              </div>
              <button
                onClick={() => copyUrl(img)}
                className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                title="Copy URL"
              >
                {copiedId === img.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-slate-600" />}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-600">{page} / {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl max-h-[80vh] bg-white rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute top-3 right-3 p-1.5 bg-white/80 rounded-full hover:bg-white z-10">
              <X className="w-5 h-5" />
            </button>
            {/* FIX: F3 - Use NextImage instead of native <img> */}
            <NextImage src={preview.url} alt={preview.alt || preview.originalName} width={800} height={600} className="max-w-full max-h-[70vh] object-contain" style={{ width: '100%', height: 'auto' }} unoptimized />
            <div className="p-4 border-t">
              <p className="font-medium text-slate-900">{preview.originalName}</p>
              <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                <span>{formatSize(preview.size)}</span>
                <span>{preview.mimeType}</span>
                <span>{new Date(preview.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded truncate">{preview.url}</code>
                <button onClick={() => copyUrl(preview)} className="text-sky-600 hover:text-sky-700">
                  {copiedId === preview.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
