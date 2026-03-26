export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { generateToken, formatUser, isValidEmail, getClientIp } from '@/lib/auth-jwt';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  checkLoginAttempt,
  recordFailedAttempt,
  clearFailedAttempts,
} from '@/lib/brute-force-protection';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // C-02 FIX: Rate limiting (5 req/min per IP for auth/login)
    const rateLimit = await checkRateLimit(ip, '/api/auth/login');
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Trop de tentatives. Veuillez réessayer plus tard.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(
              Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
            ),
          },
        }
      );
    }

    let body: { email?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: 'Corps JSON invalide' },
        { status: 400 }
      );
    }
    const { email, password } = body;

    // C-03 FIX: Input validation
    if (!email || !password) {
      return NextResponse.json(
        { message: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: 'Format email invalide' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // C-02 FIX: Brute-force protection (3 attempts then 30min lockout)
    const lockCheck = await checkLoginAttempt(normalizedEmail, ip, userAgent);
    if (!lockCheck.allowed) {
      return NextResponse.json(
        { message: lockCheck.message || 'Compte temporairement verrouillé' },
        { status: 429 }
      );
    }

    // C3-SEC-S-006 FIX: Select only needed fields to avoid overfetching password hash in memory
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true, email: true, name: true, role: true, image: true, locale: true,
        password: true, mfaEnabled: true, mfaSecret: true,
        tenantId: true, emailVerified: true,
      },
    });

    if (!user || !user.password) {
      await recordFailedAttempt(normalizedEmail, ip, userAgent);
      return NextResponse.json(
        { message: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await recordFailedAttempt(normalizedEmail, ip, userAgent);
      return NextResponse.json(
        { message: 'Email ou mot de passe incorrect' },
        { status: 401 }
      );
    }

    // Success — clear brute-force counter
    await clearFailedAttempts(normalizedEmail);

    // AUTH-F2 FIX: Issue limited MFA challenge token when MFA is enabled
    // (was issuing full JWT before MFA verification — complete MFA bypass)
    if (user.mfaEnabled) {
      const { generateMfaChallengeToken } = await import('@/lib/auth-jwt');
      const mfaToken = await generateMfaChallengeToken(user.id, user.email);
      logger.info('MFA challenge issued', { userId: user.id, ip });
      return NextResponse.json({
        mfaToken,
        requiresMfa: true,
        user: formatUser(user),
      });
    }

    // No MFA required — issue full access token
    const token = await generateToken(user.id, user.email, user.role);
    logger.info('Direct API login success', { userId: user.id, ip });

    return NextResponse.json({
      token,
      user: formatUser(user),
      requiresMfa: false,
    });
  } catch (error) {
    logger.error('[API] /auth/login error', {
      error: error instanceof Error ? error.message : String(error),
      ip,
    });
    return NextResponse.json(
      { message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
