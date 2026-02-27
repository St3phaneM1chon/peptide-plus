export const dynamic = 'force-dynamic';

/**
 * Public Consent Form API
 * GET  - Get consent form details (by token)
 * POST - Submit consent responses
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { submitConsentSchema } from '@/lib/validations/consent';
import { logger } from '@/lib/logger';
import { createHash } from 'crypto';
import { generateConsentPdf } from '@/lib/consent-pdf';
import { sendConsentConfirmationEmail, sendConsentAdminNotification } from '@/lib/consent-email';

type RouteContext = { params: Promise<{ token: string }> };

// GET /api/consent/[token] - Get form for client to fill
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    const consent = await prisma.siteConsent.findUnique({
      where: { token },
      include: {
        client: { select: { id: true, name: true, email: true } },
        video: { select: { id: true, title: true, thumbnailUrl: true } },
        formTemplate: {
          select: {
            id: true,
            name: true,
            description: true,
            questions: true,
            legalText: true,
            translations: { orderBy: { locale: 'asc' } },
          },
        },
      },
    });

    if (!consent) {
      return NextResponse.json({ error: 'Consent request not found or expired' }, { status: 404 });
    }

    if (consent.status !== 'PENDING') {
      return NextResponse.json({
        error: 'This consent has already been processed',
        status: consent.status,
      }, { status: 400 });
    }

    // Don't expose internal IDs to public
    return NextResponse.json({
      consent: {
        id: consent.id,
        type: consent.type,
        clientName: consent.client.name,
        videoTitle: consent.video?.title,
        videoThumbnail: consent.video?.thumbnailUrl,
        template: consent.formTemplate ? {
          name: consent.formTemplate.name,
          description: consent.formTemplate.description,
          questions: consent.formTemplate.questions,
          legalText: consent.formTemplate.legalText,
        } : null,
      },
    });
  } catch (error) {
    logger.error('Consent GET [token] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/consent/[token] - Submit consent
export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const body = await request.json();

    const parsed = submitConsentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }

    const consent = await prisma.siteConsent.findUnique({
      where: { token },
      select: {
        id: true, status: true, clientId: true, type: true, videoId: true,
        client: { select: { id: true, name: true, email: true } },
        video: { select: { id: true, title: true } },
        formTemplate: { select: { id: true, name: true, description: true, questions: true, legalText: true } },
        requestedBy: { select: { id: true, email: true } },
      },
    });

    if (!consent) {
      return NextResponse.json({ error: 'Consent request not found or expired' }, { status: 404 });
    }

    if (consent.status !== 'PENDING') {
      return NextResponse.json({ error: 'This consent has already been processed' }, { status: 400 });
    }

    const now = new Date();
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Generate tamper-detection hash
    const signaturePayload = JSON.stringify(parsed.data.responses) + consent.clientId + now.toISOString() + ipAddress;
    const signatureHash = createHash('sha256').update(signaturePayload).digest('hex');

    const updated = await prisma.siteConsent.update({
      where: { id: consent.id },
      data: {
        status: 'GRANTED',
        responses: parsed.data.responses,
        grantedAt: now,
        ipAddress,
        userAgent,
        signatureHash,
      },
    });

    // Generate PDF (non-blocking — don't fail the request if PDF fails)
    const questions = Array.isArray(consent.formTemplate?.questions) ? consent.formTemplate.questions as Array<{ question: string; type: 'checkbox' | 'text' | 'signature'; required: boolean }> : [];
    let pdfBytes: Uint8Array | undefined;
    try {
      pdfBytes = await generateConsentPdf({
        consentId: consent.id,
        clientName: consent.client.name || 'Client',
        clientEmail: consent.client.email,
        type: consent.type,
        videoTitle: consent.video?.title,
        templateName: consent.formTemplate?.name,
        templateDescription: consent.formTemplate?.description,
        questions,
        responses: parsed.data.responses as Record<string, string | boolean>,
        legalText: consent.formTemplate?.legalText,
        grantedAt: now,
        ipAddress,
        userAgent,
        signatureHash,
      });

      // Store PDF generation timestamp (PDF URL would require Azure Blob upload)
      await prisma.siteConsent.update({
        where: { id: consent.id },
        data: { pdfGeneratedAt: new Date() },
      });
    } catch (pdfErr) {
      logger.error('Consent PDF generation failed', { consentId: consent.id, error: pdfErr instanceof Error ? pdfErr.message : String(pdfErr) });
    }

    // Send confirmation email to client (non-blocking)
    sendConsentConfirmationEmail({
      clientName: consent.client.name || 'Client',
      clientEmail: consent.client.email,
      videoTitle: consent.video?.title,
      templateName: consent.formTemplate?.name,
      pdfBytes,
    }).catch(err => logger.error('Consent confirmation email failed', { error: err instanceof Error ? err.message : String(err) }));

    // Notify admin (non-blocking)
    if (consent.requestedBy?.email) {
      sendConsentAdminNotification({
        adminEmail: consent.requestedBy.email,
        clientName: consent.client.name || 'Client',
        clientEmail: consent.client.email,
        action: 'granted',
        videoTitle: consent.video?.title,
        consentId: consent.id,
      }).catch(err => logger.error('Consent admin notification failed', { error: err instanceof Error ? err.message : String(err) }));
    }

    return NextResponse.json({
      success: true,
      message: 'Consent granted successfully. Thank you.',
      consentId: updated.id,
    });
  } catch (error) {
    logger.error('Consent POST [token] error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
