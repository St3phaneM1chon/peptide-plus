/**
 * Unsubscribe URL generation utility
 *
 * Extracted from src/app/api/unsubscribe/route.ts so that email templates
 * and services can import it without pulling in the Next.js route handler.
 *
 * CAN-SPAM Act, RGPD Art. 7(3), LCAP Art. 11 compliance:
 * Every commercial email MUST contain an unsubscribe link.
 */

import * as jose from 'jose';

export type UnsubscribeCategory = 'marketing' | 'transactional' | 'newsletter' | 'all';

const getSecret = () => {
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('UNSUBSCRIBE_SECRET or NEXTAUTH_SECRET must be configured');
  }
  return new TextEncoder().encode(secret);
};

/**
 * Generate a signed JWT token for unsubscribe.
 */
export async function generateUnsubscribeToken(
  email: string,
  category: UnsubscribeCategory = 'marketing',
  userId?: string,
): Promise<string> {
  const token = await new jose.SignJWT({ email, category, userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('90d')
    .setIssuedAt()
    .sign(getSecret());

  return token;
}

/**
 * Generate the full unsubscribe URL to embed in emails.
 */
export async function generateUnsubscribeUrl(
  email: string,
  category: UnsubscribeCategory = 'marketing',
  userId?: string,
): Promise<string> {
  const token = await generateUnsubscribeToken(email, category, userId);
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    'https://biocyclepeptides.com';
  return `${baseUrl}/api/unsubscribe?token=${token}`;
}
