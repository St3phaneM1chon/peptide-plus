'use client';

import { useState, useRef, useCallback } from 'react';
import NextImage from 'next/image';
import { Upload, X, FileText, PlayCircle, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n/client';

type MediaContext =
  | 'product-image'
  | 'product-video'
  | 'product-doc'
  | 'banner'
  | 'category'
  | 'logo'
  | 'seo'
  | 'general';

interface MediaUploaderProps {
  value: string;
  onChange: (url: string) => void;
  context?: MediaContext;
  label?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  previewSize?: 'sm' | 'md' | 'lg';
}

const CONTEXT_CONFIG: Record<MediaContext, { accept: string; folder: string; maxSizeMB: number }> = {
  'product-image': { accept: 'image/jpeg,image/png,image/webp,image/gif', folder: 'products', maxSizeMB: 10 },
  'product-video': { accept: 'video/mp4,video/webm', folder: 'products', maxSizeMB: 50 },
  'product-doc': { accept: 'application/pdf', folder: 'documents', maxSizeMB: 10 },
  'banner': { accept: 'image/jpeg,image/png,image/webp', folder: 'banners', maxSizeMB: 10 },
  'category': { accept: 'image/jpeg,image/png,image/webp', folder: 'categories', maxSizeMB: 5 },
  'logo': { accept: 'image/jpeg,image/png,image/webp,image/gif', folder: 'branding', maxSizeMB: 5 },
  'seo': { accept: 'image/jpeg,image/png,image/webp', folder: 'seo', maxSizeMB: 5 },
  'general': { accept: 'image/jpeg,image/png,image/webp,image/gif,application/pdf', folder: 'general', maxSizeMB: 10 },
};

const PREVIEW_SIZES = {
  sm: 'h-20 w-20',
  md: 'h-32 w-full',
  lg: 'h-48 w-full',
};

export function MediaUploader({
  value,
  onChange,
  context = 'general',
  label,
  hint,
  required = false,
  disabled = false,
  previewSize = 'md',
}: MediaUploaderProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [mediaId, setMediaId] = useState<string | null>(null);

  const config = CONTEXT_CONFIG[context];

  const getMediaType = (url: string): 'image' | 'video' | 'pdf' | 'unknown' => {
    const lower = url.toLowerCase();
    if (/\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(lower)) return 'image';
    if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(lower)) return 'video';
    if (/\.pdf(\?|$)/i.test(lower)) return 'pdf';
    if (lower.startsWith('/uploads/') || lower.startsWith('/images/')) return 'image';
    return 'unknown';
  };

  const uploadFile = useCallback(async (file: File) => {
    setError(null);

    // Client-side validation
    const maxBytes = config.maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(t('admin.mediaUploader.fileTooLarge', { max: `${config.maxSizeMB}MB` }));
      return;
    }

    const acceptTypes = config.accept.split(',');
    if (!acceptTypes.some(type => file.type === type || file.type.startsWith(type.replace('/*', '/')))) {
      setError(t('admin.mediaUploader.invalidType'));
      return;
    }

    setUploading(true);
    setProgress(0);

    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 3, 90));
    }, 80);

    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('folder', config.folder);

      const res = await fetch('/api/admin/medias', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('admin.mediaUploader.uploadFailed'));
      }

      const data = await res.json();
      const uploaded = data.media?.[0];
      if (uploaded) {
        setProgress(100);
        setMediaId(uploaded.id);
        onChange(uploaded.url);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : t('admin.mediaUploader.uploadFailed'));
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 500);
    }
  }, [config, onChange, t]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  }, [uploadFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [disabled, uploading, uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !uploading) setDragOver(true);
  }, [disabled, uploading]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (mediaId) {
      try {
        await fetch(`/api/admin/medias/${mediaId}`, { method: 'DELETE' });
      } catch {
        // Silently continue - the URL will be cleared regardless
      }
    }
    setMediaId(null);
    onChange('');
  }, [mediaId, onChange]);

  const handleClick = useCallback(() => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, uploading]);

  const mediaType = value ? getMediaType(value) : null;

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-neutral-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {value ? (
        /* --- Preview mode --- */
        <div className="relative group">
          <div className={`${PREVIEW_SIZES[previewSize]} rounded-lg border border-neutral-200 overflow-hidden bg-neutral-100 relative`}>
            {mediaType === 'image' ? (
              <NextImage
                src={value}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 300px"
                unoptimized
              />
            ) : mediaType === 'video' ? (
              <div className="w-full h-full flex items-center justify-center bg-neutral-900/5">
                <PlayCircle className="w-10 h-10 text-purple-500" />
              </div>
            ) : mediaType === 'pdf' ? (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-red-500" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-10 h-10 text-neutral-400" />
              </div>
            )}
          </div>

          {/* Delete overlay */}
          {!disabled && (
            <button
              type="button"
              onClick={handleDelete}
              className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              title={t('admin.mediaUploader.remove')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* URL display */}
          <p className="text-xs text-neutral-400 truncate mt-1">{value}</p>
        </div>
      ) : (
        /* --- Drop zone mode --- */
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`
            relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${dragOver
              ? 'border-sky-400 bg-sky-50'
              : 'border-neutral-300 hover:border-sky-400 hover:bg-neutral-50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${uploading ? 'pointer-events-none' : ''}
          `}
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="w-8 h-8 mx-auto animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="text-sm text-neutral-600">{t('admin.mediaUploader.uploading')}</p>
              <div className="w-full bg-neutral-200 rounded-full h-1.5 max-w-[200px] mx-auto">
                <div
                  className="bg-sky-500 h-1.5 rounded-full transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <Upload className="w-6 h-6 text-neutral-400 mx-auto" />
              <p className="text-sm text-neutral-600">{t('admin.mediaUploader.dropOrClick')}</p>
              <p className="text-xs text-neutral-400">
                {t('admin.mediaUploader.maxSize', { size: `${config.maxSizeMB}MB` })}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-1.5 text-red-600 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hint */}
      {hint && !error && (
        <p className="text-xs text-neutral-400">{hint}</p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={config.accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />
    </div>
  );
}
