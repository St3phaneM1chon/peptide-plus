'use client';

import { useCallback } from 'react';
import { ContactListPage } from '@/components/admin/ContactListPage';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { customerConfig } from './config';

export default function CustomersPage() {
  const { t } = useI18n();

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

  return <ContactListPage config={customerConfig} />;
}
