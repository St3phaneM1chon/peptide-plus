export const dynamic = 'force-dynamic';

/**
 * Admin Supplier Item API
 * GET    - Get a single supplier with all relations
 * PATCH  - Update a supplier (including contacts and links)
 * DELETE - Delete a supplier
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

const updateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name cannot be empty').trim().optional(),
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
  isActive: z.boolean().optional(),
  contacts: z.array(supplierContactSchema).optional(),
  links: z.array(supplierLinkSchema).optional(),
});

// GET /api/admin/suppliers/[id] - Get single supplier with all relations
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        contacts: { orderBy: { isPrimary: 'desc' } },
        links: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(supplier);
  } catch (error) {
    logger.error('Supplier GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// PATCH /api/admin/suppliers/[id] - Update supplier
export const PATCH = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const parsed = updateSupplierSchema.safeParse(body);
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
      isActive,
      contacts,
      links,
    } = parsed.data;

    // Check supplier exists
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Build update data for supplier fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (code !== undefined) updateData.code = code?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (website !== undefined) updateData.website = website?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (city !== undefined) updateData.city = city?.trim() || null;
    if (province !== undefined) updateData.province = province?.trim() || null;
    if (postalCode !== undefined)
      updateData.postalCode = postalCode?.trim() || null;
    if (country !== undefined) updateData.country = country || 'CA';
    if (notes !== undefined) updateData.notes = notes?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Use a transaction to update supplier + replace contacts and links
    const supplier = await prisma.$transaction(async (tx) => {
      // Update supplier fields
      await tx.supplier.update({
        where: { id },
        data: updateData,
      });

      // Replace contacts if provided
      if (contacts !== undefined) {
        await tx.supplierContact.deleteMany({ where: { supplierId: id } });
        if (contacts?.length) {
          await tx.supplierContact.createMany({
            data: contacts.map(
              (c: {
                department: string;
                name: string;
                email?: string;
                phone?: string;
                extension?: string;
                title?: string;
                isPrimary?: boolean;
              }) => ({
                supplierId: id,
                department: c.department,
                name: c.name,
                email: c.email || null,
                phone: c.phone || null,
                extension: c.extension || null,
                title: c.title || null,
                isPrimary: c.isPrimary || false,
              })
            ),
          });
        }
      }

      // Replace links if provided
      if (links !== undefined) {
        await tx.supplierLink.deleteMany({ where: { supplierId: id } });
        if (links?.length) {
          await tx.supplierLink.createMany({
            data: links.map(
              (
                l: { label: string; url: string; type?: string },
                idx: number
              ) => ({
                supplierId: id,
                label: l.label,
                url: l.url,
                type: l.type || 'other',
                sortOrder: idx,
              })
            ),
          });
        }
      }

      // Return updated supplier with relations
      return tx.supplier.findUnique({
        where: { id },
        include: {
          contacts: { orderBy: { isPrimary: 'desc' } },
          links: { orderBy: { sortOrder: 'asc' } },
        },
      });
    });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_SUPPLIER',
      targetType: 'Supplier',
      targetId: id,
      previousValue: { name: existing.name, isActive: existing.isActive },
      newValue: updateData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json(supplier);
  } catch (error) {
    logger.error('Supplier PATCH error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});

// DELETE /api/admin/suppliers/[id] - Delete supplier
export const DELETE = withAdminGuard(async (_request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      );
    }

    // Cascade delete handles contacts and links
    await prisma.supplier.delete({ where: { id } });

    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_SUPPLIER',
      targetType: 'Supplier',
      targetId: id,
      previousValue: { name: existing.name },
      ipAddress: getClientIpFromRequest(_request),
      userAgent: _request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Supplier DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
