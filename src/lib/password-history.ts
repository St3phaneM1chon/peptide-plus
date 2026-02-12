/**
 * PASSWORD HISTORY - Prevent password reuse
 *
 * Tracks the last 12 password hashes per user.
 * Before any password change, the new password is checked
 * against stored history to prevent reuse.
 *
 * NYDFS 500.7 compliance: password reuse prevention
 */

import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const MAX_PASSWORD_HISTORY = 12;

/**
 * Checks whether the plaintext password matches any of the user's
 * last 12 stored password hashes.
 *
 * @returns true if the password was previously used (i.e. should be rejected)
 */
export async function checkPasswordHistory(
  userId: string,
  newPassword: string
): Promise<boolean> {
  const history = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: MAX_PASSWORD_HISTORY,
    select: { password: true },
  });

  for (const entry of history) {
    const match = await bcrypt.compare(newPassword, entry.password);
    if (match) {
      return true; // Password was used before
    }
  }

  return false; // Password is not in history
}

/**
 * Stores a hashed password in the user's password history and trims
 * the history to the most recent MAX_PASSWORD_HISTORY entries.
 *
 * @param userId - The user ID
 * @param hashedPassword - The bcrypt-hashed password (already hashed by the caller)
 */
export async function addToPasswordHistory(
  userId: string,
  hashedPassword: string
): Promise<void> {
  // Store the new entry
  await prisma.passwordHistory.create({
    data: {
      userId,
      password: hashedPassword,
    },
  });

  // Trim old entries beyond the limit
  const allEntries = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });

  if (allEntries.length > MAX_PASSWORD_HISTORY) {
    const idsToDelete = allEntries
      .slice(MAX_PASSWORD_HISTORY)
      .map((entry) => entry.id);

    await prisma.passwordHistory.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }
}
