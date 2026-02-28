/**
 * Brand Kit Service
 * Chantier 4.3: CRUD operations for brand kits.
 *
 * NOTE: Requires a BrandKit model in schema.prisma. Until then,
 * uses a settings-based approach with the existing Setting model
 * or a dedicated table. See schema addition below.
 *
 * Prisma model to add:
 * model BrandKit {
 *   id             String   @id @default(cuid())
 *   name           String
 *   logoUrl        String?
 *   faviconUrl     String?
 *   primaryColor   String?  // Hex color
 *   secondaryColor String?
 *   accentColor    String?
 *   fontHeading    String?
 *   fontBody       String?
 *   guidelines     String?  @db.Text
 *   isActive       Boolean  @default(true)
 *   createdAt      DateTime @default(now())
 *   updatedAt      DateTime @updatedAt
 * }
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types (standalone until Prisma model is added)
// ---------------------------------------------------------------------------

export interface BrandKit {
  id: string;
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  guidelines: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandKitInput {
  name: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  guidelines?: string | null;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// In-memory storage (until Prisma model is added)
// ---------------------------------------------------------------------------

// Placeholder using JSON file or env-based config
// When BrandKit model is added to Prisma, replace these functions

let brandKitCache: BrandKit | null = null;

/**
 * Get the active brand kit.
 */
export async function getActiveBrandKit(): Promise<BrandKit | null> {
  // TODO: Replace with Prisma query when model is added
  // return prisma.brandKit.findFirst({ where: { isActive: true } });
  if (brandKitCache) return brandKitCache;

  // Default brand kit from environment
  const defaultKit: BrandKit = {
    id: 'default',
    name: process.env.BRAND_NAME || 'BioCycle Peptides',
    logoUrl: process.env.BRAND_LOGO_URL || null,
    faviconUrl: process.env.BRAND_FAVICON_URL || null,
    primaryColor: process.env.BRAND_PRIMARY_COLOR || '#1e40af',
    secondaryColor: process.env.BRAND_SECONDARY_COLOR || '#7c3aed',
    accentColor: process.env.BRAND_ACCENT_COLOR || '#059669',
    fontHeading: process.env.BRAND_FONT_HEADING || 'Inter',
    fontBody: process.env.BRAND_FONT_BODY || 'Inter',
    guidelines: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  brandKitCache = defaultKit;
  return defaultKit;
}

/**
 * Update the brand kit.
 */
export async function updateBrandKit(input: Partial<BrandKitInput>): Promise<BrandKit> {
  // TODO: Replace with Prisma update when model is added
  const current = await getActiveBrandKit();
  if (!current) throw new Error('No brand kit found');

  const updated: BrandKit = {
    ...current,
    ...input,
    updatedAt: new Date(),
  };

  brandKitCache = updated;
  logger.info('[BrandKit] Updated brand kit', { name: updated.name });
  return updated;
}

/**
 * Generate CSS variables from the brand kit for frontend use.
 */
export function brandKitToCSSVars(kit: BrandKit): Record<string, string> {
  const vars: Record<string, string> = {};
  if (kit.primaryColor) vars['--brand-primary'] = kit.primaryColor;
  if (kit.secondaryColor) vars['--brand-secondary'] = kit.secondaryColor;
  if (kit.accentColor) vars['--brand-accent'] = kit.accentColor;
  if (kit.fontHeading) vars['--brand-font-heading'] = kit.fontHeading;
  if (kit.fontBody) vars['--brand-font-body'] = kit.fontBody;
  return vars;
}
