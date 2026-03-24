/**
 * KORALINE PRICING CONSTANTS — Client-safe
 *
 * Pure constants, no server imports (prisma, cache, etc.).
 * Safe to import from 'use client' components.
 */

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export const KORALINE_PLANS = {
  essential: {
    name: 'Koraline Essentiel',
    description: 'Boutique en ligne complète pour petites entreprises (1-3 employés)',
    monthlyPrice: 14900,
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
    includedEmployees: 0,
    includedModules: ['commerce', 'catalogue', 'marketing', 'emails', 'comptabilite', 'systeme'],
  },
  pro: {
    name: 'Koraline Pro',
    description: 'Suite complète pour PME actives (4-15 employés)',
    monthlyPrice: 29900,
    features: [
      'Tout Essentiel +',
      'Comptabilité complète',
      'CRM Basic (pipeline, leads, deals)',
      'Blog & Content Marketing',
      'Bundles produits',
      '1 proprio + 2 employés inclus',
    ],
    includedEmployees: 2,
    includedModules: ['commerce', 'catalogue', 'marketing', 'emails', 'comptabilite', 'systeme', 'crm', 'communaute'],
  },
  enterprise: {
    name: 'Koraline Enterprise',
    description: 'Suite complète pour grandes entreprises (15+ employés)',
    monthlyPrice: 59900,
    features: [
      'Tout Pro +',
      'Support prioritaire',
      '1 proprio + 5 employés inclus',
      'White-label disponible',
    ],
    includedEmployees: 5,
    includedModules: ['commerce', 'catalogue', 'marketing', 'emails', 'comptabilite', 'systeme', 'crm', 'communaute', 'media', 'loyalty'],
  },
} as const;

export type KoralinePlan = keyof typeof KORALINE_PLANS;

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export const KORALINE_MODULES = {
  crm_advanced: { name: 'CRM Avancé', monthlyPrice: 14900, description: 'Pipeline avancé, scoring IA, automatisations' },
  marketplace_starter: { name: 'Marketplace Starter', monthlyPrice: 9900, description: 'Vendeurs tiers, commissions de base' },
  marketplace_pro: { name: 'Marketplace Pro', monthlyPrice: 24900, description: 'Marketplace multi-vendeurs complète' },
  marketplace_enterprise: { name: 'Marketplace Enterprise', monthlyPrice: 49900, description: 'Marketplace illimitée + API' },
  chat: { name: 'Chat & Tickets', monthlyPrice: 4900, description: 'Chat en direct, ticketing, support client' },
  email_marketing: { name: 'Email Marketing', monthlyPrice: 4900, description: 'Campagnes, automatisations, segmentation' },
  loyalty: { name: 'Programme Fidélité', monthlyPrice: 3900, description: 'Points, paliers, récompenses' },
  subscriptions: { name: 'Abonnements & Récurrent', monthlyPrice: 2900, description: 'Produits récurrents, box mensuelles' },
  ambassadors: { name: 'Ambassadeurs & Affiliation', monthlyPrice: 1900, description: 'Programme d\'affiliation, liens de parrainage' },
  monitoring: { name: 'Monitoring & Webhooks', monthlyPrice: 2900, description: 'Surveillance, webhooks, alertes' },
  accounting_advanced: { name: 'Comptabilité Avancée', monthlyPrice: 9900, description: 'Rapports avancés, multi-devises, exports' },
  formation: { name: 'Formation continue (Aptitudes)', monthlyPrice: 4900, description: 'LMS complet: cours, forfaits PQAP, Aurelia IA tutrice, certification, conformité UFC, parrainage corporatif' },
} as const;

export type KoralineModule = keyof typeof KORALINE_MODULES;

// ---------------------------------------------------------------------------
// Licenses
// ---------------------------------------------------------------------------

export const KORALINE_LICENSES = {
  admin: { name: 'Admin', monthlyPrice: 3500 },
  manager: { name: 'Gestionnaire', monthlyPrice: 2500 },
  employee: { name: 'Employé', monthlyPrice: 1500 },
  readonly: { name: 'Lecture seule', monthlyPrice: 500 },
} as const;

export type KoralineLicense = keyof typeof KORALINE_LICENSES;

// ---------------------------------------------------------------------------
// Hybrid Model Constants (D34, D35, D36)
// ---------------------------------------------------------------------------

export const KORALINE_DATA_ACCUMULATION_RATE = 0.15;
export const KORALINE_FREE_ACCUMULATION_MONTHS = 12;

export const KORALINE_LOYALTY_DISCOUNTS = {
  single: { rate: 0.10, term: 24, label: '1 module → -10% sur 24 mois' },
  double: { rate: 0.15, term: 24, label: '2 modules → -15% sur 24 mois' },
  full: { rate: 0.25, term: 24, label: 'Suite complète → -25% sur 24 mois' },
} as const;

export const KORALINE_SOCLE_MODULES = ['dashboard', 'systeme', 'permissions'] as const;

export type CheckoutMode = 'plan' | 'alacarte';
