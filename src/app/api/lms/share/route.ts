export const dynamic = 'force-dynamic';

/**
 * Social Sharing API — Generate share URLs for certificates and badges
 * GET /api/lms/share?type=certificate&id=xxx — LinkedIn share URL
 * GET /api/lms/share?type=badge&id=xxx — Badge assertion JSON-LD
 */
import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { generateLinkedInShareUrl, generateBadgeAssertion } from '@/lib/lms/open-badges';

export const GET = withUserGuard(async (request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // certificate, badge
  const id = searchParams.get('id');

  if (!type || !id) {
    return NextResponse.json({ error: 'type and id required' }, { status: 400 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://attitudes.vip';

  if (type === 'certificate') {
    const cert = await prisma.certificate.findFirst({
      where: { id, tenantId, userId: session.user.id },
      select: { courseTitle: true, studentName: true, verificationCode: true, issuedAt: true },
    });

    if (!cert) return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });

    const shareUrl = generateLinkedInShareUrl({
      title: cert.courseTitle,
      description: `Certificat de completion — ${cert.courseTitle}`,
      certUrl: `${siteUrl}/learn/certificates/verify/${cert.verificationCode}`,
      issueDate: cert.issuedAt,
    });

    return NextResponse.json({ data: { shareUrl, platform: 'linkedin' } });
  }

  if (type === 'badge') {
    const award = await prisma.lmsBadgeAward.findFirst({
      where: { id, tenantId, userId: session.user.id },
      include: { badge: { select: { id: true, name: true, description: true, iconUrl: true } } },
    });

    if (!award) return NextResponse.json({ error: 'Badge award not found' }, { status: 404 });

    const assertion = generateBadgeAssertion({
      awardId: award.id,
      badge: {
        id: award.badge.id,
        name: award.badge.name,
        description: award.badge.description ?? '',
        iconUrl: award.badge.iconUrl ?? undefined,
      },
      recipientEmail: session.user.email ?? '',
      issuedOn: award.awardedAt,
    });

    // Also generate LinkedIn share URL
    const shareUrl = generateLinkedInShareUrl({
      title: `Badge: ${award.badge.name}`,
      description: award.badge.description ?? '',
      certUrl: `${siteUrl}/api/lms/badges/assertions/${award.id}.json`,
      issueDate: award.awardedAt,
    });

    return NextResponse.json({ data: { assertion, shareUrl, platform: 'linkedin' } });
  }

  return NextResponse.json({ error: 'Invalid type. Use certificate or badge.' }, { status: 400 });
}, { skipCsrf: true });
