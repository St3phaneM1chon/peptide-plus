/**
 * VideoCategory Zod Validation Schemas
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Create video category (POST /api/admin/video-categories)
// ---------------------------------------------------------------------------

export const createVideoCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  slug: z.string().max(200).optional(), // Auto-generated from name if not provided
  description: z.string().max(2000).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).max(99999).optional().default(0),
  isActive: z.boolean().optional().default(true),
  parentId: z.string().max(100).optional().nullable(),
  translations: z.array(z.object({
    locale: z.string().min(2).max(10),
    name: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
  })).optional().nullable(),
});

export type CreateVideoCategoryInput = z.infer<typeof createVideoCategorySchema>;

// ---------------------------------------------------------------------------
// Update video category (PATCH /api/admin/video-categories/[id])
// ---------------------------------------------------------------------------

export const patchVideoCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).max(99999).optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().max(100).optional().nullable(),
  translations: z.array(z.object({
    locale: z.string().min(2).max(10),
    name: z.string().max(200).optional().nullable(),
    description: z.string().max(2000).optional().nullable(),
    isApproved: z.boolean().optional(),
  })).optional().nullable(),
});

export type PatchVideoCategoryInput = z.infer<typeof patchVideoCategorySchema>;
