/**
 * CASL (Canada's Anti-Spam Legislation) Compliance Engine
 * Double opt-in, consent per purpose, 10-day unsubscribe processing
 */

export interface ConsentConfig {
  requireDoubleOptIn: boolean;
  impliedConsentDurationDays: number; // 2 years max per CASL
  unsubscribeProcessingDays: number; // Max 10 days per CASL
  consentPurposes: string[];
}

export const CASL_DEFAULTS: ConsentConfig = {
  requireDoubleOptIn: true,
  impliedConsentDurationDays: 730, // 2 years
  unsubscribeProcessingDays: 10,
  consentPurposes: ['marketing', 'promotions', 'newsletter', 'product_updates', 'research'],
};

export interface ConsentCheck {
  hasConsent: boolean;
  consentType: 'EXPRESS' | 'IMPLIED' | 'NONE';
  expiresAt?: Date;
  purposes: string[];
  canSendMarketing: boolean;
}

export function checkConsent(
  consentType: 'EXPRESS' | 'IMPLIED' | 'NONE',
  consentDate: Date | null,
  purposes: string[],
  requestedPurpose: string,
  config: ConsentConfig = CASL_DEFAULTS
): ConsentCheck {
  if (consentType === 'NONE' || !consentDate) {
    return { hasConsent: false, consentType: 'NONE', purposes: [], canSendMarketing: false };
  }

  const now = new Date();
  const hasPurpose = purposes.includes(requestedPurpose);

  if (consentType === 'IMPLIED') {
    const expiresAt = new Date(consentDate.getTime() + config.impliedConsentDurationDays * 24 * 60 * 60 * 1000);
    const isExpired = now > expiresAt;
    return {
      hasConsent: !isExpired && hasPurpose,
      consentType: 'IMPLIED',
      expiresAt,
      purposes,
      canSendMarketing: !isExpired && hasPurpose,
    };
  }

  // Express consent doesn't expire but must match purpose
  return {
    hasConsent: hasPurpose,
    consentType: 'EXPRESS',
    purposes,
    canSendMarketing: hasPurpose,
  };
}

export function generateUnsubscribeToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateDoubleOptInToken(): string {
  return generateUnsubscribeToken();
}

export function isWithinUnsubscribeWindow(requestDate: Date, config: ConsentConfig = CASL_DEFAULTS): boolean {
  const now = new Date();
  const daysSinceRequest = (now.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceRequest <= config.unsubscribeProcessingDays;
}

export function getRequiredEmailFooter(unsubscribeUrl: string, companyInfo: { name: string; address: string }): string {
  return `
---
${companyInfo.name}
${companyInfo.address}

Vous recevez cet email parce que vous avez consenti à recevoir nos communications.
Pour vous désabonner: ${unsubscribeUrl}
Conformément à la LCAP (CASL), votre désinscription sera traitée dans les 10 jours ouvrables.
  `.trim();
}
