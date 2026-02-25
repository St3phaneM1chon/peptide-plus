import {
  Users,
  DollarSign,
  TrendingUp,
  Crown,
  ExternalLink,
  Sparkles,
  Gift,
  Cake,
  CalendarHeart,
  Shuffle,
  Target,
  Route,
} from 'lucide-react';
import Link from 'next/link';
import { createElement } from 'react';
import { Button } from '@/components/admin/Button';
import type { ContactListPageConfig, ContactRecord } from '@/components/admin/ContactListPage';
import { calculateRFMScore, RFM_SEGMENTS, type RFMSegment } from '@/lib/analytics/rfm-engine';

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

// ── RFM helper ──────────────────────────────────────────────

function getCustomerRFM(item: ContactRecord): { segment: RFMSegment; score: ReturnType<typeof calculateRFMScore> } {
  const daysSinceOrder = item.createdAt
    ? Math.floor((Date.now() - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : 365;
  const orders = item._count?.purchases || 0;
  const spent = item.totalSpent || 0;
  const score = calculateRFMScore(daysSinceOrder, orders, spent);
  return { segment: score.segment, score };
}

// ── Surprise indicators ─────────────────────────────────────

function getSurpriseIndicators(item: ContactRecord): { type: string; label: string; icon: typeof Gift }[] {
  const indicators: { type: string; label: string; icon: typeof Gift }[] = [];
  // VIP customers are eligible for surprises
  if (item.loyaltyTier === 'GOLD' || item.loyaltyTier === 'PLATINUM' || item.loyaltyTier === 'DIAMOND') {
    indicators.push({ type: 'birthday', label: 'Anniversaire', icon: Cake });
    indicators.push({ type: 'anniversary', label: 'Ancienneté', icon: CalendarHeart });
  }
  // High spenders can get random surprise
  if ((item.totalSpent || 0) > 500) {
    indicators.push({ type: 'random', label: 'Surprise aléatoire', icon: Shuffle });
  }
  return indicators;
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
    getBadges: (item) => {
      const rfm = getCustomerRFM(item);
      const segInfo = RFM_SEGMENTS[rfm.segment];
      const rfmVariant: ListBadgeVariant = rfm.segment === 'CHAMPIONS' || rfm.segment === 'LOYAL' ? 'success'
        : rfm.segment === 'AT_RISK' || rfm.segment === 'CANT_LOSE' ? 'error'
        : rfm.segment === 'LOST' || rfm.segment === 'HIBERNATING' ? 'neutral'
        : 'info';
      return [
        { text: item.loyaltyTier, variant: tierBadgeVariant(item.loyaltyTier) },
        { text: segInfo.nameFr, variant: rfmVariant },
      ];
    },
  },

  detailActions: {
    renderActions: (item, t) =>
      createElement(Link, { href: `/admin/customers/${item.id}` },
        createElement(Button, { variant: 'ghost' as const, size: 'sm' as const, icon: ExternalLink },
          t('admin.customers.viewProfile')
        )
      ),
  },

  detailSections: [
    // ── RFM Segment Detail Section ───────────────────────────
    {
      key: 'rfm-segment',
      render: (item, _updateItem, t) => {
        const rfm = getCustomerRFM(item);
        const segInfo = RFM_SEGMENTS[rfm.segment];
        return createElement('div', { className: 'rounded-lg border p-4', style: { borderColor: segInfo.color, backgroundColor: `${segInfo.color}10` } },
          createElement('div', { className: 'flex items-center gap-2 mb-2' },
            createElement(Target, { className: 'w-4 h-4', style: { color: segInfo.color } }),
            createElement('h3', { className: 'font-semibold text-sm text-slate-900' }, t('admin.customers.rfmSegment')),
          ),
          createElement('div', { className: 'flex items-center gap-3 mb-2' },
            createElement('span', {
              className: 'text-xs font-bold px-2.5 py-1 rounded-full text-white',
              style: { backgroundColor: segInfo.color }
            }, segInfo.nameFr),
            createElement('span', { className: 'text-xs text-slate-500' },
              `R:${rfm.score.recency} F:${rfm.score.frequency} M:${rfm.score.monetary} (${rfm.score.totalScore}/15)`
            ),
          ),
          createElement('p', { className: 'text-xs text-slate-600 mb-1' }, segInfo.description),
          createElement('p', { className: 'text-xs text-slate-500' },
            createElement('span', { className: 'font-medium' }, `${t('admin.customers.suggestedAction')}: `),
            segInfo.suggestedAction,
          ),
        );
      },
    },
    // ── Surprise & Delight Indicators ────────────────────────
    {
      key: 'surprise-delight',
      render: (item, _updateItem, t) => {
        const indicators = getSurpriseIndicators(item);
        if (indicators.length === 0) return null;
        return createElement('div', { className: 'bg-pink-50 rounded-lg border border-pink-200 p-4' },
          createElement('div', { className: 'flex items-center gap-2 mb-2' },
            createElement(Sparkles, { className: 'w-4 h-4 text-pink-500' }),
            createElement('h3', { className: 'font-semibold text-sm text-pink-900' }, t('admin.customers.surpriseDelight')),
          ),
          createElement('div', { className: 'flex flex-wrap gap-2' },
            ...indicators.map((ind) =>
              createElement('div', {
                key: ind.type,
                className: 'flex items-center gap-1.5 bg-white rounded-full px-3 py-1.5 border border-pink-200 text-xs font-medium text-pink-700'
              },
                createElement(ind.icon, { className: 'w-3.5 h-3.5' }),
                createElement('span', null, ind.label),
              )
            ),
          ),
        );
      },
    },
    // ── Customer Journey (compact) ───────────────────────────
    {
      key: 'customer-journey',
      render: (item, _updateItem, t) => {
        // Generate simulated journey events for this customer
        const createdAt = new Date(item.createdAt);
        const events: Array<{ type: string; title: string; date: Date }> = [
          { type: 'signup', title: 'Inscription', date: createdAt },
        ];
        const purchases = item._count?.purchases || 0;
        for (let i = 0; i < Math.min(purchases, 5); i++) {
          const d = new Date(createdAt.getTime() + (i + 1) * 15 * 86400000);
          events.push({ type: 'order', title: `Commande #${i + 1}`, date: d });
        }
        if (item.loyaltyPoints > 0) {
          events.push({ type: 'loyalty', title: `+${item.loyaltyPoints} pts`, date: new Date() });
        }

        return createElement('div', { className: 'bg-slate-50 rounded-lg border border-slate-200 p-4' },
          createElement('div', { className: 'flex items-center gap-2 mb-3' },
            createElement(Route, { className: 'w-4 h-4 text-blue-500' }),
            createElement('h3', { className: 'font-semibold text-sm text-slate-900' }, t('admin.customers.customerJourney')),
          ),
          events.length === 0
            ? createElement('p', { className: 'text-xs text-slate-500' }, t('admin.customers.noRecentActivity'))
            : createElement('div', { className: 'flex items-center gap-1 overflow-x-auto py-1' },
                ...events.slice(-8).map((event, i) => {
                  const colors: Record<string, string> = {
                    signup: 'bg-blue-100 text-blue-600',
                    order: 'bg-green-100 text-green-600',
                    loyalty: 'bg-emerald-100 text-emerald-600',
                  };
                  return createElement('div', {
                    key: `${event.type}-${i}`,
                    className: `flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-medium ${colors[event.type] || 'bg-slate-100 text-slate-600'}`,
                    title: `${event.title} - ${event.date.toLocaleDateString('fr-CA')}`,
                  }, event.title);
                }),
              ),
        );
      },
    },
  ],

  showContactSection: true,
  showLoyaltySection: true,
  showReferralCode: true,
};
