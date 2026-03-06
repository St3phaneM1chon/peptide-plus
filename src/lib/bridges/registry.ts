/**
 * Bridge Registry
 *
 * Central catalogue of all cross-module bridges. Used for:
 * - Feature flags admin page (toggle modules → show/hide bridges)
 * - Documentation / audit of which bridges exist
 * - Generating API endpoint URLs dynamically
 */

import type { BridgeModule } from './types';

export interface BridgeDefinition {
  /** Unique identifier, e.g. "#3" */
  id: string;
  /** Source module */
  source: BridgeModule;
  /** Target module */
  target: BridgeModule;
  /** Human-readable label */
  label: string;
  /** i18n key for the label */
  i18nKey: string;
  /** API endpoint template — {id} is replaced at runtime */
  endpoint: string;
  /** Implementation status */
  status: 'done' | 'partial' | 'planned';
  /** Where the bridge is rendered */
  renderedIn?: string;
}

/**
 * Full registry of all bridges (implemented + planned).
 * Sorted by bridge ID number.
 */
export const BRIDGE_REGISTRY: BridgeDefinition[] = [
  // ── Implemented ─────────────────────────────────────────
  {
    id: '#1-2',
    source: 'crm',
    target: 'ecommerce',
    label: 'CRM → Commerce (Purchase History)',
    i18nKey: 'admin.bridges.crmPurchaseHistory',
    endpoint: '/api/admin/crm/deals/{id}',
    status: 'done',
    renderedIn: 'deals/[id]/page.tsx',
  },
  {
    id: '#3',
    source: 'ecommerce',
    target: 'accounting',
    label: 'Commerce → Comptabilité',
    i18nKey: 'admin.bridges.orderAccounting',
    endpoint: '/api/admin/orders/{id}/accounting',
    status: 'done',
    renderedIn: 'commandes/page.tsx',
  },
  {
    id: '#4',
    source: 'accounting',
    target: 'ecommerce',
    label: 'Comptabilité → Commerce',
    i18nKey: 'admin.bridges.accountingOrder',
    endpoint: '/api/accounting/entries',
    status: 'done',
    renderedIn: 'comptabilite/ecritures/page.tsx',
  },
  {
    id: '#5',
    source: 'ecommerce',
    target: 'loyalty',
    label: 'Commerce → Fidélité',
    i18nKey: 'admin.bridges.orderLoyalty',
    endpoint: '/api/admin/orders/{id}/loyalty',
    status: 'done',
    renderedIn: 'commandes/page.tsx',
  },
  {
    id: '#7',
    source: 'crm',
    target: 'voip',
    label: 'CRM → Téléphonie (Call History)',
    i18nKey: 'admin.bridges.crmCallHistory',
    endpoint: '/api/admin/crm/deals/{id}',
    status: 'done',
    renderedIn: 'deals/[id]/page.tsx',
  },
  {
    id: '#8',
    source: 'voip',
    target: 'crm',
    label: 'Téléphonie → CRM',
    i18nKey: 'admin.bridges.voipCrm',
    endpoint: '/api/admin/voip/call-logs/{id}',
    status: 'done',
    renderedIn: 'telephonie/journal/CallLogClient.tsx',
  },
  {
    id: '#9',
    source: 'ecommerce',
    target: 'marketing',
    label: 'Commerce → Marketing',
    i18nKey: 'admin.bridges.orderMarketing',
    endpoint: '/api/admin/orders/{id}/marketing',
    status: 'done',
    renderedIn: 'commandes/page.tsx',
  },
  {
    id: '#11',
    source: 'crm',
    target: 'email',
    label: 'CRM → Email',
    i18nKey: 'admin.bridges.crmEmail',
    endpoint: '/api/admin/crm/deals/{id}',
    status: 'done',
    renderedIn: 'deals/[id]/page.tsx',
  },
  {
    id: '#13',
    source: 'voip',
    target: 'ecommerce',
    label: 'Téléphonie → Commerce',
    i18nKey: 'admin.bridges.voipOrders',
    endpoint: '/api/admin/voip/call-logs/{id}',
    status: 'done',
    renderedIn: 'telephonie/journal/CallLogClient.tsx',
  },
  {
    id: '#15',
    source: 'crm',
    target: 'loyalty',
    label: 'CRM → Fidélité',
    i18nKey: 'admin.bridges.crmLoyalty',
    endpoint: '/api/admin/crm/deals/{id}',
    status: 'done',
    renderedIn: 'deals/[id]/page.tsx',
  },
  {
    id: '#18',
    source: 'system',
    target: 'ecommerce',
    label: 'Dashboard → Tous',
    i18nKey: 'admin.bridges.dashboardCrossModule',
    endpoint: '/api/admin/dashboard/cross-module',
    status: 'done',
    renderedIn: 'dashboard/DashboardClient.tsx',
  },

  // ── New bridges (Phase 1+) ──────────────────────────────
  {
    id: '#22',
    source: 'ecommerce',
    target: 'email',
    label: 'Commerce → Emails',
    i18nKey: 'admin.bridges.orderEmails',
    endpoint: '/api/admin/orders/{id}/emails',
    status: 'done',
    renderedIn: 'commandes/page.tsx',
  },
  {
    id: '#23',
    source: 'ecommerce',
    target: 'voip',
    label: 'Commerce → Téléphonie',
    i18nKey: 'admin.bridges.orderCalls',
    endpoint: '/api/admin/orders/{id}/calls',
    status: 'done',
    renderedIn: 'commandes/page.tsx',
  },
  {
    id: '#24',
    source: 'ecommerce',
    target: 'crm',
    label: 'Commerce → CRM (Source Deal)',
    i18nKey: 'admin.bridges.orderDeal',
    endpoint: '/api/admin/orders/{id}/deal',
    status: 'done',
    renderedIn: 'commandes/page.tsx',
  },
  {
    id: '#12',
    source: 'email',
    target: 'crm',
    label: 'Email → CRM',
    i18nKey: 'admin.bridges.emailCrm',
    endpoint: '/api/admin/emails/{id}/crm',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#14',
    source: 'accounting',
    target: 'crm',
    label: 'Comptabilité → CRM',
    i18nKey: 'admin.bridges.accountingCrm',
    endpoint: '/api/admin/accounting/entries/{id}/crm',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#6',
    source: 'loyalty',
    target: 'ecommerce',
    label: 'Fidélité → Commerce',
    i18nKey: 'admin.bridges.loyaltyOrders',
    endpoint: '/api/admin/loyalty/members/{id}/orders',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#10',
    source: 'marketing',
    target: 'ecommerce',
    label: 'Marketing → Commerce (Revenue)',
    i18nKey: 'admin.bridges.promoRevenue',
    endpoint: '/api/admin/promo-codes/{id}/revenue',
    status: 'done',
    renderedIn: 'promo-codes/page.tsx',
  },
  {
    id: '#16',
    source: 'marketing',
    target: 'crm',
    label: 'Marketing → CRM',
    i18nKey: 'admin.bridges.marketingCrm',
    endpoint: '/api/admin/promo-codes/{id}/crm',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#17',
    source: 'catalog',
    target: 'marketing',
    label: 'Catalogue → Marketing (Promos)',
    i18nKey: 'admin.bridges.productPromos',
    endpoint: '/api/admin/products/{id}/promos',
    status: 'done',
    renderedIn: 'produits/[id]/ProductEditClient.tsx',
  },
  {
    id: '#25',
    source: 'catalog',
    target: 'ecommerce',
    label: 'Catalogue → Commerce (Stats Ventes)',
    i18nKey: 'admin.bridges.productSales',
    endpoint: '/api/admin/products/{id}/sales',
    status: 'done',
    renderedIn: 'produits/[id]/ProductEditClient.tsx',
  },
  {
    id: '#26',
    source: 'catalog',
    target: 'community',
    label: 'Catalogue → Communauté (Avis)',
    i18nKey: 'admin.bridges.productReviews',
    endpoint: '/api/admin/products/{id}/reviews',
    status: 'done',
    renderedIn: 'produits/[id]/ProductEditClient.tsx',
  },
  {
    id: '#27',
    source: 'catalog',
    target: 'media',
    label: 'Catalogue → Media (Vidéos)',
    i18nKey: 'admin.bridges.productVideos',
    endpoint: '/api/admin/products/{id}/videos',
    status: 'done',
    renderedIn: 'produits/[id]/ProductEditClient.tsx',
  },
  {
    id: '#28',
    source: 'catalog',
    target: 'crm',
    label: 'Catalogue → CRM (Deals)',
    i18nKey: 'admin.bridges.productDeals',
    endpoint: '/api/admin/products/{id}/deals',
    status: 'done',
    renderedIn: 'produits/[id]/ProductEditClient.tsx',
  },
  {
    id: '#33',
    source: 'marketing',
    target: 'email',
    label: 'Marketing → Emails (Stats Campagne)',
    i18nKey: 'admin.bridges.campaignEmailStats',
    endpoint: '/api/admin/newsletter/campaigns/{id}/emails',
    status: 'done',
    renderedIn: 'newsletter/page.tsx',
  },
  {
    id: '#44',
    source: 'email',
    target: 'marketing',
    label: 'Emails → Marketing (Campagne Source)',
    i18nKey: 'admin.bridges.emailCampaign',
    endpoint: '/api/admin/emails/{id}/campaign',
    status: 'done',
    renderedIn: 'emails/page.tsx (campaigns tab)',
  },
  {
    id: '#43',
    source: 'email',
    target: 'ecommerce',
    label: 'Emails → Commerce',
    i18nKey: 'admin.bridges.emailOrders',
    endpoint: '/api/admin/emails/{id}/orders',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#45',
    source: 'voip',
    target: 'loyalty',
    label: 'Téléphonie → Fidélité',
    i18nKey: 'admin.bridges.voipLoyalty',
    endpoint: '/api/admin/voip/call-logs/{id}/loyalty',
    status: 'done',
    renderedIn: '(API ready, consumed by call detail)',
  },
  {
    id: '#46',
    source: 'voip',
    target: 'email',
    label: 'Téléphonie → Emails',
    i18nKey: 'admin.bridges.voipEmails',
    endpoint: '/api/admin/voip/call-logs/{id}/emails',
    status: 'done',
    renderedIn: '(API ready, consumed by call detail)',
  },
  {
    id: '#50',
    source: 'crm',
    target: 'accounting',
    label: 'CRM → Comptabilité',
    i18nKey: 'admin.bridges.crmAccounting',
    endpoint: '/api/admin/crm/deals/{id}/accounting',
    status: 'done',
    renderedIn: 'crm/deals/[id]/page.tsx',
  },
  {
    id: '#47',
    source: 'crm',
    target: 'catalog',
    label: 'CRM → Catalogue (Produits Deal)',
    i18nKey: 'admin.bridges.dealProducts',
    endpoint: '/api/admin/crm/deals/{id}/products',
    status: 'done',
    renderedIn: 'crm/deals/[id]/page.tsx',
  },
  {
    id: '#48',
    source: 'crm',
    target: 'marketing',
    label: 'CRM → Marketing (Promos Contact)',
    i18nKey: 'admin.bridges.dealMarketing',
    endpoint: '/api/admin/crm/deals/{id}/marketing',
    status: 'done',
    renderedIn: 'crm/deals/[id]/page.tsx',
  },
  // ── Batch bridges (Phase 5+) ──────────────────────────────
  {
    id: '#19',
    source: 'ecommerce',
    target: 'catalog',
    label: 'Commerce → Catalogue (Produits Commande)',
    i18nKey: 'admin.bridges.orderProducts',
    endpoint: '/api/admin/orders/{id}/products',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#20',
    source: 'ecommerce',
    target: 'community',
    label: 'Commerce → Communauté (Avis Client)',
    i18nKey: 'admin.bridges.orderReviews',
    endpoint: '/api/admin/orders/{id}/reviews',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#29',
    source: 'marketing',
    target: 'catalog',
    label: 'Marketing → Catalogue (Produits Promo)',
    i18nKey: 'admin.bridges.promoProducts',
    endpoint: '/api/admin/promo-codes/{id}/products',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#34',
    source: 'community',
    target: 'ecommerce',
    label: 'Communauté → Commerce (Achats Reviewer)',
    i18nKey: 'admin.bridges.reviewPurchases',
    endpoint: '/api/admin/reviews/{id}/purchases',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#35',
    source: 'community',
    target: 'catalog',
    label: 'Communauté → Catalogue (Produit Avis)',
    i18nKey: 'admin.bridges.reviewProduct',
    endpoint: '/api/admin/reviews/{id}/product',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#36',
    source: 'community',
    target: 'crm',
    label: 'Communauté → CRM (Deals Reviewer)',
    i18nKey: 'admin.bridges.reviewCrm',
    endpoint: '/api/admin/reviews/{id}/crm',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#37',
    source: 'loyalty',
    target: 'marketing',
    label: 'Fidélité → Marketing (Promos Membres)',
    i18nKey: 'admin.bridges.loyaltyPromos',
    endpoint: '/api/admin/loyalty/transactions/promos',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#38',
    source: 'loyalty',
    target: 'community',
    label: 'Fidélité → Communauté (Points Avis)',
    i18nKey: 'admin.bridges.loyaltyCommunity',
    endpoint: '/api/admin/loyalty/transactions/community',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#39',
    source: 'media',
    target: 'ecommerce',
    label: 'Media → Commerce (Ventes Vidéo)',
    i18nKey: 'admin.bridges.videoSales',
    endpoint: '/api/admin/media/videos/{id}/sales',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#40',
    source: 'media',
    target: 'catalog',
    label: 'Media → Catalogue (Produits Vidéo)',
    i18nKey: 'admin.bridges.videoProducts',
    endpoint: '/api/admin/media/videos/{id}/products',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#41',
    source: 'media',
    target: 'marketing',
    label: 'Media → Marketing (Posts Sociaux)',
    i18nKey: 'admin.bridges.mediaMarketing',
    endpoint: '/api/admin/media/social-posts/marketing',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#42',
    source: 'media',
    target: 'community',
    label: 'Media → Communauté (Réactions Vidéo)',
    i18nKey: 'admin.bridges.videoCommunity',
    endpoint: '/api/admin/media/videos/{id}/community',
    status: 'done',
    renderedIn: '(API ready)',
  },
  {
    id: '#49',
    source: 'crm',
    target: 'media',
    label: 'CRM → Media (Vidéos Contact)',
    i18nKey: 'admin.bridges.dealMedia',
    endpoint: '/api/admin/crm/deals/{id}/media',
    status: 'done',
    renderedIn: '(API ready)',
  },
];

/**
 * Get all bridges involving a specific module (as source or target).
 */
export function getBridgesForModule(module: BridgeModule): BridgeDefinition[] {
  return BRIDGE_REGISTRY.filter(
    (b) => b.source === module || b.target === module
  );
}

/**
 * Get all implemented bridges.
 */
export function getImplementedBridges(): BridgeDefinition[] {
  return BRIDGE_REGISTRY.filter((b) => b.status === 'done' || b.status === 'partial');
}

/**
 * Build the runtime endpoint URL from a template.
 */
export function buildBridgeEndpoint(template: string, id: string): string {
  return template.replace('{id}', id);
}
