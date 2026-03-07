import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';

const cartItemSchema = z.object({
  productId: z.string().min(1),
  formatId: z.string().optional(),
  quantity: z.number().int().min(1),
  price: z.number().min(0),
});

const cartSyncSchema = z.object({
  items: z.array(cartItemSchema),
});

// GET: Load cart from DB for authenticated user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ items: [] });
  }

  const cart = await prisma.cart.findUnique({
    where: { userId: session.user.id },
    include: {
      items: {
        select: {
          productId: true,
          formatId: true,
          quantity: true,
          priceAtAdd: true,
        },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  // Enrich with product names for display
  const productIds = [...new Set(cart.items.map(i => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, images: true },
  });
  const productMap = new Map(products.map(p => [p.id, p]));

  const items = cart.items.map(item => {
    const product = productMap.get(item.productId);
    return {
      productId: item.productId,
      formatId: item.formatId,
      quantity: item.quantity,
      price: Number(item.priceAtAdd),
      name: product?.name || 'Unknown Product',
      image: Array.isArray(product?.images) && product.images.length > 0 ? ((product.images[0] as Record<string, unknown>)?.url as string ?? undefined) : undefined,
    };
  });

  return NextResponse.json({ items });
}

// POST: Sync cart items to DB for authenticated user
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const raw = await request.json();
  const parsed = cartSyncSchema.safeParse(raw);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { items } = parsed.data;

  // Upsert cart
  const cart = await prisma.cart.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id },
    update: { updatedAt: new Date() },
  });

  // Delete existing items and replace with new ones
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  if (items.length > 0) {
    await prisma.cartItem.createMany({
      data: items.map((item: { productId: string; formatId?: string; quantity: number; price: number }) => ({
        cartId: cart.id,
        productId: item.productId,
        formatId: item.formatId || null,
        quantity: item.quantity,
        priceAtAdd: item.price,
      })),
    });
  }

  return NextResponse.json({ ok: true });
}
