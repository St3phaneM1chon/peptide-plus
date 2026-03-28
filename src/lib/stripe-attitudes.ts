/**
 * STRIPE CLIENT — Attitudes VIP (Koraline SaaS Platform Billing)
 *
 * Compte Stripe séparé (platform). Utilisé UNIQUEMENT pour :
 * - Facturation des abonnements Koraline (plans + modules + licences)
 * - Factures automatiques aux clients Koraline
 * - Gestion des paiements récurrents de la plateforme
 *
 * Les clients Koraline utilisent LEUR PROPRE processeur de paiement
 * pour leurs clients finaux (via le STRIPE_SECRET_KEY principal ou autre).
 */

import Stripe from 'stripe';

let _stripeAttitudes: Stripe | null = null;

/**
 * Lazy-initialized Stripe client for Attitudes VIP platform billing.
 * Uses STRIPE_ATTITUDES_SECRET_KEY (separate from the main STRIPE_SECRET_KEY).
 */
export function getStripeAttitudes(): Stripe {
  if (!_stripeAttitudes) {
    const key = process.env.STRIPE_ATTITUDES_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_ATTITUDES_SECRET_KEY is not configured');
    }
    _stripeAttitudes = new Stripe(key, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
  }
  return _stripeAttitudes;
}

// ---------------------------------------------------------------------------
// Koraline Plans — Products & Prices
// ---------------------------------------------------------------------------

export const KORALINE_PLANS = {
  essential: {
    name: 'Koraline Essentiel',
    description: 'Boutique en ligne complète pour petites entreprises (1-3 employés)',
    monthlyPrice: 14900, // 149.00 CAD in cents
    features: [
      'Commerce complet',
      'Catalogue produits',
      'Marketing de base',
      'Emails',
      'Comptabilité de base',
      'Système & permissions',
      '1 licence propriétaire incluse',
      'Domaine custom',
      'Branding personnalisé',
    ],
    includedEmployees: 0, // Only owner
  },
  pro: {
    name: 'Koraline Pro',
    description: 'Suite complète pour PME actives (4-15 employés)',
    monthlyPrice: 29900, // 299.00 CAD
    features: [
      'Tout Essentiel +',
      'Comptabilité complète',
      'CRM Basic (pipeline, leads, deals)',
      'Blog & Content Marketing',
      'Bundles produits',
      '1 proprio + 2 employés inclus',
    ],
    includedEmployees: 2,
  },
  enterprise: {
    name: 'Koraline Enterprise',
    description: 'Suite complète pour grandes entreprises (15+ employés)',
    monthlyPrice: 59900, // 599.00 CAD
    features: [
      'Tout Pro +',
      'Support prioritaire',
      '1 proprio + 5 employés inclus',
      'White-label disponible',
    ],
    includedEmployees: 5,
  },
} as const;

export type KoralinePlan = keyof typeof KORALINE_PLANS;

// ---------------------------------------------------------------------------
// Optional Modules — Add-on pricing
// ---------------------------------------------------------------------------

export const KORALINE_MODULES = {
  crm_advanced: { name: 'CRM Avancé', monthlyPrice: 14900 },
  marketplace_starter: { name: 'Marketplace Starter', monthlyPrice: 9900 },
  marketplace_pro: { name: 'Marketplace Pro', monthlyPrice: 24900 },
  marketplace_enterprise: { name: 'Marketplace Enterprise', monthlyPrice: 49900 },
  chat: { name: 'Chat & Tickets', monthlyPrice: 4900 },
  email_marketing: { name: 'Email Marketing', monthlyPrice: 4900 },
  loyalty: { name: 'Programme Fidélité', monthlyPrice: 3900 },
  subscriptions: { name: 'Abonnements & Récurrent', monthlyPrice: 2900 },
  ambassadors: { name: 'Ambassadeurs & Affiliation', monthlyPrice: 1900 },
  monitoring: { name: 'Monitoring & Webhooks', monthlyPrice: 2900 },
  accounting_advanced: { name: 'Comptabilité Avancée', monthlyPrice: 9900 },
} as const;

export type KoralineModule = keyof typeof KORALINE_MODULES;

// ---------------------------------------------------------------------------
// Employee Licenses — Per-seat pricing
// ---------------------------------------------------------------------------

export const KORALINE_LICENSES = {
  admin: { name: 'Admin', monthlyPrice: 3500 },
  manager: { name: 'Gestionnaire', monthlyPrice: 2500 },
  employee: { name: 'Employé', monthlyPrice: 1500 },
  readonly: { name: 'Lecture seule', monthlyPrice: 500 },
} as const;

export type KoralineLicense = keyof typeof KORALINE_LICENSES;

// ---------------------------------------------------------------------------
// Price ID Lookup — Resolves Stripe Price IDs for plans, modules, and licenses
// ---------------------------------------------------------------------------

/**
 * Resolves a Stripe Price ID for a given product type and key.
 * Looks up the price from Stripe products by metadata or naming convention.
 * Returns null if not found (caller should handle gracefully).
 */
export async function getStripePriceId(
  type: 'plan' | 'module' | 'license' | 'socle_mini',
  key: string
): Promise<string | null> {
  try {
    const stripe = getStripeAttitudes();
    const searchQuery = type === 'socle_mini' ? 'socle_mini' : `${type}_${key}`;

    // Search for active prices matching our lookup key in metadata
    const prices = await stripe.prices.list({
      active: true,
      lookup_keys: [searchQuery],
      limit: 1,
    });

    if (prices.data.length > 0) {
      return prices.data[0].id;
    }

    // Fallback: search products by metadata
    const products = await stripe.products.search({
      query: `metadata["koraline_type"]:"${type}" AND metadata["koraline_key"]:"${key || type}"`,
      limit: 1,
    });

    if (products.data.length > 0 && products.data[0].default_price) {
      return typeof products.data[0].default_price === 'string'
        ? products.data[0].default_price
        : products.data[0].default_price.id;
    }

    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Checkout Session for new tenant subscription
// ---------------------------------------------------------------------------

/**
 * Creates a Stripe Checkout Session for a new Koraline tenant subscription.
 * The customer selects a plan, and optionally modules and licenses.
 */
export async function createTenantCheckoutSession(params: {
  plan: KoralinePlan;
  tenantSlug: string;
  tenantName: string;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeAttitudes();
  const planConfig = KORALINE_PLANS[params.plan];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: params.customerEmail,
    line_items: [
      {
        price_data: {
          currency: 'cad',
          product_data: {
            name: planConfig.name,
            description: planConfig.description,
          },
          unit_amount: planConfig.monthlyPrice,
          recurring: {
            interval: 'month',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      tenant_slug: params.tenantSlug,
      tenant_name: params.tenantName,
      plan: params.plan,
      type: 'koraline_subscription',
    },
    subscription_data: {
      metadata: {
        tenant_slug: params.tenantSlug,
        plan: params.plan,
      },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
  });

  return session;
}
