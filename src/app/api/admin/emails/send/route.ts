export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sendEmail } from '@/lib/email/email-service';
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe';
import { escapeHtml } from '@/lib/email/templates/base-template';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';

// POST /api/admin/emails/send - Send email (direct compose or template-based test)
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const { to, subject, htmlBody, textBody, templateId, variables } = body;

    if (!to) {
      return NextResponse.json({ error: 'Recipient email (to) is required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

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
    console.error('Admin email send POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
