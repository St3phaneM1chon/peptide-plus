import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import {
  generateToken,
  formatUser,
  isValidEmail,
  isStrongPassword,
  getClientIp,
} from '@/lib/auth-jwt';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    // C-02 FIX: Rate limiting (3 req/5min per IP for auth/register)
    const rateLimit = await checkRateLimit(ip, '/api/auth/register');
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
    const { name, email, password } = body;

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

    // C-03 FIX: Password strength validation
    const passwordCheck = isStrongPassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { message: passwordCheck.message },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'Un compte avec cet email existe déjà' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // FIX: Default role is CUSTOMER (was incorrectly EMPLOYEE)
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || normalizedEmail.split('@')[0],
        password: hashedPassword,
        emailVerified: new Date(),
        role: 'CUSTOMER',
        locale: 'fr',
      },
    });

    // C-01 + C-04 FIX: Shared JWT module (no fallback secret, 1h expiry)
    const token = await generateToken(user.id, user.email, user.role);

    logger.info('Direct API register success', {
      userId: user.id,
      ip,
    });

    return NextResponse.json({
      token,
      user: formatUser(user),
      requiresMfa: false,
    });
  } catch (error) {
    logger.error('[API] /auth/register error', {
      error: error instanceof Error ? error.message : String(error),
      ip,
    });
    return NextResponse.json(
      { message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
