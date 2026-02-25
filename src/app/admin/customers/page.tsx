'use client';

import { useCallback, useState, useEffect } from 'react';
import { ContactListPage } from '@/components/admin/ContactListPage';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { Crown, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { RFM_SEGMENTS, calculateRFMScore, type RFMSegment } from '@/lib/analytics/rfm-engine';
import { customerConfig } from './config';

interface VipCustomer {
  id: string;
  name?: string;
  email: string;
  totalSpent: number;
  loyaltyTier: string;
  loyaltyPoints: number;
  _count?: { purchases: number };
  createdAt: string;
  rfmSegment: RFMSegment;
}

export default function CustomersPage() {
  const { t, locale } = useI18n();
  const [vipCustomers, setVipCustomers] = useState<VipCustomer[]>([]);
  const [showVipPanel, setShowVipPanel] = useState(true);
  const [rfmSummary, setRfmSummary] = useState<Record<string, number>>({});

  const fmt = useCallback(
    (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CAD' }).format(amount),
    [locale]
  );

  // Fetch VIP customers and compute RFM on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/users?role=CUSTOMER');
        if (!res.ok) return;
        const data = await res.json();
        const users = data.users || [];

        // Compute RFM for all customers
        const withRfm = users.map((u: { id: string; name?: string; email: string; totalSpent?: number; loyaltyTier?: string; loyaltyPoints?: number; _count?: { purchases: number }; createdAt: string }) => {
          const daysSince = Math.floor((Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          const score = calculateRFMScore(daysSince, u._count?.purchases || 0, u.totalSpent || 0);
          return { ...u, totalSpent: u.totalSpent || 0, loyaltyTier: u.loyaltyTier || 'BRONZE', loyaltyPoints: u.loyaltyPoints || 0, rfmSegment: score.segment };
        });

        // Top 5 VIP by CLV (totalSpent)
        const sorted = [...withRfm].sort((a: VipCustomer, b: VipCustomer) => b.totalSpent - a.totalSpent);
        setVipCustomers(sorted.slice(0, 5));

        // RFM segment counts
        const counts: Record<string, number> = {};
        withRfm.forEach((u: VipCustomer) => {
          counts[u.rfmSegment] = (counts[u.rfmSegment] || 0) + 1;
        });
        setRfmSummary(counts);
      } catch {
        // silently fail - this is supplementary data
      }
    })();
  }, []);

  const ribbonNewCustomer = useCallback(() => {
    toast.info(
      t('admin.customers.newCustomerGuidance') ||
      'Les clients sont crees automatiquement lors de leur premier achat sur la boutique. Pour inviter un prospect, utilisez la section Emails.'
    );
  }, [t]);

  const ribbonSalesStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CUSTOMER');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      const totalRevenue = users.reduce((sum: number, u: { totalSpent?: number }) => sum + (u.totalSpent || 0), 0);
      const totalPurchases = users.reduce((sum: number, u: { _count?: { purchases: number } }) => sum + (u._count?.purchases || 0), 0);
      const avgBasket = users.length > 0 ? totalRevenue / users.length : 0;
      const fmt = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });
      toast.success(
        `${t('admin.customers.revenueStats') || 'Revenus clients'}: ${fmt.format(totalRevenue)} | ${totalPurchases} ${t('admin.customers.purchases') || 'achats'} | ${t('admin.customers.avgBasket') || 'Panier moyen'}: ${fmt.format(avgBasket)}`
      );
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors du chargement des statistiques');
    }
  }, [t]);

  const ribbonTypeStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CUSTOMER');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      const tiers: Record<string, number> = {};
      users.forEach((u: { loyaltyTier?: string }) => {
        const tier = u.loyaltyTier || 'NONE';
        tiers[tier] = (tiers[tier] || 0) + 1;
      });
      const tierOrder = ['DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE', 'NONE'];
      const breakdown = tierOrder
        .filter(tier => tiers[tier])
        .map(tier => `${tier}: ${tiers[tier]}`)
        .join(' | ');
      toast.success(
        `${t('admin.customers.tierDistribution') || 'Repartition par tier'}: ${breakdown}`
      );
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors du chargement');
    }
  }, [t]);

  const ribbonReviewStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CUSTOMER');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      const sorted = [...users].sort((a: { totalSpent?: number }, b: { totalSpent?: number }) => (b.totalSpent || 0) - (a.totalSpent || 0));
      const top3 = sorted.slice(0, 3);
      const fmt = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });
      if (top3.length === 0) {
        toast.info(t('admin.customers.noCustomers') || 'Aucun client trouve');
        return;
      }
      const topList = top3.map((u: { name?: string; email: string; totalSpent?: number }, i: number) =>
        `${i + 1}. ${u.name || u.email}: ${fmt.format(u.totalSpent || 0)}`
      ).join(' | ');
      toast.success(
        `${t('admin.customers.topSpenders') || 'Top clients'}: ${topList}`
      );
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors du chargement');
    }
  }, [t]);

  const ribbonAmbassadorStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CUSTOMER');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      const withReferral = users.filter((u: { referralCode?: string }) => !!u.referralCode).length;
      const totalPoints = users.reduce((sum: number, u: { loyaltyPoints?: number }) => sum + (u.loyaltyPoints || 0), 0);
      const vipCount = users.filter((u: { loyaltyTier?: string }) =>
        u.loyaltyTier === 'GOLD' || u.loyaltyTier === 'PLATINUM' || u.loyaltyTier === 'DIAMOND'
      ).length;
      toast.success(
        `${t('admin.customers.ambassadorStats') || 'Ambassadeurs'}: ${withReferral}/${users.length} ${t('admin.customers.withReferralCode') || 'avec code parrainage'} | ${vipCount} VIP (Gold+) | ${totalPoints.toLocaleString()} ${t('admin.customers.totalPoints') || 'points au total'}`
      );
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors du chargement');
    }
  }, [t]);

  const ribbonExport = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CUSTOMER');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      if (users.length === 0) {
        toast.info(t('admin.customers.noDataToExport') || 'Aucune donnee a exporter');
        return;
      }
      const headers = ['Name', 'Email', 'Phone', 'Loyalty Tier', 'Loyalty Points', 'Lifetime Points', 'Total Spent', 'Purchases', 'Referral Code', 'Registered'];
      const rows = users.map((u: { name?: string; email: string; phone?: string; loyaltyTier?: string; loyaltyPoints?: number; lifetimePoints?: number; totalSpent?: number; _count?: { purchases: number }; referralCode?: string; createdAt: string }) => [
        u.name || '',
        u.email,
        u.phone || '',
        u.loyaltyTier || '',
        u.loyaltyPoints || 0,
        u.lifetimePoints || 0,
        u.totalSpent || 0,
        u._count?.purchases || 0,
        u.referralCode || '',
        new Date(u.createdAt).toLocaleDateString('fr-CA'),
      ]);
      const csvContent = '\uFEFF' + [headers, ...rows].map(row =>
        row.map((cell: string | number) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('admin.customers.exportSuccess') || `${users.length} clients exportes`);
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors de l\'export');
    }
  }, [t]);

  useRibbonAction('newCustomer', ribbonNewCustomer);
  useRibbonAction('salesStats', ribbonSalesStats);
  useRibbonAction('typeStats', ribbonTypeStats);
  useRibbonAction('reviewStats', ribbonReviewStats);
  useRibbonAction('ambassadorStats', ribbonAmbassadorStats);
  useRibbonAction('export', ribbonExport);

  return (
    <div className="h-full flex flex-col">
      {/* VIP Customer Identification Panel */}
      {vipCustomers.length > 0 && (
        <div className="px-4 lg:px-6 pt-4 lg:pt-6 flex-shrink-0">
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-4 mb-4">
            <button
              onClick={() => setShowVipPanel(!showVipPanel)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-amber-900">{t('admin.customers.vipCustomers')}</h3>
                <span className="text-xs text-amber-600">{t('admin.customers.vipByClv')}</span>
              </div>
              {showVipPanel
                ? <ChevronUp className="w-4 h-4 text-amber-600" />
                : <ChevronDown className="w-4 h-4 text-amber-600" />
              }
            </button>

            {showVipPanel && (
              <div className="mt-3 space-y-4">
                {/* Top VIP Customers */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                  {vipCustomers.map((customer, idx) => {
                    const segInfo = RFM_SEGMENTS[customer.rfmSegment];
                    return (
                      <div key={customer.id} className="bg-white rounded-lg border border-amber-100 p-3 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          {idx === 0 && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                          <span className="text-xs font-bold text-amber-700">#{idx + 1}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 truncate">{customer.name || customer.email.split('@')[0]}</p>
                        <p className="text-lg font-bold text-emerald-700">{fmt(customer.totalSpent)}</p>
                        <p className="text-[10px] text-slate-500">{customer._count?.purchases || 0} {t('admin.customers.purchases').toLowerCase()}</p>
                        <span
                          className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: segInfo.color }}
                        >
                          {segInfo.nameFr}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* RFM Summary Bar */}
                {Object.keys(rfmSummary).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-2">{t('admin.customers.rfmSegments')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.entries(rfmSummary) as [string, number][])
                        .sort((a, b) => b[1] - a[1])
                        .map(([segment, count]) => {
                          const info = RFM_SEGMENTS[segment as RFMSegment];
                          if (!info) return null;
                          return (
                            <span
                              key={segment}
                              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full text-white"
                              style={{ backgroundColor: info.color }}
                              title={info.description}
                            >
                              {info.nameFr}: {count}
                            </span>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main ContactListPage */}
      <div className="flex-1 min-h-0">
        <ContactListPage config={customerConfig} />
      </div>
    </div>
  );
}
