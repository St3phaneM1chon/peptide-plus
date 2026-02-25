// IMP-019: TODO: Implement client-side crop/resize before upload (e.g., react-image-crop)
// IMP-020: PARTIALLY_DONE: AI tagging exists via generateTags() from ai-tagger.ts; full Azure Computer Vision integration is TODO
// IMP-021: TODO: Implement automatic watermarking on product images to prevent content theft
// IMP-025: TODO: Implement blur placeholder + intersection observer for progressive image loading
// IMP-027: TODO: Integrate image-optimizer.ts server-side to auto-generate thumbnail/medium/large variants at upload
// IMP-028: TODO: Add content moderation (Azure Content Moderator) for user-uploaded images (reviews, chat)
// IMP-034: PARTIALLY_DONE: Usage tracking exists via usage-tracker.ts; full tracking from all entity references is TODO
// IMP-040: DONE: Client-side file size validation added before upload
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import {
  Image as ImageIcon, Upload, Search, Copy, Check, Trash2,
  Loader2, ChevronLeft, ChevronRight, X, Tags, Crop, Link2,
  UploadCloud, Sparkles, ScissorsIcon,
} from 'lucide-react';
import NextImage from 'next/image';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
// FIX: F59 - Use shared formatFileSize utility instead of local duplicate
import { formatFileSize } from '@/lib/format-utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { fetchWithCSRF } from '@/lib/csrf';
import { generateTags, generateAltText } from '@/lib/media/ai-tagger';
import { type ImageUsage, formatUsageSummary } from '@/lib/media/usage-tracker';
import { CROP_PRESETS, type CropPreset } from '@/lib/media/smart-crop';

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

