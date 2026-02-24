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
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
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

      let cleaned = 0;
      for (const sub of subscribers) {
        const result = await shouldSuppressEmail(sub.email);
        if (result.suppressed) {
          await prisma.newsletterSubscriber.update({
            where: { id: sub.id },
            data: { isActive: false, unsubscribedAt: new Date() },
          });
          cleaned++;
        }
      }

      logAdminAction({
        adminUserId: session.user.id,
        action: 'CLEAN_MAILING_LIST',
        targetType: 'NewsletterSubscriber',
        targetId: 'bulk',
        newValue: { checked: subscribers.length, cleaned },
        ipAddress: getClientIpFromRequest(request),
        userAgent: request.headers.get('user-agent') || undefined,
      }).catch(() => {});

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
        // Don't reject — use default, but track it
      }
      const locale = localeValid ? contact.locale : 'fr';

      try {
        // RGPD compliance: check if subscriber previously unsubscribed
        const existing = await prisma.newsletterSubscriber.findUnique({
          where: { email },
          select: { id: true, isActive: true, unsubscribedAt: true },
        });

        if (existing && !existing.isActive && existing.unsubscribedAt) {
          // User actively unsubscribed — do NOT re-subscribe (RGPD violation)
          preservedUnsubscribed++;
          continue;
        }

        if (existing) {
          // Update existing subscriber
          await prisma.newsletterSubscriber.update({
            where: { email },
            data: {
              name: safeName || undefined,
            },
          });
          updated++;
        } else {
          // Create new subscriber
          await prisma.newsletterSubscriber.create({
            data: {
              id: crypto.randomUUID(),
              email,
              name: safeName,
              locale,
              source: 'csv-import',
              isActive: true,
            },
          });
          imported++;
        }
      } catch {
        failed++;
        errors.push({ row: i + 1, email, reason: 'db_error' });
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
    }).catch(() => {});

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
