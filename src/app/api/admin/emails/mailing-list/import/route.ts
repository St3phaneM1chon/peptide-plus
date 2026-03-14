export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
import { logger } from '@/lib/logger';

const contactSchema = z.object({
  email: z.string().max(320),
  name: z.string().max(200).optional(),
  locale: z.string().max(10).optional(),
});

const importSchema = z.object({
  contacts: z.array(contactSchema).max(10000).optional(),
  action: z.enum(['import', 'clean']).optional(),
});

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip = getClientIpFromRequest(request);
    const rl = await rateLimitMiddleware(ip, '/api/admin/emails/mailing-list/import');
    if (!rl.success) {
      const res = NextResponse.json({ error: rl.error!.message }, { status: 429 });
      Object.entries(rl.headers).forEach(([k, v]) => res.headers.set(k, v));
      return res;
    }
    // CSRF validation
    const csrfValid = await validateCsrf(request);
    if (!csrfValid) {
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { contacts, action } = parsed.data;

    // Action: 'import' (default) or 'clean' (remove bounced)
    if (action === 'clean') {
      // Find all active subscribers and check against bounce list
      const subscribers = await prisma.newsletterSubscriber.findMany({
        where: { isActive: true },
        select: { id: true, email: true },
      });

      // N+1 FIX: Check bounce suppression in parallel batches of 50
      const CLEAN_BATCH_SIZE = 50;
      let cleaned = 0;
      const idsToDeactivate: string[] = [];

      for (let i = 0; i < subscribers.length; i += CLEAN_BATCH_SIZE) {
        const batch = subscribers.slice(i, i + CLEAN_BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (sub) => {
            const result = await shouldSuppressEmail(sub.email);
            return { id: sub.id, suppressed: result.suppressed };
          })
        );
        for (const r of results) {
          if (r.suppressed) {
            idsToDeactivate.push(r.id);
          }
        }
      }

      // Batch-update all suppressed subscribers at once
      if (idsToDeactivate.length > 0) {
        await prisma.newsletterSubscriber.updateMany({
          where: { id: { in: idsToDeactivate } },
          data: { isActive: false, unsubscribedAt: new Date() },
        });
        cleaned = idsToDeactivate.length;
      }

      logAdminAction({
        adminUserId: session.user.id,
        action: 'CLEAN_MAILING_LIST',
        targetType: 'NewsletterSubscriber',
        targetId: 'bulk',
        newValue: { checked: subscribers.length, cleaned },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch((error: unknown) => { logger.error('[MailingListImport] Non-blocking clean list admin action log failed', { error: error instanceof Error ? error.message : String(error) }); });

      return NextResponse.json({ success: true, cleaned, checked: subscribers.length });
    }

    // Import contacts
    if (!Array.isArray(contacts) || contacts.length === 0) {
      return NextResponse.json({ error: 'contacts array is required' }, { status: 400 });
    }

    // Limit import size to prevent DoS
    const MAX_IMPORT = 10000;
    if (contacts.length > MAX_IMPORT) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMPORT} contacts per import. Got ${contacts.length}.` },
        { status: 400 },
      );
    }

    const validLocales = ['en', 'fr', 'ar', 'de', 'es', 'hi', 'it', 'ko', 'pt', 'ru', 'sv', 'zh', 'vi', 'pl', 'ta', 'tl', 'pa', 'ht', 'gcr', 'ar-dz', 'ar-lb', 'ar-ma'];

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let preservedUnsubscribed = 0;
    let duplicatesInCsv = 0;
    let invalidLocales = 0;
    const errors: Array<{ row: number; email: string; reason: string }> = [];

    // Track emails seen in this import batch to reject intra-CSV duplicates
    const seenEmails = new Set<string>();

    // Pre-validate and collect unique emails
    interface ValidContact {
      row: number;
      email: string;
      name: string | null;
      locale: string;
    }
    const validContacts: ValidContact[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      const email = (contact.email || '').toLowerCase().trim();
      // Faille #40: Stricter email regex — rejects "a@.com", requires valid domain labels
      if (!email || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email)) {
        skipped++;
        errors.push({ row: i + 1, email: email || '(empty)', reason: 'invalid_email' });
        continue;
      }

      // Reject duplicate emails within the same CSV upload
      if (seenEmails.has(email)) {
        duplicatesInCsv++;
        errors.push({ row: i + 1, email, reason: 'duplicate_in_csv' });
        continue;
      }
      seenEmails.add(email);

      // Sanitize name: strip HTML, limit length
      const rawName = contact.name ? String(contact.name).slice(0, 200) : null;
      const safeName = rawName?.replace(/<[^>]*>/g, '') || null;
      // Validate locale against known list
      const localeValid = contact.locale ? validLocales.includes(contact.locale) : false;
      if (contact.locale && !localeValid) {
        invalidLocales++;
      }
      const locale = localeValid ? contact.locale! : 'fr';

      validContacts.push({ row: i + 1, email, name: safeName, locale });
    }

    // N+1 FIX: Batch-fetch all existing subscribers by email in one query
    const allEmails = validContacts.map(c => c.email);
    const existingSubscribers = allEmails.length > 0
      ? await prisma.newsletterSubscriber.findMany({
          where: { email: { in: allEmails } },
          select: { id: true, email: true, isActive: true, unsubscribedAt: true },
        })
      : [];
    const existingSubMap = new Map(existingSubscribers.map(s => [s.email, s]));

    // N+1 FIX: Separate contacts into create/update/skip batches, then use batch operations
    const contactsToCreate: { id: string; email: string; name: string | null; locale: string; source: string; isActive: boolean }[] = [];
    const contactsToUpdate: { email: string; name: string | null }[] = [];

    for (const contact of validContacts) {
      // RGPD compliance: check if subscriber previously unsubscribed
      const existing = existingSubMap.get(contact.email);

      if (existing && !existing.isActive && existing.unsubscribedAt) {
        // User actively unsubscribed — do NOT re-subscribe (RGPD violation)
        preservedUnsubscribed++;
        continue;
      }

      if (existing) {
        contactsToUpdate.push({ email: contact.email, name: contact.name || null });
      } else {
        contactsToCreate.push({
          id: crypto.randomUUID(),
          email: contact.email,
          name: contact.name,
          locale: contact.locale,
          source: 'csv-import',
          isActive: true,
        });
      }
    }

    // Batch create new subscribers
    if (contactsToCreate.length > 0) {
      try {
        await prisma.newsletterSubscriber.createMany({
          data: contactsToCreate,
          skipDuplicates: true,
        });
        imported = contactsToCreate.length;
      } catch (error) {
        logger.error('[MailingListImport] Batch create failed, falling back to individual creates', { error: error instanceof Error ? error.message : String(error) });
        // Fallback to individual creates if batch fails
        for (const contact of contactsToCreate) {
          try {
            await prisma.newsletterSubscriber.create({ data: contact });
            imported++;
          } catch (err) {
            logger.error('[MailingListImport] Database error creating contact', { email: contact.email, error: err instanceof Error ? err.message : String(err) });
            failed++;
            const matchingValid = validContacts.find(c => c.email === contact.email);
            errors.push({ row: matchingValid?.row ?? 0, email: contact.email, reason: 'db_error' });
          }
        }
      }
    }

    // Batch update existing subscribers using a transaction
    if (contactsToUpdate.length > 0) {
      try {
        await prisma.$transaction(
          contactsToUpdate.map((contact) =>
            prisma.newsletterSubscriber.update({
              where: { email: contact.email },
              data: { name: contact.name || undefined },
            })
          )
        );
        updated = contactsToUpdate.length;
      } catch (error) {
        logger.error('[MailingListImport] Batch update failed, falling back to individual updates', { error: error instanceof Error ? error.message : String(error) });
        // Fallback to individual updates if batch fails
        for (const contact of contactsToUpdate) {
          try {
            await prisma.newsletterSubscriber.update({
              where: { email: contact.email },
              data: { name: contact.name || undefined },
            });
            updated++;
          } catch (err) {
            logger.error('[MailingListImport] Database error updating contact', { email: contact.email, error: err instanceof Error ? err.message : String(err) });
            failed++;
            const matchingValid = validContacts.find(c => c.email === contact.email);
            errors.push({ row: matchingValid?.row ?? 0, email: contact.email, reason: 'db_error' });
          }
        }
      }
    }

    logAdminAction({
      adminUserId: session.user.id,
      action: 'IMPORT_MAILING_LIST',
      targetType: 'NewsletterSubscriber',
      targetId: 'bulk',
      newValue: { total: contacts.length, created: imported, updated, skipped, failed, duplicatesInCsv, preservedUnsubscribed },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch((error: unknown) => { logger.error('[MailingListImport] Non-blocking import admin action log failed', { error: error instanceof Error ? error.message : String(error) }); });

    return NextResponse.json({
      success: true,
      summary: {
        total: contacts.length,
        created: imported,
        updated,
        skipped,
        failed,
        duplicatesInCsv,
        invalidLocales,
        preservedUnsubscribed,
      },
      // Legacy fields for backward compatibility
      imported,
      skipped,
      failed,
      preservedUnsubscribed,
      total: contacts.length,
      // First 50 errors for debugging (avoid huge payloads)
      errors: errors.slice(0, 50),
      supportedLocales: validLocales,
    });
  } catch (error) {
    logger.error('[MailingList Import] Error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
