'use client';

import { useCallback } from 'react';
import { ContactListPage } from '@/components/admin/ContactListPage';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { clientConfig } from './config';

export default function ClientsPage() {
  const { t } = useI18n();

  const ribbonNewClient = useCallback(() => {
    toast.info(
      t('admin.clients.newClientGuidance') ||
      'Les clients sont crees automatiquement lors de leur inscription sur la boutique. Pour inviter un client, utilisez la section Emails.'
    );
  }, [t]);

  const ribbonSalesStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CLIENT');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      const totalRevenue = users.reduce((sum: number, u: { totalSpent?: number }) => sum + (u.totalSpent || 0), 0);
      const totalPurchases = users.reduce((sum: number, u: { _count?: { purchases: number } }) => sum + (u._count?.purchases || 0), 0);
      const avgBasket = users.length > 0 ? totalRevenue / users.length : 0;
      const fmt = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' });
      toast.success(
        `${t('admin.clients.salesStats') || 'Ventes clients'}: ${fmt.format(totalRevenue)} | ${totalPurchases} ${t('admin.clients.purchases') || 'achats'} | ${t('admin.clients.avgBasket') || 'Panier moyen'}: ${fmt.format(avgBasket)}`
      );
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors du chargement des statistiques');
    }
  }, [t]);

  const ribbonTypeStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CLIENT');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      const roles: Record<string, number> = {};
      users.forEach((u: { role?: string }) => {
        const role = u.role || 'PUBLIC';
        roles[role] = (roles[role] || 0) + 1;
      });
      const breakdown = Object.entries(roles)
        .map(([role, count]) => `${role}: ${count}`)
        .join(' | ');
      toast.success(
        `${t('admin.clients.roleDistribution') || 'Repartition par role'}: ${breakdown}`
      );
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors du chargement');
    }
  }, [t]);

  const ribbonReviewStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CLIENT');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      const tiers: Record<string, number> = {};
      users.forEach((u: { loyaltyTier?: string }) => {
        const tier = u.loyaltyTier || 'NONE';
        tiers[tier] = (tiers[tier] || 0) + 1;
      });
      const breakdown = Object.entries(tiers)
        .sort(([, a], [, b]) => b - a)
        .map(([tier, count]) => `${tier}: ${count}`)
        .join(' | ');
      toast.success(
        `${t('admin.clients.tierDistribution') || 'Repartition par tier'}: ${breakdown}`
      );
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors du chargement');
    }
  }, [t]);

  const ribbonAmbassadorStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CLIENT');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      const withReferral = users.filter((u: { referralCode?: string }) => !!u.referralCode).length;
      const totalPoints = users.reduce((sum: number, u: { loyaltyPoints?: number }) => sum + (u.loyaltyPoints || 0), 0);
      toast.success(
        `${t('admin.clients.ambassadorStats') || 'Ambassadeurs'}: ${withReferral}/${users.length} ${t('admin.clients.withReferralCode') || 'avec code parrainage'} | ${totalPoints.toLocaleString()} ${t('admin.clients.totalPoints') || 'points au total'}`
      );
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors du chargement');
    }
  }, [t]);

  const ribbonExport = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users?role=CLIENT');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const users = data.users || [];
      if (users.length === 0) {
        toast.info(t('admin.clients.noDataToExport') || 'Aucune donnee a exporter');
        return;
      }
      const headers = ['Name', 'Email', 'Role', 'Phone', 'Loyalty Tier', 'Loyalty Points', 'Lifetime Points', 'Total Spent', 'Purchases', 'Referral Code', 'Registered'];
      const rows = users.map((u: { name?: string; email: string; role?: string; phone?: string; loyaltyTier?: string; loyaltyPoints?: number; lifetimePoints?: number; totalSpent?: number; _count?: { purchases: number }; referralCode?: string; createdAt: string }) => [
        u.name || '',
        u.email,
        u.role || '',
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
      a.download = `clients_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('admin.clients.exportSuccess') || `${users.length} clients exportes`);
    } catch {
      toast.error(t('common.errorLoading') || 'Erreur lors de l\'export');
    }
  }, [t]);

  useRibbonAction('newClient', ribbonNewClient);
  useRibbonAction('salesStats', ribbonSalesStats);
  useRibbonAction('typeStats', ribbonTypeStats);
  useRibbonAction('reviewStats', ribbonReviewStats);
  useRibbonAction('ambassadorStats', ribbonAmbassadorStats);
  useRibbonAction('export', ribbonExport);

  return <ContactListPage config={clientConfig} />;
}
