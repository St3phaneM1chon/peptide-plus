export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

// GET - Liste toutes les slides (admin)
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const slides = await prisma.heroSlide.findMany({
      include: { translations: true },
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json({ slides });
  } catch (error) {
    console.error('Error fetching hero slides:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST - Créer une slide
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json();
    const {
      slug, mediaType, backgroundUrl, backgroundMobile, overlayOpacity,
      overlayGradient, badgeText, title, subtitle, ctaText, ctaUrl, ctaStyle,
      cta2Text, cta2Url, cta2Style, statsJson, sortOrder, isActive,
      startDate, endDate, translations,
    } = body;

    if (!slug || !title || !backgroundUrl) {
      return NextResponse.json(
        { error: 'Champs requis: slug, title, backgroundUrl' },
        { status: 400 }
      );
    }

    const existing = await prisma.heroSlide.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ error: 'Ce slug existe déjà' }, { status: 400 });
    }

    const slide = await prisma.heroSlide.create({
      data: {
        slug,
        mediaType: mediaType || 'IMAGE',
        backgroundUrl,
        backgroundMobile,
        overlayOpacity: overlayOpacity ?? 70,
        overlayGradient,
        badgeText,
        title,
        subtitle,
        ctaText,
        ctaUrl,
        ctaStyle,
        cta2Text,
        cta2Url,
        cta2Style,
        statsJson,
        sortOrder: sortOrder ?? 0,
        isActive: isActive !== undefined ? isActive : true,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        translations: translations?.length > 0 ? {
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
    console.error('Error creating hero slide:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
