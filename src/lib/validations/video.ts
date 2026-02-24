/**
 * Video Zod Validation Schemas
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** URL that starts with http://, https://, or / (relative path) */
const videoUrlField = z.string().max(2000).refine(
  (url) => url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'),
  { message: 'URL must start with http://, https://, or /' }
);

const translationSchema = z.object({
  locale: z.string().min(2).max(10),
  title: z.string().max(500).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
});

// ---------------------------------------------------------------------------
// Create video (POST /api/admin/videos)
// ---------------------------------------------------------------------------

export const createVideoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(10000).optional().nullable(),
  thumbnailUrl: videoUrlField.optional().nullable(),
  videoUrl: videoUrlField.optional().nullable(),
  duration: z.string().max(50).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.union([
    z.array(z.string().max(100)),
    z.string().max(2000),
  ]).optional().nullable(),
  instructor: z.string().max(200).optional().nullable(),
  isFeatured: z.boolean().optional().default(false),
  isPublished: z.boolean().optional().default(false),
  locale: z.string().min(2).max(10).optional().default('en'),
  sortOrder: z.number().int().min(0).max(99999).optional().default(0),
  translations: z.array(translationSchema).optional().nullable(),
});

export type CreateVideoInput = z.infer<typeof createVideoSchema>;

// ---------------------------------------------------------------------------
// Update video (PATCH /api/admin/videos/[id])
// ---------------------------------------------------------------------------

export const patchVideoSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional().nullable(),
  thumbnailUrl: videoUrlField.optional().nullable(),
  videoUrl: videoUrlField.optional().nullable(),
  duration: z.string().max(50).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  tags: z.union([
    z.array(z.string().max(100)),
    z.string().max(2000),
  ]).optional().nullable(),
  instructor: z.string().max(200).optional().nullable(),
  views: z.number().int().min(0).max(999999999).optional(),
  isFeatured: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  locale: z.string().min(2).max(10).optional(),
  sortOrder: z.number().int().min(0).max(99999).optional(),
  translations: z.array(translationSchema.extend({
    isApproved: z.boolean().optional(),
  })).optional().nullable(),
});

export type PatchVideoInput = z.infer<typeof patchVideoSchema>;
