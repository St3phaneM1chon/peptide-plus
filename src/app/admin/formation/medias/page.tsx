'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from '@/hooks/useTranslations';
import { PageHeader, Button, EmptyState } from '@/components/admin';
import { Upload, Image as ImageIcon, Video, FileText, Trash2, Search, File } from 'lucide-react';
import { ConfirmProvider, useConfirm } from '@/components/lms/ConfirmDialog';

type MediaType = '' | 'image' | 'video' | 'document';

interface MediaItem {
  id: string;
  filename: string;
  url: string;
  type: string;
  mimeType: string;
  size: number;
  createdAt: string;
  thumbnailUrl?: string | null;
}

function getMediaCategory(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

function getMediaIcon(category: 'image' | 'video' | 'document') {
  switch (category) {
    case 'image': return ImageIcon;
    case 'video': return Video;
    case 'document': return FileText;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function MediaLibraryPage() {
  return <ConfirmProvider><MediaLibraryPageInner /></ConfirmProvider>;
}
function MediaLibraryPageInner() {
  const { confirm: confirmDialog } = useConfirm();
  const { t } = useTranslations();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<MediaType>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set('type', typeFilter);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/admin/lms/media?${params}`);
      const data = await res.json();
      const list = data.data?.media ?? data.media ?? data.data ?? data;
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, searchQuery]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        await fetch('/api/admin/media/upload', {
          method: 'POST',
          body: formData,
        });
      }
      fetchMedia();
    } catch {
      // silently fail
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({ title: t('admin.lms.mediaLibrary.deleteConfirm'), message: t('admin.lms.mediaLibrary.deleteConfirm'), destructive: true });
    if (!ok) return;
    try {
      await fetch(`/api/admin/lms/media?id=${id}`, { method: 'DELETE' });
      fetchMedia();
    } catch {
      // silently fail
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const filteredItems = items;

  const typeFilterOptions: { value: MediaType; label: string; icon: typeof ImageIcon }[] = [
    { value: '', label: t('admin.lms.mediaLibrary.allTypes'), icon: File },
    { value: 'image', label: t('admin.lms.mediaLibrary.images'), icon: ImageIcon },
    { value: 'video', label: t('admin.lms.mediaLibrary.videos'), icon: Video },
    { value: 'document', label: t('admin.lms.mediaLibrary.documents'), icon: FileText },
  ];

  const typeBadgeColors: Record<string, string> = {
    image: 'bg-blue-50 text-blue-700',
    video: 'bg-purple-50 text-purple-700',
    document: 'bg-amber-50 text-amber-700',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.lms.mediaLibrary.title')}
        subtitle={`${items.length} ${t('admin.lms.mediaLibrary.total')}`}
        backHref="/admin/formation"
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleUpload}
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              aria-label={t('admin.lms.mediaLibrary.upload')}
            />
            <Button
              variant="primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? t('admin.lms.mediaLibrary.uploading') : t('admin.lms.mediaLibrary.upload')}
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('admin.lms.mediaLibrary.searchPlaceholder')}
            className="w-full h-9 pl-10 pr-3 rounded-lg border border-slate-300 text-sm text-slate-900
              bg-white/5 focus:outline-none focus:ring-2 focus:ring-indigo-700 focus:border-indigo-700"
            aria-label={t('admin.lms.mediaLibrary.searchPlaceholder')}
          />
        </div>

        {/* Type filter buttons */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {typeFilterOptions.map(opt => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
                  ${typeFilter === opt.value
                    ? 'bg-white/20 text-[var(--k-text-primary)] shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                  }
                `}
                aria-label={opt.label}
              >
                <Icon className="w-3.5 h-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="animate-pulse bg-[var(--k-glass-thin)] border border-[var(--k-border-subtle)] rounded-xl">
              <div className="h-40 bg-slate-100 rounded-t-xl" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-2/3" />
                <div className="h-3 bg-slate-100 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={t('admin.lms.mediaLibrary.noMedia')}
          description={t('admin.lms.mediaLibrary.noMediaDesc')}
          action={
            <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />{t('admin.lms.mediaLibrary.upload')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map(item => {
            const category = getMediaCategory(item.mimeType);
            const Icon = getMediaIcon(category);
            return (
              <div
                key={item.id}
                className="bg-[var(--k-glass-thin)] border border-[var(--k-border-subtle)] rounded-xl overflow-hidden hover:shadow-md transition-shadow group"
              >
                {/* Thumbnail / Icon area */}
                <div className="relative h-40 bg-white/5 flex items-center justify-center">
                  {category === 'image' && (item.thumbnailUrl || item.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Icon className="w-12 h-12 text-slate-300" />
                  )}

                  {/* Delete button overlay */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 backdrop-blur-sm
                      opacity-0 group-hover:opacity-100 transition-opacity
                      text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title={t('admin.lms.mediaLibrary.delete')}
                    aria-label={t('admin.lms.mediaLibrary.delete')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Info */}
                <div className="p-4 space-y-2">
                  <p className="text-sm font-medium text-[var(--k-text-primary)] truncate" title={item.filename}>
                    {item.filename}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeBadgeColors[category] ?? 'bg-white/5 text-slate-700'}`}>
                      {t(`admin.lms.mediaLibrary.type_${category}`)}
                    </span>
                    <span className="text-xs text-slate-400">{formatFileSize(item.size)}</span>
                  </div>
                  <p className="text-xs text-slate-400">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
