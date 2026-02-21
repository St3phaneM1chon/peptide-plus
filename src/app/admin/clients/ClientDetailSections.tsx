'use client';

import { useState } from 'react';
import { Button } from '@/components/admin/Button';
import { FormField, Input } from '@/components/admin/FormField';
import type { ContactRecord } from '@/components/admin/ContactListPage';
import { toast } from 'sonner';

// ── Role Management Section ──────────────────────────────────

interface RoleManagementProps {
  item: ContactRecord;
  updateItem: (id: string, patch: Partial<ContactRecord>) => void;
  t: (key: string) => string;
}

export function RoleManagementSection({ item, updateItem, t }: RoleManagementProps) {
  const [saving, setSaving] = useState(false);

  const updateUserRole = async (newRole: string) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/users/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      updateItem(item.id, { role: newRole });
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
    setSaving(false);
  };

  return (
    <FormField label={t('admin.clients.role')}>
      <select
        value={item.role || 'PUBLIC'}
        onChange={(e) => updateUserRole(e.target.value)}
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
  );
}

// ── Point Adjustment Section ─────────────────────────────────

interface PointAdjustmentProps {
  item: ContactRecord;
  updateItem: (id: string, patch: Partial<ContactRecord>) => void;
  t: (key: string) => string;
}

export function PointAdjustmentSection({ item, updateItem, t }: PointAdjustmentProps) {
  const [saving, setSaving] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState({ amount: 0, reason: '' });

  const adjustUserPoints = async () => {
    if (!adjustPoints.amount || !adjustPoints.reason) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/users/${item.id}/points`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adjustPoints),
      });
      const newPoints = (item.loyaltyPoints || 0) + adjustPoints.amount;
      updateItem(item.id, { loyaltyPoints: newPoints });
      setAdjustPoints({ amount: 0, reason: '' });
    } catch (err) {
      console.error(err);
      toast.error(t('common.errorOccurred'));
    }
    setSaving(false);
  };

  return (
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
        onClick={adjustUserPoints}
        disabled={saving || !adjustPoints.amount || !adjustPoints.reason}
        loading={saving}
      >
        {t('admin.clients.applyAdjustment')}
      </Button>
    </div>
  );
}
