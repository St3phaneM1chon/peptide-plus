'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Pencil, Users, UserCheck, Crown, Shield } from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { FormField, Input } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

// ── Types ─────────────────────────────────────────────────────

interface Employee {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'EMPLOYEE';
  permissions: string[];
  lastLogin?: string;
  isActive: boolean;
  createdAt: string;
}

const permissionKeys = [
  'orders.view',
  'orders.manage',
  'products.view',
  'products.manage',
  'customers.view',
  'customers.manage',
  'inventory.view',
  'inventory.manage',
  'marketing.manage',
  'reviews.moderate',
  'chat.respond',
  'reports.view',
  'settings.manage',
  'employees.manage',
] as const;

const permissionI18nMap: Record<string, string> = {
  'orders.view': 'admin.employees.permViewOrders',
  'orders.manage': 'admin.employees.permManageOrders',
  'products.view': 'admin.employees.permViewProducts',
  'products.manage': 'admin.employees.permManageProducts',
  'customers.view': 'admin.employees.permViewCustomers',
  'customers.manage': 'admin.employees.permManageCustomers',
  'inventory.view': 'admin.employees.permViewInventory',
  'inventory.manage': 'admin.employees.permManageInventory',
  'marketing.manage': 'admin.employees.permMarketing',
  'reviews.moderate': 'admin.employees.permModerateReviews',
  'chat.respond': 'admin.employees.permRespondChat',
  'reports.view': 'admin.employees.permViewReports',
  'settings.manage': 'admin.employees.permManageSettings',
  'employees.manage': 'admin.employees.permManageEmployees',
};

// ── Helpers ───────────────────────────────────────────────────

function roleBadgeVariant(role: string): 'info' | 'warning' {
  return role === 'OWNER' ? 'warning' : 'info';
}

function statusBadgeVariant(isActive: boolean): 'success' | 'error' {
  return isActive ? 'success' : 'error';
}

// ── Main Component ────────────────────────────────────────────

