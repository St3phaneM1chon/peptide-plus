export const dynamic = 'force-dynamic';

/**
 * API ACCEPT INVITE
 * Allows an invited employee to set their password and activate their account
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import bcrypt from 'bcryptjs';
import { PASSWORD_MIN_LENGTH } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { getClientIpFromRequest } from '@/lib/admin-audit';

const acceptInviteSchema = z.object({
  token: z.string().min(1, 'Token requis').max(256),
  password: z.string()
    .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`)
    .max(128)
    .regex(/[A-Z]/, 'Doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Doit contenir au moins une minuscule')
    .regex(/[0-9]/, 'Doit contenir au moins un chiffre')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Doit contenir au moins un caractère spécial'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    // SEC-FIX: Use rightmost XFF IP + Azure header to prevent rate-limit bypass via spoofed X-Forwarded-For
    const ip = getClientIpFromRequest(request);
    const rateLimit = await rateLimitMiddleware(ip, '/api/auth/accept-invite');
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.error?.message || 'Too many requests' },
        { status: 429, headers: rateLimit.headers }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed' },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    // Find user with valid invite token
    const user = await prisma.user.findFirst({
      where: {
        inviteToken: token,
        inviteTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Lien d\'invitation invalide ou expiré' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Atomically consume token + set password
    try {
      const consumed = await prisma.$transaction(async (tx) => {
        const result = await tx.user.updateMany({
          where: {
            id: user.id,
            inviteToken: token,
          },
          data: {
            inviteToken: null,
            inviteTokenExpiry: null,
          },
        });
        if (result.count === 0) {
          throw new Error('TOKEN_ALREADY_CONSUMED');
        }
        return tx.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            emailVerified: new Date(),
          },
        });
      });
      if (!consumed) throw new Error('Update failed');
    } catch (dbError) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      if (msg === 'TOKEN_ALREADY_CONSUMED') {
        return NextResponse.json(
          { error: 'Ce lien a déjà été utilisé' },
          { status: 400 }
        );
      }
      logger.error('Accept invite DB error', { error: msg });
      return NextResponse.json(
        { error: 'Erreur lors de l\'activation du compte' },
        { status: 500 }
      );
    }

    logger.info('invite_accepted', {
      event: 'invite_accepted',
      timestamp: new Date().toISOString(),
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Compte activé avec succès',
    });
  } catch (error) {
    logger.error('Accept invite error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
