export const dynamic = 'force-dynamic';

/**
 * API MFA CHALLENGE - Verify TOTP code for post-OAuth MFA verification
 * Used when OAuth users with MFA enabled need to verify their identity
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { verifyMFACode } from '@/lib/mfa';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const mfaChallengeSchema = z.object({
  code: z.string().min(6).max(8, 'Code must be 6-8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per minute per IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/mfa/challenge');
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = mfaChallengeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid code format' },
        { status: 400 }
      );
    }

    const { code } = parsed.data;
    const result = await verifyMFACode(session.user.id, code);

    if (!result.valid) {
      return NextResponse.json(
        { error: 'Invalid code' },
        { status: 400 }
      );
    }

    // Audit log
    const { prisma } = await import('@/lib/db');
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'MFA_CHALLENGE_VERIFIED',
        entityType: 'User',
        entityId: session.user.id,
        details: JSON.stringify({
          type: result.type,
          timestamp: new Date().toISOString(),
          provider: 'oauth',
        }),
      },
    }).catch((err) =>
      logger.error('MFA challenge audit log failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    );

    return NextResponse.json({ success: true, type: result.type });
  } catch (error) {
    logger.error('MFA challenge error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
