export const dynamic = 'force-dynamic';

/**
 * API MFA SETUP - Initialize MFA configuration
 * Returns QR code and manual entry key
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { initializeMFASetup } from '@/lib/mfa';
import { encrypt } from '@/lib/security';
import { prisma } from '@/lib/db';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Check if MFA is already enabled
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { mfaEnabled: true, email: true },
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

    return NextResponse.json({
      qrCodeUrl: setupData.qrCode,
      manualEntryKey: setupData.secret,
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la configuration MFA' },
      { status: 500 }
    );
  }
}
