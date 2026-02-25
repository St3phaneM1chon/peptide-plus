'use client';

import { useState, useCallback, useRef } from 'react';
import NextImage from 'next/image';
import { Plus, X, GripVertical, Star } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { MediaUploader } from './MediaUploader';

export interface GalleryImage {
  url: string;
  alt?: string;
  sortOrder: number;
  isPrimary: boolean;
  // F79 FIX: Track file size per image for total size validation
  fileSize?: number;
}

interface MediaGalleryUploaderProps {
  images: GalleryImage[];
  onChange: (images: GalleryImage[]) => void;
  maxImages?: number;
  // F79 FIX: Optional total size limit to prevent excessive uploads
  maxTotalSizeMB?: number;
}

export function MediaGalleryUploader({
  images,
  onChange,
  maxImages = 10,
  // F79 FIX: Default max total size 50MB
  maxTotalSizeMB = 50,
}: MediaGalleryUploaderProps) {
  const { t } = useI18n();
  const [showUploader, setShowUploader] = useState(false);
  const [editingAlt, setEditingAlt] = useState<number | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // F79 FIX: Compute current total size of gallery images in bytes
  const totalSizeBytes = images.reduce((sum, img) => sum + (img.fileSize || 0), 0);
  const totalSizeMB = totalSizeBytes / (1024 * 1024);
  const isOverSizeLimit = totalSizeMB >= maxTotalSizeMB;

  const addImage = useCallback((url: string, fileSize?: number) => {
    if (!url) return;
    // F79 FIX: Check total size limit before allowing add
    const currentTotal = images.reduce((sum, img) => sum + (img.fileSize || 0), 0);
    const newTotal = currentTotal + (fileSize || 0);
    if (maxTotalSizeMB > 0 && newTotal > maxTotalSizeMB * 1024 * 1024) {
      toast.error(t('admin.mediaGallery.totalSizeLimitReached') || `Total size exceeds ${maxTotalSizeMB}MB limit`);
      return;
    }
    const newImage: GalleryImage = {
      url,
      alt: '',
      sortOrder: images.length,
      isPrimary: images.length === 0,
      fileSize,
    };
    onChange([...images, newImage]);
    setShowUploader(false);
  }, [images, onChange, maxTotalSizeMB, t]);

  const removeImage = useCallback((index: number) => {
    const updated = images.filter((_, i) => i !== index);
    // Reassign sort orders and ensure one primary
    const reordered = updated.map((img, i) => ({
      ...img,
      sortOrder: i,
      isPrimary: i === 0,
    }));
    onChange(reordered);
  }, [images, onChange]);

  const setPrimary = useCallback((index: number) => {
    const updated = images.map((img, i) => ({
      ...img,
      isPrimary: i === index,
    }));
    onChange(updated);
  }, [images, onChange]);

  const updateAlt = useCallback((index: number, alt: string) => {
    const updated = [...images];
    updated[index] = { ...updated[index], alt };
    onChange(updated);
  }, [images, onChange]);

  // HTML5 drag-and-drop reorder
  const handleDragStart = useCallback((index: number) => {
    dragItem.current = index;
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    dragOverItem.current = index;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const updated = [...images];
    const [draggedItem] = updated.splice(dragItem.current, 1);
    updated.splice(dragOverItem.current, 0, draggedItem);

    // Reassign sort orders, preserve primary
    const reordered = updated.map((img, i) => ({
      ...img,
      sortOrder: i,
    }));

    dragItem.current = null;
    dragOverItem.current = null;
    onChange(reordered);
  }, [images, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-700">
          {t('admin.mediaGallery.title')}
          <span className="text-neutral-400 font-normal ml-1.5">
            ({images.length}/{maxImages})
          </span>
        </p>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((img, index) => (
          <div
            key={`${img.url}-${index}`}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragEnter={() => handleDragEnter(index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => e.preventDefault()}
            className="relative group bg-white rounded-lg border border-neutral-200 overflow-hidden cursor-grab active:cursor-grabbing"
          >
            {/* Thumbnail */}
            <div className="aspect-square relative bg-neutral-100">
              <NextImage
                src={img.url}
                alt={img.alt || ''}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
                unoptimized
              />

              {/* Primary badge */}
              {img.isPrimary && (
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-sky-500 text-white text-[10px] font-medium rounded-md flex items-center gap-0.5">
                  <Star className="w-2.5 h-2.5" />
                  {t('admin.mediaGallery.primary')}
                </div>
              )}

              {/* Drag handle overlay */}
              <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-4 h-4 text-white drop-shadow-md" />
              </div>

              {/* Action buttons overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                {!img.isPrimary && (
                  <button
                    type="button"
                    onClick={() => setPrimary(index)}
                    className="p-1.5 bg-white/90 text-sky-600 rounded-full hover:bg-white"
                    title={t('admin.mediaGallery.setPrimary')}
                  >
                    <Star className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="p-1.5 bg-white/90 text-red-600 rounded-full hover:bg-white"
                  title={t('admin.mediaGallery.remove')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Alt text */}
            <div className="p-1.5">
              {editingAlt === index ? (
                <input
                  type="text"
                  value={img.alt || ''}
                  onChange={(e) => updateAlt(index, e.target.value)}
                  onBlur={() => setEditingAlt(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setEditingAlt(null); }}
                  autoFocus
                  placeholder={t('admin.mediaGallery.altPlaceholder')}
                  className="w-full px-1.5 py-0.5 text-xs border border-neutral-200 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              ) : (
                <p
                  onClick={() => setEditingAlt(index)}
                  className="text-xs text-neutral-400 truncate cursor-text hover:text-neutral-600"
                  title={t('admin.mediaGallery.clickToEditAlt')}
                >
                  {img.alt || t('admin.mediaGallery.altPlaceholder')}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Add photo slot */}
        {/* F79 FIX: Disable add button when total size limit is reached */}
        {images.length < maxImages && !isOverSizeLimit && (
          showUploader ? (
            <div className="aspect-square">
              <MediaUploader
                value=""
                onChange={addImage}
                context="product-image"
                previewSize="md"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUploader(true)}
              className="aspect-square rounded-lg border-2 border-dashed border-neutral-300 hover:border-sky-400 hover:bg-sky-50 transition-colors flex flex-col items-center justify-center gap-1"
            >
              <Plus className="w-6 h-6 text-neutral-400" />
              <span className="text-xs text-neutral-500">{t('admin.mediaGallery.addPhoto')}</span>
            </button>
          )
        )}
        {/* F79 FIX: Show warning when total size limit reached */}
        {isOverSizeLimit && images.length < maxImages && (
          <div className="aspect-square rounded-lg border-2 border-dashed border-amber-300 bg-amber-50 flex flex-col items-center justify-center gap-1 p-2">
            <span className="text-xs text-amber-600 text-center font-medium">
              {t('admin.mediaGallery.sizeLimitReached') || `Size limit (${maxTotalSizeMB}MB) reached`}
            </span>
            <span className="text-[10px] text-amber-500 text-center">
              {totalSizeMB.toFixed(1)}MB / {maxTotalSizeMB}MB
            </span>
          </div>
        )}
      </div>

      {images.length === 0 && (
        <p className="text-xs text-neutral-400 text-center py-2">
          {t('admin.mediaGallery.emptyHint')}
        </p>
      )}
    </div>
  );
}
