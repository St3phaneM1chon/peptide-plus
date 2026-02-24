/**
 * IMAGE OPTIMIZATION PIPELINE (#67)
 * Uses sharp for resizing, WebP conversion, compression, and EXIF stripping.
 *
 * Usage:
 *   import { optimizeImage, ImageVariant } from '@/lib/image-optimizer';
 *   const variants = await optimizeImage(buffer, 'product.jpg');
 *
 * Generates variants: thumbnail (150px), medium (400px), large (800px), original.
 * (#72): EXIF metadata is stripped (except orientation) for privacy.
 */

import { storage, StorageOptions } from '@/lib/storage';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImageVariant {
  name: 'thumbnail' | 'medium' | 'large' | 'original';
  width: number;
  url: string;
  size: number;
  format: string;
}

export interface OptimizedImage {
  variants: ImageVariant[];
  originalHash: string;
}

// Variant configurations
const VARIANTS = [
  { name: 'thumbnail' as const, width: 150, quality: 75 },
  { name: 'medium' as const, width: 400, quality: 80 },
  { name: 'large' as const, width: 800, quality: 80 },
] as const;

// ---------------------------------------------------------------------------
// Sharp lazy loading
// ---------------------------------------------------------------------------

let sharpModule: typeof import('sharp') | null = null;

async function getSharp() {
  if (sharpModule) return sharpModule;

  try {
    sharpModule = (await import('sharp')).default;
    return sharpModule;
  } catch (error) {
    logger.warn('Sharp is not installed. Image optimization disabled.', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Image Optimization
// ---------------------------------------------------------------------------

/**
 * Optimize an image buffer and generate multiple variants.
 * Returns URLs for each variant (thumbnail, medium, large, original).
 *
 * @param buffer - Raw image buffer
 * @param filename - Original filename (used for naming)
 * @param options - Storage options (folder, etc.)
 */
export async function optimizeImage(
  buffer: Buffer,
  filename: string,
  options: StorageOptions = {}
): Promise<OptimizedImage> {
  const sharp = await getSharp();
  const { folder = 'images' } = options;

  // If sharp is not available, upload original as-is
  if (!sharp) {
    const result = await storage.upload(buffer, filename, 'image/webp', { folder });
    return {
      variants: [{
        name: 'original',
        width: 0,
        url: result.url,
        size: result.size,
        format: 'original',
      }],
      originalHash: result.contentHash,
    };
  }

  const baseName = filename.replace(/\.[^.]+$/, '');
  const variants: ImageVariant[] = [];

  // (#72): Strip EXIF metadata except orientation
  const baseImage = sharp(buffer)
    .rotate() // auto-rotate based on EXIF orientation
    .withMetadata({ orientation: undefined }); // strip all EXIF except what rotate() uses

  // FIX: F42 - Collect variant generation errors and surface them
  const variantErrors: string[] = [];

  // Generate resized WebP variants
  for (const variant of VARIANTS) {
    try {
      const resized = await baseImage
        .clone()
        .resize(variant.width, null, {
          withoutEnlargement: true, // don't upscale small images
          fit: 'inside',
        })
        .webp({ quality: variant.quality })
        .toBuffer();

      const variantFilename = `${baseName}-${variant.name}.webp`;
      const result = await storage.upload(
        resized,
        variantFilename,
        'image/webp',
        { folder: `${folder}/${variant.name}`, hashFilename: true }
      );

      variants.push({
        name: variant.name,
        width: variant.width,
        url: result.url,
        size: result.size,
        format: 'webp',
      });
    } catch (error) {
      // FIX: F42 - Collect errors instead of silently swallowing
      const errMsg = `Failed to generate ${variant.name} variant: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errMsg);
      variantErrors.push(errMsg);
    }
  }

  // FIX: F42 - If ALL variants failed, throw so the caller knows optimization failed
  if (variants.length === 0 && variantErrors.length > 0) {
    throw new Error(`All image variants failed: ${variantErrors.join('; ')}`);
  }

  // FIX: F75 - Upload original converted to WebP (WebP supports transparency/alpha channel).
  // TODO: For PNGs with specific ICC color profiles, consider preserving original format as fallback.
  try {
    const originalWebp = await baseImage
      .clone()
      .webp({ quality: 85, alphaQuality: 100 }) // FIX: F75 - Preserve full alpha quality for transparent images
      .toBuffer();

    const originalFilename = `${baseName}-original.webp`;
    const originalResult = await storage.upload(
      originalWebp,
      originalFilename,
      'image/webp',
      { folder: `${folder}/original`, hashFilename: true }
    );

    variants.push({
      name: 'original',
      width: 0, // original size
      url: originalResult.url,
      size: originalResult.size,
      format: 'webp',
    });

    return {
      variants,
      originalHash: originalResult.contentHash,
    };
  } catch (error) {
    logger.error('Failed to process original image', { error: error instanceof Error ? error.message : String(error) });
    // Fallback: upload raw buffer
    const result = await storage.upload(buffer, filename, 'image/webp', { folder });
    variants.push({
      name: 'original',
      width: 0,
      url: result.url,
      size: result.size,
      format: 'original',
    });

    return {
      variants,
      originalHash: result.contentHash,
    };
  }
}

/**
 * Strip EXIF metadata from an image buffer (#72).
 * Preserves orientation by auto-rotating first.
 */
export async function stripExif(buffer: Buffer): Promise<Buffer> {
  const sharp = await getSharp();
  if (!sharp) return buffer;

  return sharp(buffer)
    .rotate() // auto-rotate based on EXIF orientation
    .withMetadata({ orientation: undefined })
    .toBuffer();
}
