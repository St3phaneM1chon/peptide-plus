/**
 * API RESET PASSWORD
 * Réinitialise le mot de passe avec un token valide
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { token, email, password } = await request.json();

    // Validation des paramètres
    if (!token || !email || !password) {
      return NextResponse.json(
        { error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    // Validation du mot de passe
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caractères' },
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
      
      // Fallback: vérifier juste l'email en développement
      if (process.env.NODE_ENV === 'development') {
        user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Lien de réinitialisation invalide ou expiré' },
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
      
      // Fallback: mettre à jour juste le mot de passe
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
        },
      });
    }

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
