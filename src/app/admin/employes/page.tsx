'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Users, UserCheck, Crown } from 'lucide-react';
import { PageHeader, Button, Modal, FormField, Input, StatusBadge } from '@/components/admin';
import { useI18n } from '@/i18n/client';

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

export default function EmployesPage() {
  const { t, locale } = useI18n();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'EMPLOYEE' as 'EMPLOYEE' | 'OWNER',
    permissions: [] as string[],
  });

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
      setEmployees([]);
    }
    setLoading(false);
  };

  const toggleActive = (id: string) => {
    setEmployees(employees.map((e) => (e.id === id ? { ...e, isActive: !e.isActive } : e)));
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.employees.title')}
        subtitle={t('admin.employees.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
            {t('admin.employees.inviteEmployee')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat icon={Users} label={t('admin.employees.total')} value={employees.length} bg="bg-slate-100 text-slate-600" />
        <MiniStat icon={UserCheck} label={t('admin.employees.active')} value={employees.filter((e) => e.isActive).length} bg="bg-emerald-100 text-emerald-600" />
        <MiniStat icon={Crown} label={t('admin.employees.owners')} value={employees.filter((e) => e.role === 'OWNER').length} bg="bg-sky-100 text-sky-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.employees.employeeCol')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.employees.roleCol')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.employees.permissionsCol')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">{t('admin.employees.lastLogin')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.employees.statusCol')}</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">{t('admin.employees.actionsCol')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id} className={`hover:bg-slate-50/50 ${!emp.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                      <span className="text-slate-600 font-semibold">{emp.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{emp.name}</p>
                      <p className="text-xs text-slate-500">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge variant={emp.role === 'OWNER' ? 'primary' : 'info'}>
                    {emp.role}
                  </StatusBadge>
                </td>
                <td className="px-4 py-4">
                  <p className="text-sm text-slate-600">
                    {emp.role === 'OWNER' ? t('admin.employees.allPermissions') : t('admin.employees.permissionsCount', { count: emp.permissions.length })}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-500">
                  {emp.lastLogin ? new Date(emp.lastLogin).toLocaleString(locale) : t('admin.employees.never')}
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleActive(emp.id)}
                    disabled={emp.role === 'OWNER'}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      emp.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    } ${emp.role === 'OWNER' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      emp.isActive ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-4 text-center">
                  <Button variant="ghost" size="sm" icon={Pencil} onClick={() => startEdit(emp)}>
                    {t('admin.employees.editBtn')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
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
            <Button variant="primary" className="flex-1">
              {editingEmployee ? t('admin.employees.saveBtn') : t('admin.employees.sendInvitation')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; bg: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
