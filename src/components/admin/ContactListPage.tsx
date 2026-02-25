// F094 FIX: Export button now has CSV export onClick handler (see handleExport)
'use client';

import { useState, useMemo, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Download,
  Users,
  ExternalLink,
  Mail,
  Phone,
  Gift,
  Crown,
  ShoppingCart,
} from 'lucide-react';

import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { StatusBadge } from '@/components/admin/StatusBadge';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useAdminList } from '@/hooks/useAdminList';
import { useI18n } from '@/i18n/client';

// ── Types ─────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';
type ListBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** A person record from the API (union of customer/client fields) */
export interface ContactRecord {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role?: string;
  phone?: string;
  locale: string;
  loyaltyPoints: number;
  lifetimePoints: number;
  loyaltyTier: string;
  referralCode?: string;
  createdAt: string;
  _count?: { purchases: number };
  totalSpent?: number;
}

/** Configuration for a stat card displayed above the list */
export interface StatCardConfig {
  labelKey: string;
  icon: LucideIcon;
  /** Function to compute the displayed value from the full item list */
  getValue: (items: ContactRecord[]) => string | number;
  className?: string;
}

/** Configuration for a filter tab */
export interface FilterTabConfig {
  key: string;
  labelKey: string;
  /** If provided, use a static label string instead of a translation key */
  staticLabel?: string;
  /** Function to count matching items for this tab */
  getCount: (items: ContactRecord[]) => number;
}

/** Configuration for mapping a record to a ContentListItem */
export interface ListItemConfig {
  /** How to build the preview line. Receives the record and the t function. */
  getPreview: (item: ContactRecord, t: (key: string) => string) => string;
  /** How to build the badge(s) for the list item */
  getBadges: (item: ContactRecord) => { text: string; variant: ListBadgeVariant }[];
}

/** Configuration for the detail pane header actions */
export interface DetailActionsConfig {
  /** Render function for header actions. Receives the selected record and the t function. */
  renderActions: (item: ContactRecord, t: (key: string) => string) => ReactNode;
}

/** Configuration for additional detail pane sections (e.g., role management, point adjustment) */
export interface DetailSectionConfig {
  /** Unique key */
  key: string;
  /** Render function. Receives the item, a setter to update items locally, and the t function. */
  render: (
    item: ContactRecord,
    updateItem: (id: string, patch: Partial<ContactRecord>) => void,
    t: (key: string) => string,
  ) => ReactNode;
}

/** Full configuration for a ContactListPage instance */
export interface ContactListPageConfig {
  /** The API endpoint to fetch records from */
  apiEndpoint: string;
  /** The key in the JSON response containing the array (default: 'users') */
  dataKey?: string;
  /** i18n prefix for common keys (e.g. 'admin.customers' or 'admin.clients') */
  i18nPrefix: string;
  /** The filter field name on the record (e.g. 'loyaltyTier' or 'role') */
  filterField: keyof ContactRecord;
  /** Stat cards to display above the list */
  statCards: StatCardConfig[];
  /** Filter tabs */
  filterTabs: FilterTabConfig[];
  /** How to map records to list items */
  listItem: ListItemConfig;
  /** Detail pane header actions */
  detailActions: DetailActionsConfig;
  /** Extra sections to render in the detail pane (before the stats grid) */
  detailSections?: DetailSectionConfig[];
  /** Whether to show the loyalty section (default: true) */
  showLoyaltySection?: boolean;
  /** Whether to show the contact info section with mail/phone (default: true) */
  showContactSection?: boolean;
  /** Whether to show the referral code in the loyalty section (default: true) */
  showReferralCode?: boolean;
  /** Profile link pattern. {id} will be replaced. Default: '/admin/customers/{id}' */
  profileLinkPattern?: string;
  /** Orders link pattern. {id} will be replaced. Default: '/admin/commandes?user={id}' */
  ordersLinkPattern?: string;
}

// ── Shared helpers ────────────────────────────────────────────

const tierVariants: Record<string, BadgeVariant> = {
  BRONZE: 'warning',
  SILVER: 'neutral',
  GOLD: 'warning',
  PLATINUM: 'info',
  DIAMOND: 'primary',
};

