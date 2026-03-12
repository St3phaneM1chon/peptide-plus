export const dynamic = 'force-dynamic';

/**
 * Admin Customer Item API
 * GET /api/admin/customers/[id] - Get single customer with details
 * PUT /api/admin/customers/[id] - Update customer fields
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/api-response';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  email: z.string().email().max(320).trim().optional(),
  phone: z.string().max(50).trim().nullable().optional(),
  locale: z.string().max(10).trim().optional(),
  timezone: z.string().max(100).trim().optional(),
  birthDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  image: z.string().url().max(2048).nullable().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  loyaltyTier: z.enum(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']).optional(),
  isBanned: z.boolean().optional(),
  bannedReason: z.string().max(500).trim().nullable().optional(),
});

// ---------------------------------------------------------------------------
// GET: Single customer with details
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const customer = await prisma.user.findUnique({
    where: { id, role: 'CUSTOMER' },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      image: true,
      role: true,
      locale: true,
      timezone: true,
      birthDate: true,
      tags: true,
      loyaltyPoints: true,
      lifetimePoints: true,
      loyaltyTier: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
      stripeCustomerId: true,
      referralCode: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          orders: true,
          reviews: true,
          addresses: true,
        },
      },
    },
  });

  if (!customer) {
    return apiError('Customer not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }

  return apiSuccess(customer, { request });
}, { requiredPermission: 'users.view' });

// ---------------------------------------------------------------------------
// PUT: Update customer
// ---------------------------------------------------------------------------

export const PUT = withAdminGuard(async (
  request: NextRequest,
  { params }: { session: unknown; params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const existing = await prisma.user.findUnique({
    where: { id, role: 'CUSTOMER' },
    select: { id: true, email: true },
  });
  if (!existing) {
    return apiError('Customer not found', 'RESOURCE_NOT_FOUND', {
      status: 404,
      request,
    });
  }

  const body = await request.json();
  const parsed = updateCustomerSchema.safeParse(body);

  if (!parsed.success) {
    return apiError('Invalid input', 'VALIDATION_ERROR', {
      status: 400,
      details: parsed.error.flatten(),
      request,
    });
  }

  const data = parsed.data;

  // Check email uniqueness if changing
  if (data.email && data.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });
    if (emailTaken) {
      return apiError('A user with this email already exists', 'CONFLICT', {
        status: 409,
        request,
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.locale !== undefined) updateData.locale = data.locale;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.birthDate !== undefined) {
    updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null;
  }
  if (data.tags !== undefined) updateData.tags = data.tags;
  if (data.image !== undefined) updateData.image = data.image;
  if (data.loyaltyPoints !== undefined) updateData.loyaltyPoints = data.loyaltyPoints;
  if (data.loyaltyTier !== undefined) updateData.loyaltyTier = data.loyaltyTier;
  if (data.isBanned !== undefined) {
    updateData.isBanned = data.isBanned;
    updateData.bannedAt = data.isBanned ? new Date() : null;
    updateData.bannedReason = data.isBanned ? (data.bannedReason || null) : null;
  } else if (data.bannedReason !== undefined) {
    updateData.bannedReason = data.bannedReason;
  }

  const customer = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      image: true,
      role: true,
      locale: true,
      timezone: true,
      birthDate: true,
      tags: true,
      loyaltyPoints: true,
      lifetimePoints: true,
      loyaltyTier: true,
      isBanned: true,
      bannedAt: true,
      bannedReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiSuccess(customer, { request });
}, { requiredPermission: 'users.edit' });
