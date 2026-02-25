/**
 * Automatic Order Tagging
 * Auto-tag orders based on configurable rules
 */

export interface OrderTagRule {
  id: string;
  name: string;
  condition: (order: OrderForTagging) => boolean;
  tag: string;
  color?: string;
}

interface OrderForTagging {
  total: number;
  itemCount: number;
  isFirstOrder: boolean;
  customerTier: string;
  shippingCountry: string;
  paymentMethod?: string;
  promoCode?: string;
  hasSubscription?: boolean;
}

export const DEFAULT_TAG_RULES: OrderTagRule[] = [
  {
    id: 'high-value',
    name: 'Commande haute valeur',
    condition: (o) => o.total >= 500,
    tag: 'HIGH_VALUE',
    color: '#10b981',
  },
  {
    id: 'first-order',
    name: 'Première commande',
    condition: (o) => o.isFirstOrder,
    tag: 'FIRST_ORDER',
    color: '#3b82f6',
  },
  {
    id: 'vip',
    name: 'Client VIP',
    condition: (o) => o.customerTier === 'GOLD' || o.customerTier === 'PLATINUM',
    tag: 'VIP',
    color: '#f59e0b',
  },
  {
    id: 'international',
    name: 'International',
    condition: (o) => o.shippingCountry !== 'CA',
    tag: 'INTERNATIONAL',
    color: '#8b5cf6',
  },
  {
    id: 'bulk',
    name: 'Commande en lot',
    condition: (o) => o.itemCount >= 5,
    tag: 'BULK',
    color: '#ec4899',
  },
  {
    id: 'promo',
    name: 'Avec promotion',
    condition: (o) => !!o.promoCode,
    tag: 'PROMO_USED',
    color: '#f97316',
  },
  {
    id: 'subscription',
    name: 'Abonnement',
    condition: (o) => !!o.hasSubscription,
    tag: 'SUBSCRIPTION',
    color: '#06b6d4',
  },
];

export function autoTagOrder(order: OrderForTagging, rules: OrderTagRule[] = DEFAULT_TAG_RULES): string[] {
  return rules.filter((rule) => rule.condition(order)).map((rule) => rule.tag);
}

export function getTagColor(tag: string, rules: OrderTagRule[] = DEFAULT_TAG_RULES): string {
  return rules.find((r) => r.tag === tag)?.color || '#94a3b8';
}
