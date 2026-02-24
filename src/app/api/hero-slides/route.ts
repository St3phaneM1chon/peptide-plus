export const dynamic = 'force-dynamic';

// FIX: F5 - Migrated to withAdminGuard for consistent auth + CSRF + rate limiting
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sanitizeUrl } from '@/lib/sanitize';
import { stripHtml } from '@/lib/validation';
import { logger } from '@/lib/logger';

const heroSlideTranslationSchema = z.object({
  locale: z.string().min(1),
  badgeText: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  cta2Text: z.string().optional(),
  statsJson: z.string().optional(),
});

const createHeroSlideSchema = z.object({
  slug: z.string().min(1, 'slug is required').max(200),
  mediaType: z.string().optional(),
  backgroundUrl: z.string().min(1, 'backgroundUrl is required').max(1000),
  backgroundMobile: z.string().max(1000).optional().nullable(),
  overlayOpacity: z.number().min(0).max(100).optional(),
  overlayGradient: z.string().max(500).optional().nullable(),
  badgeText: z.string().max(200).optional().nullable(),
  title: z.string().min(1, 'title is required').max(500),
  subtitle: z.string().max(1000).optional().nullable(),
  ctaText: z.string().max(200).optional().nullable(),
  ctaUrl: z.string().max(500).optional().nullable(),
  ctaStyle: z.string().max(100).optional().nullable(),
  cta2Text: z.string().max(200).optional().nullable(),
  cta2Url: z.string().max(500).optional().nullable(),
  cta2Style: z.string().max(100).optional().nullable(),
  statsJson: z.unknown().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  translations: z.array(heroSlideTranslationSchema).optional(),
});

// GET - Liste toutes les slides (admin)
export const GET = withAdminGuard(async () => {
  try {
    const slides = await prisma.heroSlide.findMany({
      include: { translations: true },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ slides });
  } catch (error) {
    logger.error('Error fetching hero slides', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});

// POST - Creer une slide
export const POST = withAdminGuard(async (request) => {
  try {
    const body = await request.json();
    const parsed = createHeroSlideSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data', details: parsed.error.errors }, { status: 400 });
    }
    const {
      slug, mediaType, backgroundUrl, backgroundMobile, overlayOpacity,
      overlayGradient, badgeText, title, subtitle, ctaText, ctaUrl, ctaStyle,
      cta2Text, cta2Url, cta2Style, statsJson, sortOrder, isActive,
      startDate, endDate, translations,
    } = parsed.data;

    // BE-SEC-06: Validate URLs to prevent SSRF and XSS via javascript: protocol
    const safeBackgroundUrl = sanitizeUrl(backgroundUrl);
    if (!safeBackgroundUrl) {
      return NextResponse.json({ error: 'URL de fond invalide' }, { status: 400 });
    }
    const safeBackgroundMobile = backgroundMobile ? sanitizeUrl(backgroundMobile) : null;
    if (backgroundMobile && !safeBackgroundMobile) {
      return NextResponse.json({ error: 'URL mobile invalide' }, { status: 400 });
    }

    // FIX: F7 - Sanitize text fields to prevent XSS
    const safeTitle = typeof title === 'string' ? stripHtml(title) : title;
    const safeSubtitle = typeof subtitle === 'string' ? stripHtml(subtitle) : subtitle;
    const safeBadgeText = typeof badgeText === 'string' ? stripHtml(badgeText) : badgeText;

    const existing = await prisma.heroSlide.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Ce slug existe deja' }, { status: 400 });
    }

    // FIX: F26 - Validate statsJson before save
    let validatedStatsJson = undefined;
    if (statsJson) {
      try {
        JSON.parse(typeof statsJson === 'string' ? statsJson : JSON.stringify(statsJson));
        validatedStatsJson = statsJson;
      } catch {
        return NextResponse.json({ error: 'statsJson is not valid JSON' }, { status: 400 });
      }
    }

    const slide = await prisma.heroSlide.create({
      data: {
        slug,
        mediaType: mediaType || 'IMAGE',
        backgroundUrl: safeBackgroundUrl,
        backgroundMobile: safeBackgroundMobile,
        overlayOpacity: overlayOpacity ?? 70,
        overlayGradient,
        badgeText: safeBadgeText,
        title: safeTitle,
        subtitle: safeSubtitle,
        ctaText: typeof ctaText === 'string' ? stripHtml(ctaText) : ctaText,
        ctaUrl: ctaUrl ? sanitizeUrl(ctaUrl) || undefined : undefined,
        ctaStyle,
        cta2Text: typeof cta2Text === 'string' ? stripHtml(cta2Text) : cta2Text,
        cta2Url: cta2Url ? sanitizeUrl(cta2Url) || undefined : undefined,
        cta2Style,
        statsJson: validatedStatsJson,
        sortOrder: sortOrder ?? 0,
        isActive: isActive !== undefined ? isActive : true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        translations: translations && translations.length > 0 ? {
          create: translations.map((t: Record<string, string>) => ({
            locale: t.locale,
            badgeText: t.badgeText,
            title: t.title,
            subtitle: t.subtitle,
            ctaText: t.ctaText,
            cta2Text: t.cta2Text,
            statsJson: t.statsJson,
          })),
        } : undefined,
      },
      include: { translations: true },
    });

    return NextResponse.json({ slide }, { status: 201 });
  } catch (error) {
    logger.error('Error creating hero slide', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});
