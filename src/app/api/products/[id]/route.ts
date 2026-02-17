export const dynamic = 'force-dynamic';
/**
 * API - CRUD Produit individuel (version enrichie)
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';
import { enqueue, withTranslation, getTranslatedFields, DB_SOURCE_LOCALE } from '@/lib/translation';
import { defaultLocale } from '@/i18n/config';

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
        category: true,
        modules: {
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
        formats: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
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

    return NextResponse.json({ product: translated });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du produit' },
      { status: 500 }
    );
  }
}

// PUT - Mettre à jour un produit
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const body = await request.json();
    const { images, formats } = body;

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
    for (const field of allowedProductFields) {
      if (body[field] !== undefined) {
        productData[field] = body[field];
      }
    }

    // Vérifier que le produit existe
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      include: { images: true, formats: true },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Produit non trouvé' }, { status: 404 });
    }

    // Si le slug change, vérifier l'unicité
    if (productData.slug && productData.slug !== existingProduct.slug) {
      const slugExists = await prisma.product.findUnique({
        where: { slug: productData.slug as string },
      });
      if (slugExists) {
        return NextResponse.json(
          { error: 'Ce slug existe déjà' },
          { status: 400 }
        );
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

      // Supprimer les anciens formats si nouveaux fournis
      if (formats !== undefined) {
        await tx.productFormat.deleteMany({
          where: { productId: id },
        });
        
        // Créer les nouveaux formats
        if (formats && formats.length > 0) {
          await tx.productFormat.createMany({
            data: formats.map((f: Record<string, unknown>, index: number) => ({
              productId: id,
              formatType: (f.formatType as string) || 'VIAL_2ML',
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
              availability: (f.availability as string) || 'IN_STOCK',
              sortOrder: f.sortOrder != null ? Number(f.sortOrder) : index,
              isDefault: !!f.isDefault,
              isActive: f.isActive !== false,
            })),
          });
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

    return NextResponse.json({ product });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du produit' },
      { status: 500 }
    );
  }
}

// DELETE - Supprimer un produit (soft delete)
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE',
        entityType: 'Product',
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du produit' },
      { status: 500 }
    );
  }
}
