export const dynamic = 'force-dynamic';

/**
 * API - INSCRIPTION UTILISATEUR
 * Création de compte avec validation sécurisée
 */

import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/db';
import { addToPasswordHistory } from '@/lib/password-history';
import { sendWelcomeEmail } from '@/lib/email-service';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { z } from 'zod';

// Schéma de validation NYDFS-compliant
const signupSchema = z.object({
  name: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  email: z.string().email('Email invalide'),
  password: z
    .string()
    .min(12, 'Le mot de passe doit contenir au moins 12 caractères')
    .regex(/[A-Z]/, 'Le mot de passe doit contenir au moins une majuscule')
    .regex(/[a-z]/, 'Le mot de passe doit contenir au moins une minuscule')
    .regex(/[0-9]/, 'Le mot de passe doit contenir au moins un chiffre')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Le mot de passe doit contenir au moins un caractère spécial'),
});

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Rate limit signup attempts
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimit = await rateLimitMiddleware(ip, '/api/auth/register');
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: rateLimit.error!.message },
        { status: 429, headers: rateLimit.headers }
      );
    }

    const body = await request.json();

    // Validation
    const result = signupSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = result.data;

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      // SECURITY FIX H17: Don't reveal whether email exists (account enumeration)
      // Return same success response to prevent attackers from discovering valid emails
      return NextResponse.json(
        {
          success: true,
          message: 'Si cet email est disponible, un compte a été créé. Vérifiez votre boîte de réception.',
        },
        { status: 201 }
      );
    }

    // Hash du mot de passe (cost factor 12 pour NYDFS)
    const hashedPassword = await hash(password, 12);

    // Check if this email has a newsletter subscription with birthDate
    const newsletterSub = await prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() },
      select: { birthDate: true },
    }).catch(() => null);

    // Créer l'utilisateur (transfer birthDate from newsletter if available)
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'CUSTOMER', // Rôle par défaut
        ...(newsletterSub?.birthDate && { birthDate: newsletterSub.birthDate }),
      },
    });

    // Store initial password in history (for reuse prevention)
    await addToPasswordHistory(user.id, hashedPassword);

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: user.id,
        details: JSON.stringify({ email: user.email }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    // Envoyer email de bienvenue
    sendWelcomeEmail(user.id, user.email, {
      userName: user.name || 'Utilisateur',
    }).catch((err) => console.error('Welcome email failed:', err));

    return NextResponse.json(
      {
        success: true,
        message: 'Si cet email est disponible, un compte a été créé. Vérifiez votre boîte de réception.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du compte' },
      { status: 500 }
    );
  }
}
