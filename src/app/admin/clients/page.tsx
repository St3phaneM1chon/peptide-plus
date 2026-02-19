'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Download,
  Users,
  UserCheck,
  Briefcase,
  Crown,
  Mail,
  KeyRound,
  ShoppingCart,
  Ban,
} from 'lucide-react';

import { PageHeader } from '@/components/admin/PageHeader';
import { Button } from '@/components/admin/Button';
import { FilterBar, SelectFilter } from '@/components/admin/FilterBar';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DataTable, type Column } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input } from '@/components/admin/FormField';
import { useI18n } from '@/i18n/client';

interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  role: string;
  phone?: string;
  locale: string;
  loyaltyPoints: number;
  lifetimePoints: number;
  loyaltyTier: string;
  referralCode?: string;
  createdAt: string;
  _count?: {
    purchases: number;
  };
  totalSpent?: number;
}

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

const roleVariants: Record<string, BadgeVariant> = {
  PUBLIC: 'neutral',
  CUSTOMER: 'info',
  CLIENT: 'primary',
  EMPLOYEE: 'warning',
  OWNER: 'success',
};

const tierVariants: Record<string, BadgeVariant> = {
  BRONZE: 'warning',
  SILVER: 'neutral',
  GOLD: 'warning',
  PLATINUM: 'info',
  DIAMOND: 'primary',
};

