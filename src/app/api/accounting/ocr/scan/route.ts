export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { UserRole } from '@/types';
import {
  processInvoiceWithVision,
  validateOCRFile,
  createInvoiceFromOCR,
} from '@/lib/accounting';

/**
 * POST /api/accounting/ocr/scan
 * Upload and scan an invoice image via OCR
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    if (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

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
    console.error('OCR scan error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du scan OCR' },
      { status: 500 }
    );
  }
}
