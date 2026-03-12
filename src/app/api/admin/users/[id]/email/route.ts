export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

const sendEmailSchema = z.object({
  subject: z.string().min(1, 'subject is required').max(500),
  body: z.string().min(1, 'body is required').max(50000),
});

/**
 * POST /api/admin/users/[id]/email
 * Admin-initiated transactional email to a specific user.
 * Body: { subject: string, body: string }
 */
export const POST = withAdminGuard(async (request: NextRequest, { params }) => {
  try {
    const id = params!.id as string;

    // Parse and validate request body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = sendEmailSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    // SECURITY: Sanitize subject and body to prevent HTML injection in emails
    let subject = stripControlChars(stripHtml(parsed.data.subject.trim()));
    let body = stripControlChars(stripHtml(parsed.data.body.trim()));

    // Look up the user
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });

    if (!user || !user.email) {
      return NextResponse.json({ error: 'User not found or has no email' }, { status: 404 });
    }

    // Send the email (dynamic import mirrors the reset-password route pattern)
    try {
      const { sendEmail } = await import('@/lib/email/email-service');
      await sendEmail({
        to: { email: user.email, name: user.name || undefined },
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${body.replace(/\n/g, '<br />')}
          </div>
        `,
        emailType: 'transactional',
      });
    } catch (emailErr) {
      logger.error('Failed to send admin email to user', {
        userId: id,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    logger.info('Admin sent email to user', { userId: id, email: user.email, subject });
    return NextResponse.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    logger.error('Admin email route error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'users.edit' });
