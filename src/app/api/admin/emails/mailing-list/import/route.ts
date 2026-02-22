export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { shouldSuppressEmail } from '@/lib/email/bounce-handler';

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { contacts, action } = body;

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

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let preservedUnsubscribed = 0;

    for (const contact of contacts) {
      const email = (contact.email || '').toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        skipped++;
        continue;
      }

      // Sanitize name: strip HTML, limit length
      const rawName = contact.name ? String(contact.name).slice(0, 200) : null;
      const safeName = rawName?.replace(/<[^>]*>/g, '') || null;
      // Validate locale against known list
      const validLocales = ['en', 'fr', 'ar', 'de', 'es', 'hi', 'it', 'ko', 'pt', 'ru', 'sv', 'zh', 'vi', 'pl', 'ta', 'tl', 'pa', 'ht', 'gcr', 'ar-dz', 'ar-lb', 'ar-ma'];
      const locale = validLocales.includes(contact.locale) ? contact.locale : 'fr';

      try {
        // RGPD compliance: check if subscriber previously unsubscribed
        const existing = await prisma.newsletterSubscriber.findUnique({
          where: { email },
          select: { isActive: true, unsubscribedAt: true },
        });

        if (existing && !existing.isActive && existing.unsubscribedAt) {
          // User actively unsubscribed — do NOT re-subscribe (RGPD violation)
          preservedUnsubscribed++;
          continue;
        }

        await prisma.newsletterSubscriber.upsert({
          where: { email },
          create: {
            id: crypto.randomUUID(),
            email,
            name: safeName,
            locale,
            source: 'csv-import',
            isActive: true,
          },
          update: {
            name: safeName || undefined,
            // Only set active if not previously unsubscribed (handled above)
          },
        });
        imported++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ success: true, imported, skipped, failed, preservedUnsubscribed, total: contacts.length });
  } catch (error) {
    console.error('[MailingList Import] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
