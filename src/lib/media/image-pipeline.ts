/**
 * Server-side Image Optimization Pipeline
 * Chantier 1.2: Sharp-based resize, WebP conversion, thumbnail generation.
 *
 * NOTE: Requires `sharp` package. Install with: npm install sharp
 * Sharp is lazy-loaded to avoid build failures when not installed.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageVariant {
  name: string;
  width: number;
  height: number;
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  format: 'webp' | 'jpeg' | 'png';
  quality: number;
}

export interface OptimizedImage {
  variant: string;
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
  size: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  hasAlpha: boolean;
}

// ---------------------------------------------------------------------------
// Default variants
// ---------------------------------------------------------------------------

export const DEFAULT_VARIANTS: ImageVariant[] = [
  { name: 'thumb_sm', width: 64, height: 64, fit: 'cover', format: 'webp', quality: 75 },
  { name: 'thumb_md', width: 200, height: 200, fit: 'cover', format: 'webp', quality: 80 },
  { name: 'thumb_lg', width: 400, height: 400, fit: 'cover', format: 'webp', quality: 80 },
  { name: 'card', width: 600, height: 400, fit: 'cover', format: 'webp', quality: 82 },
  { name: 'hero', width: 1200, height: 630, fit: 'cover', format: 'webp', quality: 85 },
];

// ---------------------------------------------------------------------------
// Lazy Sharp import
// ---------------------------------------------------------------------------

let sharpModule: typeof import('sharp') | null = null;

async function getSharp() {
  if (!sharpModule) {
    try {
      sharpModule = await import('sharp');
    } catch {
      throw new Error('sharp is not installed. Run: npm install sharp');
    }
  }
  return sharpModule.default;
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

/**
 * Extract metadata from an image buffer without processing.
 */
export async function getImageMetadata(buffer: Buffer): Promise<ImageMetadata> {
  const sharp = await getSharp();
  const meta = await sharp(buffer).metadata();
  return {
    width: meta.width || 0,
    height: meta.height || 0,
    format: meta.format || 'unknown',
    size: buffer.length,
    hasAlpha: meta.hasAlpha || false,
  };
}

/**
 * Generate optimized variants of an image.
 * Returns an array of processed buffers with metadata.
 */
export async function generateVariants(
  inputBuffer: Buffer,
  variants: ImageVariant[] = DEFAULT_VARIANTS,
): Promise<OptimizedImage[]> {
  const sharp = await getSharp();
  const results: OptimizedImage[] = [];

  for (const variant of variants) {
    try {
      let pipeline = sharp(inputBuffer)
        .resize(variant.width, variant.height, { fit: variant.fit, withoutEnlargement: true });

      switch (variant.format) {
        case 'webp':
          pipeline = pipeline.webp({ quality: variant.quality });
          break;
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: variant.quality, mozjpeg: true });
          break;
        case 'png':
          pipeline = pipeline.png({ quality: variant.quality, compressionLevel: 9 });
          break;
      }

      const outputBuffer = await pipeline.toBuffer();
      const meta = await sharp(outputBuffer).metadata();

      results.push({
        variant: variant.name,
        buffer: outputBuffer,
        mimeType: `image/${variant.format}`,
        width: meta.width || variant.width,
        height: meta.height || variant.height,
        size: outputBuffer.length,
      });
    } catch (err) {
      logger.warn(`[ImagePipeline] Failed to generate variant "${variant.name}"`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/**
 * Optimize a single image: resize to max dimensions + convert to WebP.
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  options?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png';
  },
): Promise<{ buffer: Buffer; mimeType: string; width: number; height: number }> {
  const sharp = await getSharp();
  const maxWidth = options?.maxWidth || 1920;
  const maxHeight = options?.maxHeight || 1080;
  const quality = options?.quality || 85;
  const format = options?.format || 'webp';

  let pipeline = sharp(inputBuffer)
    .resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true });

  switch (format) {
    case 'webp':
      pipeline = pipeline.webp({ quality });
      break;
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
      break;
  }

  const outputBuffer = await pipeline.toBuffer();
  const meta = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    mimeType: `image/${format}`,
    width: meta.width || 0,
    height: meta.height || 0,
  };
}

/**
 * Check if a MIME type is an image we can process with Sharp.
 */
export function isProcessableImage(mimeType: string): boolean {
  const processable = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif'];
  return processable.includes(mimeType);
}
