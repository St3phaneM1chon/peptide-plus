export const dynamic = 'force-dynamic';

/**
 * Admin Consent Detail API
 * GET   - Get consent details
 * PATCH - Update consent (admin can change status)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

type RouteContext = { params: Promise<{ id: string }> };

const patchConsentSchema = z.object({
  status: z.enum(['PENDING', 'GRANTED', 'REVOKED', 'EXPIRED']).optional(),
  revocationReason: z.string().max(2000).optional().nullable(),
});

// GET /api/admin/consents/[id]
export const GET = withAdminGuard(async (_request, { routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const consent = await prisma.siteConsent.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        video: {
          select: { id: true, title: true, slug: true, thumbnailUrl: true, status: true },
        },
        formTemplate: { select: { id: true, name: true, questions: true, legalText: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!consent) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    return NextResponse.json({ consent });
  } catch (error) {
    logger.error('Admin consents GET [id] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// PATCH /api/admin/consents/[id]
export const PATCH = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = patchConsentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const existing = await prisma.siteConsent.findUnique({
      where: { id },
      select: { id: true, videoId: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Consent not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.status) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === 'REVOKED') {
        updateData.revokedAt = new Date();
        updateData.revocationReason = parsed.data.revocationReason || null;

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
      }
      if (parsed.data.status === 'GRANTED') {
        updateData.grantedAt = new Date();
      }
    }

    if (parsed.data.revocationReason !== undefined) {
      updateData.revocationReason = parsed.data.revocationReason;
    }

    const consent = await prisma.siteConsent.update({
      where: { id },
      data: updateData,
      include: {
        client: { select: { id: true, name: true, email: true } },
        video: { select: { id: true, title: true } },
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_CONSENT',
      targetType: 'SiteConsent',
      targetId: id,
      newValue: parsed.data,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ consent });
  } catch (error) {
    logger.error('Admin consents PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
