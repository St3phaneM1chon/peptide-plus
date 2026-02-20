export const dynamic = 'force-dynamic';

/**
 * Accounting Document Attachments API
 *
 * GET  - List attachments for a given entity (entityType + entityId)
 * POST - Upload a new attachment (multipart form data)
 * DELETE - Remove an attachment by id
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

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
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
    console.error('Attachment GET error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve attachments' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/accounting/attachments (multipart/form-data)
// ---------------------------------------------------------------------------

export const POST = withAdminGuard(async (request, { session }) => {
  try {
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

    // ------ Ensure upload directory ------

    const relativeDir = join('uploads', 'attachments', entityType, entityId);
    const uploadDir = join(process.cwd(), 'public', relativeDir);

    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // ------ Write file to disk ------

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = join(uploadDir, uniqueName);
    await writeFile(filePath, buffer);

    // ------ Create Prisma record ------

    const relativePath = `/${relativeDir}/${uniqueName}`.replace(/\\/g, '/');

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
    console.error('Attachment POST error:', error);
    return NextResponse.json(
      { error: 'Failed to upload attachment' },
      { status: 500 }
    );
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/accounting/attachments (body: { id })
// ---------------------------------------------------------------------------

export const DELETE = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const { id } = body as { id?: string };

    if (!id) {
      return NextResponse.json(
        { error: 'Attachment id is required in request body' },
        { status: 400 }
      );
    }

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

    // ------ Remove file from disk ------

    const absolutePath = join(process.cwd(), 'public', attachment.fileUrl);
    try {
      if (existsSync(absolutePath)) {
        await unlink(absolutePath);
      }
    } catch (fsError) {
      // Log but don't fail the DB deletion
      console.warn('Failed to delete file from disk:', fsError);
    }

    // ------ Delete Prisma record ------

    await prisma.documentAttachment.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Attachment DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
});
