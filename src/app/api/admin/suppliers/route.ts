export const dynamic = 'force-dynamic';

/**
 * Admin Suppliers API
 * GET  - List suppliers with pagination, search, include contacts count
 * POST - Create a supplier with contacts and links
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const supplierContactSchema = z.object({
  department: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  extension: z.string().optional(),
  title: z.string().optional(),
  isPrimary: z.boolean().optional(),
});

const supplierLinkSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  type: z.string().optional(),
});

const createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').trim(),
  code: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  website: z.string().url().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  contacts: z.array(supplierContactSchema).optional(),
  links: z.array(supplierLinkSchema).optional(),
});

// GET /api/admin/suppliers - List suppliers
export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search') || '';
    const activeOnly = searchParams.get('active') !== 'false';

    const where = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
              { code: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        select: {
          id: true,
          name: true,
          code: true,
          email: true,
          phone: true,
          website: true,
          address: true,
          city: true,
          province: true,
          postalCode: true,
          country: true,
          notes: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          contacts: {
            orderBy: { isPrimary: 'desc' },
            select: {
              id: true,
              department: true,
              name: true,
              email: true,
              phone: true,
              extension: true,
              title: true,
              isPrimary: true,
            },
          },
          links: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, label: true, url: true, type: true, sortOrder: true },
          },
          _count: { select: { contacts: true, links: true } },
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({ suppliers, total, page, limit });
  } catch (error) {
    logger.error('Suppliers GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// POST /api/admin/suppliers - Create supplier
export const POST = withAdminGuard(async (request, { session }) => {
  try {
    const body = await request.json();
    const parsed = createSupplierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.errors },
        { status: 400 }
      );
    }
    const {
      name,
      code,
      email,
      phone,
      website,
      address,
      city,
      province,
      postalCode,
      country,
      notes,
      contacts,
      links,
    } = parsed.data;

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        code: code?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        province: province?.trim() || null,
        postalCode: postalCode?.trim() || null,
        country: country || 'CA',
        notes: notes?.trim() || null,
        contacts: contacts?.length
          ? {
              create: contacts.map(
                (c: {
                  department: string;
                  name: string;
                  email?: string;
                  phone?: string;
                  extension?: string;
                  title?: string;
                  isPrimary?: boolean;
                }) => ({
                  department: c.department,
                  name: c.name,
                  email: c.email || null,
                  phone: c.phone || null,
                  extension: c.extension || null,
                  title: c.title || null,
                  isPrimary: c.isPrimary || false,
                })
              ),
            }
          : undefined,
        links: links?.length
          ? {
              create: links.map(
                (
                  l: { label: string; url: string; type?: string },
                  idx: number
                ) => ({
                  label: l.label,
                  url: l.url,
                  type: l.type || 'other',
                  sortOrder: idx,
                })
              ),
            }
          : undefined,
      },
      include: { contacts: true, links: true },
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'CREATE_SUPPLIER',
      targetType: 'Supplier',
      targetId: supplier.id,
      newValue: { name: name.trim(), code: code?.trim() || null, email: email?.trim() || null },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    logger.error('Suppliers POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
