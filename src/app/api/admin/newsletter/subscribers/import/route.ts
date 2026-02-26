export const dynamic = 'force-dynamic';

/**
 * Admin Newsletter Subscribers Import API
 * POST - Bulk import subscribers from CSV data
 *
 * FIX: SECURITY - This route was missing, causing 404 when admins tried to import contacts.
 * Protected by withAdminGuard (auth + role + CSRF + rate limiting).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const importContactSchema = z.object({
  email: z.string().email(),
  locale: z.string().min(2).max(10).optional().default('en'),
  source: z.string().max(50).optional().default('import'),
});

const importBodySchema = z.object({
  contacts: z.array(importContactSchema).min(1).max(10000),
});

/**
 * POST /api/admin/newsletter/subscribers/import
 * Body: { contacts: [{ email, locale?, source? }] }
 * Returns: { imported: number, skipped: number, errors: number }
 */
export const POST = withAdminGuard(async (request: NextRequest, { session: _session }) => {
  try {
    const body = await request.json();
    const parsed = importBodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { contacts } = parsed.data;

    // Deduplicate by email (case-insensitive)
    const uniqueContacts = new Map<string, { email: string; locale: string; source: string }>();
    for (const contact of contacts) {
      const lowerEmail = contact.email.toLowerCase().trim();
      if (!uniqueContacts.has(lowerEmail)) {
        uniqueContacts.set(lowerEmail, {
          email: lowerEmail,
          locale: contact.locale || 'en',
          source: contact.source || 'import',
        });
      }
    }

    // Find existing subscribers to skip duplicates
    const emails = Array.from(uniqueContacts.keys());
    const existing = await prisma.newsletterSubscriber.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    const existingSet = new Set(existing.map((e) => e.email.toLowerCase()));

    // Filter to only new contacts
    const newContacts = Array.from(uniqueContacts.values()).filter(
      (c) => !existingSet.has(c.email)
    );

    let imported = 0;
    let errors = 0;

    if (newContacts.length > 0) {
      try {
        const result = await prisma.newsletterSubscriber.createMany({
          data: newContacts.map((c) => ({
            email: c.email,
            locale: c.locale,
            source: c.source,
            isActive: true,
          })),
          skipDuplicates: true,
        });
        imported = result.count;
      } catch (err) {
        logger.error('Bulk import error', {
          error: err instanceof Error ? err.message : String(err),
        });
        errors = newContacts.length;
      }
    }

    return NextResponse.json({
      imported,
      skipped: existingSet.size,
      errors,
      total: contacts.length,
    });
  } catch (error) {
    logger.error('Admin newsletter subscribers import error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'Failed to import subscribers' },
      { status: 500 }
    );
  }
});
