export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

// GET - List quantity discounts for a product
export async function GET(request: Request) {
  try {
    const session = await auth();

    // Check authentication and authorization
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    const discounts = await prisma.quantityDiscount.findMany({
      where: { productId },
      orderBy: { minQty: 'asc' },
    });

    // Convert Decimal to number for JSON serialization
    const formattedDiscounts = discounts.map(d => ({
      ...d,
      discount: Number(d.discount),
    }));

    return NextResponse.json({ discounts: formattedDiscounts });
  } catch (error) {
    console.error('Error fetching quantity discounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quantity discounts' },
      { status: 500 }
    );
  }
}

// POST - Create or update quantity discounts for a product
export async function POST(request: Request) {
  try {
    const session = await auth();

    // Check authentication and authorization
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { productId, tiers } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(tiers)) {
      return NextResponse.json(
        { error: 'tiers must be an array' },
        { status: 400 }
      );
    }

    // Validate product exists
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

    // Validate tiers
    for (const tier of tiers) {
      if (typeof tier.minQty !== 'number' || tier.minQty < 1) {
        return NextResponse.json(
          { error: 'Each tier must have a valid minQty (>= 1)' },
          { status: 400 }
        );
      }
      if (tier.maxQty !== null && tier.maxQty !== undefined && tier.maxQty < tier.minQty) {
        return NextResponse.json(
          { error: 'maxQty must be greater than or equal to minQty' },
          { status: 400 }
        );
      }
      if (typeof tier.discount !== 'number' || tier.discount < 0 || tier.discount > 100) {
        return NextResponse.json(
          { error: 'Discount must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    // Delete existing tiers and create new ones (replace all)
    await prisma.$transaction(async (tx) => {
      // Delete existing tiers
      await tx.quantityDiscount.deleteMany({
        where: { productId },
      });

      // Create new tiers
      if (tiers.length > 0) {
        await tx.quantityDiscount.createMany({
          data: tiers.map((tier: { minQty: number; maxQty?: number | null; discount: number }) => ({
            productId,
            minQty: tier.minQty,
            maxQty: tier.maxQty ?? null,
            discount: tier.discount,
          })),
        });
      }
    });

    // Fetch and return the updated tiers
    const updatedDiscounts = await prisma.quantityDiscount.findMany({
      where: { productId },
      orderBy: { minQty: 'asc' },
    });

    const formattedDiscounts = updatedDiscounts.map(d => ({
      ...d,
      discount: Number(d.discount),
    }));

    return NextResponse.json({
      success: true,
      discounts: formattedDiscounts,
    });
  } catch (error) {
    console.error('Error creating/updating quantity discounts:', error);
    return NextResponse.json(
      { error: 'Failed to save quantity discounts' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a specific quantity discount tier
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    // Check authentication and authorization
    if (!session?.user || !['OWNER', 'EMPLOYEE'].includes(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    await prisma.quantityDiscount.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Quantity discount tier deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting quantity discount:', error);
    return NextResponse.json(
      { error: 'Failed to delete quantity discount' },
      { status: 500 }
    );
  }
}
