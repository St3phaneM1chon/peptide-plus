export const dynamic = 'force-dynamic';

/**
 * API MFA VERIFY - Verify TOTP code and enable MFA
 * Completes MFA setup after user scans QR code
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { verifyTOTP } from '@/lib/mfa';
import { decrypt } from '@/lib/security';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';

export async function POST(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json(
        { error: 'Code à 6 chiffres requis' },
        { status: 400 }
      );
    }

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
      } catch {
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
    console.error('MFA verify error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification MFA' },
      { status: 500 }
    );
  }
}
