export const dynamic = 'force-dynamic';
/**
 * API - Gestion utilisateur individuel
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Détail d'un utilisateur
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // L'utilisateur peut voir son propre profil, sinon admin requis
    const isOwnProfile = id === session.user.id;
    const isAdmin = session.user.role === UserRole.EMPLOYEE || session.user.role === UserRole.OWNER;

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        mfaEnabled: true,
        createdAt: true,
        companies: {
          include: {
            company: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        courseAccess: {
          include: {
            product: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        _count: {
          select: {
            purchases: true,
            courseAccess: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    logger.error('Error fetching user', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'utilisateur' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un utilisateur
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const isOwnProfile = id === session.user.id;
    const isAdmin = session.user.role === UserRole.EMPLOYEE || session.user.role === UserRole.OWNER;

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { name, image, role } = body;

    // Seul un admin peut changer le rôle
    const updateData: Record<string, unknown> = {};
    
    if (name !== undefined) updateData.name = name;
    if (image !== undefined) updateData.image = image;
    
    if (role !== undefined) {
      // Only OWNER can change roles (H14 - role escalation fix)
      if (session.user.role !== UserRole.OWNER) {
        return NextResponse.json(
          { error: 'Seul le propriétaire (OWNER) peut changer les rôles' },
          { status: 403 }
        );
      }
      // The OWNER cannot change their own role
      if (id === session.user.id) {
        return NextResponse.json(
          { error: 'Impossible de modifier votre propre rôle owner' },
          { status: 400 }
        );
      }
      // Prevent setting anyone's role to OWNER
      if (role === UserRole.OWNER) {
        return NextResponse.json(
          { error: 'Impossible d\'attribuer le rôle OWNER' },
          { status: 403 }
        );
      }
      // Validate that role is a known value
      const allowedRoles = [UserRole.PUBLIC, UserRole.CUSTOMER, UserRole.CLIENT, UserRole.EMPLOYEE];
      if (!allowedRoles.includes(role)) {
        return NextResponse.json(
          { error: 'Rôle invalide' },
          { status: 400 }
        );
      }
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
      },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: id,
        details: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    logger.error('Error updating user', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'utilisateur' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer/désactiver un utilisateur
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Ne pas permettre de se supprimer soi-même
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'Impossible de supprimer votre propre compte' },
        { status: 400 }
      );
    }

    // Soft delete - deactivate user by clearing sessions and anonymizing
    // instead of hard deleting to preserve referential integrity
    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.user.update({
        where: { id },
        data: {
          email: `deleted-${id}@deactivated.local`,
          name: 'Deleted User',
          password: null,
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: null,
          role: 'PUBLIC',
        },
      }),
    ]);

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'SOFT_DELETE',
        entityType: 'User',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting user', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'utilisateur' },
      { status: 500 }
    );
  }
}