interface BulkUploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
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

  // AI tagging state
  const [imageTags, setImageTags] = useState<Record<string, string[]>>({});
  // Usage tracking state
  const [imageUsages, setImageUsages] = useState<Record<string, ImageUsage>>({});
  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<BulkUploadFile[]>([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const bulkInputRef = useRef<HTMLInputElement>(null);
  // Smart crop state
  const [showCropPresets, setShowCropPresets] = useState<string | null>(null);

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
  // IMP-044: Arrow key navigation between images in preview modal
  useEffect(() => {
    if (!preview) return;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPreview(null); return; }
      // IMP-044: Navigate between images with arrow keys
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = images.findIndex(i => i.id === preview.id);
        if (idx < images.length - 1) setPreview(images[idx + 1]);
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = images.findIndex(i => i.id === preview.id);
        if (idx > 0) setPreview(images[idx - 1]);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [preview, images]);

  // Generate AI tags for loaded images
  useEffect(() => {
    if (images.length === 0) return;
    const newTags: Record<string, string[]> = {};
    for (const img of images) {
      newTags[img.id] = generateTags(img.originalName, img.alt || undefined, img.folder);
    }
    setImageTags(newTags);
  }, [images]);

  // Load usage tracking for images
  useEffect(() => {
    if (images.length === 0) return;
    const loadUsages = async () => {
      try {
        const ids = images.map(img => img.id).join(',');
        const res = await fetch(`/api/admin/medias/usage?ids=${ids}`);
        if (res.ok) {
          const data = await res.json();
          if (data.usages) {
            const usageMap: Record<string, ImageUsage> = {};
            for (const u of data.usages) {
              usageMap[u.imageId] = u;
            }
            setImageUsages(usageMap);
          }
        }
      } catch {
        // Usage tracking is optional - fail silently
      }
    };
    loadUsages();
  }, [images]);

  // Bulk upload drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      setBulkFiles(files.map(file => ({ file, progress: 0, status: 'pending' as const })));
      setShowBulkUpload(true);
    }
  }, []);

  const handleBulkFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setBulkFiles(Array.from(files).map(file => ({ file, progress: 0, status: 'pending' as const })));
    setShowBulkUpload(true);
    if (bulkInputRef.current) bulkInputRef.current.value = '';
  }, []);

  const startBulkUpload = useCallback(async () => {
    for (let i = 0; i < bulkFiles.length; i++) {
      setBulkFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading', progress: 10 } : f));
      try {
        const formData = new FormData();
        formData.append('files', bulkFiles[i].file);
        formData.append('folder', 'images');

        // Generate auto alt text
        const autoAlt = generateAltText(bulkFiles[i].file.name);
        formData.append('alt', autoAlt);

        setBulkFiles(prev => prev.map((f, idx) => idx === i ? { ...f, progress: 50 } : f));

        const res = await fetch('/api/admin/medias', { method: 'POST', body: formData });
        if (res.ok) {
          setBulkFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'done', progress: 100 } : f));
        } else {
          const data = await res.json().catch(() => ({}));
          setBulkFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', progress: 100, error: data.error || 'Erreur' } : f));
        }
      } catch {
        setBulkFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', progress: 100, error: 'Erreur reseau' } : f));
      }
    }
    loadImages();
    toast.success('Envoi groupé terminé');
  }, [bulkFiles, loadImages]);

  // Smart crop handler
  const handleCropPreset = useCallback(async (_imageId: string, preset: CropPreset) => {
    toast.info(`Recadrage ${preset.nameFr} (${preset.width}x${preset.height}) - Traitement côté serveur requis`);
    setShowCropPresets(null);
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // IMP-040: Client-side file size validation before upload to avoid wasting bandwidth
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB - matches server limit
    for (let i = 0; i < files.length; i++) {
      if (files[i].size > MAX_FILE_SIZE) {
        toast.error(`${files[i].name}: ${t('admin.media.fileTooLarge') || 'File exceeds maximum size of 10MB'}`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

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

      {/* Bulk Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          isDragOver ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:border-sky-300 hover:bg-sky-50/50'
        }`}
        onClick={() => bulkInputRef.current?.click()}
      >
        <input
          ref={bulkInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleBulkFileSelect}
          className="hidden"
          aria-label="Sélectionner des images pour envoi groupé"
        />
        <UploadCloud className={`w-10 h-10 mx-auto mb-2 ${isDragOver ? 'text-sky-500' : 'text-slate-400'}`} />
        <p className="text-sm font-medium text-slate-700">
          Glissez-déposez vos images ici ou cliquez pour sélectionner
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Envoi groupé avec barres de progression - Formats: JPG, PNG, WebP, GIF
        </p>
      </div>

      {/* Bulk Upload Progress */}
      {showBulkUpload && bulkFiles.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Envoi groupé ({bulkFiles.filter(f => f.status === 'done').length}/{bulkFiles.length})
            </h3>
            <div className="flex gap-2">
              {bulkFiles.some(f => f.status === 'pending') && (
                <button
                  onClick={startBulkUpload}
                  className="px-3 py-1 bg-sky-600 text-white rounded text-xs hover:bg-sky-700"
                >
                  Démarrer l&apos;envoi
                </button>
              )}
              <button
                onClick={() => { setBulkFiles([]); setShowBulkUpload(false); }}
                className="p-1 hover:bg-slate-100 rounded"
                aria-label="Fermer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {bulkFiles.map((bf, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-xs text-slate-600 truncate w-40">{bf.file.name}</span>
                <div className="flex-1 bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      bf.status === 'done' ? 'bg-green-500' :
                      bf.status === 'error' ? 'bg-red-500' :
                      bf.status === 'uploading' ? 'bg-sky-500' : 'bg-slate-300'
                    }`}
                    style={{ width: `${bf.progress}%` }}
                  />
                </div>
                <span className="text-xs w-16 text-right">
                  {bf.status === 'done' && <span className="text-green-600">Terminé</span>}
                  {bf.status === 'error' && <span className="text-red-600">Erreur</span>}
                  {bf.status === 'uploading' && <span className="text-sky-600">En cours...</span>}
                  {bf.status === 'pending' && <span className="text-slate-400">En attente</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <div className="p-2 space-y-1">
                <p className="text-xs text-slate-700 truncate" title={img.originalName}>{img.originalName}</p>
                <p className="text-xs text-slate-400">{formatSize(img.size)}</p>

                {/* AI Auto-Tags */}
                {imageTags[img.id] && imageTags[img.id].length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {imageTags[img.id].slice(0, 3).map(tag => (
                      <span key={tag} className="inline-flex items-center gap-0.5 px-1 py-0 bg-violet-50 text-violet-600 text-[9px] rounded">
                        <Tags className="w-2 h-2" />{tag}
                      </span>
                    ))}
                    {imageTags[img.id].length > 3 && (
                      <span className="text-[9px] text-violet-400">+{imageTags[img.id].length - 3}</span>
                    )}
                  </div>
                )}

                {/* Image Usage Tracking */}
                {imageUsages[img.id] && imageUsages[img.id].usedIn.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Link2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-[9px] text-emerald-600 truncate" title={formatUsageSummary(imageUsages[img.id])}>
                      {formatUsageSummary(imageUsages[img.id])}
                    </span>
                  </div>
                )}
                {imageUsages[img.id] && imageUsages[img.id].usedIn.length === 0 && (
                  <span className="text-[9px] text-slate-400 italic">Non utilisée</span>
                )}
              </div>

              {/* Action buttons - copy + crop */}
              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowCropPresets(showCropPresets === img.id ? null : img.id); }}
                  className="p-1.5 bg-white/80 rounded-full hover:bg-white"
                  title="Recadrage intelligent"
                  aria-label="Recadrage intelligent"
                >
                  <Crop className="w-3 h-3 text-slate-600" />
                </button>
                <button
                  onClick={() => copyUrl(img)}
                  className="p-1.5 bg-white/80 rounded-full hover:bg-white"
                  title="Copier l'URL"
                  aria-label="Copier l'URL de l'image"
                >
                  {copiedId === img.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-slate-600" />}
                </button>
              </div>

              {/* Smart Crop Presets Dropdown */}
              {showCropPresets === img.id && (
                <div className="absolute top-10 right-2 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-48" onClick={e => e.stopPropagation()}>
                  <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1 px-1">Recadrage rapide</p>
                  {CROP_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleCropPreset(img.id, preset)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-slate-700 hover:bg-sky-50 rounded transition-colors text-left"
                    >
                      <ScissorsIcon className="w-3 h-3 text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{preset.nameFr}</span>
                        <span className="text-slate-400 ml-1">({preset.aspectRatio})</span>
                      </div>
                      <span className="text-[9px] text-slate-400">{preset.width}x{preset.height}</span>
                    </button>
                  ))}
                </div>
              )}
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
      {/* F64 FIX: Focus trap implemented via onKeyDown handler to prevent tabbing behind modal */}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6" onClick={() => setPreview(null)} role="dialog" aria-modal="true" aria-label="Image preview"
          onKeyDown={(e) => {
            // F64 FIX: Trap Tab focus within the modal dialog
            if (e.key === 'Tab') {
              const modal = e.currentTarget.querySelector('[data-modal-content]') as HTMLElement | null;
              if (!modal) return;
              const focusable = modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
              if (focusable.length === 0) return;
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
              } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
              }
            }
          }}
        >
          <div data-modal-content className="relative max-w-3xl max-h-[80vh] bg-white rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)} className="absolute top-3 right-3 p-1.5 bg-white/80 rounded-full hover:bg-white z-10" autoFocus aria-label="Fermer l'apercu">
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

              {/* AI Tags in preview */}
              {imageTags[preview.id] && imageTags[preview.id].length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Tags IA auto-générés
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {imageTags[preview.id].map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-violet-50 text-violet-700 text-xs rounded-full">
                        <Tags className="w-3 h-3" />{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Usage tracking in preview */}
              {imageUsages[preview.id] && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> Utilisation de l&apos;image
                  </p>
                  {imageUsages[preview.id].usedIn.length > 0 ? (
                    <div className="space-y-1">
                      {imageUsages[preview.id].usedIn.map((u, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] uppercase font-medium">{u.entityType}</span>
                          <span className="text-slate-700">{u.entityName}</span>
                          <span className="text-slate-400">({u.field})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">Cette image n&apos;est utilisée nulle part</p>
                  )}
                </div>
              )}

              {/* Smart Crop Presets in preview */}
              <div className="mt-3">
                <p className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <Crop className="w-3 h-3" /> Recadrage intelligent
                </p>
                <div className="flex flex-wrap gap-1">
                  {CROP_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => handleCropPreset(preview.id, preset)}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded hover:bg-sky-100 hover:text-sky-700 transition-colors"
                    >
                      <ScissorsIcon className="w-3 h-3" />
                      {preset.nameFr} ({preset.aspectRatio})
                    </button>
                  ))}
                </div>
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
