/**
 * MFA - Multi-Factor Authentication
 * TOTP (Time-based One-Time Password) + Backup Codes
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { randomBytes } from 'crypto';
import { encrypt, decrypt } from './security';

// Configuration TOTP
authenticator.options = {
  window: 1, // Accepte le code précédent et suivant
  step: 30, // Nouvelle code toutes les 30 secondes
};

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'SecureApp';

// =====================================================
// TOTP (Google Authenticator, etc.)
// =====================================================

/**
 * Génère un nouveau secret TOTP
 */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret();
}

/**
 * Génère l'URL pour le QR Code
 */
export function generateTOTPUri(secret: string, email: string): string {
  return authenticator.keyuri(email, APP_NAME, secret);
}

/**
 * Génère le QR Code en base64
 */
export async function generateQRCode(secret: string, email: string): Promise<string> {
  const uri = generateTOTPUri(secret, email);
  return QRCode.toDataURL(uri);
}

/**
 * Vérifie un code TOTP
 */
export function verifyTOTP(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * Génère le code TOTP actuel (pour tests uniquement!)
 */
export function generateCurrentTOTP(secret: string): string {
  return authenticator.generate(secret);
}

// =====================================================
// BACKUP CODES
// =====================================================

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 8;

/**
 * Génère des codes de backup
 */
export function generateBackupCodes(): string[] {
  const codes: string[] = [];
  
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const code = randomBytes(BACKUP_CODE_LENGTH / 2)
      .toString('hex')
      .toUpperCase();
    codes.push(code);
  }
  
  return codes;
}

/**
 * Hash un code de backup pour le stockage
 */
export async function hashBackupCode(code: string): Promise<string> {
  const { hash } = await import('bcryptjs');
  return hash(code.toUpperCase(), 10);
}

/**
 * Vérifie un code de backup
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; usedIndex: number }> {
  const { compare } = await import('bcryptjs');
  
  for (let i = 0; i < hashedCodes.length; i++) {
    const isValid = await compare(code.toUpperCase(), hashedCodes[i]);
    if (isValid) {
      return { valid: true, usedIndex: i };
    }
  }
  
  return { valid: false, usedIndex: -1 };
}

// =====================================================
// MFA SETUP FLOW
// =====================================================

export interface MFASetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Initialise la configuration MFA pour un utilisateur
 */
export async function initializeMFASetup(email: string): Promise<MFASetupData> {
  const secret = generateTOTPSecret();
  const qrCode = await generateQRCode(secret, email);
  const backupCodes = generateBackupCodes();
  
  return {
    secret,
    qrCode,
    backupCodes,
  };
}

/**
 * Finalise la configuration MFA après vérification
 */
export async function finalizeMFASetup(
  userId: string,
  secret: string,
  verificationCode: string,
  backupCodes: string[]
): Promise<boolean> {
  // Vérifier que le code est valide
  if (!verifyTOTP(secret, verificationCode)) {
    return false;
  }
  
  // Hasher les backup codes
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => hashBackupCode(code))
  );
  
  // Chiffrer le secret et les backup codes pour stockage
  const encryptedSecret = await encrypt(secret);
  const encryptedBackupCodes = await encrypt(JSON.stringify(hashedBackupCodes));
  
  // Importer prisma dynamiquement pour éviter les problèmes de build
  const { prisma } = await import('./db');
  
  // Mettre à jour l'utilisateur
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: true,
      mfaSecret: encryptedSecret,
      mfaBackupCodes: encryptedBackupCodes,
    },
  });
  
  return true;
}

/**
 * Vérifie un code MFA (TOTP ou Backup)
 */
export async function verifyMFACode(
  userId: string,
  code: string
): Promise<{ valid: boolean; type: 'totp' | 'backup' | null }> {
  const { prisma } = await import('./db');
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mfaSecret: true,
      mfaBackupCodes: true,
    },
  });
  
  if (!user?.mfaSecret) {
    return { valid: false, type: null };
  }
  
  // Déchiffrer le secret
  const secret = await decrypt(user.mfaSecret);
  
  // Essayer TOTP d'abord
  if (verifyTOTP(secret, code)) {
    return { valid: true, type: 'totp' };
  }
  
  // Essayer les backup codes
  if (user.mfaBackupCodes) {
    const hashedCodes = JSON.parse(await decrypt(user.mfaBackupCodes));
    const { valid, usedIndex } = await verifyBackupCode(code, hashedCodes);
    
    if (valid) {
      // Supprimer le code utilisé
      hashedCodes.splice(usedIndex, 1);
      const encryptedBackupCodes = await encrypt(JSON.stringify(hashedCodes));
      
      await prisma.user.update({
        where: { id: userId },
        data: { mfaBackupCodes: encryptedBackupCodes },
      });
      
      return { valid: true, type: 'backup' };
    }
  }
  
  return { valid: false, type: null };
}

/**
 * Désactive le MFA pour un utilisateur
 */
export async function disableMFA(userId: string): Promise<void> {
  const { prisma } = await import('./db');
  
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: null,
    },
  });
}

/**
 * Régénère les backup codes
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const { prisma } = await import('./db');
  
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = await Promise.all(
    backupCodes.map(code => hashBackupCode(code))
  );
  const encryptedBackupCodes = await encrypt(JSON.stringify(hashedBackupCodes));
  
  await prisma.user.update({
    where: { id: userId },
    data: { mfaBackupCodes: encryptedBackupCodes },
  });
  
  return backupCodes;
}
