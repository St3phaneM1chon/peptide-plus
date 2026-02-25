/**
 * Image Optimization Utilities
 * Auto-resize, thumbnail generation, dimension validation
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageOptimizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

export interface ThumbnailConfig {
  name: string;
  width: number;
  height: number;
  fit: 'cover' | 'contain' | 'fill';
}

export const THUMBNAIL_CONFIGS: ThumbnailConfig[] = [
  { name: 'thumb_sm', width: 64, height: 64, fit: 'cover' },
  { name: 'thumb_md', width: 200, height: 200, fit: 'cover' },
  { name: 'thumb_lg', width: 400, height: 400, fit: 'cover' },
  { name: 'card', width: 600, height: 400, fit: 'cover' },
  { name: 'hero', width: 1200, height: 630, fit: 'cover' },
];

// IMP-041: AVIF support already included in allowed types for modern browser compression
// IMP-054: HEIC/HEIF support added for iPhone photo uploads (auto-converted to JPEG/WebP server-side)
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif'];
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `Type non support\u00e9: ${file.type}. Utilisez JPEG, PNG ou WebP.` };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { valid: false, error: `Fichier trop volumineux: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum: 10MB.` };
  }
  return { valid: true };
}

export function getImageDimensionsFromUrl(url: string): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Browser only'));
      return;
    }
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
}

export function calculateResizedDimensions(
  original: ImageDimensions,
  maxWidth: number,
  maxHeight: number
): ImageDimensions {
  let { width, height } = original;
  if (width > maxWidth) {
    height = Math.round(height * (maxWidth / width));
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = Math.round(width * (maxHeight / height));
    height = maxHeight;
  }
  return { width, height };
}

export function generateAltText(filename: string, productName?: string): string {
  if (productName) return productName;
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
