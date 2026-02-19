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

    const { token, email, password } = await request.json();

    // Validation des paramètres
    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    // Validation du mot de passe
    if (password.length < PASSWORD_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères` },
        { status: 400 }
      );
    }

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
      console.error('Database query error (resetToken fields may not exist):', dbError);
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

    // Mettre à jour le mot de passe et effacer le token
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
    } catch (dbError) {
      console.error('Database update error:', dbError);
      // SECURITY FIX: If we can't clear the reset token, don't update the password
      // This prevents token reuse attacks
      return NextResponse.json(
        { error: 'Erreur lors de la réinitialisation' },
        { status: 500 }
      );
    }

    // Store the new password in history
    await addToPasswordHistory(user.id, hashedPassword);

    // Log pour audit
    console.log(JSON.stringify({
      event: 'password_reset_completed',
      timestamp: new Date().toISOString(),
      userId: user.id,
      email: user.email,
    }));

    return NextResponse.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès',
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