export default function ClientsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [filter, setFilter] = useState({ role: '', search: '', tier: '' });
  const [adjustPoints, setAdjustPoints] = useState({ amount: 0, reason: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users?role=CLIENT');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      setUsers([]);
    }
    setLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, role: newRole });
      }
    } catch (err) {
      console.error('Error updating role:', err);
    }
    setSaving(false);
  };

  const adjustUserPoints = async (userId: string) => {
    if (!adjustPoints.amount || !adjustPoints.reason) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/users/${userId}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustPoints),
      });
      const newPoints = (selectedUser?.loyaltyPoints || 0) + adjustPoints.amount;
      setUsers(users.map(u => u.id === userId ? { ...u, loyaltyPoints: newPoints } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, loyaltyPoints: newPoints });
      }
      setAdjustPoints({ amount: 0, reason: '' });
    } catch (err) {
      console.error('Error adjusting points:', err);
    }
    setSaving(false);
  };

  const filteredUsers = users.filter(user => {
    if (filter.role && user.role !== filter.role) return false;
    if (filter.tier && user.loyaltyTier !== filter.tier) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!user.name?.toLowerCase().includes(search) &&
          !user.email.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: users.length,
    customers: users.filter(u => u.role === 'CUSTOMER').length,
    employees: users.filter(u => u.role === 'EMPLOYEE').length,
    gold: users.filter(u => u.loyaltyTier === 'GOLD' || u.loyaltyTier === 'PLATINUM' || u.loyaltyTier === 'DIAMOND').length,
  };

  const columns: Column<User>[] = [
    {
      key: 'client',
      header: t('admin.clients.colClient'),
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
            {user.image ? (
              <Image src={user.image} alt={user.name || user.email} width={40} height={40} className="w-10 h-10 rounded-full" unoptimized />
            ) : (
              <span className="text-slate-600 font-semibold">
                {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-slate-900">{user.name || t('admin.clients.noName')}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: t('admin.clients.colRole'),
      render: (user) => (
        <StatusBadge variant={roleVariants[user.role] || 'neutral'}>
          {user.role}
        </StatusBadge>
      ),
    },
    {
      key: 'tier',
      header: t('admin.clients.colLoyalty'),
      render: (user) => (
        <StatusBadge variant={tierVariants[user.loyaltyTier] || 'neutral'}>
          {user.loyaltyTier}
        </StatusBadge>
      ),
    },
    {
      key: 'points',
      header: t('admin.clients.colPoints'),
      render: (user) => (
        <div>
          <p className="font-semibold text-slate-900">{user.loyaltyPoints.toLocaleString()}</p>
          <p className="text-xs text-slate-500">/{user.lifetimePoints.toLocaleString()} {t('admin.clients.totalSuffix')}</p>
        </div>
      ),
    },
    {
      key: 'purchases',
      header: t('admin.clients.colPurchases'),
      render: (user) => (
        <div>
          <p className="font-semibold text-slate-900">{user._count?.purchases || 0}</p>
          {user.totalSpent && user.totalSpent > 0 && (
            <p className="text-xs text-slate-500">{user.totalSpent.toFixed(2)} $</p>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: t('admin.clients.colRegistered'),
      render: (user) => (
        <span className="text-sm text-slate-500">
          {new Date(user.createdAt).toLocaleDateString(locale)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('admin.clients.colActions'),
      align: 'center',
      render: (user) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedUser(user);
          }}
          className="text-sky-600 hover:text-sky-700 hover:bg-sky-50"
        >
          {t('admin.clients.manage')}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.clients.title')}
        subtitle={t('admin.clients.subtitle')}
        actions={
          <Button variant="secondary" icon={Download}>
            {t('admin.clients.export')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t('admin.clients.totalUsers')} value={stats.total} icon={Users} />
        <StatCard label={t('admin.clients.clients')} value={stats.customers} icon={UserCheck} />
        <StatCard label={t('admin.clients.employees')} value={stats.employees} icon={Briefcase} />
        <StatCard label={t('admin.clients.vipGoldPlus')} value={stats.gold} icon={Crown} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(value) => setFilter({ ...filter, search: value })}
        searchPlaceholder={t('admin.clients.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.clients.allRoles')}
          value={filter.role}
          onChange={(value) => setFilter({ ...filter, role: value })}
          options={[
            { value: 'CUSTOMER', label: t('admin.clients.filterCustomer') },
            { value: 'CLIENT', label: t('admin.clients.filterClient') },
            { value: 'EMPLOYEE', label: t('admin.clients.filterEmployee') },
            { value: 'OWNER', label: t('admin.clients.filterOwner') },
          ]}
        />
        <SelectFilter
          label={t('admin.clients.allTiers')}
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

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        keyExtractor={(user) => user.id}
        loading={loading}
        emptyTitle={t('admin.clients.emptyTitle')}
        emptyDescription={t('admin.clients.emptyDescription')}
        onRowClick={(user) => router.push(`/admin/clients/${user.id}`)}
      />

      {/* User Detail Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser?.name || t('admin.clients.noName')}
        subtitle={selectedUser?.email}
        size="lg"
        footer={
          <div className="flex gap-2 w-full flex-wrap">
            <Link href={`/admin/commandes?user=${selectedUser?.id}`}>
              <Button variant="secondary" icon={ShoppingCart} size="sm">
                {t('admin.clients.viewOrders')}
              </Button>
            </Link>
            <Button variant="secondary" icon={Mail} size="sm">
              {t('admin.clients.sendEmail')}
            </Button>
            <Button variant="secondary" icon={KeyRound} size="sm">
              {t('admin.clients.resetPassword')}
            </Button>
            <div className="ms-auto">
              <Button variant="danger" icon={Ban} size="sm">
                {t('admin.clients.suspend')}
              </Button>
            </div>
          </div>
        }
      >
        {selectedUser && (
          <div className="space-y-6">
            {/* Role */}
            <FormField label={t('admin.clients.role')}>
              <select
                value={selectedUser.role}
                onChange={(e) => updateUserRole(selectedUser.id, e.target.value)}
                disabled={saving}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900
                  focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="PUBLIC">{t('admin.clients.rolePublic')}</option>
                <option value="CUSTOMER">{t('admin.clients.roleCustomer')}</option>
                <option value="CLIENT">{t('admin.clients.roleClient')}</option>
                <option value="EMPLOYEE">{t('admin.clients.roleEmployee')}</option>
                <option value="OWNER">{t('admin.clients.roleOwner')}</option>
              </select>
            </FormField>

            {/* Loyalty Info */}
            <div className="bg-sky-50 rounded-lg p-4 border border-sky-200">
              <h3 className="font-semibold text-sky-900 mb-3">{t('admin.clients.loyaltyProgram')}</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-sm text-sky-700">{t('admin.clients.tier')}</p>
                  <StatusBadge variant={tierVariants[selectedUser.loyaltyTier] || 'neutral'}>
                    {selectedUser.loyaltyTier}
                  </StatusBadge>
                </div>
                <div>
                  <p className="text-sm text-sky-700">{t('admin.clients.currentPoints')}</p>
                  <p className="text-2xl font-bold text-sky-900">{selectedUser.loyaltyPoints.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-sky-700">{t('admin.clients.lifetimePoints')}</p>
                  <p className="text-2xl font-bold text-sky-900">{selectedUser.lifetimePoints.toLocaleString()}</p>
                </div>
              </div>
              {selectedUser.referralCode && (
                <p className="text-sm text-sky-700">
                  {t('admin.clients.referralCode')}: <span className="font-mono font-bold">{selectedUser.referralCode}</span>
                </p>
              )}
            </div>

            {/* Adjust Points */}
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3">{t('admin.clients.adjustPoints')}</h3>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <FormField label={t('admin.clients.amount')}>
                  <Input
                    type="number"
                    placeholder={t('admin.clients.amountPlaceholder')}
                    value={adjustPoints.amount || ''}
                    onChange={(e) => setAdjustPoints({ ...adjustPoints, amount: parseInt(e.target.value) || 0 })}
                  />
                </FormField>
                <FormField label={t('admin.clients.reason')}>
                  <Input
                    type="text"
                    placeholder={t('admin.clients.reasonPlaceholder')}
                    value={adjustPoints.reason}
                    onChange={(e) => setAdjustPoints({ ...adjustPoints, reason: e.target.value })}
                  />
                </FormField>
              </div>
              <Button
                variant="primary"
                onClick={() => adjustUserPoints(selectedUser.id)}
                disabled={saving || !adjustPoints.amount || !adjustPoints.reason}
                loading={saving}
              >
                {t('admin.clients.applyAdjustment')}
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-sm text-slate-500">{t('admin.clients.orders')}</p>
                <p className="text-2xl font-bold text-slate-900">{selectedUser._count?.purchases || 0}</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-sm text-slate-500">{t('admin.clients.totalSpent')}</p>
                <p className="text-2xl font-bold text-emerald-700">{selectedUser.totalSpent?.toFixed(2) || '0.00'} $</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
