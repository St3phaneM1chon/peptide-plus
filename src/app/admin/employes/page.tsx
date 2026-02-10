'use client';

import { useState, useEffect } from 'react';

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
  { key: 'orders.manage', label: 'Gérer les commandes' },
  { key: 'products.view', label: 'Voir les produits' },
  { key: 'products.manage', label: 'Gérer les produits' },
  { key: 'customers.view', label: 'Voir les clients' },
  { key: 'customers.manage', label: 'Gérer les clients' },
  { key: 'inventory.view', label: 'Voir l\'inventaire' },
  { key: 'inventory.manage', label: 'Gérer l\'inventaire' },
  { key: 'marketing.manage', label: 'Marketing (promos, newsletter)' },
  { key: 'reviews.moderate', label: 'Modérer les avis' },
  { key: 'chat.respond', label: 'Répondre au chat' },
  { key: 'reports.view', label: 'Voir les rapports' },
  { key: 'settings.manage', label: 'Gérer les paramètres' },
  { key: 'employees.manage', label: 'Gérer les employés' },
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
    setEmployees(employees.map(e => e.id === id ? { ...e, isActive: !e.isActive } : e));
  };

  const resetForm = () => {
    setFormData({ email: '', name: '', role: 'EMPLOYEE', permissions: [] });
    setEditingEmployee(null);
    setShowForm(false);
  };

  const startEdit = (emp: Employee) => {
    setFormData({
      email: emp.email,
      name: emp.name,
      role: emp.role,
      permissions: emp.permissions,
    });
    setEditingEmployee(emp);
    setShowForm(true);
  };

  const togglePermission = (key: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(key)
        ? prev.permissions.filter(p => p !== key)
        : [...prev.permissions, key],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employés</h1>
          <p className="text-gray-500">Gérez les accès de votre équipe</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Inviter un employé
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Actifs</p>
          <p className="text-2xl font-bold text-green-700">{employees.filter(e => e.isActive).length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Propriétaires</p>
          <p className="text-2xl font-bold text-amber-700">{employees.filter(e => e.role === 'OWNER').length}</p>
        </div>
      </div>

      {/* Employees List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Employé</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Permissions</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dernière connexion</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {employees.map((emp) => (
              <tr key={emp.id} className={`hover:bg-gray-50 ${!emp.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 font-semibold">{emp.name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    emp.role === 'OWNER' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {emp.role}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <p className="text-sm text-gray-600">
                    {emp.role === 'OWNER' ? 'Toutes' : `${emp.permissions.length} permissions`}
                  </p>
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">
                  {emp.lastLogin 
                    ? new Date(emp.lastLogin).toLocaleString('fr-CA')
                    : 'Jamais'
                  }
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleActive(emp.id)}
                    disabled={emp.role === 'OWNER'}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      emp.isActive ? 'bg-green-500' : 'bg-gray-300'
                    } ${emp.role === 'OWNER' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      emp.isActive ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => startEdit(emp)}
                    className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingEmployee ? 'Modifier les accès' : 'Inviter un employé'}
              </h2>
              <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!!editingEmployee}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="EMPLOYEE">Employé</option>
                  <option value="OWNER">Propriétaire (tous les accès)</option>
                </select>
              </div>

              {formData.role === 'EMPLOYEE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {allPermissions.map((perm) => (
                      <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.key)}
                          onChange={() => togglePermission(perm.key)}
                          className="w-4 h-4 rounded border-gray-300 text-amber-500"
                        />
                        <span className="text-sm text-gray-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={resetForm}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Annuler
                </button>
                <button className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  {editingEmployee ? 'Sauvegarder' : 'Envoyer l\'invitation'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
