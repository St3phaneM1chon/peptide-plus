export const dynamic = 'force-dynamic';

/**
 * GDPR Email Data Deletion API
 * POST - Delete all email-related data for a given email address
 *
 * Deletes: EmailLog, InboundEmail, EmailBounce, EmailSuppression,
 *          NewsletterSubscriber, ConsentRecord (revoked, not deleted)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// Simple email format validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = withAdminGuard(
  async (request: NextRequest, { session }: { session: { user: { id: string } } }) => {
    try {
      const body = await request.json();
      const { email } = body;

      if (!email || typeof email !== 'string' || !EMAIL_RE.test(email)) {
        return NextResponse.json(
          { error: 'A valid email address is required' },
          { status: 400 }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Execute all deletions in a single transaction
      const results = await prisma.$transaction(async (tx) => {
        // 1. Delete EmailLog entries
        const emailLogs = await tx.emailLog.deleteMany({
          where: { to: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        // 2. Delete InboundEmail entries (from = email)
        const inboundEmails = await tx.inboundEmail.deleteMany({
          where: { from: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        // 3. Delete EmailBounce entries
        const emailBounces = await tx.emailBounce.deleteMany({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        // 4. Delete EmailSuppression entries
        const emailSuppressions = await tx.emailSuppression.deleteMany({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        // 5. Delete NewsletterSubscriber entries
        const newsletterSubscribers = await tx.newsletterSubscriber.deleteMany({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        // 6. Revoke all ConsentRecord entries (set revokedAt instead of hard delete for audit trail)
        const consentRecords = await tx.consentRecord.updateMany({
          where: {
            email: { equals: normalizedEmail, mode: 'insensitive' },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });

        return {
          emailLogs: emailLogs.count,
          inboundEmails: inboundEmails.count,
          emailBounces: emailBounces.count,
          emailSuppressions: emailSuppressions.count,
          newsletterSubscribers: newsletterSubscribers.count,
          consentRecordsRevoked: consentRecords.count,
        };
      });

      const totalDeleted =
        results.emailLogs +
        results.inboundEmails +
        results.emailBounces +
        results.emailSuppressions +
        results.newsletterSubscribers +
        results.consentRecordsRevoked;

      // Audit log
      logAdminAction({
        adminUserId: session.user.id,
        action: 'GDPR_EMAIL_DELETE',
        targetType: 'Email',
        targetId: normalizedEmail,
        newValue: results,
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      logger.info(`[GDPR] Email data deleted for ${normalizedEmail} by admin ${session.user.id}: ${JSON.stringify(results)}`);

      return NextResponse.json({
        success: true,
        email: normalizedEmail,
        deletedCounts: results,
        totalAffected: totalDeleted,
      });
    } catch (error) {
      logger.error('[GDPR Delete] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);
