export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { UserRole } from '@/types';

// GET - Une slide avec traductions
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { id } = await params;
    const slide = await prisma.heroSlide.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!slide) {
      return NextResponse.json({ error: 'Slide non trouvée' }, { status: 404 });
    }

    return NextResponse.json({ slide });
  } catch (error) {
    console.error('Error fetching hero slide:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PUT - Modifier une slide + upsert traductions
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { translations, ...slideData } = body;

    // Update date fields
    if (slideData.startDate) slideData.startDate = new Date(slideData.startDate);
    else if (slideData.startDate === null || slideData.startDate === '') slideData.startDate = null;
    if (slideData.endDate) slideData.endDate = new Date(slideData.endDate);
    else if (slideData.endDate === null || slideData.endDate === '') slideData.endDate = null;

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

    return NextResponse.json({ slide: updated });
  } catch (error) {
    console.error('Error updating hero slide:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE - Supprimer une slide
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== UserRole.EMPLOYEE && session.user.role !== UserRole.OWNER)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const { id } = await params;
    await prisma.heroSlide.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting hero slide:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
