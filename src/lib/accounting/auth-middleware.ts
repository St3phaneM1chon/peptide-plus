/**
 * Accounting Auth Middleware
 *
 * IMP: A014 - Implements accounting-specific permission checks.
 * Verifies that the authenticated user has the required accounting role
 * before allowing access to accounting operations.
 *
 * Roles hierarchy:
 *   ADMIN       - Full access to all accounting operations
 *   ACCOUNTANT  - Can create, post, void entries; manage invoices; run reports
 *   VIEWER      - Read-only access to reports, dashboards, and data
 *
 * Usage in API routes:
 *   import { requireAccountingRole } from '@/lib/accounting/auth-middleware';
 *   // Inside handler:
 *   const authError = await requireAccountingRole(session, 'ACCOUNTANT');
 *   if (authError) return authError;
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export type AccountingRole = 'ADMIN' | 'ACCOUNTANT' | 'VIEWER';

// Permission mapping: what each role is allowed to do
const ROLE_HIERARCHY: Record<AccountingRole, number> = {
  VIEWER: 1,
  ACCOUNTANT: 2,
  ADMIN: 3,
};

/**
 * Check if a session user has the required accounting role.
 * Returns null if authorized, or a NextResponse error if not.
 *
 * @param session - The authenticated session (from withAdminGuard)
 * @param requiredRole - Minimum role required for this operation
 * @returns null if authorized, NextResponse with 403 error if not
 */
export async function requireAccountingRole(
  session: { user?: { id?: string; email?: string; role?: string } },
  requiredRole: AccountingRole
): Promise<NextResponse | null> {
  const userId = session.user?.id || session.user?.email;

  if (!userId) {
    return NextResponse.json(
      { error: 'Authentification requise' },
      { status: 401 }
    );
  }

  // Get user's accounting role
  const userRole = await getUserAccountingRole(userId);

  if (!userRole) {
    logger.warn('Accounting access denied: no role assigned', { userId });
    return NextResponse.json(
      { error: 'Accès refusé: aucun rôle comptable assigné' },
      { status: 403 }
    );
  }

  const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  if (userLevel < requiredLevel) {
    logger.warn('Accounting access denied: insufficient role', {
      userId,
      userRole,
      requiredRole,
    });
    return NextResponse.json(
      {
        error: `Accès refusé: rôle "${requiredRole}" requis (votre rôle: "${userRole}")`,
      },
      { status: 403 }
    );
  }

  return null; // Authorized
}

/**
 * Get the accounting role for a user.
 * Falls back to session.user.role if no accounting-specific role is configured.
 *
 * The role lookup order:
 * 1. Check user.role field from the database
 * 2. If user is ADMIN/OWNER in the system, grant ADMIN accounting role
 * 3. If user has EMPLOYEE role, grant ACCOUNTANT accounting role
 * 4. Otherwise grant VIEWER
 */
async function getUserAccountingRole(userId: string): Promise<AccountingRole | null> {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: userId }, { email: userId }],
      },
      select: { role: true },
    });

    if (!user) return null;

    // Map system roles to accounting roles
    const systemRole = (user.role || '').toUpperCase();

    if (systemRole === 'ADMIN' || systemRole === 'OWNER' || systemRole === 'SUPER_ADMIN') {
      return 'ADMIN';
    }
    if (systemRole === 'EMPLOYEE' || systemRole === 'ACCOUNTANT' || systemRole === 'MANAGER') {
      return 'ACCOUNTANT';
    }

    // Default: viewers can still access read-only accounting data
    return 'VIEWER';
  } catch (error) {
    logger.error('Failed to get accounting role', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail closed: deny access if role lookup fails
    return null;
  }
}

/**
 * Convenience: require at least VIEWER role (read-only access)
 */
export async function requireViewer(
  session: { user?: { id?: string; email?: string; role?: string } }
): Promise<NextResponse | null> {
  return requireAccountingRole(session, 'VIEWER');
}

/**
 * Convenience: require at least ACCOUNTANT role (write access)
 */
export async function requireAccountant(
  session: { user?: { id?: string; email?: string; role?: string } }
): Promise<NextResponse | null> {
  return requireAccountingRole(session, 'ACCOUNTANT');
}

/**
 * Convenience: require ADMIN role (full access including period close, settings)
 */
export async function requireAdmin(
  session: { user?: { id?: string; email?: string; role?: string } }
): Promise<NextResponse | null> {
  return requireAccountingRole(session, 'ADMIN');
}
