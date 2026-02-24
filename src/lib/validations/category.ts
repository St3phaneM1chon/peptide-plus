/**
 * Category Zod Validation Schemas
 *
 * Extracted from:
 *   - src/app/api/categories/route.ts (createCategorySchema)
 *   - src/app/api/categories/[id]/route.ts (updateCategorySchema)
 */

import { z } from 'zod';
import { stripHtml, stripControlChars } from '@/lib/sanitize';

// ---------------------------------------------------------------------------
// Create category (admin)
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(200).transform(v => stripControlChars(stripHtml(v)).trim()),
  slug: z.string().min(1, 'Slug is required').max(200).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().max(5000).optional().nullable().transform(v => v ? stripControlChars(stripHtml(v)).trim() : v),
  imageUrl: z.string().url().max(2000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  parentId: z.string().optional().nullable(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

// ---------------------------------------------------------------------------
// Update category (all fields optional)
// ---------------------------------------------------------------------------

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
