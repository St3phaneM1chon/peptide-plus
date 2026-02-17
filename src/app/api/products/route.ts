export const dynamic = 'force-dynamic';
/**
 * API - CRUD Produits (version enrichie)
 * Gère: formations, produits physiques, hybrides
 * Avec: images multiples, formats, certificats, fiche technique
 * Supporte: ?locale=fr pour contenu traduit
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { withTranslations, getTranslatedFields, enqueue, DB_SOURCE_LOCALE } from '@/lib/translation';
import { isValidLocale, defaultLocale } from '@/i18n/config';

// GET - Liste des produits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const productType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const locale = searchParams.get('locale') || defaultLocale;

    const where: Record<string, unknown> = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (category) {
      where.category = { slug: category };
    }

    if (featured === 'true') {
      where.isFeatured = true;
    }

    if (productType) {
      where.productType = productType;
    }

    let products = await prisma.product.findMany({
      where,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Apply translations if locale is not default
    if (isValidLocale(locale) && locale !== DB_SOURCE_LOCALE) {
      products = await withTranslations(products, 'Product', locale);

      // Also translate nested category names
      const categoryIds = [...new Set(products.map(p => (p as Record<string, unknown> & { category?: { id: string } }).category?.id).filter(Boolean))] as string[];
      const categoryTranslations = new Map<string, Record<string, string>>();
      await Promise.all(
        categoryIds.map(async (catId) => {
          const translated = await getTranslatedFields('Category', catId, locale);
          if (translated) categoryTranslations.set(catId, translated);
        })
      );

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

    return NextResponse.json({ products }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des produits' },
      { status: 500 }
    );
  }
}

// POST - Créer un produit (Admin/Owner seulement)
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
    const {
      // Base
      name,
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
    } = body;

    // Validation
    if (!name || !slug || !price || !categoryId) {
      return NextResponse.json(
        { error: 'Champs requis: name, slug, price, categoryId' },
        { status: 400 }
      );
    }

    // Vérifier l'unicité du slug
    const existingProduct = await prisma.product.findUnique({
      where: { slug },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Ce slug existe déjà' },
        { status: 400 }
      );
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
        productType: productType || 'DIGITAL',
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

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du produit' },
      { status: 500 }
    );
  }
}
