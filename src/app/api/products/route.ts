export const dynamic = 'force-dynamic';
/**
 * API - CRUD Produits (version enrichie)
 * Gère: formations, produits physiques, hybrides
 * Avec: images multiples, formats, certificats, fiche technique
 * Supporte: ?locale=fr pour contenu traduit
 */

import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { UserRole } from '@/types';
import { withTranslations, getTranslatedFieldsBatch, enqueue, DB_SOURCE_LOCALE } from '@/lib/translation';
import { isValidLocale, defaultLocale } from '@/i18n/config';
import { z } from 'zod';
import { stripHtml, stripControlChars } from '@/lib/sanitize';
import { apiSuccess, apiError, withETag, validateContentType } from '@/lib/api-response';
import { ErrorCode } from '@/lib/error-codes';

// BE-SEC-03: Zod validation schema for product creation (admin)
const productImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().max(500).optional(),
  caption: z.string().max(500).optional(),
  sortOrder: z.number().int().optional(),
  isPrimary: z.boolean().optional(),
});

const productFormatSchema = z.object({
  formatType: z.string().max(50).optional(),
  name: z.string().max(200),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional().nullable(),
  dosageMg: z.number().optional().nullable(),
  volumeMl: z.number().optional().nullable(),
  unitCount: z.number().int().optional().nullable(),
  costPrice: z.number().optional().nullable(),
  price: z.number().min(0).optional(),
  comparePrice: z.number().optional().nullable(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  inStock: z.boolean().optional(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  availability: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200, 'Product name must not exceed 200 characters'),
  subtitle: z.string().max(500).optional().nullable(),
  slug: z.string().min(1, 'Slug is required').max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  shortDescription: z.string().max(1000).optional().nullable(),
  description: z.string().max(50000).optional().nullable(),
  fullDetails: z.string().max(100000).optional().nullable(),
  specifications: z.string().max(10000).optional().nullable(),
  productType: z.string().max(50).optional(),
  price: z.number().min(0, 'Price must be non-negative'),
  compareAtPrice: z.number().min(0).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
  videoUrl: z.string().max(2000).optional().nullable(),
  certificateUrl: z.string().max(2000).optional().nullable(),
  certificateName: z.string().max(200).optional().nullable(),
  dataSheetUrl: z.string().max(2000).optional().nullable(),
  dataSheetName: z.string().max(200).optional().nullable(),
  categoryId: z.string().min(1, 'Category is required'),
  weight: z.number().min(0).optional().nullable(),
  dimensions: z.string().max(100).optional().nullable(),
  requiresShipping: z.boolean().optional(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  origin: z.string().max(100).optional().nullable(),
  supplierUrl: z.string().max(2000).optional().nullable(),
  metaTitle: z.string().max(200).optional().nullable(),
  metaDescription: z.string().max(500).optional().nullable(),
  researchSays: z.string().max(50000).optional().nullable(),
  relatedResearch: z.string().max(50000).optional().nullable(),
  participateResearch: z.string().max(50000).optional().nullable(),
  customSections: z.unknown().optional().nullable(),
  isFeatured: z.boolean().optional(),
  isActive: z.boolean().optional(),
  images: z.array(productImageSchema).max(50).optional(),
  formats: z.array(productFormatSchema).max(50).optional(),
});

// GET - Liste des produits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const productType = searchParams.get('type');
    const slugs = searchParams.get('slugs');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50), 200);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const locale = searchParams.get('locale') || defaultLocale;

    // #58: Faceted search params
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const minRating = searchParams.get('minRating');
    const inStock = searchParams.get('inStock');
    const categoryIds = searchParams.get('categoryIds');
    const tags = searchParams.get('tags');
    const withFacets = searchParams.get('facets') === 'true';

    // SEC-22: Require admin auth when includeInactive=true
    if (includeInactive) {
      const session = await auth();
      if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
        return apiError('Admin authentication required to view inactive products', ErrorCode.FORBIDDEN, { request });
      }
    }

    // Item 11: Optional field selection via ?fields=name,price,slug
    // TODO: Use fieldSelect to filter response fields
    // parseFieldSelection(request, [
    //   'id', 'name', 'subtitle', 'slug', 'shortDescription', 'description',
    //   'productType', 'price', 'compareAtPrice', 'imageUrl', 'videoUrl',
    //   'categoryId', 'isFeatured', 'isActive', 'createdAt', 'updatedAt',
    //   'sku', 'barcode', 'weight', 'manufacturer', 'origin', 'purity',
    //   'metaTitle', 'metaDescription',
    // ]);

    const where: Record<string, unknown> = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    // Filter by specific slugs (comma-separated)
    if (slugs) {
      const slugList = slugs.split(',').filter(Boolean).slice(0, 20);
      where.slug = { in: slugList };
    }

    if (category) {
      // Check if this is a parent category - if so, include all children
      const cat = await prisma.category.findUnique({
        where: { slug: category },
        include: { children: { select: { id: true } } },
      });
      if (cat) {
        if (cat.children.length > 0) {
          // Parent category: include products from all children
          const categoryIds = [cat.id, ...cat.children.map(c => c.id)];
          where.categoryId = { in: categoryIds };
        } else {
          where.category = { slug: category };
        }
      } else {
        where.category = { slug: category };
      }
    }

    if (featured === 'true') {
      where.isFeatured = true;
    }

    if (productType) {
      where.productType = productType;
    }

    // #58: Faceted search filters (validate NaN)
    if (minPrice || maxPrice) {
      where.price = {};
      const minPriceVal = parseFloat(minPrice || '');
      const maxPriceVal = parseFloat(maxPrice || '');
      if (minPrice && !isNaN(minPriceVal) && minPriceVal >= 0) (where.price as Record<string, unknown>).gte = minPriceVal;
      if (maxPrice && !isNaN(maxPriceVal) && maxPriceVal >= 0) (where.price as Record<string, unknown>).lte = maxPriceVal;
    }

    if (minRating) {
      where.averageRating = { gte: parseFloat(minRating) };
    }

    if (inStock === 'true') {
      where.formats = { some: { isActive: true, stockQuantity: { gt: 0 } } };
    }

    if (categoryIds) {
      const ids = categoryIds.split(',').filter(Boolean).slice(0, 20);
      if (ids.length > 0) {
        where.categoryId = { in: ids };
      }
    }

    if (tags) {
      const tagList = tags.split(',').filter(Boolean).slice(0, 10);
      if (tagList.length > 0) {
        // Tags stored as comma-separated string in Product.tags
        where.OR = [
          ...(Array.isArray(where.OR) ? where.OR as Record<string, unknown>[] : []),
          ...tagList.map(tag => ({ tags: { contains: tag, mode: 'insensitive' as const } })),
        ];
      }
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, slug: true, parentId: true, parent: { select: { id: true, name: true, slug: true } } },
        },
        // PERF 89: For list view, only fetch the primary image to reduce payload for large catalogs
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Apply translations if locale is not default
    if (isValidLocale(locale) && locale !== DB_SOURCE_LOCALE) {
      products = await withTranslations(products, 'Product', locale);

      // Also translate nested category names (batch query instead of N+1)
      const categoryIds = [...new Set(products.map(p => (p as Record<string, unknown> & { category?: { id: string } }).category?.id).filter(Boolean))] as string[];
      const categoryTranslations = new Map<string, Record<string, string>>();
      if (categoryIds.length > 0) {
        const batchResult = await getTranslatedFieldsBatch('Category', categoryIds, locale);
        for (const [catId, trans] of batchResult) {
          if (trans) categoryTranslations.set(catId, trans);
        }
      }

      // Apply category translations to each product
      products = products.map(p => {
        const product = p as Record<string, unknown> & { category?: { id: string; name: string; slug: string } };
        if (product.category && categoryTranslations.has(product.category.id)) {
          const catTrans = categoryTranslations.get(product.category.id)!;
          return {
            ...p,
            category: {
              ...product.category,
              name: catTrans.name || product.category.name,
            },
          };
        }
        return p;
      });
    }

    // #58: Compute facets if requested
    let facets: Record<string, unknown> | undefined;
    if (withFacets) {
      const [facetCategories, priceAgg, ratingGroups] = await Promise.all([
        // Category facets with counts
        prisma.category.findMany({
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { products: { where: { isActive: true } } } },
          },
          orderBy: { sortOrder: 'asc' },
        }),
        // Price range
        prisma.product.aggregate({
          where: { isActive: true },
          _min: { price: true },
          _max: { price: true },
        }),
        // Rating distribution
        prisma.product.groupBy({
          by: ['averageRating'],
          where: { isActive: true, averageRating: { not: null } },
          _count: true,
        }),
      ]);

      // Build rating distribution (1-5 stars)
      const ratings: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const g of ratingGroups) {
        const r = Math.round(Number(g.averageRating ?? 0));
        if (r >= 1 && r <= 5) ratings[r] += g._count;
      }

      facets = {
        categories: facetCategories.map(c => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          count: c._count.products,
        })),
        priceRange: {
          min: Number(priceAgg._min.price ?? 0),
          max: Number(priceAgg._max.price ?? 0),
        },
        ratings,
      };
    }

    // Item 3: ETag support for caching
    const responseBody = facets ? { products, facets } : { products };
    return withETag(responseBody, request, {
      cacheControl: 'public, s-maxage=300, stale-while-revalidate=600',
    });
  } catch (error) {
    logger.error('Error fetching products', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la récupération des produits', ErrorCode.INTERNAL_ERROR, { request });
  }
}

