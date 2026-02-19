export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { db } from '@/lib/db';
import { validateCsrf } from '@/lib/csrf-middleware';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/account/wishlist/[id]
 * Removes a wishlist item by its ID, verifying ownership
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;

    // Find the wishlist item and verify ownership
    const wishlistItem = await db.wishlist.findUnique({
      where: { id },
    });

    if (!wishlistItem) {
      return NextResponse.json(
        { error: 'Wishlist item not found' },
        { status: 404 }
      );
    }

    if (wishlistItem.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete the wishlist item
    await db.wishlist.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Removed from wishlist' });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    return NextResponse.json(
      { error: 'Failed to remove from wishlist' },
      { status: 500 }
    );
  }
}
