export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { UserRole } from '@/types';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// #89 Audit: Zod schema for accounting settings validation
const accountingSettingsSchema = z.object({
  companyName: z.string().min(1).max(200).optional(),
  legalName: z.string().min(1).max(200).optional(),
  taxId: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(50).optional(),
  postalCode: z.string().max(20).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().max(255).optional(),
  website: z.string().url().max(255).optional().or(z.literal('')),
  fiscalYearStart: z.string().max(10).optional(),
  defaultCurrency: z.string().length(3).optional(),
  taxNumber: z.string().max(50).optional(),
  // Quick Method GST/HST fields
  quickMethodEnabled: z.boolean().optional(),
  quickMethodProvince: z.string().length(2).optional(),
  // Document Retention Policy
  blockDeletionDuringRetention: z.boolean().optional(),
}).strict(); // strict() rejects unknown fields

/**
 * GET /api/accounting/settings
 * Get accounting settings
 */
export const GET = withAdminGuard(async () => {
  try {
    let settings = await prisma.accountingSettings.findUnique({
      where: { id: 'default' },
    });

    // Auto-create default settings if not found
    if (!settings) {
      settings = await prisma.accountingSettings.create({
        data: { id: 'default' },
      });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres' },
      { status: 500 }
    );
  }
});

/**
 * PUT /api/accounting/settings
 * Update accounting settings
 */
export const PUT = withAdminGuard(async (request, { session }) => {
  try {
    // #78 Compliance: Restrict settings modification to OWNER role only
    if (session.user.role !== UserRole.OWNER) {
      return NextResponse.json(
        { error: 'Seul le propriétaire (OWNER) peut modifier les paramètres comptables' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // #89 Audit: Validate settings with zod schema (replaces manual allowlist)
    const parsed = accountingSettingsSchema.safeParse(body);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return NextResponse.json(
        { error: `Paramètre invalide: ${firstError.path.join('.')} - ${firstError.message}` },
        { status: 400 }
      );
    }
    const updateFields = parsed.data;

    // #98 Backup current settings before update (for rollback capability)
    let previousSettings = null;
    try {
      previousSettings = await prisma.accountingSettings.findUnique({
        where: { id: 'default' },
      });
      if (previousSettings) {
        // Store a snapshot as a JSON audit log entry
        console.info('Settings backup before update:', {
          backupAt: new Date().toISOString(),
          modifiedBy: session.user.id || session.user.email,
          previousValues: previousSettings,
        });
      }
    } catch (backupError) {
      // #98 Non-blocking: log but don't fail the update if backup fails
      console.warn('Failed to backup settings before update:', backupError);
    }

    const settings = await prisma.accountingSettings.upsert({
      where: { id: 'default' },
      update: updateFields,
      create: { id: 'default', ...updateFields },
    });

    return NextResponse.json({
      success: true,
      settings,
      // #98 Include previous values in response so frontend can offer undo
      previousSettings: previousSettings ? {
        ...Object.fromEntries(
          Object.keys(accountingSettingsSchema.shape)
            .filter((k) => k in (previousSettings as Record<string, unknown>))
            .map((k) => [k, (previousSettings as Record<string, unknown>)[k]])
        ),
      } : null,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des paramètres' },
      { status: 500 }
    );
  }
});
