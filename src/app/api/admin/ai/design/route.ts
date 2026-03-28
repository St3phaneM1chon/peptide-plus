export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/ai/design
 *
 * AI Design Assistant endpoints for the Koraline page builder.
 * Handles three actions:
 *   - "suggestions"  → design suggestions (palette, fonts, layout, hints)
 *   - "content"      → page content generation (hero, features, CTA, FAQ)
 *   - "improve"      → rewrite / improve existing text
 *   - "section"      → generate content for a single section
 *
 * Rate limited: 10 requests/minute per tenant (via withAdminGuard override).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';
import {
  generateDesignSuggestions,
  type Industry,
} from '@/lib/ai/design-suggestions';
import {
  generatePageContent,
  improveText,
  generateSectionContent,
  type ContentTone,
  type ContentLength,
} from '@/lib/ai/content-generator';

// ---------------------------------------------------------------------------
// Input validation schemas
// ---------------------------------------------------------------------------

const suggestionsSchema = z.object({
  action: z.literal('suggestions'),
  pageType: z.string().min(1).max(100),
  industry: z.enum([
    'restaurant', 'fitness', 'education', 'legal',
    'creative', 'tech', 'healthcare', 'retail', 'general',
  ]),
  existingSections: z.array(z.string().max(50)).max(30).optional(),
});

const contentSchema = z.object({
  action: z.literal('content'),
  topic: z.string().min(1).max(500),
  tone: z.enum(['professional', 'friendly', 'bold', 'minimal', 'luxury']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  sections: z.array(z.string().max(50)).max(10).optional(),
});

const improveSchema = z.object({
  action: z.literal('improve'),
  text: z.string().min(1).max(5000),
  instruction: z.string().max(500).optional(),
  tone: z.enum(['professional', 'friendly', 'bold', 'minimal', 'luxury']).optional(),
});

const sectionSchema = z.object({
  action: z.literal('section'),
  sectionType: z.string().min(1).max(50),
  topic: z.string().min(1).max(500),
  tone: z.enum(['professional', 'friendly', 'bold', 'minimal', 'luxury']).optional(),
});

const requestSchema = z.discriminatedUnion('action', [
  suggestionsSchema,
  contentSchema,
  improveSchema,
  sectionSchema,
]);

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(
  async (request: Request) => {
    try {
      const body = await request.json();
      const parsed = requestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
          { status: 400 },
        );
      }

      const data = parsed.data;

      switch (data.action) {
        case 'suggestions': {
          const result = await generateDesignSuggestions(
            data.pageType,
            data.industry as Industry,
            data.existingSections ?? [],
          );
          return NextResponse.json({ data: result });
        }

        case 'content': {
          const result = await generatePageContent(
            data.topic,
            (data.tone ?? 'professional') as ContentTone,
            (data.length ?? 'medium') as ContentLength,
            data.sections ?? ['hero', 'features', 'cta'],
          );
          return NextResponse.json({ data: result });
        }

        case 'improve': {
          const result = await improveText(
            data.text,
            data.instruction ?? 'Make it more engaging and professional',
            (data.tone ?? 'professional') as ContentTone,
          );
          return NextResponse.json({ data: { improved: result } });
        }

        case 'section': {
          const result = await generateSectionContent(
            data.sectionType,
            data.topic,
            (data.tone ?? 'professional') as ContentTone,
          );
          return NextResponse.json({ data: result });
        }

        default:
          return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
      }
    } catch (error) {
      logger.error('[AI Design] Error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  },
  { rateLimit: 10 },
);