export default function EmployesPage() {
  const { t, locale } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Form modal state (Create/Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'OWNER',
    permissions: [] as string[],
  });
  const [saving, setSaving] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/admin/employees');
      const data = await res.json();
      setEmployees(data.employees || []);
    } catch (err) {
      console.error('Error fetching employees:', err);
      toast.error(t('common.error'));
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  // ─── Actions ──────────────────────────────────────────────

  const toggleActive = async (id: string) => {
    const emp = employees.find((e) => e.id === id);
    if (!emp || emp.role === 'OWNER') return;

    const newActive = !emp.isActive;
    // Optimistic update
    setEmployees(employees.map((e) => (e.id === id ? { ...e, isActive: newActive } : e)));

    try {
      const res = await fetch(`/api/admin/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        setEmployees(employees.map((e) => (e.id === id ? { ...e, isActive: !newActive } : e)));
        toast.error(t('common.updateFailed'));
      }
    } catch {
      setEmployees(employees.map((e) => (e.id === id ? { ...e, isActive: !newActive } : e)));
      toast.error(t('common.updateFailed'));
    }
  };

  const handleSubmit = async () => {
    if (!formData.email || !formData.name) {
      toast.error(t('admin.employees.emailAndNameRequired') || 'Email and name are required');
      return;
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        const res = await fetch(`/api/admin/employees/${editingEmployee.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            role: formData.role,
            permissions: formData.role === 'EMPLOYEE' ? formData.permissions : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || t('common.updateFailed'));
          return;
        }
        toast.success(t('admin.employees.employeeUpdated') || 'Employee updated');
      } else {
        const res = await fetch('/api/admin/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name,
            role: formData.role,
            permissions: formData.role === 'EMPLOYEE' ? formData.permissions : undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || t('common.saveFailed'));
          return;
        }
        toast.success(t('admin.employees.employeeInvited') || 'Employee invited');
      }

      resetForm();
      await fetchEmployees();
    } catch (err) {
      console.error('Error saving employee:', err);
      toast.error(t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ email: '', name: '', role: 'EMPLOYEE', permissions: [] });
    setEditingEmployee(null);
    setShowForm(false);
  };

  const startEdit = (emp: Employee) => {
    setFormData({ email: emp.email, name: emp.name, role: emp.role, permissions: emp.permissions });
    setEditingEmployee(emp);
    setShowForm(true);
  };

  const togglePermission = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key],
    }));
  };

  const handleSelectEmployee = useCallback((id: string) => {
    setSelectedEmployeeId(id);
  }, []);

  // ─── Filtering ──────────────────────────────────────────────

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (roleFilter === 'active' && !emp.isActive) return false;
      if (roleFilter === 'OWNER' && emp.role !== 'OWNER') return false;
      if (roleFilter === 'EMPLOYEE' && emp.role !== 'EMPLOYEE') return false;
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (
          !emp.name.toLowerCase().includes(search) &&
          !emp.email.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [employees, roleFilter, searchValue]);

  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter((e) => e.isActive).length,
    owners: employees.filter((e) => e.role === 'OWNER').length,
  }), [employees]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.employees.total'), count: stats.total },
    { key: 'active', label: t('admin.employees.active'), count: stats.active },
    { key: 'OWNER', label: t('admin.employees.owners'), count: stats.owners },
    { key: 'EMPLOYEE', label: t('admin.employees.roleEmployee'), count: employees.filter(e => e.role === 'EMPLOYEE').length },
  ], [t, stats, employees]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredEmployees.map((emp) => ({
      id: emp.id,
      avatar: { text: emp.name.charAt(0) },
      title: emp.name,
      subtitle: emp.email,
      preview: emp.role === 'OWNER'
        ? t('admin.employees.allPermissions')
        : t('admin.employees.permissionsCount', { count: emp.permissions.length }),
      timestamp: emp.lastLogin || emp.createdAt,
      badges: [
        { text: emp.role, variant: roleBadgeVariant(emp.role) },
        { text: emp.isActive ? t('admin.employees.active') : 'Inactive', variant: statusBadgeVariant(emp.isActive) },
      ],
    }));
  }, [filteredEmployees, t]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.id === selectedEmployeeId) || null;
  }, [employees, selectedEmployeeId]);

  // ─── Ribbon action handlers ───────────────────────────────
  const handleRibbonNewRole = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, []);

  const handleRibbonSave = useCallback(() => {
    handleSubmit();
  }, []);

  const handleRibbonDelete = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleRibbonExport = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  useRibbonAction('newRole', handleRibbonNewRole);
  useRibbonAction('save', handleRibbonSave);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('export', handleRibbonExport);

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stat cards row */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.employees.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.employees.subtitle')}</p>
          </div>
          <Button variant="primary" icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
            {t('admin.employees.inviteEmployee')}
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <StatCard label={t('admin.employees.total')} value={stats.total} icon={Users} />
          <StatCard label={t('admin.employees.active')} value={stats.active} icon={UserCheck} />
          <StatCard label={t('admin.employees.owners')} value={stats.owners} icon={Crown} />
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={380}
          showDetail={!!selectedEmployeeId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedEmployeeId}
              onSelect={handleSelectEmployee}
              filterTabs={filterTabs}
              activeFilter={roleFilter}
              onFilterChange={setRoleFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.employees.searchPlaceholder') || 'Rechercher un employe...'}
              loading={loading}
              emptyIcon={Users}
              emptyTitle={t('admin.employees.emptyTitle') || 'Aucun employe'}
              emptyDescription={t('admin.employees.emptyDescription') || 'Aucun employe trouve.'}
            />
          }
          detail={
            selectedEmployee ? (
              <DetailPane
                header={{
                  title: selectedEmployee.name,
                  subtitle: selectedEmployee.email,
                  avatar: { text: selectedEmployee.name.charAt(0) },
                  onBack: () => setSelectedEmployeeId(null),
                  backLabel: t('admin.employees.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={Pencil} onClick={() => startEdit(selectedEmployee)}>
                        {t('admin.employees.editBtn')}
                      </Button>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Status & Role */}
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        selectedEmployee.role === 'OWNER'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}>
                        {selectedEmployee.role === 'OWNER' ? <Crown className="w-4 h-4 mr-1.5" /> : <Shield className="w-4 h-4 mr-1.5" />}
                        {selectedEmployee.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-sm text-slate-600">{t('admin.employees.statusCol')}:</span>
                      <button
                        onClick={() => toggleActive(selectedEmployee.id)}
                        disabled={selectedEmployee.role === 'OWNER'}
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          selectedEmployee.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                        } ${selectedEmployee.role === 'OWNER' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          selectedEmployee.isActive ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                      <span className={`text-sm font-medium ${selectedEmployee.isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {selectedEmployee.isActive ? t('admin.employees.active') : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Employee Info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.employees.employeeCol')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.employees.nameLabel')}</p>
                        <p className="text-slate-900 font-medium">{selectedEmployee.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.employees.emailLabel')}</p>
                        <p className="text-slate-900">{selectedEmployee.email}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.employees.lastLogin')}</p>
                        <p className="text-slate-700">
                          {selectedEmployee.lastLogin
                            ? new Date(selectedEmployee.lastLogin).toLocaleString(locale)
                            : t('admin.employees.never')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.employees.roleCol')}</p>
                        <p className="text-slate-700">{selectedEmployee.role}</p>
                      </div>
                    </div>
                  </div>

                  {/* Permissions */}
                  <div>
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.employees.permissionsCol')}</h3>
                    {selectedEmployee.role === 'OWNER' ? (
                      <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        {t('admin.employees.allPermissions')}
                      </p>
                    ) : (
                      <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                        {permissionKeys.map((key) => {
                          const hasPermission = selectedEmployee.permissions.includes(key);
                          return (
                            <div
                              key={key}
                              className={`flex items-center justify-between px-4 py-2.5 ${
                                hasPermission ? '' : 'opacity-40'
                              }`}
                            >
                              <span className="text-sm text-slate-700">{t(permissionI18nMap[key])}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                                hasPermission
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {hasPermission ? '✓' : '-'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Users}
                emptyTitle={t('admin.employees.emptyTitle') || 'Selectionnez un employe'}
                emptyDescription={t('admin.employees.emptyDescription') || 'Selectionnez un employe pour voir ses details.'}
              />
            )
          }
        />
      </div>

      {/* ─── CREATE/EDIT FORM MODAL ─────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={resetForm}
        title={editingEmployee ? t('admin.employees.editAccess') : t('admin.employees.inviteTitle')}
      >
        <div className="space-y-4">
          <FormField label={t('admin.employees.emailLabel')} required>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!!editingEmployee}
            />
          </FormField>
          <FormField label={t('admin.employees.nameLabel')} required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </FormField>
          <FormField label={t('admin.employees.roleLabel')}>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as 'OWNER' | 'EMPLOYEE' })}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="EMPLOYEE">{t('admin.employees.roleEmployee')}</option>
              <option value="OWNER">{t('admin.employees.roleOwner')}</option>
            </select>
          </FormField>

          {formData.role === 'EMPLOYEE' && (
            <FormField label={t('admin.employees.permissionsLabel')}>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {permissionKeys.map((key) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(key)}
                      onChange={() => togglePermission(key)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-500"
                    />
                    <span className="text-sm text-slate-700">{t(permissionI18nMap[key])}</span>
                  </label>
                ))}
              </div>
            </FormField>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={resetForm} className="flex-1">
              {t('admin.employees.cancelBtn')}
            </Button>
            <Button variant="primary" className="flex-1" onClick={handleSubmit} loading={saving} disabled={saving}>
              {editingEmployee ? t('admin.employees.saveBtn') : t('admin.employees.sendInvitation')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
