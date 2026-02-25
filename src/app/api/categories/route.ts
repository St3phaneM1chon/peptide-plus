export const dynamic = 'force-dynamic';
/**
 * API - CRUD Catégories
 * Supporte: ?locale=fr pour contenu traduit
 */

import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { logger } from '@/lib/logger';
import { enqueue, DB_SOURCE_LOCALE } from '@/lib/translation';
import { isValidLocale, defaultLocale } from '@/i18n/config';
import { cacheGetOrSet, cacheInvalidateTag, CacheTags, CacheTTL } from '@/lib/cache';
import { createCategorySchema } from '@/lib/validations/category';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { apiSuccess, apiError, withETag } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

// GET - Liste des catégories
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/categories');
    if (!rl.success) {
      const res = apiError(rl.error!.message, ErrorCode.RATE_LIMITED, { request });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

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
      return withETag({ categories: treeCategories }, request, {
        cacheControl: 'public, s-maxage=600, stale-while-revalidate=1200',
      });
    }

    return withETag({ categories }, request, {
      cacheControl: 'public, s-maxage=600, stale-while-revalidate=1200',
    });
  } catch (error) {
    logger.error('Error fetching categories', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la récupération des catégories', ErrorCode.INTERNAL_ERROR, { request });
  }
}

// POST - Créer une catégorie (Admin/Owner seulement)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/categories');
    if (!rl.success) {
      const res = apiError(rl.error!.message, ErrorCode.RATE_LIMITED, { request });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return apiError('Invalid CSRF token', ErrorCode.CSRF_INVALID, { request });
    }

    const session = await auth();

    if (!session?.user) {
      return apiError('Non autorisé', ErrorCode.UNAUTHORIZED, { request });
    }

    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return apiError('Accès refusé', ErrorCode.FORBIDDEN, { request });
    }

    const body = await request.json();

    // BUG-004 FIX: Validate with Zod schema instead of simple truthy checks
    const validation = createCategorySchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        validation.error.errors[0]?.message || 'Invalid category data',
        ErrorCode.VALIDATION_ERROR,
        { request, details: validation.error.errors }
      );
    }
    const { name, slug, description, imageUrl, sortOrder, parentId } = validation.data;

    // Vérifier l'unicité du slug
    const existingCategory = await prisma.category.findUnique({
      where: { slug },
    });

    if (existingCategory) {
      return apiError('Ce slug existe déjà', ErrorCode.DUPLICATE_ENTRY, { request });
    }

    // Validate parentId if provided
    if (parentId) {
      const parentCategory = await prisma.category.findUnique({ where: { id: parentId } });
      if (!parentCategory) {
        return apiError('Catégorie parent non trouvée', ErrorCode.VALIDATION_ERROR, { request });
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

    // Revalidate cached pages after category creation
    try { revalidatePath('/shop', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath('/api/categories', 'layout'); } catch { /* revalidation is best-effort */ }

    return apiSuccess({ category }, { status: 201, request });
  } catch (error) {
    logger.error('Error creating category', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la création de la catégorie', ErrorCode.INTERNAL_ERROR, { request });
  }
}
