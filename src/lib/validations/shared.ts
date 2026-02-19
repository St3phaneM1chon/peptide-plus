/**
 * Shared Zod primitives and transforms (Backend Round 2 - Items 16-25)
 *
 * Reusable building blocks for all validation schemas:
 * - Sanitization transforms (Item 22)
 * - Phone validation (Item 20)
 * - Email normalization (Item 23)
 * - Numeric bounds (Item 18)
 * - URL validation (Item 19)
 * - Field length limits (Item 24)
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Input sanitization (Item 22)
// ---------------------------------------------------------------------------

/**
 * Strip HTML tags, trim whitespace, and remove control characters.
 * Apply to all free-text user input.
 */
export function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')             // strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .trim();
}

/**
 * Zod transform that sanitizes a string value.
 */
export const sanitizedString = (minOrOpts?: number | { min?: number; max?: number }, maxLen?: number) => {
  let schema = z.string();
  const min = typeof minOrOpts === 'number' ? minOrOpts : minOrOpts?.min;
  const max = maxLen ?? (typeof minOrOpts === 'object' ? minOrOpts?.max : undefined);
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  return schema.transform(sanitize);
};

// ---------------------------------------------------------------------------
// Email (Item 23)
// ---------------------------------------------------------------------------

/** Email: validated, lowercased, trimmed */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .max(254)
  .transform((v) => v.toLowerCase().trim());

// ---------------------------------------------------------------------------
// Phone (Item 20) - E.164 international format
// ---------------------------------------------------------------------------

const E164_REGEX = /^\+?[1-9]\d{1,14}$/;

/** Phone: optional, but if provided must match E.164 */
export const phoneSchema = z
  .string()
  .max(20)
  .regex(E164_REGEX, 'Phone must match E.164 format (e.g. +14155552671)')
  .optional()
  .nullable();

// ---------------------------------------------------------------------------
// Numeric bounds (Item 18)
// ---------------------------------------------------------------------------

/** Price: 0 to 99999.99 */
export const priceSchema = z
  .number()
  .min(0, 'Price must be non-negative')
  .max(99999.99, 'Price must not exceed 99999.99');

/** Quantity: 1 to 999 */
export const quantitySchema = z
  .number()
  .int()
  .min(1, 'Quantity must be at least 1')
  .max(999, 'Quantity must not exceed 999');

/** Rating: 1 to 5 */
export const ratingSchema = z
  .number()
  .int()
  .min(1, 'Rating must be between 1 and 5')
  .max(5, 'Rating must be between 1 and 5');

/** Page number: 1 to 1000 */
export const pageSchema = z
  .number()
  .int()
  .min(1)
  .max(1000)
  .default(1);

/** Page size: 1 to 100 */
export const pageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20);

// ---------------------------------------------------------------------------
// URL validation (Item 19)
// ---------------------------------------------------------------------------

/** Allowed domains for product image URLs */
const ALLOWED_IMAGE_DOMAINS = [
  'biocyclepeptides.com',
  'www.biocyclepeptides.com',
  'res.cloudinary.com',
  'images.unsplash.com',
  'blob.core.windows.net',
  'azurefd.net',
  'localhost',
];

/** URL schema that validates format */
export const urlSchema = z.string().url('Invalid URL format').max(2000);

/** Image URL schema: validates URL + optionally checks allowed domains */
export const imageUrlSchema = z
  .string()
  .url('Invalid image URL')
  .max(2000)
  .refine(
    (url) => {
      try {
        const hostname = new URL(url).hostname;
        // Allow any domain with the allowed domains as a substring match
        return ALLOWED_IMAGE_DOMAINS.some(
          (d) => hostname === d || hostname.endsWith(`.${d}`)
        );
      } catch {
        return false;
      }
    },
    { message: 'Image URL must point to an allowed domain' }
  )
  .optional()
  .nullable();

// ---------------------------------------------------------------------------
// String length limits (Item 24)
// ---------------------------------------------------------------------------

/** Title: max 200 chars, sanitized */
export const titleSchema = sanitizedString(1, 200);

/** Description: max 10000 chars, sanitized */
export const descriptionSchema = sanitizedString({ max: 10000 });

/** Name: max 100 chars, sanitized */
export const nameSchema = sanitizedString(1, 100);

/** Comment/review text: max 5000 chars, sanitized */
export const commentSchema = sanitizedString(1, 5000);

// ---------------------------------------------------------------------------
// Common pagination query schema
// ---------------------------------------------------------------------------

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// UUID shorthand
// ---------------------------------------------------------------------------

export const uuidSchema = z.string().uuid('Invalid ID format');
