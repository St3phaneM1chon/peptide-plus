export const dynamic = 'force-dynamic';

/**
 * I-INVENTORY-8: Supplier Management API
 * Manages supplier information for inventory procurement
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import crypto from 'crypto';

const supplierSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  website: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
});

// GET: List all suppliers
export const GET = withAdminGuard(async (_request: NextRequest) => {
  // Use Supplier model if it exists, otherwise use AuditLog-based approach
  // Since there's no Supplier model in schema, we store suppliers as site settings
  const settings = await prisma.siteSetting.findMany({
    where: { key: { startsWith: 'supplier:' } },
    orderBy: { key: 'asc' },
  });

  const suppliers = settings.map((s) => {
    try {
      return { id: s.key.replace('supplier:', ''), ...JSON.parse(s.value) };
    } catch {
      return null;
    }
  }).filter(Boolean);

  return NextResponse.json({ suppliers, total: suppliers.length });
});

// POST: Create a new supplier
export const POST = withAdminGuard(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = supplierSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const id = `sup_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const data = { ...parsed.data, createdAt: new Date().toISOString() };

  await prisma.siteSetting.create({
    data: {
      key: `supplier:${id}`,
      value: JSON.stringify(data),
    },
  });

  return NextResponse.json({ id, ...data }, { status: 201 });
});
