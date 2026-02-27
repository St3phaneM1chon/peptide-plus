export const dynamic = 'force-dynamic';

/**
 * Admin Video Consent API
 * GET  - View consent status for a video
 * POST - Request consent from featured client
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { createConsentRequestSchema } from '@/lib/validations/consent';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { sendConsentRequestEmail } from '@/lib/consent-email';

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/videos/[id]/consent
export const GET = withAdminGuard(async (_request, { routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;

    const video = await prisma.video.findUnique({
      where: { id },
      select: { id: true, featuredClientId: true, status: true },
    });
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const consents = await prisma.siteConsent.findMany({
      where: { videoId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true, email: true } },
        formTemplate: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true } },
      },
    });

    const requiresConsent = !!video.featuredClientId;
    const hasGrantedConsent = consents.some(c => c.status === 'GRANTED');
    const canPublish = !requiresConsent || hasGrantedConsent;

    return NextResponse.json({
      requiresConsent,
      hasGrantedConsent,
      canPublish,
      consents,
    });
  } catch (error) {
    logger.error('Admin video consent GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

// POST /api/admin/videos/[id]/consent - Request consent
export const POST = withAdminGuard(async (request, { session, routeContext }) => {
  try {
    const { id } = await (routeContext as RouteContext).params;
    const body = await request.json();

    const parsed = createConsentRequestSchema.safeParse({ ...body, videoId: id });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const { clientId, formTemplateId, type } = parsed.data;

    // Verify video, client, and template exist
    const [video, client, template] = await Promise.all([
      prisma.video.findUnique({ where: { id }, select: { id: true, title: true } }),
      prisma.user.findUnique({ where: { id: clientId }, select: { id: true, name: true, email: true } }),
      prisma.consentFormTemplate.findUnique({ where: { id: formTemplateId }, select: { id: true, name: true } }),
    ]);

    if (!video) return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (!template) return NextResponse.json({ error: 'Consent template not found' }, { status: 404 });

    // Generate unique token
    const { randomUUID } = await import('crypto');
    const token = randomUUID();

    const consent = await prisma.siteConsent.create({
      data: {
        clientId,
        videoId: id,
        formTemplateId,
        type: type as 'VIDEO_APPEARANCE' | 'TESTIMONIAL' | 'PHOTO' | 'CASE_STUDY' | 'MARKETING' | 'OTHER',
        status: 'PENDING',
        requestedById: session.user.id,
        token,
      },
      include: {
        client: { select: { id: true, name: true, email: true } },
        formTemplate: { select: { id: true, name: true } },
      },
    });

    // Send consent request email to client (non-blocking)
    sendConsentRequestEmail({
      clientName: client.name || 'Client',
      clientEmail: client.email,
      consentToken: token,
      videoTitle: video.title,
      templateName: template.name,
      requestedByName: session.user.name || null,
    }).catch(err => logger.error('Consent request email failed', { error: err instanceof Error ? err.message : String(err) }));

    logAdminAction({
      adminUserId: session.user.id,
      action: 'REQUEST_CONSENT',
      targetType: 'SiteConsent',
      targetId: consent.id,
      newValue: { clientId, videoId: id, type },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      consent,
      consentUrl: `${process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com'}/consent/${token}`,
    }, { status: 201 });
  } catch (error) {
    logger.error('Admin video consent POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
