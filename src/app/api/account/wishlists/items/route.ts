export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';

/**
 * GET /api/account/wishlists/items?collectionId=...
 * Returns wishlist items for a specific collection with product details
 */
export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const collectionId = searchParams.get('collectionId');

    if (!collectionId) {
      return NextResponse.json(
        { error: 'collectionId is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const collection = await prisma.wishlistCollection.findFirst({
      where: {
        id: collectionId,
        userId: session.user.id,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    const items = await prisma.wishlistItem.findMany({
      where: { collectionId },
      orderBy: { createdAt: 'desc' },
    });

    if (items.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Fetch product details
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        formats: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
          take: 1,
        },
        category: {
          select: { name: true, slug: true },
        },
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Combine items with product details
    const enrichedItems = items
      .map((item) => {
        const product = productMap.get(item.productId);
        if (!product) return null;

        const primaryImage = product.images[0];
        const lowestFormat = product.formats[0];

        return {
          id: item.id,
          productId: product.id,
          collectionId: item.collectionId,
          createdAt: item.createdAt.toISOString(),
          product: {
            name: product.name,
            slug: product.slug,
            imageUrl: primaryImage?.url || product.imageUrl || null,
            price: lowestFormat ? Number(lowestFormat.price) : Number(product.price),
            comparePrice: lowestFormat?.comparePrice
              ? Number(lowestFormat.comparePrice)
              : null,
            purity: product.purity ? Number(product.purity) : null,
            isActive: product.isActive,
            inStock: lowestFormat ? lowestFormat.inStock : false,
            category: product.category?.name || null,
            categorySlug: product.category?.slug || null,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items: enrichedItems });
  } catch (error) {
    console.error('Error fetching wishlist items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wishlist items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/account/wishlists/items
 * Add a product to a wishlist collection
 * Body: { collectionId: string, productId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { collectionId, productId } = await request.json();

    if (!collectionId || !productId) {
      return NextResponse.json(
        { error: 'collectionId and productId are required' },
        { status: 400 }
      );
    }

    // Verify collection ownership
    const collection = await prisma.wishlistCollection.findFirst({
      where: {
        id: collectionId,
        userId: session.user.id,
      },
    });

    if (!collection) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check for duplicates
    const existing = await prisma.wishlistItem.findUnique({
      where: {
        collectionId_productId: {
          collectionId,
          productId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { message: 'Product already in this wishlist', id: existing.id },
        { status: 200 }
      );
    }

    // Add to wishlist
    const item = await prisma.wishlistItem.create({
      data: {
        collectionId,
        productId,
      },
    });

    return NextResponse.json(
      { message: 'Added to wishlist', id: item.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to add to wishlist' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/account/wishlists/items
 * Move item to a different wishlist collection
 * Body: { itemId: string, newCollectionId: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId, newCollectionId } = await request.json();

    if (!itemId || !newCollectionId) {
      return NextResponse.json(
        { error: 'itemId and newCollectionId are required' },
        { status: 400 }
      );
    }

    // Verify item exists and get current collection
    const item = await prisma.wishlistItem.findUnique({
      where: { id: itemId },
      include: {
        collection: true,
      },
    });

    if (!item || item.collection.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Wishlist item not found' },
        { status: 404 }
      );
    }

    // Verify new collection ownership
    const newCollection = await prisma.wishlistCollection.findFirst({
      where: {
        id: newCollectionId,
        userId: session.user.id,
      },
    });

    if (!newCollection) {
      return NextResponse.json(
        { error: 'Target wishlist not found' },
        { status: 404 }
      );
    }

    // Check if product already exists in target collection
    const existingInTarget = await prisma.wishlistItem.findUnique({
      where: {
        collectionId_productId: {
          collectionId: newCollectionId,
          productId: item.productId,
        },
      },
    });

    if (existingInTarget) {
      // Delete the original item since it would be a duplicate
      await prisma.wishlistItem.delete({
        where: { id: itemId },
      });

      return NextResponse.json({
        message: 'Item already exists in target wishlist, duplicate removed',
        id: existingInTarget.id,
      });
    }

    // Move the item
    const updated = await prisma.wishlistItem.update({
      where: { id: itemId },
      data: { collectionId: newCollectionId },
    });

    return NextResponse.json({
      message: 'Item moved to another wishlist',
      id: updated.id,
    });
  } catch (error) {
    console.error('Error moving wishlist item:', error);
    return NextResponse.json(
      { error: 'Failed to move wishlist item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account/wishlists/items?id=...
 * Remove item from wishlist
 */
export async function DELETE(request: NextRequest) {
  try {
    // SECURITY (BE-SEC-15): CSRF protection for mutation endpoint
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Item ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership through collection
    const item = await prisma.wishlistItem.findUnique({
      where: { id },
      include: {
        collection: true,
      },
    });

    if (!item || item.collection.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Wishlist item not found' },
        { status: 404 }
      );
    }

    await prisma.wishlistItem.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Error removing wishlist item:', error);
    return NextResponse.json(
      { error: 'Failed to remove from wishlist' },
      { status: 500 }
    );
  }
}
