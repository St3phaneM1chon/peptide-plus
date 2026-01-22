export const dynamic = 'force-dynamic';
/**
 * API - Gestion des compagnies (clients)
 * Pour les rôles CLIENT (sa propre compagnie), EMPLOYEE, OWNER
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

// GET - Liste des compagnies (Employee/Owner) ou ma compagnie (Client)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Client: seulement sa propre compagnie
    if (session.user.role === UserRole.CLIENT) {
      const company = await prisma.company.findUnique({
        where: { ownerId: session.user.id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { customers: true, purchases: true } },
        },
      });

      if (!company) {
        return NextResponse.json({ company: null });
      }

      return NextResponse.json({ company });
    }

    // Employee/Owner
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Récupérer une compagnie spécifique
    if (id) {
      const company = await prisma.company.findUnique({
        where: { id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          customers: {
            include: {
              customer: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { customers: true, purchases: true } },
        },
      });

      if (!company) {
        return NextResponse.json({ error: 'Compagnie non trouvée' }, { status: 404 });
      }

      return NextResponse.json({ company });
    }

    // Liste de toutes les compagnies
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { customers: true, purchases: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.company.count({ where }),
    ]);

    return NextResponse.json({
      companies,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des compagnies' },
      { status: 500 }
    );
  }
}

// POST - Créer une compagnie
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      slug,
      contactEmail,
      phone,
      billingAddress,
      billingCity,
      billingState,
      billingPostal,
      billingCountry,
      ownerId,
    } = body;

    if (!name || !contactEmail) {
      return NextResponse.json({ error: 'name et contactEmail requis' }, { status: 400 });
    }

    // Générer le slug si non fourni
    const finalSlug = slug || name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Vérifier unicité du slug
    const existingSlug = await prisma.company.findUnique({
      where: { slug: finalSlug },
    });

    if (existingSlug) {
      return NextResponse.json({ error: 'Ce slug existe déjà' }, { status: 400 });
    }

    // Déterminer le propriétaire
    let finalOwnerId: string;

    if (session.user.role === UserRole.CLIENT) {
      // Le client crée sa propre compagnie
      finalOwnerId = session.user.id;

      // Vérifier qu'il n'en a pas déjà une
      const existingCompany = await prisma.company.findUnique({
        where: { ownerId: session.user.id },
      });

      if (existingCompany) {
        return NextResponse.json(
          { error: 'Vous avez déjà une entreprise enregistrée' },
          { status: 400 }
        );
      }
    } else if (session.user.role === UserRole.EMPLOYEE || session.user.role === UserRole.OWNER) {
      // Employee/Owner crée pour un autre utilisateur
      if (!ownerId) {
        return NextResponse.json({ error: 'ownerId requis' }, { status: 400 });
      }
      finalOwnerId = ownerId;
    } else {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const company = await prisma.company.create({
      data: {
        name,
        slug: finalSlug,
        contactEmail,
        phone,
        billingAddress,
        billingCity,
        billingState,
        billingPostal,
        billingCountry,
        ownerId: finalOwnerId,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    // Mettre à jour le rôle du propriétaire
    await prisma.user.update({
      where: { id: finalOwnerId },
      data: { role: 'CLIENT' },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Company',
        entityId: company.id,
        details: JSON.stringify({ name, slug: finalSlug, ownerId: finalOwnerId }),
      },
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la compagnie' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour une compagnie
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id requis' }, { status: 400 });
    }

    // Récupérer la compagnie
    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return NextResponse.json({ error: 'Compagnie non trouvée' }, { status: 404 });
    }

    // Vérifier les permissions
    if (
      session.user.role === UserRole.CLIENT &&
      company.ownerId !== session.user.id
    ) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    if (
      session.user.role !== UserRole.CLIENT &&
      session.user.role !== UserRole.EMPLOYEE &&
      session.user.role !== UserRole.OWNER
    ) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Si le slug change, vérifier unicité
    if (updates.slug && updates.slug !== company.slug) {
      const existingSlug = await prisma.company.findUnique({
        where: { slug: updates.slug },
      });

      if (existingSlug) {
        return NextResponse.json({ error: 'Ce slug existe déjà' }, { status: 400 });
      }
    }

    const updatedCompany = await prisma.company.update({
      where: { id },
      data: updates,
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { customers: true, purchases: true } },
      },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Company',
        entityId: company.id,
        details: JSON.stringify({ fields: Object.keys(updates) }),
      },
    });

    return NextResponse.json({ company: updatedCompany });
  } catch (error) {
    console.error('Error updating company:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la compagnie' },
      { status: 500 }
    );
  }
}
