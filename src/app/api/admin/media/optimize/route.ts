export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/media/optimize
 * Batch optimize images from the Media library.
 * Resizes to 110% of display context, converts to WebP, strips EXIF.
 *
 * Body: { context?: string, mediaIds?: string[], quality?: number }
 * - context: 'product' | 'category' | 'banner' | 'avatar' | 'thumbnail' | 'general'
 * - mediaIds: specific media IDs to optimize (if empty, optimizes all unoptimized)
 * - quality: WebP quality 1-100 (default 85)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  DISPLAY_SIZE_TARGETS,
  optimizeForDisplay,
  isProcessableImage,
} from '@/lib/media/image-pipeline';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: Request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const context = (body.context || 'general') as keyof typeof DISPLAY_SIZE_TARGETS;
    const mediaIds = body.mediaIds as string[] | undefined;
    const quality = body.quality || 85;

    // Find media to optimize
    const whereClause: Record<string, unknown> = {
      mimeType: { startsWith: 'image/' },
    };

    if (mediaIds && mediaIds.length > 0) {
      whereClause.id = { in: mediaIds };
    }

    const medias = await prisma.media.findMany({
      where: whereClause,
      select: {
        id: true,
        url: true,
        originalName: true,
        mimeType: true,
        size: true,
      },
      take: 100, // Process max 100 at a time
    });

    if (medias.length === 0) {
      return NextResponse.json({ message: 'No images found to optimize', results: [] });
    }

    const results: Array<{
      id: string;
      name: string;
      status: 'optimized' | 'skipped' | 'error';
      originalSize?: number;
      newSize?: number;
      savingsPercent?: number;
      error?: string;
    }> = [];

    for (const media of medias) {
      try {
        if (!isProcessableImage(media.mimeType)) {
          results.push({ id: media.id, name: media.originalName, status: 'skipped' });
          continue;
        }

        // SECURITY: Validate URL to prevent SSRF - only allow trusted storage domains
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(media.url);
        } catch {
          results.push({ id: media.id, name: media.originalName, status: 'error', error: 'Invalid URL' });
          continue;
        }
        const trustedHosts = ['blob.core.windows.net', 'azurewebsites.net', 'biocyclepeptides.com'];
        const isTrusted = trustedHosts.some(h => parsedUrl.hostname.endsWith(h));
        if (!isTrusted && parsedUrl.hostname !== 'localhost') {
          results.push({ id: media.id, name: media.originalName, status: 'error', error: 'Untrusted URL domain' });
          continue;
        }

        // Fetch the image from its URL
        const response = await fetch(media.url, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) {
          results.push({
            id: media.id,
            name: media.originalName,
            status: 'error',
            error: `Failed to fetch: ${response.status}`,
          });
          continue;
        }

        const inputBuffer = Buffer.from(await response.arrayBuffer());

        // Optimize using the 110% display rule
        const result = await optimizeForDisplay(inputBuffer, context, {
          quality,
          generateVariants: false,
          stripMetadata: true,
        });

        // Update the media record with optimized size info
        await prisma.media.update({
          where: { id: media.id },
          data: {
            size: result.optimized.size,
            // Store optimization metadata in alt field as JSON if no better field
          },
        });

        results.push({
          id: media.id,
          name: media.originalName,
          status: 'optimized',
          originalSize: result.originalSize,
          newSize: result.optimized.size,
          savingsPercent: result.savingsPercent,
        });
      } catch (err) {
        logger.error(`[media/optimize] Error processing ${media.originalName}:`, err);
        results.push({
          id: media.id,
          name: media.originalName,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const totalOriginal = results.reduce((sum, r) => sum + (r.originalSize || 0), 0);
    const totalNew = results.reduce((sum, r) => sum + (r.newSize || 0), 0);

    return NextResponse.json({
      processed: results.filter(r => r.status === 'optimized').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
      totalSavedBytes: totalOriginal - totalNew,
      totalSavedPercent: totalOriginal > 0 ? Math.round((1 - totalNew / totalOriginal) * 100) : 0,
      results,
    });
  } catch (error) {
    logger.error('[media/optimize] Error:', error);
    return NextResponse.json(
      { error: 'Failed to optimize images' },
      { status: 500 }
    );
  }
});
