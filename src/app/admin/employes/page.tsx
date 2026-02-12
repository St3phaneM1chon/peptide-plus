'use client';

import { useState, useEffect } from 'react';
import { Plus, Pencil, Users, UserCheck, Crown } from 'lucide-react';
import { PageHeader, Button, Modal, FormField, Input, StatusBadge } from '@/components/admin';

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

const allPermissions = [
  { key: 'orders.view', label: 'Voir les commandes' },
  { key: 'orders.manage', label: 'Gerer les commandes' },
  { key: 'products.view', label: 'Voir les produits' },
  { key: 'products.manage', label: 'Gerer les produits' },
  { key: 'customers.view', label: 'Voir les clients' },
  { key: 'customers.manage', label: 'Gerer les clients' },
  { key: 'inventory.view', label: "Voir l'inventaire" },
  { key: 'inventory.manage', label: "Gerer l'inventaire" },
  { key: 'marketing.manage', label: 'Marketing (promos, newsletter)' },
  { key: 'reviews.moderate', label: 'Moderer les avis' },
  { key: 'chat.respond', label: 'Repondre au chat' },
  { key: 'reports.view', label: 'Voir les rapports' },
  { key: 'settings.manage', label: 'Gerer les parametres' },
  { key: 'employees.manage', label: 'Gerer les employes' },
];

export default function EmployesPage() {
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
        title="Employes"
        subtitle="Gerez les acces de votre equipe"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => { resetForm(); setShowForm(true); }}>
            Inviter un employe
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat icon={Users} label="Total" value={employees.length} bg="bg-slate-100 text-slate-600" />
        <MiniStat icon={UserCheck} label="Actifs" value={employees.filter((e) => e.isActive).length} bg="bg-emerald-100 text-emerald-600" />
        <MiniStat icon={Crown} label="Proprietaires" value={employees.filter((e) => e.role === 'OWNER').length} bg="bg-sky-100 text-sky-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Employe</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Permissions</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Derniere connexion</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
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
                    {emp.role === 'OWNER' ? 'Toutes' : `${emp.permissions.length} permissions`}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-slate-500">
                  {emp.lastLogin ? new Date(emp.lastLogin).toLocaleString('fr-CA') : 'Jamais'}
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
                    Modifier
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
        title={editingEmployee ? 'Modifier les acces' : 'Inviter un employe'}
      >
        <div className="space-y-4">
          <FormField label="Email" required>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={!!editingEmployee}
            />
          </FormField>
          <FormField label="Nom" required>
            <Input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </FormField>
          <FormField label="Role">
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="EMPLOYEE">Employe</option>
              <option value="OWNER">Proprietaire (tous les acces)</option>
            </select>
          </FormField>

          {formData.role === 'EMPLOYEE' && (
            <FormField label="Permissions">
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3">
                {allPermissions.map((perm) => (
                  <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.permissions.includes(perm.key)}
                      onChange={() => togglePermission(perm.key)}
                      className="w-4 h-4 rounded border-slate-300 text-sky-500"
                    />
                    <span className="text-sm text-slate-700">{perm.label}</span>
                  </label>
                ))}
              </div>
            </FormField>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={resetForm} className="flex-1">
              Annuler
            </Button>
            <Button variant="primary" className="flex-1">
              {editingEmployee ? 'Sauvegarder' : "Envoyer l'invitation"}
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
