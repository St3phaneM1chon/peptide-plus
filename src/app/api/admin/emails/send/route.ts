export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { escapeHtml } from '@/lib/email/templates/base-template';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const sendEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().max(500).optional(),
  htmlBody: z.string().optional(),
  textBody: z.string().optional(),
  templateId: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
});

// POST /api/admin/emails/send - Send email (direct compose or template-based test)
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/send');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = sendEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { to, subject, htmlBody, textBody, templateId, variables } = parsed.data;

    let emailSubject = subject || 'Test Email';
    let html = htmlBody || textBody?.replace(/\n/g, '<br/>') || '<p>This is a test email.</p>';
    let text = textBody || '';

    // If a template is specified, load and fill it
    if (templateId) {
      const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      emailSubject = template.subject;
      html = template.htmlContent;
      if (variables && typeof variables === 'object') {
        for (const [key, value] of Object.entries(variables)) {
          const placeholder = `{{${key}}}`;
          const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
          const strVal = String(value);
          // HTML-escape for HTML context, raw for subject (plain text)
          emailSubject = emailSubject.replace(regex, strVal);
          html = html.replace(regex, escapeHtml(strVal));
        }
      }
    }

    // Generate unsubscribe URL for compliance (CAN-SPAM / RGPD / LCAP)
    const unsubscribeUrl = await generateUnsubscribeUrl(to, 'marketing').catch(() => undefined);

    // Send via configured provider
    const result = await sendEmail({
      to: { email: to },
      subject: emailSubject,
      html,
      text,
      tags: [templateId ? 'admin-template-test' : 'admin-direct'],
      unsubscribeUrl,
    });

    // Log the email with messageId for webhook correlation
    const emailLog = await prisma.emailLog.create({
      data: {
        templateId: templateId || null,
        to,
        subject: emailSubject,
        status: result.success ? 'sent' : 'failed',
        error: result.error || null,
        messageId: result.messageId || null,
      },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'SEND_EMAIL',
      targetType: 'EmailLog',
      targetId: emailLog.id,
      newValue: { to, subject: emailSubject, success: result.success, templateId: templateId || null },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({
      success: result.success,
      emailLog,
      messageId: result.messageId,
      message: result.success ? `Email sent to ${to}` : `Failed: ${result.error}`,
    });
  } catch (error) {
    logger.error('Admin email send POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
