'use client';

/**
 * AttachmentPanel - Reusable document attachments component for accounting entities.
 *
 * Provides upload (with drag-and-drop), listing, preview, download, and delete
 * for files associated with any accounting entity (JournalEntry, Invoice, etc.).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/i18n/client';
import { useCsrf } from '@/hooks/useCsrf';
import { Button } from '@/components/admin/Button';
import { Modal } from '@/components/admin/Modal';
import {
  Paperclip,
  Upload,
  File,
  FileText,
  Image as ImageIcon,
  Trash2,
  Download,
  X,
  Table,
  AlertCircle,
} from 'lucide-react';
// FIX: F59 - Use shared formatFileSize utility instead of local duplicate
import { formatFileSize } from '@/lib/format-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Attachment {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  thumbnailUrl?: string | null;
  description?: string | null;
  uploadedBy?: string | null;
  createdAt: string;
}

interface AttachmentStats {
  totalCount: number;
  totalSize: number;
  totalSizeFormatted: string;
}

export interface AttachmentPanelProps {
  entityType: string;
  entityId: string;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'jpg', 'jpeg', 'png', 'gif', 'webp',
  'doc', 'docx',
  'xls', 'xlsx', 'csv',
]);

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileExtension(fileName: string): string {
  return (fileName.split('.').pop() || '').toLowerCase();
}

// FIX: F59 - formatFileSize moved to shared @/lib/format-utils

function isImageFile(fileType: string): boolean {
  return IMAGE_EXTENSIONS.has(fileType);
}

function FileTypeIcon({ fileType, className }: { fileType: string; className?: string }) {
  const cls = className || 'w-5 h-5';

  if (IMAGE_EXTENSIONS.has(fileType)) {
    return <ImageIcon className={`${cls} text-emerald-500`} />;
  }
  if (fileType === 'pdf') {
    return <FileText className={`${cls} text-red-500`} />;
  }
  if (['doc', 'docx'].includes(fileType)) {
    return <FileText className={`${cls} text-blue-500`} />;
  }
  if (['xls', 'xlsx', 'csv'].includes(fileType)) {
    return <Table className={`${cls} text-green-600`} />;
  }
  return <File className={`${cls} text-slate-400`} />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttachmentPanel({ entityType, entityId, readOnly = false }: AttachmentPanelProps) {
  const { t, locale } = useI18n();
  const { csrfHeaders } = useCsrf();

  // State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [stats, setStats] = useState<AttachmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ------ Fetch attachments ------

  const fetchAttachments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/accounting/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load attachments');
      }
      const data = await res.json();
      setAttachments(data.attachments || []);
      setStats(data.stats || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (entityType && entityId) {
      fetchAttachments();
    }
  }, [entityType, entityId, fetchAttachments]);

  // ------ Upload ------

  const uploadFile = useCallback(
    async (file: File) => {
      const ext = getFileExtension(file.name);

      if (!ALLOWED_EXTENSIONS.has(ext)) {
        setError(
          t('admin.attachments.invalidType') ||
            `Invalid file type (.${ext}). Allowed: PDF, images, documents, spreadsheets.`
        );
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(
          t('admin.attachments.fileTooLarge') ||
            `File "${file.name}" exceeds maximum size of 10 MB.`
        );
        return;
      }

      setUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', entityType);
        formData.append('entityId', entityId);

        const res = await fetch('/api/accounting/attachments', {
          method: 'POST',
          headers: { ...csrfHeaders() },
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Upload failed');
        }

        await fetchAttachments();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId, csrfHeaders, fetchAttachments, t]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        uploadFile(files[0]);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [uploadFile]
  );

  // ------ Drag & Drop ------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      if (readOnly) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        uploadFile(files[0]);
      }
    },
    [readOnly, uploadFile]
  );

  // ------ Delete ------

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch('/api/accounting/attachments', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...csrfHeaders(),
        },
        body: JSON.stringify({ id: deleteTarget.id }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Delete failed');
      }

      setDeleteTarget(null);
      await fetchAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, csrfHeaders, fetchAttachments]);

  // ------ Render ------

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-5 h-5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">
            {t('admin.attachments.title') || 'Attachments'}
          </h3>
          {stats && stats.totalCount > 0 && (
            <span className="text-xs text-slate-400">
              ({stats.totalCount} &middot; {stats.totalSizeFormatted})
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-0.5 hover:bg-red-100 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Upload drop zone */}
      {!readOnly && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative flex flex-col items-center justify-center gap-2 p-6
            border-2 border-dashed rounded-lg transition-colors cursor-pointer
            ${dragOver
              ? 'border-sky-400 bg-sky-50'
              : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
            }
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className={`w-8 h-8 ${dragOver ? 'text-sky-500' : 'text-slate-400'}`} />
          <p className="text-sm text-slate-600">
            {t('admin.attachments.dropzone') || 'Drag & drop a file here, or click to browse'}
          </p>
          <p className="text-xs text-slate-400">
            {t('admin.attachments.allowedTypes') ||
              'PDF, images, documents, spreadsheets (max 10 MB)'}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.csv"
            onChange={handleFileSelect}
          />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-sky-600 font-medium">
                <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
                {t('admin.attachments.uploading') || 'Uploading...'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Attachment list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-slate-400">
          <div className="w-4 h-4 mr-2 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
          {t('common.loading') || 'Loading...'}
        </div>
      ) : attachments.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">
          <Paperclip className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          {t('admin.attachments.empty') || 'No attachments yet'}
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors"
            >
              {/* File icon or thumbnail */}
              <div className="shrink-0">
                {isImageFile(attachment.fileType) ? (
                  <button
                    onClick={() => setPreviewUrl(attachment.fileUrl)}
                    className="block w-10 h-10 rounded border border-slate-200 overflow-hidden hover:ring-2 hover:ring-sky-300 transition"
                    title={t('admin.attachments.preview') || 'Preview'}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.fileUrl}
                      alt={attachment.fileName}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex items-center justify-center w-10 h-10 rounded bg-slate-100">
                    <FileTypeIcon fileType={attachment.fileType} />
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {attachment.fileName}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{formatFileSize(attachment.fileSize)}</span>
                  <span>&middot;</span>
                  <span>{new Date(attachment.createdAt).toLocaleDateString(locale)}</span>
                  {attachment.uploadedBy && (
                    <>
                      <span>&middot;</span>
                      <span>{attachment.uploadedBy}</span>
                    </>
                  )}
                </div>
                {attachment.description && (
                  <p className="mt-0.5 text-xs text-slate-500 truncate">
                    {attachment.description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <a
                  href={attachment.fileUrl}
                  download={attachment.fileName}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  title={t('admin.attachments.download') || 'Download'}
                >
                  <Download className="w-4 h-4" />
                </a>
                {!readOnly && (
                  <button
                    onClick={() => setDeleteTarget(attachment)}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                    title={t('admin.attachments.delete') || 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Image preview modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.attachments.imagePreview') || 'Image preview'}
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-white rounded-full shadow-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={t('admin.attachments.preview') || 'Preview'}
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('admin.attachments.deleteConfirmTitle') || 'Delete Attachment'}
        subtitle={
          deleteTarget
            ? (t('admin.attachments.deleteConfirmMessage') ||
                `Are you sure you want to delete "${deleteTarget.fileName}"? This action cannot be undone.`)
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              loading={deleting}
              onClick={handleDelete}
            >
              {t('common.delete') || 'Delete'}
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <FileTypeIcon fileType={deleteTarget.fileType} className="w-8 h-8" />
            <div>
              <p className="text-sm font-medium text-slate-700">{deleteTarget.fileName}</p>
              <p className="text-xs text-slate-400">{formatFileSize(deleteTarget.fileSize)}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
