export const dynamic = 'force-dynamic';

/**
 * API Changer mot de passe
 * POST /api/user/change-password
 */

import { z } from 'zod';
import { db } from '@/lib/db';
import { checkPasswordHistory, addToPasswordHistory } from '@/lib/password-history';
import bcrypt from 'bcryptjs';
import { withApiHandler, apiSuccess, apiError, type ApiContext } from '@/lib/api-handler';
import { validateCsrf } from '@/lib/csrf-middleware';
import { PASSWORD_MIN_LENGTH } from '@/lib/constants';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(256),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères`).max(256),
});

export const POST = withApiHandler(async (ctx: ApiContext) => {
  // SECURITY: CSRF protection for password mutation
  const csrfValid = await validateCsrf(ctx.request);
  if (!csrfValid) {
    return apiError('Invalid CSRF token', 403);
  }

  // Zod schema validation
  const body = await ctx.request.json();
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid data', 400, parsed.error.errors);
  }
  const { currentPassword, newPassword } = parsed.data;

  // Password validation (consistent with signup: min 8 chars)
  const passwordErrors: string[] = [];
  if (!/[A-Z]/.test(newPassword)) passwordErrors.push('Au moins une majuscule');
  if (!/[a-z]/.test(newPassword)) passwordErrors.push('Au moins une minuscule');
  if (!/[0-9]/.test(newPassword)) passwordErrors.push('Au moins un chiffre');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) passwordErrors.push('Au moins un caractère spécial');

  if (passwordErrors.length > 0) {
    return apiError(`Mot de passe invalide: ${passwordErrors.join(', ')}`, 400);
  }

  const user = await db.user.findUnique({
    where: { email: ctx.session!.user.email },
    select: { id: true, password: true },
  });

  if (!user) {
    return apiError('User not found', 404);
  }

  if (!user.password) {
    return apiError('Impossible de changer le mot de passe pour un compte OAuth', 400);
  }

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) {
    return apiError('Mot de passe actuel incorrect', 400);
  }

  // SECURITY: Check password history (prevent reuse of last 12 passwords)
  const wasUsedBefore = await checkPasswordHistory(user.id, newPassword);
  if (wasUsedBefore) {
    return apiError('Ce mot de passe a déjà été utilisé. Veuillez en choisir un nouveau.', 400);
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await db.user.update({
    where: { id: user.id },
    data: { password: hashedPassword },
  });

  await addToPasswordHistory(user.id, hashedPassword);

  return apiSuccess({ success: true, message: 'Mot de passe modifié avec succès' });
}, { auth: true });
