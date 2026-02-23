export const dynamic = 'force-dynamic';

// FIX: F5 - Migrated to withAdminGuard for consistent auth + CSRF + rate limiting
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { sanitizeUrl } from '@/lib/sanitize';
import { stripHtml } from '@/lib/validation';
import { logAdminAction, getClientIpFromRequest } from '@/lib/admin-audit';
import { logger } from '@/lib/logger';

// GET - Une slide avec traductions
export const GET = withAdminGuard(async (_request, { params }) => {
  try {
    const id = params!.id;
    const slide = await prisma.heroSlide.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!slide) {
      return NextResponse.json({ error: 'Slide non trouvee' }, { status: 404 });
    }

    return NextResponse.json({ slide });
  } catch (error) {
    logger.error('Error fetching hero slide', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});

// FIX: F6 - Field whitelist for allowed slide fields (prevents arbitrary field injection)
const ALLOWED_SLIDE_FIELDS = new Set([
  'slug', 'mediaType', 'backgroundUrl', 'backgroundMobile', 'overlayOpacity',
  'overlayGradient', 'badgeText', 'title', 'subtitle', 'ctaText', 'ctaUrl',
  'ctaStyle', 'cta2Text', 'cta2Url', 'cta2Style', 'statsJson', 'sortOrder',
  'isActive', 'startDate', 'endDate',
]);

// PUT - Modifier une slide + upsert traductions
export const PUT = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;
    const body = await request.json();
    const { translations, ...rawSlideData } = body;

    // FIX: F6 - Only accept whitelisted fields (prevents arbitrary data injection)
    const slideData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawSlideData)) {
      if (ALLOWED_SLIDE_FIELDS.has(key)) {
        slideData[key] = value;
      }
    }

    // FIX: F8 - Sanitize URL fields to prevent XSS via javascript: protocol
    if (typeof slideData.backgroundUrl === 'string') {
      const safe = sanitizeUrl(slideData.backgroundUrl as string);
      if (!safe) return NextResponse.json({ error: 'URL de fond invalide' }, { status: 400 });
      slideData.backgroundUrl = safe;
    }
    if (typeof slideData.backgroundMobile === 'string' && slideData.backgroundMobile) {
      const safe = sanitizeUrl(slideData.backgroundMobile as string);
      if (!safe) return NextResponse.json({ error: 'URL mobile invalide' }, { status: 400 });
      slideData.backgroundMobile = safe;
    }
    if (typeof slideData.ctaUrl === 'string' && slideData.ctaUrl) {
      slideData.ctaUrl = sanitizeUrl(slideData.ctaUrl as string) || undefined;
    }
    if (typeof slideData.cta2Url === 'string' && slideData.cta2Url) {
      slideData.cta2Url = sanitizeUrl(slideData.cta2Url as string) || undefined;
    }

    // FIX: F8 - Sanitize text fields to prevent stored XSS
    if (typeof slideData.title === 'string') slideData.title = stripHtml(slideData.title as string);
    if (typeof slideData.subtitle === 'string') slideData.subtitle = stripHtml(slideData.subtitle as string);
    if (typeof slideData.badgeText === 'string') slideData.badgeText = stripHtml(slideData.badgeText as string);
    if (typeof slideData.ctaText === 'string') slideData.ctaText = stripHtml(slideData.ctaText as string);
    if (typeof slideData.cta2Text === 'string') slideData.cta2Text = stripHtml(slideData.cta2Text as string);

    // FIX: F8 - Validate statsJson if present
    if (slideData.statsJson !== undefined && slideData.statsJson !== null && slideData.statsJson !== '') {
      try {
        const raw = slideData.statsJson;
        JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
      } catch {
        return NextResponse.json({ error: 'statsJson is not valid JSON' }, { status: 400 });
      }
    }

    // Update date fields
    if (slideData.startDate) slideData.startDate = new Date(slideData.startDate as string);
    else if (slideData.startDate === null || slideData.startDate === '') slideData.startDate = null;
    if (slideData.endDate) slideData.endDate = new Date(slideData.endDate as string);
    else if (slideData.endDate === null || slideData.endDate === '') slideData.endDate = null;

    const existing = await prisma.heroSlide.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Slide non trouvee' }, { status: 404 });
    }

    await prisma.heroSlide.update({
      where: { id },
      data: slideData,
    });

    // Upsert translations
    if (translations && Array.isArray(translations)) {
      for (const t of translations) {
        if (!t.locale || !t.title) continue;
        await prisma.heroSlideTranslation.upsert({
          where: { slideId_locale: { slideId: id, locale: t.locale } },
          create: {
            slideId: id,
            locale: t.locale,
            badgeText: t.badgeText,
            title: t.title,
            subtitle: t.subtitle,
            ctaText: t.ctaText,
            cta2Text: t.cta2Text,
            statsJson: t.statsJson,
          },
          update: {
            badgeText: t.badgeText,
            title: t.title,
            subtitle: t.subtitle,
            ctaText: t.ctaText,
            cta2Text: t.cta2Text,
            statsJson: t.statsJson,
          },
        });
      }
    }

    const updated = await prisma.heroSlide.findUnique({
      where: { id },
      include: { translations: true },
    });

    // Audit log for PUT
    logAdminAction({
      adminUserId: session.user.id,
      action: 'UPDATE_HERO_SLIDE',
      targetType: 'HeroSlide',
      targetId: id,
      previousValue: { title: existing.title, isActive: existing.isActive },
      newValue: slideData,
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    return NextResponse.json({ slide: updated });
  } catch (error) {
    logger.error('Error updating hero slide', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});

// DELETE - Supprimer une slide
export const DELETE = withAdminGuard(async (request, { session, params }) => {
  try {
    const id = params!.id;

    const existing = await prisma.heroSlide.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Slide non trouvee' }, { status: 404 });
    }

    // FIX: F19 - Add audit logging before deletion
    logAdminAction({
      adminUserId: session.user.id,
      action: 'DELETE_HERO_SLIDE',
      targetType: 'HeroSlide',
      targetId: id,
      previousValue: { title: existing.title, slug: existing.slug, backgroundUrl: existing.backgroundUrl },
      ipAddress: getClientIpFromRequest(request),
      userAgent: request.headers.get('user-agent') || undefined,
    }).catch(() => {});

    await prisma.heroSlide.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting hero slide', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
});
