export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';

// GET single bundle by ID
export const GET = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const bundle = await prisma.bundle.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                formats: true,
              },
            },
          },
        },
      },
    });

    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error fetching bundle:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bundle' },
      { status: 500 }
    );
  }
});

// PATCH update bundle
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { name, slug, description, image, discount, isActive, items } = body;

    // Check if bundle exists
    const existingBundle = await prisma.bundle.findUnique({
      where: { id },
    });

    if (!existingBundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }

    // If slug is being changed, check if it's unique
    if (slug && slug !== existingBundle.slug) {
      const slugExists = await prisma.bundle.findUnique({
        where: { slug },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'Bundle with this slug already exists' },
          { status: 400 }
        );
      }
    }

    // Update bundle
    const updateData: {
      name?: string;
      slug?: string;
      description?: string | null;
      image?: string | null;
      discount?: number;
      isActive?: boolean;
    } = {};

    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (discount !== undefined) updateData.discount = discount;
    if (isActive !== undefined) updateData.isActive = isActive;

    const bundle = await prisma.bundle.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              include: {
                formats: true,
              },
            },
          },
        },
      },
    });

    // If items are provided, update them
    if (items) {
      // Delete existing items
      await prisma.bundleItem.deleteMany({
        where: { bundleId: id },
      });

      // Create new items
      await prisma.bundleItem.createMany({
        data: items.map((item: { productId: string; formatId?: string; quantity: number }) => ({
          bundleId: id,
          productId: item.productId,
          formatId: item.formatId || null,
          quantity: item.quantity || 1,
        })),
      });
    }

    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error updating bundle:', error);
    return NextResponse.json(
      { error: 'Failed to update bundle' },
      { status: 500 }
    );
  }
});

// DELETE bundle
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const bundle = await prisma.bundle.findUnique({
      where: { id },
    });

    if (!bundle) {
      return NextResponse.json(
        { error: 'Bundle not found' },
        { status: 404 }
      );
    }

    await prisma.bundle.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bundle:', error);
    return NextResponse.json(
      { error: 'Failed to delete bundle' },
      { status: 500 }
    );
  }
});
