/**
 * API Changer mot de passe
 * POST /api/user/change-password
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Current and new password required' }, { status: 400 });
    }

    // Validation du nouveau mot de passe
    const passwordErrors: string[] = [];
    if (newPassword.length < 8) passwordErrors.push('Au moins 8 caractères');
    if (!/[A-Z]/.test(newPassword)) passwordErrors.push('Au moins une majuscule');
    if (!/[a-z]/.test(newPassword)) passwordErrors.push('Au moins une minuscule');
    if (!/[0-9]/.test(newPassword)) passwordErrors.push('Au moins un chiffre');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) passwordErrors.push('Au moins un caractère spécial');

    if (passwordErrors.length > 0) {
      return NextResponse.json({ 
        error: `Mot de passe invalide: ${passwordErrors.join(', ')}` 
      }, { status: 400 });
    }

    // Récupérer l'utilisateur avec son mot de passe
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Vérifier si l'utilisateur a un mot de passe (OAuth users n'en ont pas)
    if (!user.password) {
      return NextResponse.json({ 
        error: 'Impossible de changer le mot de passe pour un compte OAuth' 
      }, { status: 400 });
    }

    // Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    console.log(`Password changed for user: ${session.user.email}`);

    return NextResponse.json({ success: true, message: 'Mot de passe modifié avec succès' });

  } catch (error) {
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
