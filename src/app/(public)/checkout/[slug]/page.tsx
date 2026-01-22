/**
 * PAGE CHECKOUT
 * Paiement multi-providers: Stripe, Apple Pay, Google Pay, PayPal, Click to Pay
 * Gère produits DIGITAL (accès immédiat) et PHYSICAL (avec livraison)
 */

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { CheckoutForm } from '@/components/payment/CheckoutForm';
import { CheckoutPageClient } from './CheckoutPageClient';

interface CheckoutPageProps {
  params: { slug: string };
}

async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug, isActive: true },
    include: { category: true },
  });
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const session = await auth();

  // Rediriger vers login si non connecté
  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=/checkout/${params.slug}`);
  }

  const product = await getProduct(params.slug);

  if (!product) {
    notFound();
  }

  // Pour les produits digitaux, vérifier si déjà acheté
  if (product.productType === 'DIGITAL') {
    const existingAccess = await prisma.courseAccess.findUnique({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId: product.id,
        },
      },
    });

    if (existingAccess) {
      redirect(`/cours/${params.slug}/learn`);
    }
  }

  // Récupérer les cartes sauvegardées
  const savedCards = await prisma.savedCard.findMany({
    where: { userId: session.user.id },
    orderBy: { isDefault: 'desc' },
  });

  // Récupérer les adresses sauvegardées (pour produits physiques)
  const savedAddresses = product.productType !== 'DIGITAL'
    ? await prisma.userAddress.findMany({
        where: { userId: session.user.id },
        orderBy: { isDefault: 'desc' },
      })
    : [];

  const isPhysical = product.productType === 'PHYSICAL' || product.productType === 'HYBRID';

  return (
    <CheckoutPageClient
      product={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        compareAtPrice: product.compareAtPrice ? Number(product.compareAtPrice) : null,
        imageUrl: product.imageUrl,
        categoryName: product.category?.name || null,
        productType: product.productType,
        duration: product.duration,
      }}
      user={{
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || '',
      }}
      savedCards={savedCards.map((card) => ({
        id: card.id,
        brand: card.brand,
        last4: card.last4,
        expMonth: card.expMonth,
        expYear: card.expYear,
        isDefault: card.isDefault,
      }))}
      savedAddresses={savedAddresses.map((addr) => ({
        id: addr.id,
        label: addr.label,
        recipientName: addr.recipientName,
        addressLine1: addr.addressLine1,
        addressLine2: addr.addressLine2,
        city: addr.city,
        state: addr.state,
        postalCode: addr.postalCode,
        country: addr.country,
        phone: addr.phone,
        isDefault: addr.isDefault,
      }))}
      isPhysical={isPhysical}
    />
  );
}
