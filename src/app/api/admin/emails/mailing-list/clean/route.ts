export const dynamic = 'force-dynamic';

/**
 * Admin Mailing List Cleanup API
 * POST - Cross-reference subscribers with EmailSuppression and deactivate matches
 *
 * CSRF Mitigation (#30): Protected by withAdminGuard (session auth) +
 * JSON Content-Type (triggers CORS preflight for cross-origin).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(
  async (request, { session }) => {
    try {
      // Fetch all suppressed emails (hard bounces, complaints, manual suppressions)
      const suppressions = await prisma.emailSuppression.findMany({
        select: { email: true },
      });

      if (suppressions.length === 0) {
        return NextResponse.json({
          deactivated: 0,
          message: 'No suppressed emails found. Mailing list is clean.',
        });
      }

      const suppressedEmails = suppressions.map((s) => s.email.toLowerCase());

      // Find active subscribers whose email is in the suppression list
      const toDeactivate = await prisma.newsletterSubscriber.findMany({
        where: {
          isActive: true,
          email: { in: suppressedEmails },
        },
        select: { id: true, email: true },
      });

      if (toDeactivate.length === 0) {
        return NextResponse.json({
          deactivated: 0,
          message: 'All active subscribers are clean. No matches in suppression list.',
        });
      }

      // Deactivate matching subscribers in a single batch update
      const result = await prisma.newsletterSubscriber.updateMany({
        where: {
          id: { in: toDeactivate.map((s) => s.id) },
        },
        data: {
          isActive: false,
          unsubscribedAt: new Date(),
        },
      });

      logAdminAction({
        adminUserId: session.user.id,
        action: 'CLEAN_MAILING_LIST',
        targetType: 'NewsletterSubscriber',
        targetId: 'batch',
        newValue: {
          deactivatedCount: result.count,
          deactivatedEmails: toDeactivate.map((s) => s.email),
          suppressionCount: suppressedEmails.length,
        },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

      return NextResponse.json({
        deactivated: result.count,
        suppressionListSize: suppressedEmails.length,
        message: `Deactivated ${result.count} subscriber(s) found in the suppression list.`,
      });
    } catch (error) {
      logger.error('[MailingList Clean] Error', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }
);
