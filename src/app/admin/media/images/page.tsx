'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Image as ImageIcon, Upload, Search, Copy, Check, Trash2,
  Loader2, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import NextImage from 'next/image';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
// FIX: F59 - Use shared formatFileSize utility instead of local duplicate
import { formatFileSize } from '@/lib/format-utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fetchWithCSRF } from '@/lib/csrf';

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
  const { t, locale } = useI18n();
  const [images, setImages] = useState<MediaItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  // ---- Selection handling ----
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === images.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(images.map(img => img.id)));
    }
  };

  // ---- Delete selected images ----
  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetchWithCSRF(`/api/admin/medias/${id}`, { method: 'DELETE' });
        if (res.ok) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
    setSelectedIds(new Set());
    if (successCount > 0) {
      toast.success(`${successCount} ${t('admin.media.imagesTitle') || 'image(s)'} ${t('common.deleted') || 'deleted'}`);
      loadImages();
    }
    if (failCount > 0) {
      toast.error(`${failCount} ${t('admin.media.deleteFailed') || 'failed to delete'}`);
    }
  }, [selectedIds, t, loadImages]);

  // ---- Rename (update alt text) ----
  const handleRenameImage = useCallback(async () => {
    if (selectedIds.size !== 1) {
      toast.info(t('admin.media.selectOneToRename') || 'Select exactly one image to rename');
      return;
    }
    const id = Array.from(selectedIds)[0];
    const img = images.find(i => i.id === id);
    if (!img) return;
    const newAlt = window.prompt(t('admin.media.enterAltText') || 'Enter new alt text:', img.alt || img.originalName);
    if (newAlt === null) return;
    try {
      const res = await fetchWithCSRF(`/api/admin/medias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: newAlt }),
      });
      if (res.ok) {
        toast.success(t('common.saved') || 'Saved');
        loadImages();
      } else {
        toast.error(t('common.error') || 'Error');
      }
    } catch {
      toast.error(t('common.error') || 'Error');
    }
  }, [selectedIds, images, t, loadImages]);

  // ---- Organize (move to folder) ----
  const handleOrganizeImage = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.info(t('admin.media.selectToOrganize') || 'Select images to organize');
      return;
    }
    const folder = window.prompt(
      t('admin.media.enterFolder') || 'Enter folder name (e.g., products, blog, general):',
      'images'
    );
    if (!folder) return;
    let successCount = 0;
    for (const id of selectedIds) {
      try {
        const res = await fetchWithCSRF(`/api/admin/medias/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder }),
        });
        if (res.ok) successCount++;
      } catch { /* skip */ }
    }
    if (successCount > 0) {
      toast.success(`${successCount} ${t('admin.media.movedToFolder') || 'moved to'} "${folder}"`);
      loadImages();
    }
    setSelectedIds(new Set());
  }, [selectedIds, t, loadImages]);

  // ---- Export CSV ----
  const handleExportCsv = useCallback(() => {
    if (images.length === 0) {
      toast.info(t('admin.media.noDataToExport') || 'No images to export');
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['ID', 'Filename', 'Original Name', 'MIME Type', 'Size (bytes)', 'URL', 'Alt Text', 'Folder', 'Created At'];
    const rows = images.map(img => [
      img.id, img.filename, img.originalName, img.mimeType,
      String(img.size), img.url, img.alt || '', img.folder,
      new Date(img.createdAt).toISOString(),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `images-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.media.exportSuccess') || 'CSV exported');
  }, [images, t]);

  // ---- Ribbon action handlers (media.management) ----
  const handleUploadRibbon = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleDeleteRibbon = useCallback(() => {
    if (selectedIds.size === 0) { toast.info(t('admin.media.selectToDelete') || 'Select images to delete'); return; }
    setShowDeleteConfirm(true);
  }, [selectedIds, t]);
  const handleRenameRibbon = useCallback(() => { handleRenameImage(); }, [handleRenameImage]);
  const handleOrganizeRibbon = useCallback(() => { handleOrganizeImage(); }, [handleOrganizeImage]);
  const handleOptimizeRibbon = useCallback(() => toast.info(t('admin.media.optimizeHint') || 'Image optimization requires server-side processing. Coming soon.'), [t]);
  const handleExportRibbon = useCallback(() => { handleExportCsv(); }, [handleExportCsv]);

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
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleUpload} aria-label={t('admin.media.upload') || 'Upload images'} className="hidden" />
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

      {/* Selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-2 bg-sky-50 border border-sky-200 rounded-lg text-sm">
          <span className="text-sky-700 font-medium">{selectedIds.size} {t('common.selected') || 'selected'}</span>
          <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 text-xs">
            <Trash2 className="w-3 h-3" /> {t('common.delete') || 'Delete'}
          </button>
          <button onClick={handleOrganizeImage} className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-xs">
            {t('admin.media.moveToFolder') || 'Move to folder'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-slate-500 hover:text-slate-700 text-xs">
            {t('common.clearSelection') || 'Clear'}
          </button>
        </div>
      )}

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
        <>
        <div className="flex items-center gap-2 mb-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input type="checkbox" checked={selectedIds.size === images.length && images.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300" aria-label="Select all images" />
            {t('common.selectAll') || 'Select all'}
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {images.map(img => (
            <div key={img.id} className={`group relative bg-white rounded-lg border overflow-hidden hover:border-sky-300 transition-colors ${selectedIds.has(img.id) ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-200'}`}>
              {/* Selection checkbox */}
              <div className="absolute top-2 left-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.has(img.id)}
                  onChange={() => toggleSelect(img.id)}
                  className="rounded border-slate-300 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
                  aria-label={`Select ${img.originalName}`}
                />
              </div>
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
                aria-label="Copier l'URL de l'image"
              >
                {copiedId === img.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-slate-600" />}
              </button>
            </div>
          ))}
        </div>
        </>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Page precedente">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-600">{page} / {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Page suivante">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <div className="relative max-w-3xl max-h-[80vh] bg-white rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute top-3 right-3 p-1.5 bg-white/80 rounded-full hover:bg-white z-10" aria-label="Fermer l'apercu">
              <X className="w-5 h-5" />
            </button>
            {/* FIX: F3 - Use NextImage instead of native <img> */}
            <NextImage src={preview.url} alt={preview.alt || preview.originalName} width={800} height={600} className="max-w-full max-h-[70vh] object-contain" style={{ width: '100%', height: 'auto' }} unoptimized />
            <div className="p-4 border-t">
              <p className="font-medium text-slate-900">{preview.originalName}</p>
              <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                <span>{formatSize(preview.size)}</span>
                <span>{preview.mimeType}</span>
                <span>{new Date(preview.createdAt).toLocaleDateString(locale)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <code className="flex-1 text-xs bg-slate-100 px-2 py-1 rounded truncate">{preview.url}</code>
                <button onClick={() => copyUrl(preview)} className="text-sky-600 hover:text-sky-700" aria-label="Copier l'URL">
                  {copiedId === preview.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('admin.media.deleteConfirmTitle') || 'Delete Images'}
        message={`${t('admin.media.deleteConfirmMessage') || 'Are you sure you want to delete'} ${selectedIds.size} ${t('admin.media.imagesTitle') || 'image(s)'}? ${t('admin.media.deleteIrreversible') || 'This action cannot be undone.'}`}
        confirmLabel={deleting ? '...' : (t('common.delete') || 'Delete')}
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
  );
}
