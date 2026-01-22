export const dynamic = 'force-dynamic';
/**
 * API - Gestion des customers (étudiants) d'une compagnie
 * Pour les rôles CLIENT, EMPLOYEE, OWNER
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import crypto from 'crypto';

// GET - Liste des customers de ma compagnie (ou toutes pour Employee/Owner)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    // Client: seulement ses propres customers
    if (session.user.role === UserRole.CLIENT) {
      const company = await prisma.company.findUnique({
        where: { ownerId: session.user.id },
        include: {
          customers: {
            include: {
              customer: {
                include: {
                  courseAccess: { select: { id: true, completedAt: true } },
                  certificates: { select: { id: true } },
                },
              },
            },
            orderBy: { addedAt: 'desc' },
          },
        },
      });

      if (!company) {
        return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 });
      }

      return NextResponse.json({ customers: company.customers });
    }

    // Employee/Owner: tous les customers ou ceux d'une compagnie spécifique
    if (session.user.role === UserRole.EMPLOYEE || session.user.role === UserRole.OWNER) {
      const where: any = companyId ? { companyId } : {};

      const customers = await prisma.companyCustomer.findMany({
        where,
        include: {
          customer: {
            include: {
              courseAccess: { select: { id: true, completedAt: true } },
              certificates: { select: { id: true } },
            },
          },
          company: { select: { id: true, name: true } },
        },
        orderBy: { addedAt: 'desc' },
      });

      return NextResponse.json({ customers });
    }

    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des customers' },
      { status: 500 }
    );
  }
}

// POST - Ajouter un customer à ma compagnie
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (
      session.user.role !== UserRole.CLIENT &&
      session.user.role !== UserRole.EMPLOYEE &&
      session.user.role !== UserRole.OWNER
    ) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { email, name, createNew, sendInvite, companyId: targetCompanyId } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    // Déterminer la compagnie cible
    let companyId: string;

    if (session.user.role === UserRole.CLIENT) {
      // Client: utilise sa propre compagnie
      const company = await prisma.company.findUnique({
        where: { ownerId: session.user.id },
      });

      if (!company) {
        return NextResponse.json({ error: 'Entreprise non trouvée' }, { status: 404 });
      }

      companyId = company.id;
    } else {
      // Employee/Owner: doit spécifier la compagnie
      if (!targetCompanyId) {
        return NextResponse.json({ error: 'companyId requis pour Employee/Owner' }, { status: 400 });
      }
      companyId = targetCompanyId;
    }

    // Vérifier si l'utilisateur existe déjà
    let user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user && createNew) {
      // Créer un nouvel utilisateur
      const tempPassword = crypto.randomBytes(16).toString('hex');

      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: name || null,
          role: 'CUSTOMER',
          // Le password sera défini lors de l'activation du compte
        },
      });

      // TODO: Envoyer email d'invitation si sendInvite === true
      if (sendInvite) {
        // await sendInvitationEmail(user.email, inviteToken);
        console.log(`[TODO] Envoyer invitation à ${user.email}`);
      }
    } else if (!user) {
      return NextResponse.json(
        { error: 'Aucun utilisateur trouvé avec cet email. Cochez "Créer un nouveau compte".' },
        { status: 404 }
      );
    }

    // Vérifier si déjà associé
    const existingRelation = await prisma.companyCustomer.findFirst({
      where: { companyId, customerId: user.id },
    });

    if (existingRelation) {
      return NextResponse.json(
        { error: 'Cet utilisateur est déjà associé à cette entreprise' },
        { status: 400 }
      );
    }

    // Créer la relation
    const relation = await prisma.companyCustomer.create({
      data: {
        companyId,
        customerId: user.id,
      },
      include: {
        customer: true,
        company: { select: { id: true, name: true } },
      },
    });

    // Mettre à jour le rôle si nécessaire
    if (user.role === 'PUBLIC') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'CUSTOMER' },
      });
    }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'CompanyCustomer',
        entityId: relation.id,
        details: JSON.stringify({ companyId, customerId: user.id, email }),
      },
    });

    return NextResponse.json({ relation }, { status: 201 });
  } catch (error) {
    console.error('Error adding customer:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout du customer' },
      { status: 500 }
    );
  }
}

// DELETE - Retirer un customer de ma compagnie
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const relationId = searchParams.get('id');
    const customerId = searchParams.get('customerId');

    if (!relationId && !customerId) {
      return NextResponse.json({ error: 'id ou customerId requis' }, { status: 400 });
    }

    // Trouver la relation
    let relation;

    if (relationId) {
      relation = await prisma.companyCustomer.findUnique({
        where: { id: relationId },
        include: { company: true },
      });
    } else if (customerId && session.user.role === UserRole.CLIENT) {
      const company = await prisma.company.findUnique({
        where: { ownerId: session.user.id },
      });

      if (company) {
        relation = await prisma.companyCustomer.findFirst({
          where: { companyId: company.id, customerId },
          include: { company: true },
        });
      }
    }

    if (!relation) {
      return NextResponse.json({ error: 'Relation non trouvée' }, { status: 404 });
    }

    // Vérifier les permissions
    if (session.user.role === UserRole.CLIENT && relation.company.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Supprimer la relation
    await prisma.companyCustomer.delete({
      where: { id: relation.id },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'CompanyCustomer',
        entityId: relation.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing customer:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du customer' },
      { status: 500 }
    );
  }
}
