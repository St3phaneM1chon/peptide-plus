/**
 * Public API v1 - Orders
 * GET  /api/v1/orders - List orders (paginated, filterable)
 * POST /api/v1/orders - Create a new order
 */

import { NextRequest } from 'next/server';
import { withApiAuth, jsonSuccess, jsonError } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';

export const GET = withApiAuth(async (request: NextRequest) => {
  const url = new URL(request.url);

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;

  const status = url.searchParams.get('status');
  const paymentStatus = url.searchParams.get('paymentStatus');
  const userId = url.searchParams.get('userId');
  const dateFrom = url.searchParams.get('dateFrom');
  const dateTo = url.searchParams.get('dateTo');
  const sortBy = url.searchParams.get('sortBy') || 'createdAt';
  const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (userId) where.userId = userId;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }

  const allowedSortFields = ['createdAt', 'updatedAt', 'total', 'orderNumber'];
  const orderByField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [orderByField]: sortOrder },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        subtotal: true,
        shippingCost: true,
        discount: true,
        tax: true,
        total: true,
        currencyId: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
        shippingName: true,
        shippingCity: true,
        shippingState: true,
        shippingCountry: true,
        carrier: true,
        trackingNumber: true,
        trackingUrl: true,
        shippedAt: true,
        deliveredAt: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            productId: true,
            productName: true,
            formatName: true,
            sku: true,
            quantity: true,
            unitPrice: true,
            discount: true,
            total: true,
          },
        },
        currency: {
          select: {
            code: true,
            symbol: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return jsonSuccess(orders, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}, 'orders:read');

export const POST = withApiAuth(async (request: NextRequest) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  // Validate required fields
  const requiredFields = ['shippingName', 'shippingAddress1', 'shippingCity', 'shippingState', 'shippingPostal', 'shippingCountry', 'items'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return jsonError(`Missing required field: ${field}`, 400);
    }
  }

  const items = body.items as Array<{ productId: string; formatId?: string; quantity: number }>;
  if (!Array.isArray(items) || items.length === 0) {
    return jsonError('Order must contain at least one item', 400);
  }

  // Validate items and calculate totals
  let subtotal = 0;
  const orderItems: Array<{
    productId: string;
    formatId: string | null;
    productName: string;
    formatName: string | null;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }> = [];

  for (const item of items) {
    if (!item.productId || !item.quantity || item.quantity < 1) {
      return jsonError('Each item must have productId and quantity >= 1', 400);
    }

    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: {
        id: true,
        name: true,
        price: true,
        sku: true,
        isActive: true,
        formats: {
          where: item.formatId ? { id: item.formatId } : undefined,
          select: {
            id: true,
            name: true,
            price: true,
            sku: true,
            inStock: true,
          },
        },
      },
    });

    if (!product || !product.isActive) {
      return jsonError(`Product ${item.productId} not found or inactive`, 400);
    }

    let unitPrice = Number(product.price);
    let formatName: string | null = null;
    let sku = product.sku;

    if (item.formatId && product.formats.length > 0) {
      const format = product.formats.find((f) => f.id === item.formatId);
      if (!format) {
        return jsonError(`Format ${item.formatId} not found for product ${item.productId}`, 400);
      }
      if (!format.inStock) {
        return jsonError(`Format ${item.formatId} is out of stock`, 400);
      }
      unitPrice = Number(format.price);
      formatName = format.name;
      sku = format.sku || sku;
    }

    const itemTotal = unitPrice * item.quantity;
    subtotal += itemTotal;

    orderItems.push({
      productId: item.productId,
      formatId: item.formatId || null,
      productName: product.name,
      formatName,
      sku: sku || null,
      quantity: item.quantity,
      unitPrice,
      discount: 0,
      total: itemTotal,
    });
  }

  // Get default currency
  const defaultCurrency = await prisma.currency.findFirst({
    where: { isDefault: true, isActive: true },
  });
  if (!defaultCurrency) {
    return jsonError('No default currency configured', 500);
  }

  // Generate order number
  const lastOrder = await prisma.order.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { orderNumber: true },
  });
  const nextNum = lastOrder
    ? parseInt(lastOrder.orderNumber.replace(/\D/g, ''), 10) + 1
    : 10001;
  const orderNumber = `BP-${String(nextNum).padStart(6, '0')}`;

  const shippingCost = typeof body.shippingCost === 'number' ? body.shippingCost : 0;
  const tax = typeof body.tax === 'number' ? body.tax : 0;
  const total = subtotal + shippingCost + tax;

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: typeof body.userId === 'string' ? body.userId : null,
      subtotal,
      shippingCost,
      discount: 0,
      tax,
      taxTps: typeof body.taxTps === 'number' ? body.taxTps : 0,
      taxTvq: typeof body.taxTvq === 'number' ? body.taxTvq : 0,
      taxTvh: typeof body.taxTvh === 'number' ? body.taxTvh : 0,
      taxPst: typeof body.taxPst === 'number' ? body.taxPst : 0,
      total,
      currencyId: defaultCurrency.id,
      status: 'PENDING',
      paymentStatus: 'PENDING',
      shippingName: body.shippingName as string,
      shippingAddress1: body.shippingAddress1 as string,
      shippingAddress2: (body.shippingAddress2 as string) || null,
      shippingCity: body.shippingCity as string,
      shippingState: body.shippingState as string,
      shippingPostal: body.shippingPostal as string,
      shippingCountry: (body.shippingCountry as string) || 'CA',
      shippingPhone: (body.shippingPhone as string) || null,
      customerNotes: (body.customerNotes as string) || null,
      items: {
        create: orderItems,
      },
    },
    select: {
      id: true,
      orderNumber: true,
      subtotal: true,
      shippingCost: true,
      tax: true,
      total: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          productName: true,
          formatName: true,
          quantity: true,
          unitPrice: true,
          total: true,
        },
      },
    },
  });

  return jsonSuccess(order, undefined, 201);
}, 'orders:write');
