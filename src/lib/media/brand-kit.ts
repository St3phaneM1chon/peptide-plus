/**
 * Brand Kit Service
 * C-05 fix: Migrated from in-memory to Prisma persistence.
 * Data survives redeploys.
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types (matches Prisma BrandKit model)
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
// Default values (used for initial seeding)
// ---------------------------------------------------------------------------

const DEFAULT_BRAND_KIT: Omit<BrandKit, 'id' | 'createdAt' | 'updatedAt'> = {
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
};

// ---------------------------------------------------------------------------
// CRUD operations (Prisma-backed)
// ---------------------------------------------------------------------------

/**
 * Get the active brand kit. Creates a default one if none exists.
 */
export async function getActiveBrandKit(): Promise<BrandKit> {
  try {
    const existing = await prisma.brandKit.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) return existing;

    // Auto-seed default brand kit on first access
    const created = await prisma.brandKit.create({
      data: DEFAULT_BRAND_KIT,
    });
    logger.info('[BrandKit] Created default brand kit');
    return created;
  } catch (error) {
    logger.error('[BrandKit] Error fetching brand kit', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Update the brand kit.
 */
export async function updateBrandKit(input: Partial<BrandKitInput>): Promise<BrandKit> {
  const current = await getActiveBrandKit();

  const updated = await prisma.brandKit.update({
    where: { id: current.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
      ...(input.faviconUrl !== undefined && { faviconUrl: input.faviconUrl }),
      ...(input.primaryColor !== undefined && { primaryColor: input.primaryColor }),
      ...(input.secondaryColor !== undefined && { secondaryColor: input.secondaryColor }),
      ...(input.accentColor !== undefined && { accentColor: input.accentColor }),
      ...(input.fontHeading !== undefined && { fontHeading: input.fontHeading }),
      ...(input.fontBody !== undefined && { fontBody: input.fontBody }),
      ...(input.guidelines !== undefined && { guidelines: input.guidelines }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

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
