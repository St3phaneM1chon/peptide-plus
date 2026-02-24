export const dynamic = 'force-dynamic';

/**
 * API MFA VERIFY - Verify TOTP code and enable MFA
 * Completes MFA setup after user scans QR code
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { verifyTOTP } from '@/lib/mfa';
import { decrypt } from '@/lib/security';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const mfaVerifySchema = z.object({
  code: z.string().length(6, 'Code à 6 chiffres requis'),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY (SEC-005): Rate limit MFA verify - 5 attempts per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/account/mfa/verify');
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error?.message || 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = mfaVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { code } = parsed.data;

    // Get the pending MFA secret
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        mfaEnabled: true,
        mfaSecret: true,
        mfaBackupCodes: true,
      },
    });

    if (!user?.mfaSecret) {
      return NextResponse.json(
        { error: 'Veuillez d\'abord initialiser la configuration MFA' },
        { status: 400 }
      );
    }

    if (user.mfaEnabled) {
      return NextResponse.json({ error: 'MFA déjà activé' }, { status: 400 });
    }

    // Decrypt and verify the code
    const secret = await decrypt(user.mfaSecret);
    const isValid = verifyTOTP(secret, code);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Code invalide. Vérifiez votre application d\'authentification.' },
        { status: 400 }
      );
    }

    // Enable MFA
    await prisma.user.update({
      where: { id: session.user.id },
      data: { mfaEnabled: true },
    });

    // Decrypt backup codes to return them to user (one-time display)
    let backupCodes: string[] = [];
    if (user.mfaBackupCodes) {
      try {
        backupCodes = JSON.parse(await decrypt(user.mfaBackupCodes));
      } catch (error) {
        console.error('[MfaVerify] Failed to decrypt backup codes:', error);
        // Backup codes may already be hashed
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'MFA_ENABLED',
        entityType: 'User',
        entityId: session.user.id,
        details: JSON.stringify({ timestamp: new Date().toISOString() }),
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'MFA activé avec succès',
      backupCodes,
    });
  } catch (error) {
    logger.error('MFA verify error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la vérification MFA' },
      { status: 500 }
    );
  }
}
