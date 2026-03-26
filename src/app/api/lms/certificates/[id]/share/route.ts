export const dynamic = 'force-dynamic';

/**
 * Certificate Share API
 * GET /api/lms/certificates/[id]/share — Generate LinkedIn share URL + Open Badge assertion
 */
import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { generateLinkedInShareUrl, generateBadgeAssertion } from '@/lib/lms/open-badges';

export const GET = withUserGuard(async (_request: NextRequest, { session, params }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 });

  const resolvedParams = await params;
  const id = resolvedParams?.id;
  const userId = session.user.id!;

  const certificate = await prisma.certificate.findFirst({
    where: { id, tenantId, userId },
    select: {
      id: true,
      courseTitle: true,
      studentName: true,
      issuedAt: true,
      expiresAt: true,
      verificationCode: true,
      status: true,
    },
  });

  if (!certificate) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 });
  }

  if (certificate.status === 'REVOKED') {
    return NextResponse.json({ error: 'Cannot share a revoked certificate' }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://attitudes.vip';
  const verifyUrl = `${baseUrl}/verify/${certificate.verificationCode}`;

  // Generate LinkedIn share URL
  const linkedInUrl = generateLinkedInShareUrl({
    title: certificate.courseTitle,
    description: `Certification: ${certificate.courseTitle}`,
    certUrl: verifyUrl,
    issueDate: certificate.issuedAt,
  });

  // Generate Open Badge 3.0 assertion
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  let badgeAssertion = null;
  if (user?.email) {
    badgeAssertion = generateBadgeAssertion({
      awardId: certificate.id,
      badge: {
        id: certificate.id,
        name: certificate.courseTitle,
        description: `Certification for completing ${certificate.courseTitle}`,
      },
      recipientEmail: user.email,
      issuedOn: certificate.issuedAt,
      expiresOn: certificate.expiresAt ?? undefined,
    });
  }

  return NextResponse.json({
    data: {
      linkedInUrl,
      verifyUrl,
      badgeAssertion,
      qrCodeData: verifyUrl, // Client can generate QR from this URL
    },
  });
}, { skipCsrf: true });
