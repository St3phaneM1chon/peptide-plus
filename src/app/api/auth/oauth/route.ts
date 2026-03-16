import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateToken, formatUser, isValidEmail, getClientIp } from '@/lib/auth-jwt';
import { checkRateLimit } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    // C-02 FIX: Rate limiting
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
    const { provider, idToken, accessToken, email, fullName } = body;

    // C-03 FIX: Input validation
    if (!provider || !email) {
      return NextResponse.json(
        { message: 'Provider et email requis' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: 'Format email invalide' },
        { status: 400 }
      );
    }

    // Validate provider is a known value
    const ALLOWED_PROVIDERS = ['google', 'apple', 'microsoft', 'twitter', 'linkedin', 'facebook'];
    const normalizedProvider = String(provider).toLowerCase().trim();
    if (!ALLOWED_PROVIDERS.includes(normalizedProvider)) {
      return NextResponse.json(
        { message: 'Provider OAuth non supporté' },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { accounts: { select: { provider: true } } },
    });

    if (!user) {
      // FIX: Default role is CUSTOMER (was incorrectly EMPLOYEE)
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: fullName || normalizedEmail.split('@')[0],
          emailVerified: new Date(),
          role: 'CUSTOMER',
          locale: 'fr',
          accounts: {
            create: {
              type: 'oauth',
              provider: normalizedProvider,
              providerAccountId: normalizedEmail,
              id_token: idToken,
              access_token: accessToken,
            },
          },
        },
        include: { accounts: { select: { provider: true } } },
      });
    } else {
      // Link account if not already linked
      const existingAccount = await prisma.account.findFirst({
        where: { userId: user.id, provider: normalizedProvider },
      });
      if (!existingAccount) {
        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'oauth',
            provider: normalizedProvider,
            providerAccountId: normalizedEmail,
            id_token: idToken,
            access_token: accessToken,
          },
        });
      }
    }

    // C-01 + C-04 FIX: Shared JWT module (no fallback secret, 1h expiry)
    const token = await generateToken(user.id, user.email, user.role);

    logger.info('Direct API OAuth login success', {
      userId: user.id,
      provider: normalizedProvider,
      ip,
    });

    return NextResponse.json({
      token,
      user: formatUser(user),
      requiresMfa: false,
    });
  } catch (error) {
    logger.error('[API] /auth/oauth error', {
      error: error instanceof Error ? error.message : String(error),
      ip,
    });
    return NextResponse.json(
      { message: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
