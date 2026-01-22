/**
 * API - Gestion utilisateur individuel
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

interface RouteParams {
  params: { id: string };
}

// GET - Détail d'un utilisateur
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // L'utilisateur peut voir son propre profil, sinon admin requis
    const isOwnProfile = params.id === session.user.id;
    const isAdmin = session.user.role === UserRole.EMPLOYEE || session.user.role === UserRole.OWNER;

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
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
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération de l\'utilisateur' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un utilisateur
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const isOwnProfile = params.id === session.user.id;
    const isAdmin = session.user.role === UserRole.EMPLOYEE || session.user.role === UserRole.OWNER;

    if (!isOwnProfile && !isAdmin) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { name, image, role } = body;

    // Seul un admin peut changer le rôle
    const updateData: any = {};
    
    if (name !== undefined) updateData.name = name;
    if (image !== undefined) updateData.image = image;
    
    if (role !== undefined) {
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'Seul un administrateur peut changer le rôle' },
          { status: 403 }
        );
      }
      // Le owner ne peut pas être rétrogradé
      if (params.id === session.user.id && session.user.role === UserRole.OWNER) {
        return NextResponse.json(
          { error: 'Impossible de modifier votre propre rôle owner' },
          { status: 400 }
        );
      }
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id: params.id },
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
        entityId: params.id,
        details: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'utilisateur' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer/désactiver un utilisateur
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Ne pas permettre de se supprimer soi-même
    if (params.id === session.user.id) {
      return NextResponse.json(
        { error: 'Impossible de supprimer votre propre compte' },
        { status: 400 }
      );
    }

    // Soft delete - on pourrait ajouter un champ isActive
    await prisma.user.delete({
      where: { id: params.id },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'User',
        entityId: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'utilisateur' },
      { status: 500 }
    );
  }
}
