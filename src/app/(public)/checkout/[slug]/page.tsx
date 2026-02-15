export const dynamic = 'force-dynamic';
/**
 * PAGE CHECKOUT
 * Paiement multi-providers: Stripe, Apple Pay, Google Pay, PayPal, Click to Pay
 * Gère produits DIGITAL (accès immédiat) et PHYSICAL (avec livraison)
 */

import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth-config';
import { prisma } from '@/lib/db';
import { CheckoutPageClient } from './CheckoutPageClient';

interface CheckoutPageProps {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string) {
  return prisma.product.findUnique({
    where: { slug, isActive: true },
    include: { category: true },
  });
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const session = await auth();

  // Rediriger vers login si non connecté
  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=/checkout/${slug}`);
  }

  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  // Récupérer les cartes sauvegardées
  const savedCards = await prisma.savedCard.findMany({
    where: { userId: session.user.id },
    orderBy: { isDefault: 'desc' },
  });

  // Récupérer les adresses sauvegardées (tous les produits sont physiques pour BioCycle)
  const savedAddresses = await prisma.userAddress.findMany({
    where: { userId: session.user.id },
    orderBy: { isDefault: 'desc' },
  });

  // Tous les produits BioCycle sont physiques et nécessitent une livraison
  const isPhysical = true;

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
        duration: null,
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
