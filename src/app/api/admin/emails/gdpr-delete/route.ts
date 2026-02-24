export const dynamic = 'force-dynamic';

/**
 * GDPR Email Data Deletion API
 * POST - Delete all email-related data for a given email address
 *
 * Deletes: EmailLog, InboundEmail, EmailBounce, EmailSuppression,
 *          NewsletterSubscriber, ConsentRecord (revoked, not deleted)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const gdprDeleteSchema = z.object({
  email: z.string().email().max(320),
});

export const POST = withAdminGuard(
  async (request: NextRequest, { session }: { session: { user: { id: string } } }) => {
    try {
      // Rate limiting
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip') || '127.0.0.1';
      const rl = await rateLimitMiddleware(ip, '/api/admin/emails/gdpr-delete');
      if (!rl.success) {
        const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
        Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
        return res;
      }
      // CSRF validation
      const csrfValid = await validateCsrf(request);
      if (!csrfValid) {
        return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
      }

      const body = await request.json();
      const parsed = gdprDeleteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
      }
      const { email } = parsed.data;

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
      }).catch((auditErr) => {
        logger.warn('[GDPR] Non-blocking audit log failure on GDPR_EMAIL_DELETE', { email: normalizedEmail, error: auditErr instanceof Error ? auditErr.message : String(auditErr) });
      });

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
