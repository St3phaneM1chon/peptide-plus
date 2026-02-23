export const dynamic = 'force-dynamic';
/**
 * API - CRUD Catégorie individuelle
 *
 * TODO (item 78): Return Policies per Product Category
 * Currently return/refund policy is global (SiteSettings.refundDays, refundProcessingDays).
 * Some product categories may need different policies (e.g., peptides: non-returnable once
 * opened, supplements: 30-day return, accessories: 60-day return).
 *
 * Implementation plan:
 *   - Add fields to Category model:
 *     returnPolicyDays     Int?       // Override global refundDays (null = use global)
 *     returnPolicyText     String?    // Custom policy text for this category
 *     isReturnable         Boolean    @default(true)  // Some categories are final sale
 *     restockingFeePercent Decimal?   // Optional restocking fee (e.g., 15%)
 *   - Update PUT handler above to accept these new fields in allowedFields
 *   - Create /api/admin/return-policies endpoint to view/manage all category policies
 *   - Update refund validation in /api/admin/orders/[id] to check category-level policy
 *   - Display category-specific return policy on product pages (frontend)
 *   - Update return request flow to validate against category policy
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { enqueue } from '@/lib/translation';
import { UserRole } from '@/types';
import { apiSuccess, apiError, apiNoContent, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
// BUG-017 FIX: Import cache invalidation
import { cacheInvalidateTag, CacheTags } from '@/lib/cache';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Détail d'une catégorie
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
        },
        children: {
          where: { isActive: true },
          include: {
            _count: { select: { products: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        parent: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return apiError('Catégorie non trouvée', ErrorCode.NOT_FOUND);
    }

    return apiSuccess({ category });
  } catch (error) {
    logger.error('Error fetching category', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la récupération de la catégorie', ErrorCode.INTERNAL_ERROR);
  }
}

// PUT - Mettre à jour une catégorie
// Status codes: 200 OK, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 415 Unsupported Media Type, 500 Internal Error
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Item 12: Content-Type validation
    const ctError = validateContentType(request);
    if (ctError) return ctError;

    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return apiError('Non autorisé', ErrorCode.UNAUTHORIZED, { request });
    }

    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return apiError('Accès refusé', ErrorCode.FORBIDDEN, { request });
    }

    const body = await request.json();

    // Whitelist: only allow safe fields to be updated (H11 - mass assignment fix)
    const allowedFields = ['name', 'slug', 'description', 'imageUrl', 'sortOrder', 'isActive', 'parentId'] as const;
    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Vérifier que la catégorie existe
    const existingCategory = await prisma.category.findUnique({
      where: { id },
    });

    if (!existingCategory) {
      return apiError('Catégorie non trouvée', ErrorCode.NOT_FOUND, { request });
    }

    // Si le slug change, vérifier l'unicité
    if (updateData.slug && updateData.slug !== existingCategory.slug) {
      const slugExists = await prisma.category.findUnique({
        where: { slug: updateData.slug as string },
      });
      if (slugExists) {
        return apiError('Ce slug existe déjà', ErrorCode.DUPLICATE_ENTRY, { status: 409, request });
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    // BUG-017 FIX: Invalidate category cache after update
    cacheInvalidateTag(CacheTags.CATEGORIES);

    // Auto-enqueue translation (force re-translate on update)
    enqueue.category(category.id, true);

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Category',
        entityId: category.id,
        details: JSON.stringify(updateData),
      },
    });

    return apiSuccess({ category }, { request });
  } catch (error) {
    logger.error('Error updating category', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la mise à jour de la catégorie', ErrorCode.INTERNAL_ERROR, { request });
  }
}

// DELETE - Supprimer une catégorie (soft delete, Owner only)
// Status codes: 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Error
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError('Non autorisé', ErrorCode.UNAUTHORIZED);
    }

    if (session.user.role !== UserRole.OWNER) {
      return apiError('Accès refusé', ErrorCode.FORBIDDEN);
    }

    const { id } = await params;

    // Vérifier si la catégorie a des produits ou des sous-catégories
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true, children: true },
        },
      },
    });

    if (!category) {
      return apiError('Catégorie non trouvée', ErrorCode.NOT_FOUND);
    }

    if (category._count.products > 0) {
      return apiError(`Impossible de supprimer: ${category._count.products} produit(s) associé(s)`, ErrorCode.CONFLICT);
    }

    if (category._count.children > 0) {
      return apiError(`Impossible de supprimer: ${category._count.children} sous-catégorie(s) associée(s)`, ErrorCode.CONFLICT);
    }

    await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'Category',
        entityId: id,
      },
    });

    // BUG-017 FIX: Invalidate category cache after deletion
    cacheInvalidateTag(CacheTags.CATEGORIES);

    // Item 2: HTTP 204 No Content for DELETE operations
    return apiNoContent();
  } catch (error) {
    logger.error('Error deleting category', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la suppression de la catégorie', ErrorCode.INTERNAL_ERROR);
  }
}