// POST - Créer un produit (Admin/Owner seulement)
// Status codes: 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 500 Internal Error
export async function POST(request: NextRequest) {
  try {
    // Item 12: Content-Type validation
    const ctError = validateContentType(request);
    if (ctError) return ctError;

    const session = await auth();

    if (!session?.user) {
      return apiError('Non autorisé', ErrorCode.UNAUTHORIZED, { request });
    }

    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return apiError('Accès refusé', ErrorCode.FORBIDDEN, { request });
    }

    const body = await request.json();

    // BE-SEC-03 + Item 17: Validate product data with Zod schema
    const validation = createProductSchema.safeParse(body);
    if (!validation.success) {
      return apiError(
        validation.error.errors[0]?.message || 'Invalid product data',
        ErrorCode.VALIDATION_ERROR,
        { details: validation.error.errors.map(e => ({ path: e.path.join('.'), message: e.message })), request }
      );
    }

    // BUG-001 FIX: Use validated data from Zod instead of raw body to prevent field injection
    const {
      // Base
      name: rawName,
      subtitle,
      slug,
      shortDescription,
      description,
      fullDetails,
      specifications,
      productType,
      // Prix
      price,
      compareAtPrice,
      // Médias
      imageUrl,
      videoUrl,
      // Documents
      certificateUrl,
      certificateName,
      dataSheetUrl,
      dataSheetName,
      // Catégorie
      categoryId,
      // Physique
      weight,
      dimensions,
      requiresShipping,
      sku,
      barcode,
      manufacturer,
      origin,
      supplierUrl,
      // SEO
      metaTitle,
      metaDescription,
      // Research content
      researchSays,
      relatedResearch,
      participateResearch,
      customSections,
      // Status
      isFeatured,
      isActive,
      // Relations
      images,
      formats,
    } = validation.data;

    // BE-SEC-03: Sanitize product name (strip HTML to prevent stored XSS in admin views)
    const name = stripControlChars(stripHtml(String(rawName))).trim();

    // BUG-014 FIX: Use explicit null/undefined checks instead of falsy checks (price=0 is valid for free samples)
    if (!name || !slug || (price === undefined || price === null) || !categoryId) {
      return apiError('Champs requis: name, slug, price, categoryId', ErrorCode.MISSING_FIELD, { request });
    }

    // Vérifier l'unicité du slug
    const existingProduct = await prisma.product.findUnique({
      where: { slug },
    });

    if (existingProduct) {
      return apiError('Ce slug existe déjà', ErrorCode.DUPLICATE_ENTRY, { status: 409, request });
    }

    // Créer le produit avec ses relations
    const product = await prisma.product.create({
      data: {
        // Base
        name,
        subtitle,
        slug,
        shortDescription,
        description,
        fullDetails,
        specifications,
        productType: productType || 'PEPTIDE',
        // Prix
        price,
        compareAtPrice,
        // Médias
        imageUrl,
        videoUrl,
        // Documents
        certificateUrl,
        certificateName,
        dataSheetUrl,
        dataSheetName,
        // Catégorie
        categoryId,
        // Physique
        weight,
        dimensions,
        requiresShipping: requiresShipping || false,
        sku,
        barcode,
        manufacturer,
        origin,
        supplierUrl,
        // SEO
        metaTitle,
        metaDescription,
        // Research content
        researchSays,
        relatedResearch,
        participateResearch,
        customSections,
        // Status
        isFeatured: isFeatured || false,
        isActive: isActive !== undefined ? isActive : true,
        // Images
        images: images && images.length > 0 ? {
          create: images.map((img: Record<string, unknown>, index: number) => ({
            url: img.url,
            alt: img.alt || '',
            caption: img.caption || '',
            sortOrder: img.sortOrder ?? index,
            isPrimary: img.isPrimary || false,
          })),
        } : undefined,
        // Formats
        formats: formats && formats.length > 0 ? {
          create: formats.map((f: Record<string, unknown>, index: number) => ({
            formatType: f.formatType || 'VIAL_2ML',
            name: f.name,
            description: f.description || '',
            imageUrl: f.imageUrl || null,
            dosageMg: f.dosageMg || null,
            volumeMl: f.volumeMl || null,
            unitCount: f.unitCount || null,
            costPrice: f.costPrice || null,
            price: f.price || 0,
            comparePrice: f.comparePrice || null,
            sku: f.sku || null,
            barcode: f.barcode || null,
            inStock: f.inStock !== false,
            stockQuantity: f.stockQuantity || 0,
            lowStockThreshold: f.lowStockThreshold ?? 5,
            availability: f.availability || 'IN_STOCK',
            sortOrder: f.sortOrder ?? index,
            isDefault: f.isDefault || false,
            isActive: f.isActive !== false,
          })),
        } : undefined,
      },
      include: { 
        category: true,
        images: true,
        formats: true,
      },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'Product',
        entityId: product.id,
        details: JSON.stringify({ name, slug, productType }),
      },
    });

    // Enqueue automatic translation to all locales
    enqueue.product(product.id);

    return apiSuccess({ product }, { status: 201, request });
  } catch (error) {
    logger.error('Error creating product', { error: error instanceof Error ? error.message : String(error) });
    return apiError('Erreur lors de la création du produit', ErrorCode.INTERNAL_ERROR, { request });
  }
}
