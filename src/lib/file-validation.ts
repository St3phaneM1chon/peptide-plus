/**
 * FILE UPLOAD VALIDATION (#68)
 * Centralized file validation: magic bytes, extension, MIME type, double extensions.
 *
 * Usage:
 *   import { validateUpload, FileContext } from '@/lib/file-validation';
 *   const result = validateUpload(buffer, file.name, file.type, 'review');
 *   if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 });
 */

import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FileContext = 'admin' | 'review' | 'avatar' | 'document';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Magic Byte Signatures
// ---------------------------------------------------------------------------

const MAGIC_SIGNATURES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF] }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  'image/gif': [{ bytes: [0x47, 0x49, 0x46, 0x38] }],
  'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46] }],
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }],
  'image/bmp': [{ bytes: [0x42, 0x4D] }],
  'image/tiff': [
    { bytes: [0x49, 0x49, 0x2A, 0x00] }, // little-endian
    { bytes: [0x4D, 0x4D, 0x00, 0x2A] }, // big-endian
  ],
};

// ---------------------------------------------------------------------------
// Allowed types per context (#75)
// ---------------------------------------------------------------------------

const ALLOWED_TYPES_BY_CONTEXT: Record<FileContext, Set<string>> = {
  // Reviews: images only
  review: new Set(['image/jpeg', 'image/png', 'image/webp']),
  // Avatars: images only
  avatar: new Set(['image/jpeg', 'image/png', 'image/webp']),
  // Admin: all supported types
  admin: new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
    'application/pdf',
  ]),
  // Documents
  document: new Set(['application/pdf']),
};

// ---------------------------------------------------------------------------
// Size limits per type (#68)
// ---------------------------------------------------------------------------

const SIZE_LIMITS: Record<string, number> = {
  'image/jpeg': 10 * 1024 * 1024, // 10MB
  'image/png': 10 * 1024 * 1024,
  'image/gif': 10 * 1024 * 1024,
  'image/webp': 10 * 1024 * 1024,
  'image/bmp': 10 * 1024 * 1024,
  'application/pdf': 20 * 1024 * 1024, // 20MB
  default: 10 * 1024 * 1024,
};

// ---------------------------------------------------------------------------
// Blocked extensions
// ---------------------------------------------------------------------------

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.php', '.jsp', '.asp', '.aspx',
  '.cgi', '.pl', '.py', '.rb', '.js', '.html', '.htm', '.svg', '.swf',
  '.com', '.msi', '.scr', '.pif', '.vbs', '.wsf', '.dll', '.so',
]);

// Extension-to-MIME mapping for validation
const EXTENSION_MIME_MAP: Record<string, string[]> = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.bmp': ['image/bmp'],
  '.tiff': ['image/tiff'],
  '.tif': ['image/tiff'],
  '.pdf': ['application/pdf'],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate an uploaded file against magic bytes, extension, MIME type,
 * double extension, and size limits.
 */
export function validateUpload(
  buffer: Buffer,
  filename: string,
  declaredMime: string,
  context: FileContext = 'admin'
): ValidationResult {
  // 1. Check for double extensions (#68) - e.g. "file.jpg.exe"
  const parts = filename.split('.');
  if (parts.length > 2) {
    // Check if any intermediate extension is blocked
    for (let i = 1; i < parts.length - 1; i++) {
      const ext = `.${parts[i].toLowerCase()}`;
      if (BLOCKED_EXTENSIONS.has(ext)) {
        return { valid: false, error: `Suspicious double extension detected in "${filename}"` };
      }
    }
  }

  // 2. Check final extension
  const ext = path.extname(filename).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `File extension ${ext} is not allowed` };
  }

  // 3. Verify extension matches declared MIME type
  const allowedMimes = EXTENSION_MIME_MAP[ext];
  if (allowedMimes && !allowedMimes.includes(declaredMime)) {
    return {
      valid: false,
      error: `Extension ${ext} does not match declared type ${declaredMime}`,
    };
  }

  // 4. Check file type is allowed for this context (#75)
  const contextTypes = ALLOWED_TYPES_BY_CONTEXT[context];
  if (contextTypes && !contextTypes.has(declaredMime)) {
    return {
      valid: false,
      error: `File type ${declaredMime} is not allowed for ${context} uploads`,
    };
  }

  // 5. Validate magic bytes match declared MIME type
  if (!validateMagicBytes(buffer, declaredMime)) {
    return {
      valid: false,
      error: `File content does not match declared type ${declaredMime}`,
    };
  }

  // 6. Check file size limits
  const maxSize = SIZE_LIMITS[declaredMime] || SIZE_LIMITS.default;
  if (buffer.length > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File exceeds maximum size of ${maxMB}MB for type ${declaredMime}`,
    };
  }

  return { valid: true };
}

/**
 * Validate magic bytes match the declared MIME type.
 */
function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const signatures = MAGIC_SIGNATURES[declaredMime];

  // If no signatures defined for this MIME, reject as unknown
  if (!signatures || signatures.length === 0) {
    return false;
  }

  for (const sig of signatures) {
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) continue;

    let matches = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buffer[offset + i] !== sig.bytes[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
}

/**
 * Get the maximum file size for a given MIME type.
 */
export function getMaxFileSize(mimeType: string): number {
  return SIZE_LIMITS[mimeType] || SIZE_LIMITS.default;
}

/**
 * Check if a file type is allowed for a given context.
 */
export function isTypeAllowed(mimeType: string, context: FileContext): boolean {
  const allowed = ALLOWED_TYPES_BY_CONTEXT[context];
  return allowed ? allowed.has(mimeType) : false;
}
