import {
  Users,
  DollarSign,
  TrendingUp,
  Crown,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { createElement } from 'react';
import { Button } from '@/components/admin/Button';
import type { ContactListPageConfig } from '@/components/admin/ContactListPage';

// ── Currency helper (standalone, no React hook available) ────

const currencyFormatter = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });
function fmtCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

// ── Badge helper ─────────────────────────────────────────────

type ListBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

function tierBadgeVariant(tier: string): ListBadgeVariant {
  switch (tier) {
    case 'BRONZE': return 'warning';
    case 'SILVER': return 'neutral';
    case 'GOLD': return 'warning';
    case 'PLATINUM': return 'info';
    case 'DIAMOND': return 'success';
    default: return 'neutral';
  }
}

// ── Config ───────────────────────────────────────────────────

export const customerConfig: ContactListPageConfig = {
  apiEndpoint: '/api/admin/users?role=CUSTOMER',
  dataKey: 'users',
  i18nPrefix: 'admin.customers',
  filterField: 'loyaltyTier',
  profileLinkPattern: '/admin/customers/{id}',
  ordersLinkPattern: '/admin/commandes?user={id}',

  statCards: [
    {
      labelKey: 'admin.customers.totalCustomers',
      icon: Users,
      getValue: (items) => items.length,
    },
    {
      labelKey: 'admin.customers.totalRevenue',
      icon: DollarSign,
      getValue: (items) => fmtCurrency(items.reduce((sum, c) => sum + (c.totalSpent || 0), 0)),
      className: 'bg-emerald-50 border-emerald-200',
    },
    {
      labelKey: 'admin.customers.avgBasket',
      icon: TrendingUp,
      getValue: (items) => {
        const avg = items.length > 0
          ? items.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / items.length
          : 0;
        return fmtCurrency(avg);
      },
      className: 'bg-sky-50 border-sky-200',
    },
    {
      labelKey: 'admin.customers.vipGoldPlus',
      icon: Crown,
      getValue: (items) => items.filter(c =>
        c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM' || c.loyaltyTier === 'DIAMOND'
      ).length,
      className: 'bg-amber-50 border-amber-200',
    },
  ],

  filterTabs: [
    { key: 'all', labelKey: 'admin.customers.allTiers', getCount: (items) => items.length },
    { key: 'BRONZE', labelKey: 'admin.customers.allTiers', staticLabel: 'Bronze', getCount: (items) => items.filter(c => c.loyaltyTier === 'BRONZE').length },
    { key: 'SILVER', labelKey: 'admin.customers.allTiers', staticLabel: 'Silver', getCount: (items) => items.filter(c => c.loyaltyTier === 'SILVER').length },
    { key: 'GOLD', labelKey: 'admin.customers.allTiers', staticLabel: 'Gold', getCount: (items) => items.filter(c => c.loyaltyTier === 'GOLD').length },
    { key: 'PLATINUM', labelKey: 'admin.customers.allTiers', staticLabel: 'Platinum', getCount: (items) => items.filter(c => c.loyaltyTier === 'PLATINUM').length },
    { key: 'DIAMOND', labelKey: 'admin.customers.allTiers', staticLabel: 'Diamond', getCount: (items) => items.filter(c => c.loyaltyTier === 'DIAMOND').length },
  ],

  listItem: {
    getPreview: (item, t) =>
      `${fmtCurrency(item.totalSpent || 0)} - ${item._count?.purchases || 0} ${t('admin.customers.purchases').toLowerCase()}`,
    getBadges: (item) => [
      { text: item.loyaltyTier, variant: tierBadgeVariant(item.loyaltyTier) },
    ],
  },

  detailActions: {
    renderActions: (item, t) =>
      createElement(Link, { href: `/admin/customers/${item.id}` },
        createElement(Button, { variant: 'ghost' as const, size: 'sm' as const, icon: ExternalLink },
          t('admin.customers.viewProfile')
        )
      ),
  },

  showContactSection: true,
  showLoyaltySection: true,
  showReferralCode: true,
};
