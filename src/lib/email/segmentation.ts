/**
 * Smart Email Segmentation Engine
 * Segment by purchase history, engagement, spending, geography, behavior
 */

export interface Segment {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  criteria: SegmentCriterion[];
  estimatedSize?: number;
}

export interface SegmentCriterion {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'notIn' | 'contains' | 'between';
  value: unknown;
  label?: string;
}

export const BUILT_IN_SEGMENTS: Segment[] = [
  {
    id: 'vip-customers',
    name: 'VIP Customers',
    nameFr: 'Clients VIP',
    description: 'Customers with 5+ orders or $1000+ total spent',
    criteria: [
      { field: 'totalOrders', operator: 'gte', value: 5, label: '5+ commandes' },
    ],
  },
  {
    id: 'new-customers',
    name: 'New Customers',
    nameFr: 'Nouveaux clients',
    description: 'Registered in the last 30 days',
    criteria: [
      { field: 'createdDaysAgo', operator: 'lte', value: 30, label: 'Inscrit < 30 jours' },
    ],
  },
  {
    id: 'at-risk',
    name: 'At Risk',
    nameFr: 'À risque',
    description: 'No order in 60+ days, previously active',
    criteria: [
      { field: 'lastOrderDaysAgo', operator: 'gte', value: 60, label: 'Dernière commande > 60j' },
      { field: 'totalOrders', operator: 'gte', value: 1, label: 'Au moins 1 commande' },
    ],
  },
  {
    id: 'high-spenders',
    name: 'High Spenders',
    nameFr: 'Gros acheteurs',
    description: 'Average order value > $200',
    criteria: [
      { field: 'avgOrderValue', operator: 'gt', value: 200, label: 'AOV > $200' },
    ],
  },
  {
    id: 'quebec',
    name: 'Quebec Customers',
    nameFr: 'Clients Québec',
    description: 'Customers from Quebec province',
    criteria: [
      { field: 'province', operator: 'eq', value: 'QC', label: 'Province = QC' },
    ],
  },
  {
    id: 'engaged-subscribers',
    name: 'Engaged Subscribers',
    nameFr: 'Abonnés engagés',
    description: 'Opened email in last 30 days',
    criteria: [
      { field: 'lastEmailOpenDaysAgo', operator: 'lte', value: 30, label: 'Email ouvert < 30j' },
    ],
  },
  {
    id: 'repeat-buyers',
    name: 'Repeat Buyers',
    nameFr: 'Acheteurs récurrents',
    description: 'Customers with 2+ orders',
    criteria: [
      { field: 'totalOrders', operator: 'gte', value: 2, label: '2+ commandes' },
    ],
  },
  {
    id: 'cart-abandoners',
    name: 'Cart Abandoners',
    nameFr: 'Paniers abandonnés',
    description: 'Abandoned cart in last 7 days',
    criteria: [
      { field: 'abandonedCartDaysAgo', operator: 'lte', value: 7, label: 'Panier abandonné < 7j' },
    ],
  },
];

export function buildSegmentQuery(segment: Segment): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const criterion of segment.criteria) {
    const { field, operator, value } = criterion;
    switch (operator) {
      case 'eq': where[field] = value; break;
      case 'neq': where[field] = { not: value }; break;
      case 'gt': where[field] = { gt: value }; break;
      case 'gte': where[field] = { gte: value }; break;
      case 'lt': where[field] = { lt: value }; break;
      case 'lte': where[field] = { lte: value }; break;
      case 'in': where[field] = { in: value }; break;
      case 'contains': where[field] = { contains: value, mode: 'insensitive' }; break;
      default: break;
    }
  }

  return where;
}
