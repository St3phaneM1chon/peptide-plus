export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { checkPasswordHistory, addToPasswordHistory } from '@/lib/password-history';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { passwordSchema } from '@/lib/security';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';

const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(256),
  newPassword: z.string().min(1, 'New password is required').max(256),
});

export async function PUT(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SEC-27: Rate limit password changes - 5 per user per hour
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/password', session.user.id);
    if (!rl.success) {
      const res = NextResponse.json(
        { error: rl.error!.message },
        { status: 429 }
      );
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const bodyParsed = changePasswordBodySchema.safeParse(body);
    if (!bodyParsed.success) {
      return NextResponse.json(
        { error: bodyParsed.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    const { currentPassword, newPassword } = bodyParsed.data;

    // SECURITY: Validate new password meets complexity requirements
    // (min 8 chars, uppercase, lowercase, digit, special character)
    const passwordValidation = passwordSchema.safeParse(newPassword);
    if (!passwordValidation.success) {
      return NextResponse.json(
        { error: passwordValidation.error.errors[0]?.message || 'Password does not meet requirements' },
        { status: 400 }
      );
    }

    // Get user with password
    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has a password (not OAuth only)
    if (!user.password) {
      return NextResponse.json(
        { error: 'This account uses social login. Password cannot be changed here.' },
        { status: 400 }
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // SECURITY: Check password history (prevent reuse of last 12 passwords)
    const wasUsedBefore = await checkPasswordHistory(user.id, newPassword);
    if (wasUsedBefore) {
      return NextResponse.json(
        { error: 'Ce mot de passe a déjà été utilisé. Veuillez en choisir un nouveau.' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await db.user.update({
      where: { email: session.user.email },
      data: { password: hashedPassword },
    });

    // Store in password history
    await addToPasswordHistory(user.id, hashedPassword);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error updating password', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to update password' },
      { status: 500 }
    );
  }
}
