import { z } from 'zod';

// ── AdminNavSection ─────────────────────────────────────────────

export const createNavSectionSchema = z.object({
  railId: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const patchNavSectionSchema = createNavSectionSchema.partial();

// ── AdminNavSubSection ──────────────────────────────────────────

export const createNavSubSectionSchema = z.object({
  sectionId: z.string().cuid(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const patchNavSubSectionSchema = createNavSubSectionSchema.partial();

// ── AdminNavPage ────────────────────────────────────────────────

// Security: Only allow HTTPS URLs for WebNavigator iframe safety
const safeUrlSchema = z.string().url().max(2000).refine(
  (val) => {
    try {
      const parsed = new URL(val);
      return parsed.protocol === 'https:';
    } catch (error) {
      console.error('[AdminNav] URL validation failed:', error);
      return false;
    }
  },
  { message: 'Only HTTPS URLs are allowed for security reasons' }
);

export const createNavPageSchema = z.object({
  subSectionId: z.string().cuid(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional().nullable(),
  url: safeUrlSchema,
  icon: z.string().max(50).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  openInNewTab: z.boolean().default(false),
});

export const patchNavPageSchema = createNavPageSchema.partial();
