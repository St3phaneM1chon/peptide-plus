export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import {
  processInvoiceWithVision,
  validateOCRFile,
  createInvoiceFromOCR,
} from '@/lib/accounting';
import { logger } from '@/lib/logger';

/**
 * POST /api/accounting/ocr/scan
 * Upload and scan an invoice image via OCR
 */
export const POST = withAdminGuard(async (request) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validate file
    const validation = validateOCRFile({ type: file.type, size: file.size });
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Convert to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Process with Vision API
    const result = await processInvoiceWithVision(base64, file.type);

    if (!result.success || !result.data) {
      return NextResponse.json(
        { error: result.error || 'OCR processing failed' },
        { status: 422 }
      );
    }

    // Create structured invoice data
    const invoiceData = createInvoiceFromOCR(result.data);

    return NextResponse.json({
      success: true,
      data: {
        ...invoiceData,
        confidence: result.data.confidence,
        needsReview: invoiceData.reviewNotes,
        items: invoiceData.items,
      },
      processingTime: result.processingTime,
    });
  } catch (error) {
    logger.error('OCR scan error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Erreur lors du scan OCR' },
      { status: 500 }
    );
  }
});
