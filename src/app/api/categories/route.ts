export const dynamic = 'force-dynamic';
/**
 * API - CRUD Catégories
 * Supporte: ?locale=fr pour contenu traduit
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { withTranslations, enqueue, DB_SOURCE_LOCALE } from '@/lib/translation';
import { isValidLocale, defaultLocale } from '@/i18n/config';
import { cacheGetOrSet, CacheTags, CacheTTL } from '@/lib/cache';

// GET - Liste des catégories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const tree = searchParams.get('tree') === 'true';
    const locale = searchParams.get('locale') || defaultLocale;

    const where: Record<string, unknown> = {};
    if (!includeInactive) where.isActive = true;

    // Cache key includes query parameters so different views get separate cache entries
    const cacheKey = `categories:list:inactive=${includeInactive}:tree=${tree}:locale=${locale}`;

    let categories = await cacheGetOrSet(
      cacheKey,
      async () => {
        return prisma.category.findMany({
          where,
          include: {
            _count: {
              select: { products: true },
            },
            children: {
              where: includeInactive ? {} : { isActive: true },
              include: {
                _count: { select: { products: true } },
              },
              orderBy: { sortOrder: 'asc' },
            },
            parent: {
              select: { id: true, name: true, slug: true },
            },
          },
          orderBy: { sortOrder: 'asc' },
        });
      },
      { ttl: CacheTTL.STATS, tags: [CacheTags.CATEGORIES] }, // 10 minutes
    );

    // Apply translations if locale is not default
    if (isValidLocale(locale) && locale !== DB_SOURCE_LOCALE) {
      categories = await withTranslations(categories, 'Category', locale);
      // Also translate children
      for (const cat of categories) {
        if ((cat as Record<string, unknown>).children) {
          const children = (cat as Record<string, unknown>).children as Array<Record<string, unknown>>;
          const translatedChildren = await withTranslations(children, 'Category', locale);
          (cat as Record<string, unknown>).children = translatedChildren;
        }
      }
    }

    // If tree=true, return only parent categories with their children nested
    if (tree) {
      const treeCategories = categories.filter(c => !c.parentId).map(parent => {
        const children = (parent as Record<string, unknown>).children as Array<Record<string, unknown> & { _count: { products: number } }> || [];
        const childProductCount = children.reduce((sum, c) => sum + (c._count?.products || 0), 0);
        return {
          ...parent,
          _count: {
            ...parent._count,
            products: parent._count.products + childProductCount,
          },
        };
      });
      return NextResponse.json({ categories: treeCategories }, {
        headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
      });
    }

    return NextResponse.json({ categories }, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200' },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des catégories' },
      { status: 500 }
    );
  }
}

// POST - Créer une catégorie (Admin/Owner seulement)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { name, slug, description, imageUrl, sortOrder, parentId } = body;

    // Validation
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Champs requis: name, slug' },
        { status: 400 }
      );
    }

    // Vérifier l'unicité du slug
    const existingCategory = await prisma.category.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'Ce slug existe déjà' },
        { status: 400 }
      );
    }

    // Validate parentId if provided
    if (parentId) {
      const parentCategory = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parentCategory) {
        return NextResponse.json({ error: 'Catégorie parent non trouvée' }, { status: 400 });
      }
    }

    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        imageUrl,
        sortOrder: sortOrder || 0,
        parentId: parentId || null,
      },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Category',
        entityId: category.id,
        details: JSON.stringify({ name, slug }),
      },
    });

    // Enqueue automatic translation to all locales
    enqueue.category(category.id);

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la catégorie' },
      { status: 500 }
    );
  }
}
