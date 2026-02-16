/**
 * WebAuthn Configuration - BioCycle Peptides
 * Handles passkey/biometric authentication (Face ID, Touch ID, fingerprint)
 */

export const rpName = 'BioCycle Peptides';

// RP ID must match the domain (without protocol or port)
export const rpID = process.env.NODE_ENV === 'production'
  ? 'biocyclepeptides.com'
  : 'localhost';

export const origin = process.env.NODE_ENV === 'production'
  ? 'https://biocyclepeptides.com'
  : 'http://localhost:3000';
