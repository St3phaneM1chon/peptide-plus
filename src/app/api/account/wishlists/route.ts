export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';

/**
 * GET /api/account/wishlists
 * Returns all wishlists for the authenticated user with item counts
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const wishlists = await prisma.wishlistCollection.findMany({
      where: { userId: session.user.id },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    // Ensure user has at least one default wishlist
    if (wishlists.length === 0) {
      const defaultWishlist = await prisma.wishlistCollection.create({
        data: {
          userId: session.user.id,
          name: 'My Wishlist',
          isDefault: true,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });
      return NextResponse.json({ wishlists: [defaultWishlist] });
    }

    return NextResponse.json({ wishlists });
  } catch (error) {
    console.error('Error fetching wishlists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wishlists' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/account/wishlists
 * Create a new wishlist
 * Body: { name: string }
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

    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Name must be 100 characters or less' },
        { status: 400 }
      );
    }

    const wishlist = await prisma.wishlistCollection.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        isDefault: false,
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json(
      { wishlist, message: 'Wishlist created' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to create wishlist' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/account/wishlists
 * Rename a wishlist
 * Body: { id: string, name: string }
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

    const { id, name } = await request.json();

    if (!id || !name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'ID and name are required' },
        { status: 400 }
      );
    }

    if (name.trim().length > 100) {
      return NextResponse.json(
        { error: 'Name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Verify ownership
    const wishlist = await prisma.wishlistCollection.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.wishlistCollection.update({
      where: { id },
      data: { name: name.trim() },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    return NextResponse.json({
      wishlist: updated,
      message: 'Wishlist renamed',
    });
  } catch (error) {
    console.error('Error renaming wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to rename wishlist' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account/wishlists?id=...
 * Delete a wishlist (cannot delete default, items moved to default)
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
        { error: 'Wishlist ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership and check if default
    const wishlist = await prisma.wishlistCollection.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        items: true,
      },
    });

    if (!wishlist) {
      return NextResponse.json(
        { error: 'Wishlist not found' },
        { status: 404 }
      );
    }

    if (wishlist.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete default wishlist' },
        { status: 400 }
      );
    }

    // Find or create default wishlist
    let defaultWishlist = await prisma.wishlistCollection.findFirst({
      where: {
        userId: session.user.id,
        isDefault: true,
      },
    });

    if (!defaultWishlist) {
      defaultWishlist = await prisma.wishlistCollection.create({
        data: {
          userId: session.user.id,
          name: 'My Wishlist',
          isDefault: true,
        },
      });
    }

    // Move items to default wishlist
    if (wishlist.items.length > 0) {
      const itemsToMove = wishlist.items.map((item) => ({
        collectionId: defaultWishlist.id,
        productId: item.productId,
      }));

      // Use upsert to avoid duplicates
      for (const item of itemsToMove) {
        await prisma.wishlistItem.upsert({
          where: {
            collectionId_productId: {
              collectionId: item.collectionId,
              productId: item.productId,
            },
          },
          update: {},
          create: item,
        });
      }
    }

    // Delete the wishlist (cascade will delete items)
    await prisma.wishlistCollection.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Wishlist deleted',
      movedItems: wishlist.items.length,
    });
  } catch (error) {
    console.error('Error deleting wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to delete wishlist' },
      { status: 500 }
    );
  }
}
