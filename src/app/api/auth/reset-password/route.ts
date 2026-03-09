export const dynamic = 'force-dynamic';

/**
 * API RESET PASSWORD
 * Réinitialise le mot de passe avec un token valide
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { checkPasswordHistory, addToPasswordHistory } from '@/lib/password-history';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PASSWORD_MIN_LENGTH } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requis').max(256),
  email: z.string().email('Email invalide').max(255),
  password: z.string()
    .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`)
    .max(128)
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Le mot de passe doit contenir au moins un caractère spécial'),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit password reset attempts
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimit = await rateLimitMiddleware(ip, '/api/auth/reset-password');
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.error!.message },
        { status: 429, headers: rateLimit.headers }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;
    const email = stripControlChars(stripHtml(parsed.data.email));

    // Hasher le token reçu pour comparaison
    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Trouver l'utilisateur avec ce token
    let user;
    try {
      user = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          resetToken: tokenHash,
          resetTokenExpiry: {
            gt: new Date(), // Token non expiré
          },
        },
      });
    } catch (dbError) {
      logger.error('Database query error (resetToken fields may not exist)', { error: dbError instanceof Error ? dbError.message : String(dbError) });
      // SECURITY FIX: Never bypass token validation. If schema is missing fields, fail.
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Lien de réinitialisation invalide ou expiré' },
        { status: 400 }
      );
    }

    // SECURITY: Check password history (prevent reuse of last 12 passwords)
    const wasUsedBefore = await checkPasswordHistory(user.id, password);
    if (wasUsedBefore) {
      return NextResponse.json(
        { error: 'Ce mot de passe a déjà été utilisé. Veuillez en choisir un nouveau.' },
        { status: 400 }
      );
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // AUTH-002 FIX: Use transaction to atomically consume token + update password
    // This prevents race conditions where two simultaneous requests use the same token
    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Atomically clear the token first — if another request already consumed it,
        // updateMany returns count=0 and we abort
        const consumed = await tx.user.updateMany({
          where: {
            id: user.id,
            resetToken: tokenHash, // Only succeeds if token still matches
          },
          data: {
            resetToken: null,
            resetTokenExpiry: null,
          },
        });
        if (consumed.count === 0) {
          throw new Error('TOKEN_ALREADY_CONSUMED');
        }
        // Now safely update the password
        return tx.user.update({
          where: { id: user.id },
          data: { password: hashedPassword },
        });
      });
      if (!updated) throw new Error('Update failed');
    } catch (dbError) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError);
      if (msg === 'TOKEN_ALREADY_CONSUMED') {
        return NextResponse.json(
          { error: 'Ce lien a déjà été utilisé' },
          { status: 400 }
        );
      }
      logger.error('Database update error', { error: msg });
      return NextResponse.json(
        { error: 'Erreur lors de la réinitialisation' },
        { status: 500 }
      );
    }

    // SECURITY: Invalidate all existing sessions after password reset.
    // A stolen session cookie should not remain valid after password change.
    try {
      await prisma.session.deleteMany({
        where: { userId: user.id },
      });
    } catch (sessionErr) {
      // Non-blocking: log but don't fail the password reset
      logger.warn('Failed to invalidate sessions after password reset', {
        userId: user.id,
        error: sessionErr instanceof Error ? sessionErr.message : String(sessionErr),
      });
    }

    // Store the new password in history
    await addToPasswordHistory(user.id, hashedPassword);

    // Log pour audit
    logger.info('password_reset_completed', {
      event: 'password_reset_completed',
      timestamp: new Date().toISOString(),
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
    });

  } catch (error) {
    logger.error('Reset password error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
