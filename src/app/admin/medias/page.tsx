'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  LayoutGrid,
  List,
  PlayCircle,
  FileText,
  Image,
  Video,
  HardDrive,
  Files,
  Trash2,
  Copy,
  FolderOpen,
} from 'lucide-react';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { EmptyState } from '@/components/admin/EmptyState';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';

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
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState({ type: '', search: '' });
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setFiles([]);
    setLoading(false);
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
    if (!uploadedFiles) return;

    setUploading(true);
    // Simulate upload
    await new Promise(r => setTimeout(r, 1500));
    setUploading(false);
    alert('Fichier(s) uploade(s) avec succes!');
  };

  const deleteFile = (id: string) => {
    if (!confirm('Supprimer ce fichier?')) return;
    setFiles(files.filter(f => f.id !== id));
    if (selectedFile?.id === id) setSelectedFile(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  // --- Table columns for list view ---
  const columns: Column<MediaFile>[] = [
    {
      key: 'name',
      header: 'Fichier',
      render: (file) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
            {file.type === 'image' ? (
              <img src={file.url} alt="" className="w-full h-full object-cover" />
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
      header: 'Type',
      render: (file) => <span className="text-slate-600">{file.type}</span>,
    },
    {
      key: 'size',
      header: 'Taille',
      render: (file) => <span className="text-slate-600">{formatFileSize(file.size)}</span>,
    },
    {
      key: 'dimensions',
      header: 'Dimensions',
      render: (file) => (
        <span className="text-slate-600">
          {file.dimensions ? `${file.dimensions.width}\u00D7${file.dimensions.height}` : '-'}
        </span>
      ),
    },
    {
      key: 'usedIn',
      header: 'Utilise dans',
      render: (file) => (
        <span className="text-slate-600">{file.usedIn?.join(', ') || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (file) => (
        <Button
          variant="danger"
          size="sm"
          icon={Trash2}
          onClick={() => deleteFile(file.id)}
        >
          Supprimer
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
        {uploading ? 'Upload...' : 'Uploader'}
      </Button>
      <input
        type="file"
        multiple
        onChange={handleUpload}
        className="hidden"
        accept="image/*,video/*,.pdf"
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
        title="Medias"
        subtitle="Gerez vos fichiers et images"
        actions={uploadButton}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total fichiers"
          value={files.length}
          icon={Files}
        />
        <StatCard
          label="Images"
          value={files.filter(f => f.type === 'image').length}
          icon={Image}
        />
        <StatCard
          label="Videos"
          value={files.filter(f => f.type === 'video').length}
          icon={Video}
        />
        <StatCard
          label="Espace utilise"
          value={formatFileSize(totalSize)}
          icon={HardDrive}
        />
      </div>

      {/* Filters & View Toggle */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(value) => setFilter({ ...filter, search: value })}
        searchPlaceholder="Rechercher..."
        actions={viewToggle}
      >
        <SelectFilter
          label="Tous les types"
          value={filter.type}
          onChange={(value) => setFilter({ ...filter, type: value })}
          options={[
            { value: 'image', label: 'Images' },
            { value: 'video', label: 'Videos' },
            { value: 'document', label: 'Documents' },
          ]}
        />
      </FilterBar>

      {/* Files */}
      {view === 'grid' ? (
        filteredFiles.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg">
            <EmptyState
              icon={FolderOpen}
              title="Aucun fichier trouve"
              description="Uploadez des fichiers pour les voir ici."
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
                <div className="aspect-square bg-slate-100 flex items-center justify-center">
                  {file.type === 'image' ? (
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
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
          emptyTitle="Aucun fichier trouve"
          emptyDescription="Uploadez des fichiers pour les voir ici."
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
              Copier l&apos;URL
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                if (selectedFile) deleteFile(selectedFile.id);
              }}
            >
              Supprimer
            </Button>
          </>
        }
      >
        {selectedFile && (
          <>
            {selectedFile.type === 'image' && (
              <img src={selectedFile.url} alt={selectedFile.name} className="w-full rounded-lg mb-4" />
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Type</p>
                <p className="font-medium text-slate-900">{selectedFile.mimeType}</p>
              </div>
              <div>
                <p className="text-slate-500">Taille</p>
                <p className="font-medium text-slate-900">{formatFileSize(selectedFile.size)}</p>
              </div>
              {selectedFile.dimensions && (
                <div>
                  <p className="text-slate-500">Dimensions</p>
                  <p className="font-medium text-slate-900">
                    {selectedFile.dimensions.width}&times;{selectedFile.dimensions.height}
                  </p>
                </div>
              )}
              <div>
                <p className="text-slate-500">URL</p>
                <code className="text-xs bg-slate-100 px-1 rounded text-slate-700">{selectedFile.url}</code>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