// ── Main Component ────────────────────────────────────────────

export function ContactListPage({ config }: { config: ContactListPageConfig }) {
  const { t, locale } = useI18n();
  const prefix = config.i18nPrefix;

  const {
    items,
    loading,
    search,
    setSearch,
    filters,
    setFilter,
    selectedId,
    setSelectedId,
  } = useAdminList<ContactRecord>(config.apiEndpoint, {
    dataKey: config.dataKey ?? 'users',
    defaultFilters: { main: 'all' },
  });

  // Allow detail sections to patch items locally (e.g. after role change or point adjustment)
  const [localPatches, setLocalPatches] = useState<Record<string, Partial<ContactRecord>>>({});

  const patchedItems = useMemo(() => {
    if (Object.keys(localPatches).length === 0) return items;
    return items.map((item) => {
      const patch = localPatches[item.id];
      return patch ? { ...item, ...patch } : item;
    });
  }, [items, localPatches]);

  const updateItem = useCallback((id: string, patch: Partial<ContactRecord>) => {
    setLocalPatches((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...patch },
    }));
  }, []);

  // Selected item from patched list
  const displayItem = useMemo(
    () => (selectedId ? patchedItems.find((i) => i.id === selectedId) ?? null : null),
    [patchedItems, selectedId]
  );

  // ─── Filtering ──────────────────────────────────────────────

  const mainFilter = filters.main || 'all';

  const filteredItems = useMemo(() => {
    return patchedItems.filter((item) => {
      // Apply main filter
      if (mainFilter !== 'all') {
        const fieldValue = item[config.filterField];
        if (fieldValue !== mainFilter) return false;
      }
      // Apply search
      if (search) {
        const s = search.toLowerCase();
        if (!item.name?.toLowerCase().includes(s) && !item.email.toLowerCase().includes(s)) {
          return false;
        }
      }
      return true;
    });
  }, [patchedItems, mainFilter, search, config.filterField]);

  // ─── Filter tabs with counts ────────────────────────────────

  const resolvedFilterTabs = useMemo(() => {
    return config.filterTabs.map((tab) => ({
      key: tab.key,
      label: tab.staticLabel ?? t(tab.labelKey),
      count: tab.getCount(patchedItems),
    }));
  }, [config.filterTabs, patchedItems, t]);

  // ─── ContentList items ──────────────────────────────────────

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredItems.map((item): ContentListItem => ({
      id: item.id,
      avatar: { text: item.name || item.email.charAt(0).toUpperCase() },
      title: item.name || t(`${prefix}.noName`),
      subtitle: item.email,
      preview: config.listItem.getPreview(item, t),
      timestamp: item.createdAt,
      badges: config.listItem.getBadges(item),
    }));
  }, [filteredItems, t, prefix, config.listItem]);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, [setSelectedId]);

  // ─── Profile & orders links ─────────────────────────────────

  const profileLink = useCallback(
    (id: string) => (config.profileLinkPattern ?? '/admin/customers/{id}').replace('{id}', id),
    [config.profileLinkPattern]
  );

  const ordersLink = useCallback(
    (id: string) => (config.ordersLinkPattern ?? '/admin/commandes?user={id}').replace('{id}', id),
    [config.ordersLinkPattern]
  );

  // F094 FIX: Implement CSV export for the contact list export button
  const handleExport = useCallback(() => {
    if (filteredItems.length === 0) return;
    const BOM = '\uFEFF';
    const headers = ['Name', 'Email', 'Phone', 'Tier', 'Points', 'Lifetime Points', 'Purchases', 'Total Spent', 'Registered'];
    const rows = filteredItems.map(item => [
      item.name || '',
      item.email,
      item.phone || '',
      item.loyaltyTier,
      String(item.loyaltyPoints),
      String(item.lifetimePoints),
      String(item._count?.purchases || 0),
      String(item.totalSpent || 0),
      new Date(item.createdAt).toLocaleDateString(locale),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredItems, locale]);

  // ─── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t(`${prefix}.title`)}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t(`${prefix}.subtitle`)}</p>
          </div>
          {/* F094 FIX: Wire onClick handler to CSV export function */}
          <Button variant="secondary" icon={Download} size="sm" onClick={handleExport}>
            {t(`${prefix}.export`)}
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {config.statCards.map((sc, idx) => (
            <StatCard
              key={idx}
              label={t(sc.labelKey)}
              value={sc.getValue(patchedItems)}
              icon={sc.icon}
              className={sc.className}
            />
          ))}
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedId}
              onSelect={handleSelect}
              filterTabs={resolvedFilterTabs}
              activeFilter={mainFilter}
              onFilterChange={(key) => setFilter('main', key)}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={t(`${prefix}.searchPlaceholder`)}
              loading={loading}
              emptyIcon={Users}
              emptyTitle={t(`${prefix}.emptyTitle`)}
              emptyDescription={t(`${prefix}.emptyDescription`)}
            />
          }
          detail={
            displayItem ? (
              <DetailPane
                header={{
                  title: displayItem.name || t(`${prefix}.noName`),
                  subtitle: displayItem.email,
                  avatar: { text: displayItem.name || displayItem.email.charAt(0).toUpperCase() },
                  onBack: () => setSelectedId(null),
                  backLabel: t(`${prefix}.title`),
                  actions: config.detailActions.renderActions(displayItem, t),
                }}
              >
                <div className="space-y-6">
                  {/* Contact Info */}
                  {config.showContactSection !== false && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">{t(`${prefix}.contactInfo`)}</h3>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Mail className="w-4 h-4 text-slate-400" />
                          <span>{displayItem.email}</span>
                        </div>
                        {displayItem.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span>{displayItem.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>{t(`${prefix}.colRegistered`)}: {new Date(displayItem.createdAt).toLocaleDateString(locale)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Extra detail sections (role management, etc.) rendered before loyalty */}
                  {config.detailSections?.map((section) => (
                    <div key={section.key}>
                      {section.render(displayItem, updateItem, t)}
                    </div>
                  ))}

                  {/* Loyalty Info */}
                  {config.showLoyaltySection !== false && (
                    <div className="bg-sky-50 rounded-lg p-4 border border-sky-200">
                      <h3 className="font-semibold text-sky-900 mb-3 flex items-center gap-2">
                        <Crown className="w-4 h-4" />
                        {t(`${prefix}.loyaltyProgram`)}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <p className="text-sm text-sky-700">{t(`${prefix}.tier`)}</p>
                          <StatusBadge variant={tierVariants[displayItem.loyaltyTier] || 'neutral'}>
                            {displayItem.loyaltyTier}
                          </StatusBadge>
                        </div>
                        <div>
                          <p className="text-sm text-sky-700">{t(`${prefix}.currentPoints`)}</p>
                          <p className="text-2xl font-bold text-sky-900">{displayItem.loyaltyPoints.toLocaleString(locale)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-sky-700">{t(`${prefix}.lifetimePoints`)}</p>
                          <p className="text-2xl font-bold text-sky-900">{displayItem.lifetimePoints.toLocaleString(locale)}</p>
                        </div>
                      </div>
                      {config.showReferralCode !== false && displayItem.referralCode && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-sky-700">
                          <Gift className="w-4 h-4" />
                          <span>{t(`${prefix}.referralCode`)}: <span className="font-mono font-bold">{displayItem.referralCode}</span></span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t(`${prefix}.purchases`)}</p>
                      <p className="text-2xl font-bold text-slate-900">{displayItem._count?.purchases || 0}</p>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-500">{t(`${prefix}.totalSpent`)}</p>
                      <p className="text-2xl font-bold text-emerald-700">{new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(displayItem.totalSpent || 0)}</p>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-2">
                    <Link href={ordersLink(displayItem.id)}>
                      <Button variant="secondary" icon={ShoppingCart} size="sm">
                        {t(`${prefix}.viewOrders`)}
                      </Button>
                    </Link>
                    <Link href={profileLink(displayItem.id)}>
                      <Button variant="primary" icon={ExternalLink} size="sm">
                        {t(`${prefix}.viewProfile`)}
                      </Button>
                    </Link>
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Users}
                emptyTitle={t(`${prefix}.emptyTitle`)}
                emptyDescription={t(`${prefix}.emptyDescription`)}
              />
            )
          }
        />
      </div>
    </div>
  );
}
