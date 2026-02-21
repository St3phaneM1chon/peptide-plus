'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import {
  FolderOpen, Upload, Search, Copy, Check, FileText, Film, Image as ImageIcon,
  Loader2, ChevronLeft, ChevronRight, Grid, List, X, Download,
} from 'lucide-react';

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-emerald-500" />;
  if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-red-500" />;
  if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-orange-500" />;
  return <FileText className="w-5 h-5 text-slate-400" />;
}

export default function MediaLibraryPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [mimeFilter, setMimeFilter] = useState('');
  const [folderFilter, setFolderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaItem | null>(null);
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
    } finally {
      setLoading(false);
    }
  }, [page, search, mimeFilter, folderFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

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
      if (res.ok) loadItems();
    } catch (err) {
      console.error('Upload failed:', err);
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

  return (
    <div className="p-6 max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">{t('admin.media.libraryTitle')}</h1>
        <div className="flex items-center gap-2">
          <div className="flex border border-slate-300 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-sky-50 text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}><Grid className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-sky-50 text-sky-600' : 'text-slate-400 hover:text-slate-600'}`}><List className="w-4 h-4" /></button>
          </div>
          <input ref={fileInputRef} type="file" multiple onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors text-sm disabled:opacity-50"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload
          </button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
            placeholder={t('common.search')}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={mimeFilter} onChange={e => { setMimeFilter(e.target.value); setPage(1); }}>
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="application/pdf">PDF</option>
        </select>
        <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={folderFilter} onChange={e => { setFolderFilter(e.target.value); setPage(1); }}>
          <option value="">All folders</option>
          <option value="general">General</option>
          <option value="images">Images</option>
          <option value="products">Products</option>
          <option value="blog">Blog</option>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map(item => (
            <div key={item.id} className="group relative bg-white rounded-lg border border-slate-200 overflow-hidden hover:border-sky-300 transition-colors">
              <div className="aspect-square cursor-pointer flex items-center justify-center bg-slate-50" onClick={() => setPreview(item)}>
                {item.mimeType.startsWith('image/') ? (
                  <img src={item.url} alt={item.alt || item.originalName} className="w-full h-full object-cover" />
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
              >
                {copiedId === item.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-slate-600" />}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 divide-y">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors">
              <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center flex-shrink-0">
                {item.mimeType.startsWith('image/') ? (
                  <img src={item.url} alt="" className="w-10 h-10 rounded object-cover" />
                ) : (
                  getFileIcon(item.mimeType)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 truncate">{item.originalName}</p>
                <p className="text-xs text-slate-400">{item.folder} &middot; {formatSize(item.size)} &middot; {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => copyUrl(item)} className="p-1.5 rounded hover:bg-slate-100" title="Copy URL">
                  {copiedId === item.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                </button>
                <a href={item.url} download className="p-1.5 rounded hover:bg-slate-100" title="Download">
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
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-2 rounded hover:bg-slate-100 disabled:opacity-30">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-600">{page} / {pagination.totalPages} ({pagination.total} files)</span>
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
            {preview.mimeType.startsWith('image/') ? (
              <img src={preview.url} alt={preview.alt || preview.originalName} className="max-w-full max-h-[70vh] object-contain" />
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
