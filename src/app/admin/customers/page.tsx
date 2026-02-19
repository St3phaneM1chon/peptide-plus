'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Download,
  Users,
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Crown,
} from 'lucide-react';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { useI18n } from '@/i18n/client';

interface Customer {
  id: string;
  email: string;
  name?: string;
  image?: string;
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

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

const tierVariants: Record<string, BadgeVariant> = {
  BRONZE: 'warning',
  SILVER: 'neutral',
  GOLD: 'warning',
  PLATINUM: 'info',
  DIAMOND: 'primary',
};

export default function CustomersPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ search: '', tier: '' });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/admin/users?role=CUSTOMER');
      const data = await res.json();
      setCustomers(data.users || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setCustomers([]);
    }
    setLoading(false);
  };

  const filteredCustomers = customers.filter(c => {
    if (filter.tier && c.loyaltyTier !== filter.tier) return false;
    if (filter.search) {
      const s = filter.search.toLowerCase();
      if (!c.name?.toLowerCase().includes(s) && !c.email.toLowerCase().includes(s)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: customers.length,
    totalRevenue: customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
    avgSpent: customers.length > 0
      ? customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / customers.length
      : 0,
    vip: customers.filter(c =>
      c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM' || c.loyaltyTier === 'DIAMOND'
    ).length,
  };

  const columns: Column<Customer>[] = [
    {
      key: 'customer',
      header: t('admin.customers.colClient'),
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
            {c.image ? (
              <Image src={c.image} alt={c.name || c.email} width={40} height={40} className="w-10 h-10 rounded-full" unoptimized />
            ) : (
              <span className="text-slate-600 font-semibold">
                {c.name?.charAt(0) || c.email.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-slate-900">{c.name || t('admin.customers.noName')}</p>
            <p className="text-xs text-slate-500">{c.email}</p>
            {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'tier',
      header: t('admin.customers.colLoyalty'),
      render: (c) => (
        <StatusBadge variant={tierVariants[c.loyaltyTier] || 'neutral'}>
          {c.loyaltyTier} ({c.loyaltyPoints.toLocaleString()} pts)
        </StatusBadge>
      ),
    },
    {
      key: 'purchases',
      header: t('admin.customers.colPurchases'),
      align: 'center',
      render: (c) => (
        <span className="font-semibold text-slate-900">{c._count?.purchases || 0}</span>
      ),
    },
    {
      key: 'totalSpent',
      header: t('admin.customers.colTotalSpent'),
      align: 'right',
      render: (c) => (
        <span className="font-semibold text-emerald-700">
          {(c.totalSpent || 0).toFixed(2)} $
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('admin.customers.colRegistered'),
      render: (c) => (
        <span className="text-sm text-slate-500">
          {new Date(c.createdAt).toLocaleDateString(locale)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'center',
      render: (c) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/admin/customers/${c.id}`);
          }}
          className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
        >
          {t('admin.customers.viewProfile')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.customers.title')}
        subtitle={t('admin.customers.subtitle')}
        actions={
          <Button variant="secondary" icon={Download}>
            {t('admin.customers.export')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('admin.customers.totalCustomers')} value={stats.total} icon={Users} />
        <StatCard
          label={t('admin.customers.totalRevenue')}
          value={`${stats.totalRevenue.toFixed(2)} $`}
          icon={DollarSign}
          className="bg-emerald-50 border-emerald-200"
        />
        <StatCard
          label={t('admin.customers.avgBasket')}
          value={`${stats.avgSpent.toFixed(2)} $`}
          icon={TrendingUp}
          className="bg-sky-50 border-sky-200"
        />
        <StatCard
          label={t('admin.customers.vipGoldPlus')}
          value={stats.vip}
          icon={Crown}
          className="bg-amber-50 border-amber-200"
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(value) => setFilter({ ...filter, search: value })}
        searchPlaceholder={t('admin.customers.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.customers.allTiers')}
          value={filter.tier}
          onChange={(value) => setFilter({ ...filter, tier: value })}
          options={[
            { value: 'BRONZE', label: 'Bronze' },
            { value: 'SILVER', label: 'Silver' },
            { value: 'GOLD', label: 'Gold' },
            { value: 'PLATINUM', label: 'Platinum' },
            { value: 'DIAMOND', label: 'Diamond' },
          ]}
        />
      </FilterBar>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredCustomers}
        keyExtractor={(c) => c.id}
        loading={loading}
        emptyTitle={t('admin.customers.emptyTitle')}
        emptyDescription={t('admin.customers.emptyDescription')}
        onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
      />
    </div>
  );
}
