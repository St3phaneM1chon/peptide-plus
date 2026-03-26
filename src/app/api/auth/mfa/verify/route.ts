export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateToken, verifyToken, formatUser } from '@/lib/auth-jwt';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const mfaSchema = z.object({
  code: z.string().length(6),
  mfaToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    // AUTH-F4 FIX: Rate limit MFA verification (5 attempts per 15 min)
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/auth/mfa/verify');
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many attempts' }, { status: 429, headers: rl.headers });
    }
    const body = await request.json();
    const parsed = mfaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const { code, mfaToken } = parsed.data;

    // Decode mfaToken to get userId
    const payload = await verifyToken(mfaToken);
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Invalid MFA token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        mfaSecret: true,
        image: true,
        phone: true,
        locale: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // AUTH-F1 CRITICAL FIX: Verify TOTP code against user's mfaSecret
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid MFA code' }, { status: 401 });
    }

    const { verifyMFACode } = await import('@/lib/mfa');
    const mfaResult = await verifyMFACode(user.id, code);
    if (!mfaResult.valid) {
      return NextResponse.json({ error: 'Invalid MFA code' }, { status: 401 });
    }

    const token = await generateToken(user.id, user.email, user.role);

    // AUTH-F7 FIX: Generate server-signed proof for session update
    const crypto = await import('crypto');
    const mfaProof = crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET || '')
      .update(`mfa-verified:${user.id}`)
      .digest('hex');

    return NextResponse.json({
      token,
      mfaProof, // Client passes this in session update({ mfaVerified: true, mfaProof })
      user: formatUser(user),
    });
  } catch (error) {
    logger.error('[MFA] Verify failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'MFA verification failed' },
      { status: 500 }
    );
  }
}
