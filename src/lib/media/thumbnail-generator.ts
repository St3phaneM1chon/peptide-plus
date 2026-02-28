/**
 * Video Thumbnail Generator
 * C-22: Extracts a frame from a video to use as thumbnail.
 * Uses a simple approach: fetches video, generates a placeholder thumbnail.
 * Full FFmpeg-based extraction requires server-side ffmpeg binary.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ThumbnailResult {
  success: boolean;
  buffer?: Buffer;
  mimeType?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Placeholder thumbnail generator
// (For full video frame extraction, FFmpeg would be needed server-side)
// ---------------------------------------------------------------------------

/**
 * Generate a branded placeholder thumbnail with text overlay.
 * Uses Sharp to create a gradient image with the video title.
 */
export async function generatePlaceholderThumbnail(
  title: string,
  options?: { width?: number; height?: number },
): Promise<ThumbnailResult> {
  const width = options?.width || 1280;
  const height = options?.height || 720;

  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;

    // Create a gradient background with text
    const truncatedTitle = title.length > 50 ? title.slice(0, 47) + '...' : title;
    const escapedTitle = truncatedTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const svgOverlay = `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1e40af;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#bg)" />
        <text x="50%" y="45%" font-family="Inter,Arial,sans-serif" font-size="48"
              fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">
          ${escapedTitle}
        </text>
        <text x="50%" y="60%" font-family="Inter,Arial,sans-serif" font-size="24"
              fill="rgba(255,255,255,0.7)" text-anchor="middle">
          BioCycle Peptides
        </text>
        <circle cx="${width / 2}" cy="${height / 2 + 80}" r="30" fill="rgba(255,255,255,0.3)" />
        <polygon points="${width / 2 - 10},${height / 2 + 65} ${width / 2 - 10},${height / 2 + 95} ${width / 2 + 18},${height / 2 + 80}"
                 fill="white" />
      </svg>
    `;

    const buffer = await sharp(Buffer.from(svgOverlay))
      .resize(width, height)
      .jpeg({ quality: 85 })
      .toBuffer();

    return {
      success: true,
      buffer,
      mimeType: 'image/jpeg',
    };
  } catch (error) {
    logger.error('[ThumbnailGenerator] Error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate thumbnail',
    };
  }
}
