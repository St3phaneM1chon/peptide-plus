/**
 * API FORGOT PASSWORD
 * Envoie un email de réinitialisation de mot de passe
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import crypto from 'crypto';

// Durée de validité du token (1 heure)
const TOKEN_EXPIRY_HOURS = 1;

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit password reset requests
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimit = rateLimitMiddleware(ip, '/api/auth/forgot-password');
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.error!.message },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      );
    }

    // Vérifier si l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // IMPORTANT: Toujours retourner succès même si l'email n'existe pas
    // Pour éviter l'énumération des utilisateurs
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
      });
    }

    // Générer un token sécurisé
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Calculer la date d'expiration
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + TOKEN_EXPIRY_HOURS);

    // Sauvegarder le token hashé dans la base de données
    // Note: Vous devez ajouter ces champs au modèle User dans Prisma:
    // resetToken      String?
    // resetTokenExpiry DateTime?
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: resetTokenHash,
          resetTokenExpiry: resetTokenExpiry,
        },
      });
    } catch (dbError) {
      console.error('Database update error (resetToken fields may not exist):', dbError);
      // Continuer quand même pour le développement
    }

    // Construire l'URL de réinitialisation
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Envoyer l'email de réinitialisation
    await sendPasswordResetEmail(user.id, email, {
      userName: user.name || 'Utilisateur',
      resetUrl,
      expiresIn: `${TOKEN_EXPIRY_HOURS} heure(s)`,
    });

    // Log pour audit
    console.log(JSON.stringify({
      event: 'password_reset_requested',
      timestamp: new Date().toISOString(),
      email: email,
      userId: user.id,
    }));

    return NextResponse.json({
      success: true,
      message: 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.',
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Une erreur est survenue' },
      { status: 500 }
    );
  }
}
