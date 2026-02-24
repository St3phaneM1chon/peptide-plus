export const dynamic = 'force-dynamic';
/**
 * API - Gestion des compagnies (clients)
 * Pour les rôles CLIENT (sa propre compagnie), EMPLOYEE, OWNER
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const createCompanySchema = z.object({
  name: z.string().min(1, 'name is required').max(200),
  slug: z.string().max(200).optional(),
  contactEmail: z.string().email('Invalid email').min(1, 'contactEmail is required'),
  phone: z.string().max(30).optional(),
  billingAddress: z.string().max(300).optional(),
  billingCity: z.string().max(100).optional(),
  billingState: z.string().max(100).optional(),
  billingPostal: z.string().max(20).optional(),
  billingCountry: z.string().max(100).optional(),
  ownerId: z.string().optional(),
});

const updateCompanySchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().min(1).max(200).optional(),
  slug: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  billingAddress: z.string().max(300).optional(),
  billingCity: z.string().max(100).optional(),
  billingState: z.string().max(100).optional(),
  billingPostal: z.string().max(20).optional(),
  billingCountry: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

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
    // FIX: Bound pagination params to prevent abuse
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '20', 10)), 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

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
    logger.error('Error fetching companies', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des compagnies' },
      { status: 500 }
    );
  }
}

// POST - Créer une compagnie
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/company');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
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
    } = parsed.data;

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
    logger.error('Error creating company', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la compagnie' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour une compagnie
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/company');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateCompanySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id } = parsed.data;

    // Whitelist: only allow safe fields to be updated (H12 - mass assignment fix)
    const allowedFields = [
      'name', 'slug', 'contactEmail', 'phone',
      'billingAddress', 'billingCity', 'billingState', 'billingPostal', 'billingCountry',
      'isActive',
    ] as const;
    const updates: Record<string, unknown> = {};
    const data = parsed.data as Record<string, unknown>;
    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates[field] = data[field];
      }
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
        where: { slug: updates.slug as string },
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
    logger.error('Error updating company', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la compagnie' },
      { status: 500 }
    );
  }
}
