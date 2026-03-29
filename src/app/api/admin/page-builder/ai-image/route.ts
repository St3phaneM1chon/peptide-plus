export const dynamic = 'force-dynamic';

/**
 * AI Image Generation API
 * POST /api/admin/page-builder/ai-image
 *
 * Generate images using DALL-E 3 for use in the page builder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { z } from 'zod';
import { generateImage, generateImageVariation } from '@/lib/puck/ai-media';
import { logger } from '@/lib/logger';

const requestSchema = z.object({
  prompt: z.string().min(3).max(1000),
  size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional(),
  style: z.enum(['vivid', 'natural']).optional(),
  quality: z.enum(['standard', 'hd']).optional(),
  referenceImageUrl: z.string().url().optional(), // For image-to-image
});

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { prompt, size, style, quality, referenceImageUrl } = requestSchema.parse(body);

    let result;
    if (referenceImageUrl) {
      result = await generateImageVariation(referenceImageUrl, prompt, { size });
    } else {
      result = await generateImage(prompt, { size, style, quality });
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Échec de la génération. Vérifiez que OPENAI_API_KEY est configurée.' },
        { status: 503 }
      );
    }

    logger.info('[AI Image] Generated', {
      prompt: prompt.slice(0, 80),
      model: result.model,
      size: `${result.width}x${result.height}`,
    });

    return NextResponse.json({ image: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Données invalides', details: error.errors }, { status: 400 });
    }
    logger.error('[AI Image] Failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur de génération d\'image' }, { status: 500 });
  }
});
