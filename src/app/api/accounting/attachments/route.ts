export const dynamic = 'force-dynamic';

/**
 * Accounting Document Attachments API
 *
 * GET  - List attachments for a given entity (entityType + entityId)
 * POST - Upload a new attachment (multipart form data)
 * DELETE - Remove an attachment by id
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { randomUUID } from 'crypto';
import { storage } from '@/lib/storage';
import { logger } from '@/lib/logger';
import { rateLimitMiddleware } from '@/lib/rate-limiter';
import { validateCsrf } from '@/lib/csrf-middleware';
// FIX: F59 - Use shared formatFileSize utility instead of local duplicate
import { formatFileSize } from '@/lib/format-utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Allowed MIME types mapped to their canonical extensions */
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
};

/** Valid entity types for document attachments */
const VALID_ENTITY_TYPES = new Set([
  'JournalEntry',
  'CustomerInvoice',
  'SupplierInvoice',
  'BankTransaction',
  'Expense',
]);

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const deleteAttachmentSchema = z.object({
  id: z.string().min(1, 'Attachment id is required'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
// FIX: F59 - formatFileSize moved to shared @/lib/format-utils

/**
 * Sanitize a file extension: strip non-alphanumeric chars and lowercase.
 */
function sanitizeExtension(ext: string): string {
  return ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// GET /api/accounting/attachments?entityType=X&entityId=Y
// ---------------------------------------------------------------------------

export const GET = withAdminGuard(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');

    if (!entityType || !entityId) {
      return NextResponse.json(
        { error: 'entityType and entityId query parameters are required' },
        { status: 400 }
      );
    }

    if (!VALID_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${[...VALID_ENTITY_TYPES].join(', ')}` },
        { status: 400 }
      );
    }

    const attachments = await prisma.documentAttachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });

    const totalSize = attachments.reduce((sum, a) => sum + a.fileSize, 0);

    return NextResponse.json({
      attachments,
      stats: {
        totalCount: attachments.length,
        totalSize,
        totalSizeFormatted: formatFileSize(totalSize),
      },
    });
  } catch (error) {
    logger.error('Attachment GET error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to retrieve attachments' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/attachments (multipart/form-data)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request: NextRequest, { session }) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/attachments');
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

    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const entityType = formData.get('entityType') as string | null;
    const entityId = formData.get('entityId') as string | null;
    const description = (formData.get('description') as string | null) || undefined;

    // ------ Validation ------

    if (!file || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'file, entityType, and entityId are required' },
        { status: 400 }
      );
    }

    if (!VALID_ENTITY_TYPES.has(entityType)) {
      return NextResponse.json(
        { error: `Invalid entityType. Must be one of: ${[...VALID_ENTITY_TYPES].join(', ')}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File exceeds maximum size of ${formatFileSize(MAX_FILE_SIZE)}` },
        { status: 400 }
      );
    }

    const mimeType = file.type;
    if (!ALLOWED_MIME_TYPES[mimeType]) {
      return NextResponse.json(
        {
          error: `File type "${mimeType}" is not allowed. Accepted: PDF, images (jpg/png/gif/webp), documents (doc/docx), spreadsheets (xls/xlsx/csv)`,
        },
        { status: 400 }
      );
    }

    // ------ Generate unique filename ------

    const rawExtension = file.name.split('.').pop() || ALLOWED_MIME_TYPES[mimeType];
    const extension = sanitizeExtension(rawExtension) || ALLOWED_MIME_TYPES[mimeType];
    const uniqueName = `${randomUUID()}.${extension}`;

    // ------ Read file content and validate magic bytes (FIX F17) ------

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // SECURITY FIX (F17): Validate magic bytes match declared MIME type
    const MAGIC_BYTES: Record<string, number[]> = {
      'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/gif': [0x47, 0x49, 0x46],
      'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
    };

    const expectedBytes = MAGIC_BYTES[mimeType];
    if (expectedBytes) {
      const header = buffer.subarray(0, expectedBytes.length);
      const matches = expectedBytes.every((b, i) => header[i] === b);
      if (!matches) {
        return NextResponse.json(
          { error: `File content does not match declared type (${mimeType}). Possible file spoofing detected.` },
          { status: 400 }
        );
      }
    }

    // ------ Upload via StorageService (FIX F11: persists on Azure) ------

    const folder = `attachments/${entityType}/${entityId}`;
    const result = await storage.upload(buffer, uniqueName, mimeType, { folder });
    const relativePath = result.url;

    const attachment = await prisma.documentAttachment.create({
      data: {
        entityType,
        entityId,
        fileName: file.name,
        fileType: ALLOWED_MIME_TYPES[mimeType],
        fileSize: file.size,
        fileUrl: relativePath,
        description: description || null,
        uploadedBy: session.user?.name || session.user?.email || null,
      },
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    logger.error('Attachment POST error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/attachments (body: { id })
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request: NextRequest) => {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip') || '127.0.0.1';
    const rl = await rateLimitMiddleware(ip, '/api/accounting/attachments');
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
    const parsed = deleteAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const { id } = parsed.data;

    // ------ Fetch attachment ------

    const attachment = await prisma.documentAttachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      );
    }

    // ------ Remove file from storage (FIX F11: works with Azure Blob or local) ------

    try {
      await storage.delete(attachment.fileUrl);
    } catch (fsError) {
      // Log but don't fail the DB deletion
      logger.warn('Failed to delete file from storage', { error: fsError instanceof Error ? fsError.message : String(fsError) });
    }

    // ------ Delete Prisma record ------

    await prisma.documentAttachment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    logger.error('Attachment DELETE error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
});
