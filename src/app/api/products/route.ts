/**
 * API - CRUD Produits (version enrichie)
 * Gère: formations, produits physiques, hybrides
 * Avec: images multiples, formats, certificats, fiche technique
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

// GET - Liste des produits
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const productType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: any = {};
    
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

    const products = await prisma.product.findMany({
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

    return NextResponse.json({ products });
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
      // Formation
      duration,
      level,
      language,
      instructor,
      prerequisites,
      objectives,
      targetAudience,
      // Physique
      weight,
      dimensions,
      requiresShipping,
      sku,
      barcode,
      manufacturer,
      origin,
      // SEO
      metaTitle,
      metaDescription,
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
        // Formation
        duration,
        level,
        language: language || 'fr',
        instructor,
        prerequisites,
        objectives,
        targetAudience,
        // Physique
        weight,
        dimensions,
        requiresShipping: requiresShipping || false,
        sku,
        barcode,
        manufacturer,
        origin,
        // SEO
        metaTitle,
        metaDescription,
        // Status
        isFeatured: isFeatured || false,
        isActive: isActive !== undefined ? isActive : true,
        // Images
        images: images && images.length > 0 ? {
          create: images.map((img: any, index: number) => ({
            url: img.url,
            alt: img.alt || '',
            caption: img.caption || '',
            sortOrder: img.sortOrder ?? index,
            isPrimary: img.isPrimary || false,
          })),
        } : undefined,
        // Formats
        formats: formats && formats.length > 0 ? {
          create: formats.map((f: any, index: number) => ({
            name: f.name,
            description: f.description || '',
            price: f.price || null,
            sku: f.sku || '',
            downloadUrl: f.downloadUrl || '',
            fileSize: f.fileSize || '',
            inStock: f.inStock !== false,
            stockQuantity: f.stockQuantity || null,
            sortOrder: f.sortOrder ?? index,
            isDefault: f.isDefault || false,
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

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du produit' },
      { status: 500 }
    );
  }
}
