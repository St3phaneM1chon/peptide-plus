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

// Content Hub enums
const videoContentTypeValues = [
  'PODCAST', 'TRAINING', 'PERSONAL_SESSION', 'PRODUCT_DEMO', 'TESTIMONIAL',
  'FAQ_VIDEO', 'WEBINAR_RECORDING', 'TUTORIAL', 'BRAND_STORY', 'LIVE_STREAM', 'OTHER',
] as const;

const videoSourceValues = [
  'YOUTUBE', 'VIMEO', 'TEAMS', 'ZOOM', 'WEBEX', 'GOOGLE_MEET',
  'WHATSAPP', 'X_TWITTER', 'TIKTOK', 'NATIVE_UPLOAD', 'OTHER',
] as const;

const contentVisibilityValues = [
  'PUBLIC', 'CUSTOMERS_ONLY', 'CLIENTS_ONLY', 'EMPLOYEES_ONLY', 'PRIVATE',
] as const;

const contentStatusValues = ['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED'] as const;

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
  // Content Hub fields
  contentType: z.enum(videoContentTypeValues).optional().default('OTHER'),
  source: z.enum(videoSourceValues).optional().default('YOUTUBE'),
  sourceUrl: videoUrlField.optional().nullable(),
  visibility: z.enum(contentVisibilityValues).optional().default('PUBLIC'),
  status: z.enum(contentStatusValues).optional().default('DRAFT'),
  videoCategoryId: z.string().max(100).optional().nullable(),
  createdById: z.string().max(100).optional().nullable(),
  featuredClientId: z.string().max(100).optional().nullable(),
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
  // Content Hub fields
  contentType: z.enum(videoContentTypeValues).optional(),
  source: z.enum(videoSourceValues).optional(),
  sourceUrl: videoUrlField.optional().nullable(),
  visibility: z.enum(contentVisibilityValues).optional(),
  status: z.enum(contentStatusValues).optional(),
  videoCategoryId: z.string().max(100).optional().nullable(),
  createdById: z.string().max(100).optional().nullable(),
  featuredClientId: z.string().max(100).optional().nullable(),
});

export type PatchVideoInput = z.infer<typeof patchVideoSchema>;
