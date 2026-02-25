export const dynamic = 'force-dynamic';
/**
 * API - CRUD Produit individuel (version enrichie)
 */

import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { UserRole } from '@/types';
import { enqueue, withTranslation, getTranslatedFields, DB_SOURCE_LOCALE } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';
import { apiSuccess, apiError, apiNoContent, withETag, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';
import { validateCsrf } from '@/lib/csrf-middleware';
import { rateLimitMiddleware } from '@/lib/rate-limiter';

const updateProductSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  subtitle: z.string().max(300).optional(),
  slug: z.string().min(1).max(300).optional(),
  shortDescription: z.string().max(1000).optional(),
  description: z.string().max(10000).optional(),
  fullDetails: z.string().max(50000).optional(),
  specifications: z.string().max(10000).optional(),
  productType: z.string().max(100).optional(),
  price: z.number().min(0).optional(),
  compareAtPrice: z.number().min(0).optional().nullable(),
  purity: z.number().min(0).max(100).optional().nullable(),
  aminoSequence: z.string().max(5000).optional().nullable(),
  molecularWeight: z.string().max(200).optional().nullable(),
  casNumber: z.string().max(100).optional().nullable(),
  molecularFormula: z.string().max(500).optional().nullable(),
  storageConditions: z.string().max(500).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  videoUrl: z.string().max(500).optional().nullable(),
  certificateUrl: z.string().max(500).optional().nullable(),
  certificateName: z.string().max(200).optional().nullable(),
  dataSheetUrl: z.string().max(500).optional().nullable(),
  dataSheetName: z.string().max(200).optional().nullable(),
  coaUrl: z.string().max(500).optional().nullable(),
  msdsUrl: z.string().max(500).optional().nullable(),
  hplcUrl: z.string().max(500).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  trackInventory: z.boolean().optional(),
  allowBackorder: z.boolean().optional(),
  weight: z.number().min(0).optional().nullable(),
  dimensions: z.string().max(200).optional().nullable(),
  requiresShipping: z.boolean().optional(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  origin: z.string().max(200).optional().nullable(),
  supplierUrl: z.string().max(500).optional().nullable(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  researchSays: z.string().max(10000).optional().nullable(),
  relatedResearch: z.string().max(10000).optional().nullable(),
  participateResearch: z.string().max(10000).optional().nullable(),
  customSections: z.unknown().optional().nullable(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isNew: z.boolean().optional(),
  isBestseller: z.boolean().optional(),
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().optional(),
    caption: z.string().optional(),
    sortOrder: z.number().optional(),
    isPrimary: z.boolean().optional(),
  })).optional(),
  formats: z.array(z.record(z.unknown())).optional(),
}).passthrough();

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Détail d'un produit
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const locale = request.nextUrl.searchParams.get('locale') || defaultLocale;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, slug: true, parentId: true, imageUrl: true },
        },
        modules: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, url: true, alt: true, caption: true, sortOrder: true, isPrimary: true },
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      return apiError('Produit non trouvé', ErrorCode.NOT_FOUND, { request });
    }

    // BUG-011 FIX: Non-admin users should not see inactive products
    if (!product.isActive) {
      const session = await auth();
      if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
        return apiError('Produit non trouvé', ErrorCode.NOT_FOUND, { request });
      }
    }

    // Apply translations
    let translated = locale !== DB_SOURCE_LOCALE
      ? await withTranslation(product, 'Product', locale)
      : product;

    // Also translate nested category
    if (locale !== DB_SOURCE_LOCALE && translated.category) {
      const catTrans = await getTranslatedFields('Category', translated.category.id, locale);
      if (catTrans?.name) {
        translated = { ...translated, category: { ...translated.category, name: catTrans.name } };
      }
    }

    // Item 3: ETag support for caching
    return withETag({ product: translated }, request);
  } catch (error) {
    logger.error('Error fetching product', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la récupération du produit', ErrorCode.INTERNAL_ERROR, { request });
  }
}

