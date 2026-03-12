export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import crypto from 'crypto';

/**
 * POST /api/admin/users/[id]/reset-password
 * Admin-initiated password reset: generates a reset token and sends an email.
 */
export const POST = withAdminGuard(async (_request: NextRequest, { params, session }) => {
  try {
    const id = params!.id;

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true },
    });

    // SECURITY: Prevent EMPLOYEE from resetting OWNER passwords (privilege escalation)
    if (user && user.role === 'OWNER' && session.user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only an OWNER can reset another OWNER\'s password' },
        { status: 403 }
      );
    }

    if (!user || !user.email) {
      return NextResponse.json({ error: 'User not found or has no email' }, { status: 404 });
    }

    // Generate secure reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    // Store token (use VerificationToken model)
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires: expiresAt,
      },
    });

    // Send reset email
    const baseUrl = process.env.NEXTAUTH_URL || 'https://biocyclepeptides.com';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`;

    try {
      const { sendEmail } = await import('@/lib/email/email-service');
      await sendEmail({
        to: { email: user.email, name: user.name || undefined },
        subject: 'Password Reset - BioCycle Peptides',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset</h2>
            <p>An administrator has requested a password reset for your account.</p>
            <a href="${resetUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #666; font-size: 14px;">This link expires in 24 hours. If you did not expect this, please ignore this email.</p>
          </div>
        `,
        emailType: 'transactional',
      });
    } catch (emailErr) {
      logger.error('Failed to send reset email', {
        userId: id,
        error: emailErr instanceof Error ? emailErr.message : String(emailErr),
      });
      return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 });
    }

    logger.info('Admin-initiated password reset', { userId: id, email: user.email });
    return NextResponse.json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    logger.error('Password reset error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}, { requiredPermission: 'users.edit' });
