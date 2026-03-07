export const dynamic = 'force-dynamic';

/**
 * Account Consent Detail API
 * GET   - View a specific consent
 * PATCH - Revoke consent
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withUserGuard } from '@/lib/user-api-guard';
import { revokeConsentSchema } from '@/lib/validations/consent';
import { logger } from '@/lib/logger';

// GET /api/account/consents/[id]
export const GET = withUserGuard(async (_request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;

    const consent = await prisma.siteConsent.findFirst({
      where: { id, clientId: session.user.id },
      include: {
        video: { select: { id: true, title: true, slug: true, thumbnailUrl: true } },
        formTemplate: { select: { id: true, name: true, questions: true, legalText: true } },
      },
    });

    if (!consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    return NextResponse.json({ consent });
  } catch (error) {
    logger.error('Account consent GET [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { skipCsrf: true });

// PATCH /api/account/consents/[id] - Revoke consent
export const PATCH = withUserGuard(async (request: NextRequest, { session, params }) => {
  try {
    const id = params?.id;
    const body = await request.json();

    const parsed = revokeConsentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const existing = await prisma.siteConsent.findFirst({
      where: { id, clientId: session.user.id },
      select: { id: true, status: true, videoId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    if (existing.status !== 'GRANTED') {
      return NextResponse.json({ error: 'Can only revoke a granted consent' }, { status: 400 });
    }

    const consent = await prisma.siteConsent.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
        revocationReason: parsed.data.reason || null,
      },
    });

    // Auto-archive video only if no other GRANTED consents remain
    if (existing.videoId) {
      const otherGranted = await prisma.siteConsent.count({
        where: {
          videoId: existing.videoId,
          status: 'GRANTED',
          id: { not: id },
        },
      });
      if (otherGranted === 0) {
        await prisma.video.update({
          where: { id: existing.videoId },
          data: { status: 'ARCHIVED' },
        });
      }
    }

    return NextResponse.json({ consent });
  } catch (error) {
    logger.error('Account consent PATCH [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
