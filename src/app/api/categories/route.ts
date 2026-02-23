export const dynamic = 'force-dynamic';
/**
 * API - CRUD Catégories
 * Supporte: ?locale=fr pour contenu traduit
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';
import { withTranslations, enqueue, DB_SOURCE_LOCALE } from '@/lib/translation';
import { isValidLocale, defaultLocale } from '@/i18n/config';
import { cacheGetOrSet, cacheInvalidateTag, CacheTags, CacheTTL } from '@/lib/cache';
import { z } from 'zod';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

// BUG-004 FIX: Add Zod validation schema for category creation
const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(200).transform(v => stripControlChars(stripHtml(v)).trim()),
  slug: z.string().min(1, 'Slug is required').max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(5000).optional().nullable().transform(v => v ? stripControlChars(stripHtml(v)).trim() : v),
  imageUrl: z.string().url().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  parentId: z.string().optional().nullable(),
});

// GET - Liste des catégories
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tree = searchParams.get('tree') === 'true';
    const locale = searchParams.get('locale') || defaultLocale;

    // BUG-015 FIX: Only allow includeInactive for authenticated admin/owner users
    let includeInactive = false;
    if (searchParams.get('includeInactive') === 'true') {
      const session = await auth();
      if (session?.user?.role === UserRole.EMPLOYEE || session?.user?.role === UserRole.OWNER) {
        includeInactive = true;
      }
    }

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
      // Collect all category IDs (parents + children) for a single batch query
      const allCategoryIds: string[] = [];
      for (const cat of categories) {
        allCategoryIds.push(cat.id);
        const children = (cat as Record<string, unknown>).children as Array<Record<string, unknown> & { id: string }> | undefined;
        if (children) {
          for (const child of children) {
            allCategoryIds.push(child.id);
          }
        }
      }

      // Single batch query for all translations (parents + children)
      const { getTranslatedFieldsBatch } = await import('@/lib/translation');
      const translationMap = await getTranslatedFieldsBatch('Category', allCategoryIds, locale);

      // Apply translations to parent categories
      categories = categories.map(cat => {
        const trans = translationMap.get(cat.id);
        const updated = trans ? { ...cat, ...trans } : cat;

        // Apply translations to children
        const children = (updated as Record<string, unknown>).children as Array<Record<string, unknown> & { id: string }> | undefined;
        if (children) {
          (updated as Record<string, unknown>).children = children.map(child => {
            const childTrans = translationMap.get(child.id);
            return childTrans ? { ...child, ...childTrans } : child;
          });
        }

        return updated;
      });
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
    logger.error('Error fetching categories', { error: error instanceof Error ? error.message : String(error) });
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

    // BUG-004 FIX: Validate with Zod schema instead of simple truthy checks
    const validation = createCategorySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || 'Invalid category data', details: validation.error.errors },
        { status: 400 }
      );
    }
    const { name, slug, description, imageUrl, sortOrder, parentId } = validation.data;

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

    // BUG-017 FIX: Invalidate category cache after creation
    cacheInvalidateTag(CacheTags.CATEGORIES);

    // Enqueue automatic translation to all locales
    enqueue.category(category.id);

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    logger.error('Error creating category', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la création de la catégorie' },
      { status: 500 }
    );
  }
}
