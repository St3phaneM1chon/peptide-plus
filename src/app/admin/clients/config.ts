import {
  Users,
  UserCheck,
  Briefcase,
  Crown,
  ShoppingCart,
  Mail,
  KeyRound,
  Ban,
} from 'lucide-react';
import Link from 'next/link';
import { createElement } from 'react';
import { Button } from '@/components/admin/Button';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';
import type { ContactListPageConfig } from '@/components/admin/ContactListPage';
import { RoleManagementSection, PointAdjustmentSection } from './ClientDetailSections';

// ── Badge helper ─────────────────────────────────────────────

type ListBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

function roleBadgeVariant(role: string): ListBadgeVariant {
  switch (role) {
    case 'CUSTOMER': return 'info';
    case 'CLIENT': return 'info';
    case 'EMPLOYEE': return 'warning';
    case 'OWNER': return 'success';
    default: return 'neutral';
  }
}

// ── Config ───────────────────────────────────────────────────

export const clientConfig: ContactListPageConfig = {
  apiEndpoint: '/api/admin/users?role=CLIENT',
  dataKey: 'users',
  i18nPrefix: 'admin.clients',
  filterField: 'role',
  profileLinkPattern: '/admin/clients/{id}',
  ordersLinkPattern: '/admin/commandes?user={id}',

  statCards: [
    {
      labelKey: 'admin.clients.totalUsers',
      icon: Users,
      getValue: (items) => items.length,
    },
    {
      labelKey: 'admin.clients.clients',
      icon: UserCheck,
      getValue: (items) => items.filter(u => u.role === 'CUSTOMER').length,
    },
    {
      labelKey: 'admin.clients.employees',
      icon: Briefcase,
      getValue: (items) => items.filter(u => u.role === 'EMPLOYEE').length,
    },
    {
      labelKey: 'admin.clients.vipGoldPlus',
      icon: Crown,
      getValue: (items) => items.filter(u =>
        u.loyaltyTier === 'GOLD' || u.loyaltyTier === 'PLATINUM' || u.loyaltyTier === 'DIAMOND'
      ).length,
    },
  ],

  filterTabs: [
    { key: 'all', labelKey: 'admin.clients.allRoles', getCount: (items) => items.length },
    { key: 'CUSTOMER', labelKey: 'admin.clients.filterCustomer', getCount: (items) => items.filter(u => u.role === 'CUSTOMER').length },
    { key: 'CLIENT', labelKey: 'admin.clients.filterClient', getCount: (items) => items.filter(u => u.role === 'CLIENT').length },
    { key: 'EMPLOYEE', labelKey: 'admin.clients.filterEmployee', getCount: (items) => items.filter(u => u.role === 'EMPLOYEE').length },
    { key: 'OWNER', labelKey: 'admin.clients.filterOwner', getCount: (items) => items.filter(u => u.role === 'OWNER').length },
  ],

  listItem: {
    getPreview: (item) =>
      `${item.loyaltyTier} - ${item.loyaltyPoints.toLocaleString()} pts`,
    getBadges: (item) => [
      { text: item.role || 'PUBLIC', variant: roleBadgeVariant(item.role || 'PUBLIC') },
    ],
  },

  detailActions: {
    renderActions: (item, t) =>
      createElement('div', { className: 'flex items-center gap-2 flex-wrap' },
        createElement(Link, { href: `/admin/commandes?user=${item.id}` },
          createElement(Button, { variant: 'ghost' as const, size: 'sm' as const, icon: ShoppingCart },
            t('admin.clients.viewOrders')
          )
        ),
        createElement(Button, {
          variant: 'ghost' as const, size: 'sm' as const, icon: Mail,
          onClick: () => {
            // TODO: Create API endpoint POST /api/admin/users/:id/email for sending emails
            toast.info(t('admin.clients.sendEmail') + ' - Coming soon');
          },
        },
          t('admin.clients.sendEmail')
        ),
        createElement(Button, {
          variant: 'ghost' as const, size: 'sm' as const, icon: KeyRound,
          onClick: async () => {
            try {
              const res = await fetch(`/api/admin/users/${item.id}/reset-password`, { method: 'POST', headers: addCSRFHeader() });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'Failed to reset password');
                return;
              }
              toast.success(t('admin.clients.passwordResetSent') || 'Password reset email sent');
            } catch {
              // TODO: Create API endpoint POST /api/admin/users/:id/reset-password
              toast.info(t('admin.clients.resetPassword') + ' - Coming soon');
            }
          },
        },
          t('admin.clients.resetPassword')
        ),
        createElement(Button, {
          variant: 'danger' as const, size: 'sm' as const, icon: Ban,
          onClick: async () => {
            if (!confirm(t('admin.clients.suspendConfirm') || `Suspend ${item.name || item.email}?`)) return;
            try {
              const res = await fetch(`/api/admin/users/${item.id}`, {
                method: 'PATCH',
                headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ isBanned: true }),
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || 'Failed to suspend user');
                return;
              }
              toast.success(t('admin.clients.userSuspended') || 'User suspended');
            } catch {
              // TODO: Create API endpoint PATCH /api/admin/users/:id with isBanned field
              toast.info(t('admin.clients.suspend') + ' - Coming soon');
            }
          },
        },
          t('admin.clients.suspend')
        ),
      ),
  },

  detailSections: [
    {
      key: 'role-management',
      render: (item, updateItem, t) =>
        createElement(RoleManagementSection, { item, updateItem, t }),
    },
    {
      key: 'point-adjustment',
      render: (item, updateItem, t) =>
        createElement(PointAdjustmentSection, { item, updateItem, t }),
    },
  ],

  showContactSection: true,
  showLoyaltySection: true,
  showReferralCode: true,
};
