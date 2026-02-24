export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.redirect(new URL('/?subscription=error', request.url));
    }

    const subscriber = await prisma.mailingListSubscriber.findUnique({
      where: { confirmToken: token },
    });

    if (!subscriber) {
      return NextResponse.redirect(new URL('/?subscription=invalid', request.url));
    }

    if (subscriber.status === 'ACTIVE') {
      return NextResponse.redirect(new URL('/?subscription=already', request.url));
    }

    const confirmedAt = new Date();
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    await prisma.mailingListSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: 'ACTIVE',
        confirmedAt,
        confirmToken: null, // Invalidate token after use
      },
    });

    // Faille #34: Also activate the legacy NewsletterSubscriber record
    // (created as isActive:false by /api/newsletter pending double opt-in)
    await prisma.newsletterSubscriber.updateMany({
      where: { email: subscriber.email.toLowerCase(), isActive: false },
      data: { isActive: true },
    }).catch((err) => logger.error('Mailing list confirm cross-sync failed', { error: err instanceof Error ? err.message : String(err) }));

    // RGPD Art. 6/7 + CASL: Create definitive ConsentRecord after double opt-in
    await prisma.consentRecord.create({
      data: {
        email: subscriber.email.toLowerCase(),
        type: 'marketing',
        source: `double_optin_${subscriber.consentMethod || 'website_form'}`,
        consentText: 'Consentement confirmé par double opt-in. J\'accepte de recevoir les promotions, codes promo, spéciaux et nouveaux produits de BioCycle Peptides.',
        grantedAt: confirmedAt,
        ipAddress: ip,
      },
    }).catch((err) => logger.error('Mailing list confirm cross-sync failed', { error: err instanceof Error ? err.message : String(err) }));

    // CASL audit: persist to AuditLog (not just console.log)
    await prisma.auditLog.create({
      data: {
        // AMELIORATION: Use crypto.randomUUID instead of Math.random for audit IDs
        id: `consent-confirm-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
        action: 'CONSENT_CONFIRMED',
        entityType: 'MailingListSubscriber',
        entityId: subscriber.id,
        details: JSON.stringify({
          event: 'mailing_list_confirmed',
          email: subscriber.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
          consentDate: subscriber.consentDate?.toISOString(),
          consentIp: subscriber.consentIp,
          confirmIp: ip,
          confirmedAt: confirmedAt.toISOString(),
        }),
        ipAddress: ip,
      },
    }).catch((err) => logger.error('Mailing list confirm cross-sync failed', { error: err instanceof Error ? err.message : String(err) }));

    return NextResponse.redirect(new URL('/?subscription=confirmed', request.url));
  } catch (error) {
    logger.error('Mailing list confirm error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.redirect(new URL('/?subscription=error', request.url));
  }
}
