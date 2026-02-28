/**
 * Media Validation Schemas (Zod)
 * Chantier 1.4: Shared client/server validation for media forms.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const urlField = z.string().max(2000).refine(
  (url) => url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'),
  { message: 'URL must start with http://, https://, or /' }
);

// ---------------------------------------------------------------------------
// Social Post
// ---------------------------------------------------------------------------

export const platformValues = ['instagram', 'facebook', 'twitter', 'tiktok', 'linkedin'] as const;
export type SocialPlatform = typeof platformValues[number];

export const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  instagram: 2200,
  facebook: 63206,
  twitter: 280,
  tiktok: 2200,
  linkedin: 3000,
};

export const createSocialPostSchema = z.object({
  platform: z.union([
    z.enum(platformValues),
    z.array(z.enum(platformValues)).min(1).max(5),
  ]),
  content: z.string().min(1).max(63206),
  imageUrl: z.string().url().nullable().optional(),
  scheduledAt: z.string().datetime(),
  status: z.enum(['draft', 'scheduled']).default('scheduled'),
}).strict();

export const updateSocialPostSchema = z.object({
  content: z.string().min(1).max(63206).optional(),
  imageUrl: z.string().url().nullable().optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(['draft', 'scheduled']).optional(),
}).strict();

export type CreateSocialPostInput = z.infer<typeof createSocialPostSchema>;
export type UpdateSocialPostInput = z.infer<typeof updateSocialPostSchema>;

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

export const consentStatusValues = ['PENDING', 'GRANTED', 'DENIED', 'REVOKED', 'EXPIRED'] as const;

export const createConsentSchema = z.object({
  videoId: z.string().min(1),
  clientId: z.string().min(1),
  templateId: z.string().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
}).strict();

export const updateConsentSchema = z.object({
  status: z.enum(consentStatusValues).optional(),
  notes: z.string().max(2000).optional().nullable(),
}).strict();

export type CreateConsentInput = z.infer<typeof createConsentSchema>;
export type UpdateConsentInput = z.infer<typeof updateConsentSchema>;

// ---------------------------------------------------------------------------
// Video Category
// ---------------------------------------------------------------------------

export const createVideoCategorySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).max(99999).optional().default(0),
  isActive: z.boolean().optional().default(true),
  parentId: z.string().optional().nullable(),
}).strict();

export const updateVideoCategorySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).max(99999).optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
}).strict();

export type CreateVideoCategoryInput = z.infer<typeof createVideoCategorySchema>;
export type UpdateVideoCategoryInput = z.infer<typeof updateVideoCategorySchema>;

// ---------------------------------------------------------------------------
// Brand Kit
// ---------------------------------------------------------------------------

export const brandKitSchema = z.object({
  name: z.string().min(1).max(200),
  logoUrl: urlField.optional().nullable(),
  faviconUrl: urlField.optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().nullable(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().nullable(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color').optional().nullable(),
  fontHeading: z.string().max(100).optional().nullable(),
  fontBody: z.string().max(100).optional().nullable(),
  guidelines: z.string().max(10000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
}).strict();

export type BrandKitInput = z.infer<typeof brandKitSchema>;

// ---------------------------------------------------------------------------
// Media Upload (client-side validation before FormData)
// ---------------------------------------------------------------------------

export const mediaUploadSchema = z.object({
  folder: z.string().max(200).regex(/^[a-zA-Z0-9_\-\/]+$/, 'Invalid folder path').optional().default('general'),
  alt: z.string().max(500).optional().nullable(),
});

export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
