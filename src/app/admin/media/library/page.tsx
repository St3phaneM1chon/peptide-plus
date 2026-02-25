'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import {
  FolderOpen, Upload, Search, Copy, Check, FileText, Film, Image as ImageIcon,
  Loader2, ChevronLeft, ChevronRight, Grid, List, X, Download, Trash2,
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

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
  if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-red-500" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-orange-500" />;
  return <FileText className="w-5 h-5 text-slate-400" />;
}

export default function MediaLibraryPage() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [mimeFilter, setMimeFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (search) params.set('search', search);
      if (mimeFilter) params.set('mimeType', mimeFilter);
      if (folderFilter) params.set('folder', folderFilter);
      const res = await fetch(`/api/admin/medias?${params}`);
      const data = await res.json();
      setItems(data.media || []);
      setPagination(data.pagination || null);
    } catch (err) {
      console.error('Failed to load media:', err);
      // FIX: F30 - Show error toast on search/load failure
      toast.error(t('admin.media.loadFailed') || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, [page, search, mimeFilter, folderFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // F71 FIX: Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // F62 FIX: Close preview modal with Escape key
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
      formData.append('folder', folderFilter || 'general');
      const res = await fetch('/api/admin/medias', { method: 'POST', body: formData });
      if (res.ok) {
        loadItems();
        toast.success(t('admin.media.uploadSuccess') || 'Upload successful');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.media.uploadFailed') || 'Upload failed');
      }
    } catch (err) {
      // FIX: F29 - Show toast error on upload failure instead of just console.error
      console.error('Upload failed:', err);
      toast.error(t('admin.media.uploadFailed') || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // FIX: F86 - Add toast feedback on copy
  const copyUrl = (item: MediaItem) => {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    toast.success('URL copied');
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
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.id)));
    }
  };

  // ---- Delete selected files ----
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
      toast.success(`${successCount} ${t('admin.media.filesDeleted') || 'file(s) deleted'}`);
      loadItems();
    }
    if (failCount > 0) {
      toast.error(`${failCount} ${t('admin.media.deleteFailed') || 'failed to delete'}`);
    }
  }, [selectedIds, t, loadItems]);

  // ---- Rename (update alt text) ----
  const handleRenameFile = useCallback(async () => {
    if (selectedIds.size !== 1) {
      toast.info(t('admin.media.selectOneToRename') || 'Select exactly one file to rename');
      return;
    }
    const id = Array.from(selectedIds)[0];
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newAlt = window.prompt(t('admin.media.enterAltText') || 'Enter new alt text:', item.alt || item.originalName);
    if (newAlt === null) return;
    try {
      const res = await fetchWithCSRF(`/api/admin/medias/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alt: newAlt }),
      });
      if (res.ok) {
        toast.success(t('common.saved') || 'Saved');
        loadItems();
      } else {
        toast.error(t('common.error') || 'Error');
      }
    } catch {
      toast.error(t('common.error') || 'Error');
    }
  }, [selectedIds, items, t, loadItems]);

  // ---- Organize (move to folder) ----
  const handleOrganizeFiles = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.info(t('admin.media.selectToOrganize') || 'Select files to organize');
      return;
    }
    const folder = window.prompt(
      t('admin.media.enterFolder') || 'Enter folder name (e.g., products, blog, general):',
      folderFilter || 'general'
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
      loadItems();
    }
    setSelectedIds(new Set());
  }, [selectedIds, folderFilter, t, loadItems]);

  // ---- Export CSV ----
  const handleExportCsv = useCallback(() => {
    if (items.length === 0) {
      toast.info(t('admin.media.noDataToExport') || 'No files to export');
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['ID', 'Filename', 'Original Name', 'MIME Type', 'Size (bytes)', 'URL', 'Alt Text', 'Folder', 'Created At'];
    const rows = items.map(item => [
      item.id, item.filename, item.originalName, item.mimeType,
      String(item.size), item.url, item.alt || '', item.folder,
      new Date(item.createdAt).toISOString(),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `media-library-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('admin.media.exportSuccess') || 'CSV exported');
  }, [items, t]);

  // ---- Ribbon action handlers (media.management) ----
  const handleUploadRibbon = useCallback(() => { fileInputRef.current?.click(); }, []);
  const handleDeleteRibbon = useCallback(() => {
    if (selectedIds.size === 0) { toast.info(t('admin.media.selectToDelete') || 'Select files to delete'); return; }
    setShowDeleteConfirm(true);
  }, [selectedIds, t]);
  const handleRenameRibbon = useCallback(() => { handleRenameFile(); }, [handleRenameFile]);
  const handleOrganizeRibbon = useCallback(() => { handleOrganizeFiles(); }, [handleOrganizeFiles]);
  const handleOptimizeRibbon = useCallback(() => toast.info(t('admin.media.optimizeHint') || 'File optimization requires server-side processing. Coming soon.'), [t]);
  const handleExportRibbon = useCallback(() => { handleExportCsv(); }, [handleExportCsv]);

  useRibbonAction('upload', handleUploadRibbon);
  useRibbonAction('delete', handleDeleteRibbon);
  useRibbonAction('rename', handleRenameRibbon);
  useRibbonAction('organize', handleOrganizeRibbon);
  useRibbonAction('optimize', handleOptimizeRibbon);
  useRibbonAction('export', handleExportRibbon);

  return (
    <div className="p-6 max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.media.libraryTitle')}</h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-slate-300 rounded-lg overflow-hidden">
            {/* FIX: F88 - Added aria-label for accessibility */}
            <button onClick={() => setViewMode('grid')} aria-label="Grid view" className={`p-2 ${viewMode === 'grid' ? 'bg-sky-50 text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}><Grid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} aria-label="List view" className={`p-2 ${viewMode === 'list' ? 'bg-sky-50 text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-4 h-4" /></button>
          </div>
          <input ref={fileInputRef} type="file" multiple onChange={handleUpload} aria-label={t('admin.media.upload') || 'Upload files'} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {/* FIX: F36 - Use i18n instead of hardcoded "Upload" */}
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
          <button onClick={handleOrganizeFiles} className="px-3 py-1 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 text-xs">
            {t('admin.media.moveToFolder') || 'Move to folder'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-slate-500 hover:text-slate-700 text-xs">
            {t('common.clearSelection') || 'Clear'}
          </button>
        </div>
      )}

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder={t('common.search')}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>
        {/* FIX: F38 - Use i18n for filter labels instead of hardcoded English */}
        <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={mimeFilter} onChange={e => { setMimeFilter(e.target.value); setPage(1); }} aria-label={t('admin.media.allTypes') || 'Filter by file type'}>
          <option value="">{t('admin.media.allTypes') || 'All types'}</option>
          <option value="image">{t('admin.media.imagesTitle') || 'Images'}</option>
          <option value="video">{t('admin.media.videosTitle') || 'Videos'}</option>
          <option value="application/pdf">PDF</option>
        </select>
        {/* FIX: F81 - TODO: Load folders dynamically from DB (SELECT DISTINCT folder FROM Media) instead of hardcoding */}
        <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={folderFilter} onChange={e => { setFolderFilter(e.target.value); setPage(1); }} aria-label={t('admin.media.allFolders') || 'Filter by folder'}>
          <option value="">{t('admin.media.allFolders') || 'All folders'}</option>
          <option value="general">{t('admin.media.folderGeneral') || 'General'}</option>
          <option value="images">{t('admin.media.imagesTitle') || 'Images'}</option>
          <option value="products">{t('admin.media.folderProducts') || 'Products'}</option>
          <option value="blog">{t('admin.media.folderBlog') || 'Blog'}</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p>{t('admin.media.libraryDesc')}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="flex items-center gap-2 mb-2">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300" aria-label="Select all files" />
              {t('common.selectAll') || 'Select all'}
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map(item => (
              <div key={item.id} className={`group relative bg-white rounded-lg border overflow-hidden hover:border-sky-300 transition-colors ${selectedIds.has(item.id) ? 'border-sky-400 ring-2 ring-sky-200' : 'border-slate-200'}`}>
                {/* Selection checkbox */}
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    className="rounded border-slate-300 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
                    aria-label={`Select ${item.originalName}`}
                  />
                </div>
                <div className="aspect-square cursor-pointer flex items-center justify-center bg-slate-50" onClick={() => setPreview(item)}>
                  {/* FIX: F2 - Use NextImage instead of native <img> */}
                  {item.mimeType.startsWith('image/') ? (
                    <NextImage src={item.url} alt={item.alt || item.originalName} fill className="object-cover" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw" unoptimized />
                  ) : (
                    <div className="text-center">
                      {getFileIcon(item.mimeType)}
                      <p className="text-xs text-slate-400 mt-1">{item.mimeType.split('/')[1]?.toUpperCase()}</p>
                    </div>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs text-slate-700 truncate" title={item.originalName}>{item.originalName}</p>
                  <p className="text-xs text-slate-400">{formatSize(item.size)}</p>
                </div>
                <button
                  onClick={() => copyUrl(item)}
                  className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  aria-label="Copier l'URL du fichier"
                >
                  {copiedId === item.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-slate-600" />}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y">
          <div className="flex items-center gap-3 p-2 bg-slate-50 text-xs text-slate-600 font-medium border-b">
            <input type="checkbox" checked={selectedIds.size === items.length && items.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 ml-1" aria-label="Select all files" />
            <span>{t('common.selectAll') || 'Select all'}</span>
          </div>
          {items.map(item => (
            <div key={item.id} className={`flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors ${selectedIds.has(item.id) ? 'bg-sky-50' : ''}`}>
              <input
                type="checkbox"
                checked={selectedIds.has(item.id)}
                onChange={() => toggleSelect(item.id)}
                className="rounded border-slate-300 flex-shrink-0"
                aria-label={`Select ${item.originalName}`}
              />
              <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                {/* FIX: F2 - Use NextImage instead of native <img> */}
                {item.mimeType.startsWith('image/') ? (
                  <NextImage src={item.url} alt="" width={40} height={40} className="w-10 h-10 rounded object-cover" unoptimized />
                ) : (
                  getFileIcon(item.mimeType)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 truncate">{item.originalName}</p>
                <p className="text-xs text-slate-400">{item.folder} &middot; {formatSize(item.size)} &middot; {new Date(item.createdAt).toLocaleDateString(locale)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => copyUrl(item)} className="p-1.5 rounded hover:bg-slate-100" title="Copy URL" aria-label="Copier l'URL">
                  {copiedId === item.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
                {/* F87 FIX: Use original filename for download */}
                <a href={item.url} download={item.originalName} className="p-1.5 rounded hover:bg-slate-100" title="Download" aria-label="Telecharger le fichier">
                  <Download className="w-4 h-4 text-slate-400" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Page precedente">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-600">{page} / {pagination.totalPages} ({pagination.total} files)</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30" aria-label="Page suivante">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Preview modal */}
      {/* FIX: F64 - TODO: Implement focus trap (use dialog element or focus-trap library) to prevent tabbing behind modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setPreview(null)} role="dialog" aria-modal="true" aria-label="Media preview">
          <div className="relative max-w-3xl max-h-[80vh] bg-white rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute top-3 right-3 p-1.5 bg-white/80 rounded-full hover:bg-white z-10" autoFocus aria-label="Fermer l'apercu">
              <X className="w-5 h-5" />
            </button>
            {/* FIX: F2 - Use NextImage instead of native <img> */}
            {preview.mimeType.startsWith('image/') ? (
              <NextImage src={preview.url} alt={preview.alt || preview.originalName} width={800} height={600} className="max-w-full max-h-[70vh] object-contain" style={{ width: '100%', height: 'auto' }} unoptimized />
            ) : preview.mimeType.startsWith('video/') ? (
              <video src={preview.url} controls className="max-w-full max-h-[70vh]" />
            ) : (
              <div className="w-96 h-64 flex flex-col items-center justify-center">
                {getFileIcon(preview.mimeType)}
                <p className="mt-3 text-slate-600">{preview.originalName}</p>
              </div>
            )}
            <div className="p-4 border-t">
              <p className="font-medium text-slate-900">{preview.originalName}</p>
              <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
                <span>{formatSize(preview.size)}</span>
                <span>{preview.mimeType}</span>
                <span>{preview.folder}</span>
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
        title={t('admin.media.deleteConfirmTitle') || 'Delete Files'}
        message={`${t('admin.media.deleteConfirmMessage') || 'Are you sure you want to delete'} ${selectedIds.size} ${t('admin.media.filesLabel') || 'file(s)'}? ${t('admin.media.deleteIrreversible') || 'This action cannot be undone.'}`}
        confirmLabel={deleting ? '...' : (t('common.delete') || 'Delete')}
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
  );
}
