export const dynamic = 'force-dynamic';

/**
 * API MFA SETUP - Initialize MFA configuration
 * Returns QR code and manual entry key
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUserGuard } from '@/lib/user-api-guard';
import { initializeMFASetup } from '@/lib/mfa';
import { encrypt } from '@/lib/security';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const POST = withUserGuard(async (_request: NextRequest, { session }) => {
  try {

    // Check if MFA is already enabled (select only MFA-related fields)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, mfaEnabled: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    if (user.mfaEnabled) {
      return NextResponse.json({ error: 'MFA déjà activé' }, { status: 400 });
    }

    // Initialize MFA setup
    const setupData = await initializeMFASetup(user.email);

    // Store pending secret temporarily (encrypted) for verification step
    const encryptedSecret = await encrypt(setupData.secret);
    const encryptedBackupCodes = await encrypt(JSON.stringify(setupData.backupCodes));

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        mfaSecret: encryptedSecret,
        mfaBackupCodes: encryptedBackupCodes,
        // mfaEnabled stays false until verification
      },
    });

    // SEC-32: Prevent caching of MFA secret data
    const response = NextResponse.json({
      qrCodeUrl: setupData.qrCode,
      manualEntryKey: setupData.secret,
    });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');
    return response;
  } catch (error) {
    logger.error('MFA setup error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la configuration MFA' },
      { status: 500 }
    );
  }
});
