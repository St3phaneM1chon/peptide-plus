/**
 * WebAuthn Configuration - BioCycle Peptides
 * Handles passkey/biometric authentication (Face ID, Touch ID, fingerprint)
 */

export const rpName = 'BioCycle Peptides';

// RP ID must match the domain (without protocol or port)
export const rpID = process.env.NODE_ENV === 'production'
  ? (process.env.WEBAUTHN_RP_ID || 'attitudes.vip')
  : 'localhost';

export const origin = process.env.NODE_ENV === 'production'
  ? (process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip')
  : 'http://localhost:3000';
