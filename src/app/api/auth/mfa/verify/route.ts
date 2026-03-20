export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { generateToken, verifyToken, formatUser } from '@/lib/auth-jwt';
import { logger } from '@/lib/logger';

const mfaSchema = z.object({
  code: z.string().length(6),
  mfaToken: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
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

    // TODO: Verify TOTP code against user's mfaSecret when fully implemented
    // For now, accept any 6-digit code (MFA not yet fully implemented)
    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid MFA code' }, { status: 401 });
    }

    const token = await generateToken(user.id, user.email, user.role);

    return NextResponse.json({
      token,
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
