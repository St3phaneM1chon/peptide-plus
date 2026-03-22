export const dynamic = 'force-dynamic';

/**
 * Public API v1 - Orders
 * GET  /api/v1/orders - List orders (paginated, filterable)
 * POST /api/v1/orders - Create a new order
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withApiAuth, jsonSuccess, jsonError } from '@/lib/api/api-auth.middleware';
import { prisma } from '@/lib/db';
import { add, multiply } from '@/lib/decimal-calculator';
import { stripHtml } from '@/lib/sanitize';

export const GET = withApiAuth(async (request: NextRequest, { apiKey }) => {
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

  const where: Prisma.OrderWhereInput = {};

  // SEC: Non-admin API keys can only see their own orders
  if (!apiKey.isAdmin && apiKey.createdBy) {
    where.userId = apiKey.createdBy;
  }

  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (userId) {
    // Non-admin keys cannot filter by arbitrary userId
    if (!apiKey.isAdmin && apiKey.createdBy) {
      return jsonError('Non-admin API keys cannot filter by userId', 403);
    }
    where.userId = userId;
  }
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
      // PII minimization: list endpoint omits shippingName and full address.
      // Use GET /api/v1/orders/[id] for full details when needed.
      select: {
        id: true,
        orderNumber: true,
        subtotal: true,
        shippingCost: true,
        discount: true,
        tax: true,
        total: true,
        currencyId: true,
        paymentMethod: true,
        paymentStatus: true,
        status: true,
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
            optionName: true,
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

const createOrderSchema = z.object({
  shippingName: z.string().min(1).max(200),
  shippingAddress1: z.string().min(1).max(500),
  shippingAddress2: z.string().max(500).optional(),
  shippingCity: z.string().min(1).max(200),
  shippingState: z.string().min(1).max(100),
  shippingPostal: z.string().min(1).max(20),
  shippingCountry: z.string().min(2).max(3).default('CA'),
  shippingPhone: z.string().max(30).optional(),
  shippingCost: z.number().min(0).max(999999.99).default(0),
  tax: z.number().min(0).max(999999.99).default(0),
  taxTps: z.number().min(0).max(999999.99).default(0),
  taxTvq: z.number().min(0).max(999999.99).default(0),
  taxTvh: z.number().min(0).max(999999.99).default(0),
  taxPst: z.number().min(0).max(999999.99).default(0),
  userId: z.string().optional(),
  customerNotes: z.string().max(2000).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    optionId: z.string().optional(),
    quantity: z.number().int().positive(),
  })).min(1, 'Order must contain at least one item'),
});

export const POST = withApiAuth(async (request: NextRequest) => {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createOrderSchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonError(
      'Invalid order data',
      400
    );
  }

  const body = parsed.data;
  const items = body.items;

  // Batch fetch all products at once instead of one query per item
  const productIds = [...new Set(items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      price: true,
      sku: true,
      isActive: true,
      options: {
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
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Validate items and calculate totals
  let subtotal = 0;
  const orderItems: Array<{
    productId: string;
    optionId: string | null;
    productName: string;
    optionName: string | null;
    sku: string | null;
    quantity: number;
    unitPrice: number;
    discount: number;
    total: number;
  }> = [];

  for (const item of items) {
    const product = productMap.get(item.productId);

    if (!product || !product.isActive) {
      return jsonError(`Product ${item.productId} not found or inactive`, 400);
    }

    let unitPrice = Number(product.price);
    let optionName: string | null = null;
    let sku = product.sku;

    if (item.optionId && product.options.length > 0) {
      const format = product.options.find((f) => f.id === item.optionId);
      if (!format) {
        return jsonError(`Format ${item.optionId} not found for product ${item.productId}`, 400);
      }
      if (!format.inStock) {
        return jsonError(`Format ${item.optionId} is out of stock`, 400);
      }
      unitPrice = Number(format.price);
      optionName = format.name;
      sku = format.sku || sku;
    }

    const itemTotal = multiply(unitPrice, item.quantity);
    subtotal = add(subtotal, itemTotal);

    orderItems.push({
      productId: item.productId,
      optionId: item.optionId || null,
      productName: product.name,
      optionName,
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

  const shippingCost = body.shippingCost;
  const tax = body.tax;
  const total = add(subtotal, shippingCost, tax);

  // Use a transaction to ensure order + items creation is atomic
  // RACE CONDITION FIX: Generate order number INSIDE transaction with advisory lock
  const order = await prisma.$transaction(async (tx) => {
    const year = new Date().getFullYear();
    const prefix = `BP-${year}-`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(43)`;
    const lastRows = await tx.$queryRaw<{ order_number: string }[]>`
      SELECT "orderNumber" as order_number FROM "Order"
      WHERE "orderNumber" LIKE ${prefix + '%'}
      ORDER BY "orderNumber" DESC
      LIMIT 1
    `;
    const lastNum = lastRows.length > 0
      ? parseInt(lastRows[0].order_number.replace(prefix, ''), 10)
      : 0;
    const orderNumber = `${prefix}${String(lastNum + 1).padStart(6, '0')}`;

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId: body.userId || null,
        subtotal,
        shippingCost,
        discount: 0,
        tax,
        taxTps: body.taxTps,
        taxTvq: body.taxTvq,
        taxTvh: body.taxTvh,
        taxPst: body.taxPst,
        total,
        currencyId: defaultCurrency.id,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        shippingName: stripHtml(body.shippingName),
        shippingAddress1: stripHtml(body.shippingAddress1),
        shippingAddress2: body.shippingAddress2 ? stripHtml(body.shippingAddress2) : null,
        shippingCity: stripHtml(body.shippingCity),
        shippingState: stripHtml(body.shippingState),
        shippingPostal: stripHtml(body.shippingPostal),
        shippingCountry: body.shippingCountry,
        shippingPhone: body.shippingPhone || null,
        customerNotes: body.customerNotes ? stripHtml(body.customerNotes) : null,
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
            optionName: true,
            quantity: true,
            unitPrice: true,
            total: true,
          },
        },
      },
    });

    return created;
  });

  return jsonSuccess(order, undefined, 201);
}, 'orders:write');
