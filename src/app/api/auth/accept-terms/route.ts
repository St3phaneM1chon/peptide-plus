export const dynamic = 'force-dynamic';

/**
 * Accept Terms of Service API
 * POST - Record user's acceptance of Terms of Service and Privacy Policy
 *
 * RGPD/PIPEDA compliance: stores explicit consent with timestamp and version.
 * Used primarily for OAuth signups that bypass the regular signup form.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

const acceptTermsSchema = z.object({
  termsVersion: z.string().min(1, 'termsVersion is required').max(20),
  privacyVersion: z.string().max(20).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/auth/accept-terms');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // SECURITY: CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = acceptTermsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }

    const { termsVersion, privacyVersion } = parsed.data;

    const now = new Date();

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        termsAcceptedAt: now,
        termsVersion: stripControlChars(stripHtml(termsVersion)),
        privacyAcceptedAt: now,
      },
    });

    logger.info('terms_accepted', {
      event: 'terms_accepted',
      timestamp: now.toISOString(),
      userId: session.user.id,
      email: session.user.email,
      termsVersion,
      privacyVersion: privacyVersion || termsVersion,
    });

    return NextResponse.json({
      success: true,
      acceptedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error('Accept terms error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
