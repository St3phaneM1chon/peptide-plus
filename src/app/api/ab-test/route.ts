export const dynamic = 'force-dynamic';

/**
 * Public A/B Test API
 * GET  - Get variant assignment for a visitor on a given page
 * POST - Track conversion for a visitor
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const getVariantSchema = z.object({
  pageUrl: z.string().min(1),
  visitorId: z.string().min(1),
});

const trackConversionSchema = z.object({
  testId: z.string().min(1),
  visitorId: z.string().min(1),
}).strict();

// ---------------------------------------------------------------------------
// Deterministic variant assignment via hash
// ---------------------------------------------------------------------------
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

interface Variant {
  id: string;
  name: string;
  content: string;
  trafficPercent: number;
}

function assignVariant(visitorId: string, testId: string, variants: Variant[]): Variant {
  const hash = hashString(`${visitorId}:${testId}`);
  const bucket = hash % 100; // 0-99

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.trafficPercent;
    if (bucket < cumulative) {
      return variant;
    }
  }
  // Fallback to last variant
  return variants[variants.length - 1];
}

// ---------------------------------------------------------------------------
// GET /api/ab-test?pageUrl=...&visitorId=...
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageUrl = searchParams.get('pageUrl');
    const visitorId = searchParams.get('visitorId');

    const parsed = getVariantSchema.safeParse({ pageUrl, visitorId });
    if (!parsed.success) {
      return NextResponse.json({ error: 'pageUrl and visitorId are required' }, { status: 400 });
    }

    // Find active test for this page
    const test = await prisma.abTest.findFirst({
      where: {
        pageUrl: parsed.data.pageUrl,
        status: 'running',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!test) {
      return NextResponse.json({ testId: null, variant: null, isControl: true });
    }

    const variants = (test.variants as unknown as Variant[]) || [];
    if (variants.length === 0) {
      return NextResponse.json({ testId: test.id, variant: null, isControl: true });
    }

    // Check if visitor already has an assignment
    const existingImpression = await prisma.abTestImpression.findFirst({
      where: { testId: test.id, visitorId: parsed.data.visitorId },
    });

    let assignedVariant: Variant;
    if (existingImpression) {
      assignedVariant = variants.find(v => v.id === existingImpression.variantId) || variants[0];
    } else {
      // Assign based on hash
      assignedVariant = assignVariant(parsed.data.visitorId, test.id, variants);

      // Record impression
      await prisma.abTestImpression.create({
        data: {
          testId: test.id,
          variantId: assignedVariant.id,
          visitorId: parsed.data.visitorId,
        },
      });
    }

    return NextResponse.json({
      testId: test.id,
      variant: assignedVariant,
      isControl: assignedVariant.id === variants[0]?.id,
    });
  } catch (error) {
    logger.error('AB test GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ testId: null, variant: null, isControl: true });
  }
}

// ---------------------------------------------------------------------------
// POST /api/ab-test - Track conversion
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = trackConversionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'testId and visitorId are required' }, { status: 400 });
    }

    const { testId, visitorId } = parsed.data;

    // Find the visitor's impression and mark as converted
    const impression = await prisma.abTestImpression.findFirst({
      where: { testId, visitorId, converted: false },
    });

    if (!impression) {
      return NextResponse.json({ success: false, reason: 'No matching impression found' });
    }

    await prisma.abTestImpression.update({
      where: { id: impression.id },
      data: { converted: true },
    });

    return NextResponse.json({ success: true, variantId: impression.variantId });
  } catch (error) {
    logger.error('AB test POST conversion error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false });
  }
}
