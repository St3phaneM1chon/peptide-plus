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

    const body = await request.json();
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

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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

    // C-01 + C-04 FIX: Shared JWT module (no fallback secret, 1h expiry)
    const token = await generateToken(user.id, user.email, user.role);

    logger.info('Direct API login success', {
      userId: user.id,
      ip,
    });

    return NextResponse.json({
      token,
      user: formatUser(user),
      requiresMfa: user.mfaEnabled || false,
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
