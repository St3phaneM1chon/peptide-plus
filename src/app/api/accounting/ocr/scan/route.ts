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

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // F17 FIX: Validate magic bytes to prevent file type spoofing
    const MAGIC_BYTES: Record<string, number[]> = {
      'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/jpg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
    };

    const expectedBytes = MAGIC_BYTES[file.type];
    if (expectedBytes) {
      const header = buffer.subarray(0, expectedBytes.length);
      const matches = expectedBytes.every((b, i) => header[i] === b);
      if (!matches) {
        return NextResponse.json(
          { error: `Le contenu du fichier ne correspond pas au type déclaré (${file.type}). Possible tentative de spoofing.` },
          { status: 400 }
        );
      }
    }

    // Convert to base64 for Vision API
    const base64 = buffer.toString('base64');

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
