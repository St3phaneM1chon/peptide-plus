export const dynamic = 'force-dynamic';
/**
 * API - Générer et télécharger un reçu PDF
 * Supporte la traduction dans la langue de l'utilisateur
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { generateReceiptPDFi18n } from '@/lib/receipt-generator-i18n';
import { UserRole } from '@/types';
import { getApiTranslator } from '@/i18n/server';
import { type Locale, isValidLocale, defaultLocale } from '@/i18n/config';

interface RouteParams {
  params: Promise<{ purchaseId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { purchaseId } = await params;
    const session = await auth();
    const { t } = await getApiTranslator();

    if (!session?.user) {
      return NextResponse.json({ error: t('errors.unauthorized') }, { status: 401 });
    }

    // Récupérer l'achat avec la locale de l'utilisateur
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            locale: true,
          },
        },
        product: true,
        company: true,
      },
    });

    if (!purchase) {
      return NextResponse.json({ error: t('errors.404.title') }, { status: 404 });
    }

    // Vérifier les permissions
    const isOwner = purchase.userId === session.user.id;
    const isAdmin = session.user.role === UserRole.EMPLOYEE || session.user.role === UserRole.OWNER;
    const isCompanyOwner = purchase.company?.ownerId === session.user.id;

    if (!isOwner && !isAdmin && !isCompanyOwner) {
      return NextResponse.json({ error: t('errors.forbidden') }, { status: 403 });
    }

    // Vérifier que l'achat est complété
    if (purchase.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: t('checkout.errors.paymentFailed') },
        { status: 400 }
      );
    }

    // Déterminer la locale pour le PDF
    // 1. Paramètre URL ?locale=en
    // 2. Locale de l'utilisateur acheteur
    // 3. Locale par défaut
    const urlLocale = request.nextUrl.searchParams.get('locale');
    let pdfLocale: Locale = defaultLocale;
    
    if (urlLocale && isValidLocale(urlLocale)) {
      pdfLocale = urlLocale as Locale;
    } else if (purchase.user.locale && isValidLocale(purchase.user.locale)) {
      pdfLocale = purchase.user.locale as Locale;
    }

    // Calculer les taxes
    const subtotal = Number(purchase.amount);
    const tpsRate = 0.05;
    const tvqRate = 0.09975;
    const tps = subtotal * tpsRate;
    const tvq = subtotal * tvqRate;
    const total = subtotal + tps + tvq;

    // Générer le PDF traduit
    const pdfBuffer = generateReceiptPDFi18n({
      receiptNumber: purchase.receiptNumber || `REC-${purchase.id.slice(0, 8).toUpperCase()}`,
      date: purchase.createdAt,
      customerName: purchase.user.name || 'Client',
      customerEmail: purchase.user.email,
      companyName: purchase.company?.name,
      items: [
        {
          name: purchase.product.name,
          quantity: 1,
          unitPrice: subtotal,
          total: subtotal,
        },
      ],
      subtotal,
      taxes: [
        { name: 'TPS/GST', rate: tpsRate * 100, amount: tps },
        { name: 'TVQ/QST', rate: tvqRate * 100, amount: tvq },
      ],
      total,
      paymentMethod: purchase.paymentMethod,
      locale: pdfLocale,
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'RECEIPT_DOWNLOADED',
        entityType: 'Purchase',
        entityId: purchase.id,
        details: JSON.stringify({ locale: pdfLocale }),
      },
    });

    // Nom du fichier selon la locale
    const fileNames: Partial<Record<Locale, string>> = {
      fr: 'recu',
      en: 'receipt',
      es: 'recibo',
      de: 'quittung',
      it: 'ricevuta',
      pt: 'recibo',
      zh: 'receipt',
      ar: 'receipt',
    };

    const fileName = `${fileNames[pdfLocale] || 'receipt'}-${purchase.receiptNumber || purchase.id}.pdf`;

    // Retourner le PDF (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    const { t } = await getApiTranslator();
    return NextResponse.json(
      { error: t('common.error') },
      { status: 500 }
    );
  }
}
