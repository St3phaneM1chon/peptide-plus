'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  LayoutGrid,
  List,
  PlayCircle,
  FileText,
  Image as ImageIcon,
  Video,
  HardDrive,
  Files,
  Trash2,
  Copy,
  FolderOpen,
} from 'lucide-react';
import NextImage from 'next/image';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { EmptyState } from '@/components/admin/EmptyState';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface MediaFile {
  id: string;
  name: string;
  type: 'image' | 'video' | 'document';
  url: string;
  size: number;
  mimeType: string;
  dimensions?: { width: number; height: number };
  uploadedAt: string;
  usedIn?: string[];
}

export default function MediasPage() {
  const { t } = useI18n();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState({ type: '', search: '' });
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/medias');
      if (res.ok) {
        const data = await res.json();
        const rawMedia = data.media || [];
        setFiles(
          rawMedia.map((m: Record<string, unknown>) => {
            const mime = (m.mimeType as string) || '';
            let type: MediaFile['type'] = 'document';
            if (mime.startsWith('image/')) type = 'image';
            else if (mime.startsWith('video/')) type = 'video';

            return {
              id: m.id as string,
              name: (m.originalName as string) || (m.filename as string) || '',
              type,
              url: m.url as string,
              size: (m.size as number) || 0,
              mimeType: mime,
              dimensions: undefined,
              uploadedAt: (m.createdAt as string) || '',
              usedIn: undefined,
            };
          })
        );
      } else {
        toast.error(t('common.error'));
      }
    } catch (error) {
      console.error('Error fetching media files:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredFiles = useMemo(() =>
    files.filter(file => {
      if (filter.type && file.type !== filter.type) return false;
      if (filter.search && !file.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    }),
    [files, filter.type, filter.search]
  );

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      for (const file of Array.from(uploadedFiles)) {
        formData.append('files', file);
      }
      formData.append('folder', 'general');

      const res = await fetch('/api/admin/medias', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        toast.success(t('admin.mediaManager.uploadSuccess'));
        fetchFiles();
      } else {
        const data = await res.json();
        toast.error(data.error || t('admin.mediaManager.uploadError'));
      }
    } catch {
      toast.error(t('admin.mediaManager.uploadError'));
    } finally {
      setUploading(false);
      // Reset input so same files can be re-selected
      e.target.value = '';
    }
  };

  const deleteFile = async (id: string) => {
    if (!confirm(t('admin.mediaManager.deleteConfirm'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/medias/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFiles(files.filter(f => f.id !== id));
        if (selectedFile?.id === id) setSelectedFile(null);
        toast.success(t('admin.mediaManager.deleteSuccess'));
      } else {
        toast.error(t('admin.mediaManager.deleteError'));
      }
    } catch {
      toast.error(t('admin.mediaManager.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // --- Table columns for list view ---
  const columns: Column<MediaFile>[] = [
    {
      key: 'name',
      header: t('admin.mediaManager.colFile'),
      render: (file) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
            {file.type === 'image' ? (
              <NextImage src={file.url} alt="" width={40} height={40} className="w-full h-full object-cover" unoptimized />
            ) : (
              <FileText className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <span className="font-medium text-slate-900">{file.name}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('admin.mediaManager.colType'),
      render: (file) => <span className="text-slate-600">{file.type}</span>,
    },
    {
      key: 'size',
      header: t('admin.mediaManager.colSize'),
      render: (file) => <span className="text-slate-600">{formatFileSize(file.size)}</span>,
    },
    {
      key: 'dimensions',
      header: t('admin.mediaManager.colDimensions'),
      render: (file) => (
        <span className="text-slate-600">
          {file.dimensions ? `${file.dimensions.width}\u00D7${file.dimensions.height}` : '-'}
        </span>
      ),
    },
    {
      key: 'usedIn',
      header: t('admin.mediaManager.colUsedIn'),
      render: (file) => (
        <span className="text-slate-600">{file.usedIn?.join(', ') || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: t('admin.mediaManager.colActions'),
      align: 'center',
      render: (file) => (
        <Button
          variant="danger"
          size="sm"
          icon={Trash2}
          disabled={deletingId === file.id}
          onClick={() => deleteFile(file.id)}
        >
          {t('admin.mediaManager.delete')}
        </Button>
      ),
    },
  ];

  // --- Upload button used in PageHeader ---
  const uploadButton = (
    <label className="cursor-pointer">
      <Button
        variant="primary"
        icon={Upload}
        loading={uploading}
        // The button acts as a visual trigger; the actual click is handled by the label
        onClick={() => {}}
      >
        {uploading ? t('admin.mediaManager.uploading') : t('admin.mediaManager.upload')}
      </Button>
      <input
        type="file"
        multiple
        onChange={handleUpload}
        className="hidden"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,application/pdf"
      />
    </label>
  );

  // --- View toggle buttons ---
  const viewToggle = (
    <div className="flex border border-slate-300 rounded-lg overflow-hidden">
      <button
        onClick={() => setView('grid')}
        className={`px-3 py-2 transition-colors ${
          view === 'grid' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <LayoutGrid className="w-5 h-5" />
      </button>
      <button
        onClick={() => setView('list')}
        className={`px-3 py-2 transition-colors ${
          view === 'list' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
        }`}
      >
        <List className="w-5 h-5" />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.mediaManager.title')}
        subtitle={t('admin.mediaManager.subtitle')}
        actions={uploadButton}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.mediaManager.totalFiles')}
          value={files.length}
          icon={Files}
        />
        <StatCard
          label={t('admin.mediaManager.images')}
          value={files.filter(f => f.type === 'image').length}
          icon={ImageIcon}
        />
        <StatCard
          label={t('admin.mediaManager.videos')}
          value={files.filter(f => f.type === 'video').length}
          icon={Video}
        />
        <StatCard
          label={t('admin.mediaManager.spaceUsed')}
          value={formatFileSize(totalSize)}
          icon={HardDrive}
        />
      </div>

      {/* Filters & View Toggle */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(value) => setFilter({ ...filter, search: value })}
        searchPlaceholder={t('admin.mediaManager.searchPlaceholder')}
        actions={viewToggle}
      >
        <SelectFilter
          label={t('admin.mediaManager.allTypes')}
          value={filter.type}
          onChange={(value) => setFilter({ ...filter, type: value })}
          options={[
            { value: 'image', label: t('admin.mediaManager.typeImages') },
            { value: 'video', label: t('admin.mediaManager.typeVideos') },
            { value: 'document', label: t('admin.mediaManager.typeDocuments') },
          ]}
        />
      </FilterBar>

      {/* Files */}
      {view === 'grid' ? (
        filteredFiles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg">
            <EmptyState
              icon={FolderOpen}
              title={t('admin.mediaManager.noFilesTitle')}
              description={t('admin.mediaManager.noFilesDescription')}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                onClick={() => setSelectedFile(file)}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
              >
                <div className="aspect-square bg-slate-100 flex items-center justify-center relative">
                  {file.type === 'image' ? (
                    <NextImage src={file.url} alt={file.name} fill className="object-cover" sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw" unoptimized />
                  ) : file.type === 'video' ? (
                    <PlayCircle className="w-12 h-12 text-purple-500" />
                  ) : (
                    <FileText className="w-12 h-12 text-slate-400" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <DataTable
          columns={columns}
          data={filteredFiles}
          keyExtractor={(file) => file.id}
          onRowClick={(file) => setSelectedFile(file)}
          emptyTitle={t('admin.mediaManager.noFilesTitle')}
          emptyDescription={t('admin.mediaManager.noFilesDescription')}
        />
      )}

      {/* File Detail Modal */}
      <Modal
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        title={selectedFile?.name || ''}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              icon={Copy}
              onClick={() => {
                if (selectedFile) {
                  navigator.clipboard.writeText(selectedFile.url);
                }
              }}
            >
              {t('admin.mediaManager.copyUrl')}
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              disabled={!!deletingId}
              onClick={() => {
                if (selectedFile) deleteFile(selectedFile.id);
              }}
            >
              {t('admin.mediaManager.delete')}
            </Button>
          </>
        }
      >
        {selectedFile && (
          <>
            {selectedFile.type === 'image' && (
              <NextImage src={selectedFile.url} alt={selectedFile.name} width={800} height={600} className="w-full rounded-lg mb-4" style={{ width: '100%', height: 'auto' }} unoptimized />
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">{t('admin.mediaManager.detailType')}</p>
                <p className="font-medium text-slate-900">{selectedFile.mimeType}</p>
              </div>
              <div>
                <p className="text-slate-500">{t('admin.mediaManager.detailSize')}</p>
                <p className="font-medium text-slate-900">{formatFileSize(selectedFile.size)}</p>
              </div>
              {selectedFile.dimensions && (
                <div>
                  <p className="text-slate-500">{t('admin.mediaManager.detailDimensions')}</p>
                  <p className="font-medium text-slate-900">
                    {selectedFile.dimensions.width}&times;{selectedFile.dimensions.height}
                  </p>
                </div>
              )}
              <div>
                <p className="text-slate-500">{t('admin.mediaManager.detailUrl')}</p>
                <code className="text-xs bg-slate-100 px-1 rounded text-slate-700">{selectedFile.url}</code>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
