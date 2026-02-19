export const dynamic = 'force-dynamic';

/**
 * Admin Email Send API
 * POST - Send a test email
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

// POST /api/admin/emails/send - Send a test email
export const POST = withAdminGuard(async (request, { session: _session }) => {
  try {
    const body = await request.json();
    const { templateId, to, subject: customSubject, variables } = body;

    if (!to) {
      return NextResponse.json(
        { error: 'Recipient email (to) is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    let subject = customSubject || 'Test Email';
    let htmlContent = '<p>This is a test email.</p>';

    // If a template is specified, load it
    if (templateId) {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }

      subject = template.subject;
      htmlContent = template.htmlContent;

      // Replace template variables if provided
      if (variables && typeof variables === 'object') {
        for (const [key, value] of Object.entries(variables)) {
          const placeholder = `{{${key}}}`;
          subject = subject.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
          htmlContent = htmlContent.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value));
        }
      }
    }

    // Log the send attempt
    // In production, this would integrate with Resend/SendGrid/SMTP
    // For now, we just log it
    let logStatus = 'sent';
    let logError: string | null = null;

    try {
      // TODO: Integrate with actual email provider (Resend, SendGrid, etc.)
      // For now, simulate the send
      console.log(`[EMAIL] Sending test email to ${to}: "${subject}"`);
    } catch (sendError) {
      logStatus = 'failed';
      logError = sendError instanceof Error ? sendError.message : 'Unknown error';
    }

    // Create email log entry
    const emailLog = await prisma.emailLog.create({
      data: {
        templateId: templateId || null,
        to,
        subject,
        status: logStatus,
        error: logError,
      },
    });

    return NextResponse.json({
      success: logStatus === 'sent',
      emailLog,
      message: logStatus === 'sent'
        ? `Test email sent to ${to}`
        : `Failed to send email: ${logError}`,
    });
  } catch (error) {
    console.error('Admin email send POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
