export const dynamic = 'force-dynamic';

/**
 * CRM Deal Products API
 * GET:  List products attached to a deal
 * POST: Add a product to a deal
 */

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiSuccess, apiError } from '@/lib/api-response';
import { prisma } from '@/lib/db';

const addDealProductSchema = z.object({
  productId: z.string().min(1, 'productId required'),
  quantity: z.number().int().min(1).optional().default(1),
  unitPrice: z.number().min(0).optional(),
  discount: z.number().min(0).max(100).optional().default(0),
  notes: z.string().max(2000).optional(),
});

export const GET = withAdminGuard(async (request, { params: paramsPromise }) => {
  const { id } = await paramsPromise as unknown as { id: string };

  const products = await prisma.crmDealProduct.findMany({
    where: { dealId: id },
    include: { product: { select: { id: true, name: true, slug: true, imageUrl: true, price: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const totalValue = products.reduce((sum, p) => sum + Number(p.total), 0);

  return apiSuccess({ products, totalValue }, { request });
}, { requiredPermission: 'crm.deals.view' });

export const POST = withAdminGuard(async (request, { params: paramsPromise }) => {
  const { id: dealId } = await paramsPromise as unknown as { id: string };
  const body = await request.json();
  const parsed = addDealProductSchema.safeParse(body);
  if (!parsed.success) {
    return apiError('Invalid data', 'VALIDATION_ERROR', { status: 400, details: parsed.error.errors });
  }
  const { productId, quantity, unitPrice, discount, notes } = parsed.data;

  // Verify deal exists
  const deal = await prisma.crmDeal.findUnique({ where: { id: dealId }, select: { id: true } });
  if (!deal) return apiError('Deal not found', 'NOT_FOUND', { status: 404 });

  // Get product price if unitPrice not provided
  let price = unitPrice;
  if (!price) {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { price: true } });
    if (!product) return apiError('Product not found', 'NOT_FOUND', { status: 404 });
    price = Number(product.price);
  }

  const discountMultiplier = 1 - (Number(discount) / 100);
  const total = Number(price) * quantity * discountMultiplier;

  const dealProduct = await prisma.crmDealProduct.upsert({
    where: { dealId_productId: { dealId, productId } },
    create: {
      dealId,
      productId,
      quantity,
      unitPrice: new Prisma.Decimal(price),
      discount: new Prisma.Decimal(discount),
      total: new Prisma.Decimal(total),
      notes,
    },
    update: {
      quantity,
      unitPrice: new Prisma.Decimal(price),
      discount: new Prisma.Decimal(discount),
      total: new Prisma.Decimal(total),
      notes,
    },
    include: { product: { select: { id: true, name: true, slug: true, imageUrl: true } } },
  });

  // Update deal value using aggregate instead of loading all products
  const agg = await prisma.crmDealProduct.aggregate({
    where: { dealId },
    _sum: { total: true },
  });
  const newDealValue = Number(agg._sum.total ?? 0);
  await prisma.crmDeal.update({
    where: { id: dealId },
    data: { value: new Prisma.Decimal(newDealValue) },
  });

  return apiSuccess(dealProduct, { request, status: 201 });
}, { requiredPermission: 'crm.deals.edit' });

export const DELETE = withAdminGuard(async (request) => {
  const { searchParams } = new URL(request.url);
  const dealProductId = searchParams.get('dealProductId');
  if (!dealProductId) return apiError('dealProductId required', 'VALIDATION_ERROR', { status: 400 });

  const dp = await prisma.crmDealProduct.findUnique({
    where: { id: dealProductId },
    select: { dealId: true },
  });
  if (!dp) return apiError('Not found', 'NOT_FOUND', { status: 404 });

  await prisma.crmDealProduct.delete({ where: { id: dealProductId } });

  // Recalculate deal value using aggregate
  const remainingAgg = await prisma.crmDealProduct.aggregate({
    where: { dealId: dp.dealId },
    _sum: { total: true },
  });
  const newValue = Number(remainingAgg._sum.total ?? 0);
  await prisma.crmDeal.update({
    where: { id: dp.dealId },
    data: { value: new Prisma.Decimal(newValue) },
  });

  return apiSuccess({ deleted: true }, { request });
}, { requiredPermission: 'crm.deals.delete' });
