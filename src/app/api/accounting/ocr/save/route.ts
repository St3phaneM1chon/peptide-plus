export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { prisma } from '@/lib/db';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const ocrSaveSchema = z.object({
  invoiceNumber: z.string().optional(),
  supplierName: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  subtotal: z.number().optional(),
  taxTps: z.number().optional(),
  taxTvq: z.number().optional(),
  total: z.number().positive('Le total doit \u00eatre positif'),
  items: z.array(z.unknown()).optional(),
});

/**
 * POST /api/accounting/ocr/save
 * Save extracted OCR invoice data as a SupplierInvoice
 */
export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/ocr/save');
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
    const parsed = ocrSaveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const {
      invoiceNumber,
      supplierName,
      invoiceDate,
      dueDate,
      subtotal,
      taxTps,
      taxTvq,
      total,
      items,
    } = parsed.data;

    // Create supplier invoice
    const invoice = await prisma.supplierInvoice.create({
      data: {
        id: randomUUID(),
        invoiceNumber: invoiceNumber || `OCR-${Date.now()}`,
        supplierName: supplierName || 'Fournisseur inconnu',
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        subtotal: subtotal || 0,
        taxTps: taxTps || 0,
        taxTvq: taxTvq || 0,
        taxOther: 0,
        total: total,
        balance: total,
        currency: 'CAD',
        status: 'DRAFT',
        updatedAt: new Date(),
        notes: `Import\u00e9 via OCR. ${items?.length || 0} article(s) d\u00e9tect\u00e9(s).`,
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    logger.error('OCR save error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors de la sauvegarde de la facture' },
      { status: 500 }
    );
  }
});