// PUT - Mettre à jour un produit
// Status codes: 200 OK, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 409 Conflict, 415 Unsupported Media Type, 500 Internal Error
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/products');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

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
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return apiError('Invalid data', ErrorCode.VALIDATION_ERROR, { request });
    }

    const { images, formats } = parsed.data;

    // Whitelist: only allow safe fields to be updated (H13 - mass assignment fix)
    const allowedProductFields = [
      'name', 'subtitle', 'slug', 'shortDescription', 'description', 'fullDetails',
      'specifications', 'productType', 'price', 'compareAtPrice',
      'purity', 'aminoSequence', 'molecularWeight', 'casNumber', 'molecularFormula',
      'storageConditions',
      'imageUrl', 'videoUrl',
      'certificateUrl', 'certificateName', 'dataSheetUrl', 'dataSheetName',
      'coaUrl', 'msdsUrl', 'hplcUrl',
      'categoryId',
      'trackInventory', 'allowBackorder',
      'weight', 'dimensions', 'requiresShipping', 'sku', 'barcode', 'manufacturer', 'origin', 'supplierUrl',
      'metaTitle', 'metaDescription', 'tags',
      'researchSays', 'relatedResearch', 'participateResearch', 'customSections',
      'isActive', 'isFeatured', 'isNew', 'isBestseller',
    ] as const;
    const productData: Record<string, unknown> = {};
    const data = parsed.data as Record<string, unknown>;
    for (const field of allowedProductFields) {
      if (data[field] !== undefined) {
        productData[field] = data[field];
      }
    }

    // Vérifier que le produit existe
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        images: { select: { id: true } },
        formats: { select: { id: true } },
      },
    });

    if (!existingProduct) {
      return apiError('Produit non trouvé', ErrorCode.NOT_FOUND, { request });
    }

    // Si le slug change, vérifier l'unicité
    if (productData.slug && productData.slug !== existingProduct.slug) {
      const slugExists = await prisma.product.findUnique({
        where: { slug: productData.slug as string },
        select: { id: true },
      });
      if (slugExists) {
        return apiError('Ce slug existe déjà', ErrorCode.DUPLICATE_ENTRY, { status: 409, request });
      }
    }

    // Transaction pour mise à jour atomique
    const product = await prisma.$transaction(async (tx) => {
      // Supprimer les anciennes images si nouvelles fournies
      if (images !== undefined) {
        await tx.productImage.deleteMany({
          where: { productId: id },
        });
        
        // Créer les nouvelles images
        if (images && images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((img: { url: string; alt?: string; caption?: string; sortOrder?: number; isPrimary?: boolean }, index: number) => ({
              productId: id,
              url: img.url,
              alt: img.alt || '',
              caption: img.caption || '',
              sortOrder: img.sortOrder ?? index,
              isPrimary: img.isPrimary || false,
            })),
          });
        }
      }

      // BUG 12: Use upsert pattern for formats to avoid breaking FK constraints
      // Instead of deleteMany + createMany, update existing, create new, deactivate removed
      if (formats !== undefined) {
        const incomingFormatIds = (formats || [])
          .filter((f: Record<string, unknown>) => f.id)
          .map((f: Record<string, unknown>) => f.id as string);

        // Deactivate formats that are no longer in the incoming list (instead of deleting)
        if (existingProduct.formats.length > 0) {
          const existingIds = existingProduct.formats.map(f => f.id);
          const removedIds = existingIds.filter(eid => !incomingFormatIds.includes(eid));
          if (removedIds.length > 0) {
            await tx.productFormat.updateMany({
              where: { id: { in: removedIds } },
              data: { isActive: false },
            });
          }
        }

        // Upsert each format: update if it has an id, create if new
        if (formats && formats.length > 0) {
          for (let index = 0; index < formats.length; index++) {
            const f = formats[index] as Record<string, unknown>;
            const formatData = {
              productId: id,
              formatType: ((f.formatType as string) || 'VIAL_2ML') as import('@prisma/client').FormatType,
              name: f.name as string,
              description: (f.description as string) || '',
              imageUrl: (f.imageUrl as string) || null,
              dosageMg: f.dosageMg ? Number(f.dosageMg) : null,
              volumeMl: f.volumeMl ? Number(f.volumeMl) : null,
              unitCount: f.unitCount ? Number(f.unitCount) : null,
              costPrice: f.costPrice ? Number(f.costPrice) : null,
              price: Number(f.price) || 0,
              comparePrice: f.comparePrice ? Number(f.comparePrice) : null,
              sku: (f.sku as string) || null,
              barcode: (f.barcode as string) || null,
              inStock: f.inStock !== false,
              stockQuantity: Number(f.stockQuantity) || 0,
              lowStockThreshold: f.lowStockThreshold != null ? Number(f.lowStockThreshold) : 5,
              availability: ((f.availability as string) || 'IN_STOCK') as import('@prisma/client').StockStatus,
              sortOrder: f.sortOrder != null ? Number(f.sortOrder) : index,
              isDefault: !!f.isDefault,
              isActive: f.isActive !== false,
            };

            if (f.id && typeof f.id === 'string') {
              // Update existing format
              await tx.productFormat.update({
                where: { id: f.id },
                data: formatData,
              });
            } else {
              // Create new format
              await tx.productFormat.create({
                data: formatData,
              });
            }
          }
        }
      }

      // Mettre à jour le produit
      return tx.product.update({
        where: { id },
        data: productData,
        include: { 
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
          formats: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entityType: 'Product',
        entityId: product.id,
        details: JSON.stringify({
          fields: Object.keys(productData),
          imagesCount: images?.length,
          formatsCount: formats?.length,
        }),
      },
    });

    // Re-translate product in all locales (force overwrite existing translations)
    enqueue.productUrgent(product.id);

    // Revalidate cached pages after product update
    try { revalidatePath('/shop', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath('/api/products', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath(`/product/${product.slug}`, 'page'); } catch { /* revalidation is best-effort */ }

    return apiSuccess({ product }, { request });
  } catch (error) {
    logger.error('Error updating product', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la mise à jour du produit', ErrorCode.INTERNAL_ERROR, { request });
  }
}

// DELETE - Supprimer un produit (soft delete)
// Status codes: 204 No Content, 401 Unauthorized, 403 Forbidden, 500 Internal Error
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/products');
    if (!rl.success) { const res = NextResponse.json({ error: rl.error!.message }, { status: 429 }); Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v)); return res; }

    // CSRF protection
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return apiError('Non autorisé', ErrorCode.UNAUTHORIZED);
    }

    if (session.user.role !== UserRole.OWNER) {
      return apiError('Accès refusé', ErrorCode.FORBIDDEN);
    }

    const deletedProduct = await prisma.product.update({
      where: { id },
      data: { isActive: false },
      select: { slug: true },
    });

    // Revalidate cached pages after product deletion
    try { revalidatePath('/shop', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath('/api/products', 'layout'); } catch { /* revalidation is best-effort */ }
    try { revalidatePath(`/product/${deletedProduct.slug}`, 'page'); } catch { /* revalidation is best-effort */ }

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'Product',
        entityId: id,
      },
    });

    // Item 2: HTTP 204 No Content for DELETE operations
    return apiNoContent();
  } catch (error) {
    logger.error('Error deleting product', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la suppression du produit', ErrorCode.INTERNAL_ERROR);
  }
}
