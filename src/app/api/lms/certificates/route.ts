export const dynamic = 'force-dynamic';

/**
 * Student Certificates API
 * GET /api/lms/certificates — Returns the current user's certificates
 *
 * SEC-HARDENING: Wrapped with withUserGuard for centralized auth + rate limiting.
 * Tenant-scoped: only returns certificates belonging to the user's tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const GET = withUserGuard(async (_request: NextRequest, { session }) => {
  const tenantId = session.user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ certificates: [] });
  }

  const userId = session.user.id;
  if (!userId) {
    return NextResponse.json({ error: 'User ID missing' }, { status: 401 });
  }

  try {
    const certificates = await prisma.certificate.findMany({
      where: {
        tenantId,
        userId,
      },
      select: {
        id: true,
        courseTitle: true,
        studentName: true,
        issuedAt: true,
        expiresAt: true,
        verificationCode: true,
        status: true,
        pdfUrl: true,
        qrCodeUrl: true,
      },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });

    // Enrich with course thumbnail by looking up the enrollment -> course
    const enrichedCertificates = await Promise.all(
      certificates.map(async (cert) => {
        // Try to find the enrollment linked to this certificate to get the course thumbnail
        let courseThumbnailUrl: string | null = null;
        try {
          const enrollment = await prisma.enrollment.findFirst({
            where: { certificateId: cert.id, tenantId },
            select: {
              course: {
                select: { thumbnailUrl: true },
              },
            },
          });
          courseThumbnailUrl = enrollment?.course?.thumbnailUrl ?? null;
        } catch {
          // Non-critical: thumbnail is optional
        }

        return {
          id: cert.id,
          courseTitle: cert.courseTitle,
          studentName: cert.studentName,
          issuedAt: cert.issuedAt,
          expiresAt: cert.expiresAt,
          verificationCode: cert.verificationCode,
          status: cert.status,
          pdfUrl: cert.pdfUrl,
          qrCodeUrl: cert.qrCodeUrl,
          courseThumbnailUrl,
        };
      })
    );

    return NextResponse.json({ certificates: enrichedCertificates });
  } catch (error) {
    logger.error('Failed to fetch user certificates', {
      userId,
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load certificates' }, { status: 500 });
  }
}, { skipCsrf: true, rateLimit: 30 });
