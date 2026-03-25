/**
 * Open Badges 3.0 — Portable, verifiable digital credentials
 * Generates JSON-LD badges following the 1EdTech Open Badges 3.0 specification.
 * Badges can be shared on LinkedIn, imported into digital wallets, and verified by employers.
 */

import { createHash } from 'crypto';

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://attitudes.vip';
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Aptitudes by Attitudes VIP';

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

export interface OpenBadge {
  '@context': string[];
  type: string[];
  id: string;
  name: string;
  description: string;
  image: { id: string; type: string };
  criteria: { narrative: string };
  issuer: {
    type: string[];
    id: string;
    name: string;
    url: string;
  };
}

export interface OpenBadgeAssertion {
  '@context': string[];
  type: string[];
  id: string;
  recipient: { type: string; identity: string; hashed: boolean };
  badge: OpenBadge;
  issuedOn: string;
  expires?: string;
  evidence?: Array<{ id: string; name: string; description: string }>;
  verification: { type: string };
}

/**
 * Generate an Open Badge 3.0 JSON-LD for a badge definition.
 */
export function generateBadgeClass(badge: {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  criteria?: string;
}): OpenBadge {
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    id: `${SITE_URL}/api/lms/badges/${badge.id}/badge.json`,
    name: badge.name,
    description: badge.description,
    image: {
      id: badge.iconUrl || `${SITE_URL}/icons/badge-default.png`,
      type: 'Image',
    },
    criteria: {
      narrative: badge.criteria || badge.description,
    },
    issuer: {
      type: ['Profile'],
      id: `${SITE_URL}/api/lms/badges/issuer.json`,
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

/**
 * Generate an Open Badge 3.0 Assertion (credential) for a specific award.
 */
export function generateBadgeAssertion(params: {
  awardId: string;
  badge: { id: string; name: string; description: string; iconUrl?: string; criteria?: string };
  recipientEmail: string;
  issuedOn: Date;
  expiresOn?: Date;
  evidence?: Array<{ id: string; name: string; description: string }>;
}): OpenBadgeAssertion {
  return {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json',
    ],
    type: ['VerifiableCredential', 'OpenBadgeCredential'],
    id: `${SITE_URL}/api/lms/badges/assertions/${params.awardId}.json`,
    recipient: {
      type: 'email',
      identity: `sha256$${hashEmail(params.recipientEmail)}`,
      hashed: true,
    },
    badge: generateBadgeClass(params.badge),
    issuedOn: params.issuedOn.toISOString(),
    ...(params.expiresOn ? { expires: params.expiresOn.toISOString() } : {}),
    ...(params.evidence ? { evidence: params.evidence } : {}),
    verification: {
      type: 'HostedBadge',
    },
  };
}

/**
 * Generate LinkedIn share URL for a badge or certificate.
 */
export function generateLinkedInShareUrl(params: {
  title: string;
  description: string;
  certUrl: string;
  issuerName?: string;
  issueDate?: Date;
}): string {
  const searchParams = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: params.title,
    organizationName: params.issuerName || SITE_NAME,
    certUrl: params.certUrl,
    ...(params.issueDate ? {
      issueYear: params.issueDate.getFullYear().toString(),
      issueMonth: (params.issueDate.getMonth() + 1).toString(),
    } : {}),
  });

  return `https://www.linkedin.com/profile/add?${searchParams.toString()}`;
}
