export const dynamic = 'force-dynamic';

/**
 * Admin Customers API
 * GET  /api/admin/customers - List customers (users with role CUSTOMER) with pagination and search
 * POST /api/admin/customers - Create a new customer
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { apiPaginated, apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200).trim(),
  email: z.string().email('Invalid email').max(320).trim(),
  phone: z.string().max(50).trim().optional(),
  locale: z.string().max(10).trim().optional(),
  timezone: z.string().max(100).trim().optional(),
  birthDate: z.string().datetime().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  image: z.string().url().max(2048).optional(),
});

// ---------------------------------------------------------------------------
// GET: List customers
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
  const skip = (page - 1) * limit;
  const search = searchParams.get('search');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    role: 'CUSTOMER',
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        loyaltyPoints: true,
        loyaltyTier: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return apiPaginated(data, page, limit, total, { request });
}, { requiredPermission: 'users.view' });

// ---------------------------------------------------------------------------
// POST: Create a customer
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = createCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const { name, email, phone, locale, timezone, birthDate, tags, image } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return apiError('A user with this email already exists', 'CONFLICT', {
      status: 409,
      request,
    });
  }

  const customer = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      role: 'CUSTOMER',
      locale: locale || 'fr',
      timezone: timezone || 'America/Toronto',
      birthDate: birthDate ? new Date(birthDate) : null,
      tags: tags || [],
      image: image || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      locale: true,
      timezone: true,
      birthDate: true,
      tags: true,
      image: true,
      loyaltyPoints: true,
      loyaltyTier: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiSuccess(customer, { status: 201, request });
}, { requiredPermission: 'users.edit' });
