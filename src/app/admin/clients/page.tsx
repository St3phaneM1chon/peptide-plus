'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

const roleColors: Record<string, string> = {
  PUBLIC: 'bg-gray-100 text-gray-800',
  CUSTOMER: 'bg-blue-100 text-blue-800',
  CLIENT: 'bg-purple-100 text-purple-800',
  EMPLOYEE: 'bg-amber-100 text-amber-800',
  OWNER: 'bg-green-100 text-green-800',
};

const tierColors: Record<string, string> = {
  BRONZE: 'bg-orange-100 text-orange-800',
  SILVER: 'bg-gray-200 text-gray-700',
  GOLD: 'bg-yellow-100 text-yellow-800',
  PLATINUM: 'bg-blue-100 text-blue-800',
  DIAMOND: 'bg-purple-100 text-purple-800',
};

export default function ClientsPage() {
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
      const res = await fetch('/api/admin/users');
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
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500">Gérez vos clients et leurs points de fidélité</p>
        </div>
        <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Exporter
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total utilisateurs</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Clients</p>
          <p className="text-2xl font-bold text-blue-700">{stats.customers}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Employés</p>
          <p className="text-2xl font-bold text-amber-700">{stats.employees}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">VIP (Gold+)</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.gold}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Rechercher (nom, email)..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.role}
            onChange={(e) => setFilter({ ...filter, role: e.target.value })}
          >
            <option value="">Tous les rôles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="CLIENT">Client</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="OWNER">Owner</option>
          </select>
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.tier}
            onChange={(e) => setFilter({ ...filter, tier: e.target.value })}
          >
            <option value="">Tous les niveaux</option>
            <option value="BRONZE">Bronze</option>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="PLATINUM">Platinum</option>
            <option value="DIAMOND">Diamond</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rôle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Fidélité</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Points</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Achats</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Inscrit</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {user.image ? (
                        <img src={user.image} alt="" className="w-10 h-10 rounded-full" />
                      ) : (
                        <span className="text-gray-600 font-semibold">
                          {user.name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.name || 'Sans nom'}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${tierColors[user.loyaltyTier]}`}>
                    {user.loyaltyTier}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{user.loyaltyPoints.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">/{user.lifetimePoints.toLocaleString()} total</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-gray-900">{user._count?.purchases || 0}</p>
                  {user.totalSpent && user.totalSpent > 0 && (
                    <p className="text-xs text-gray-500">{user.totalSpent.toFixed(2)} $</p>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString('fr-CA')}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm hover:bg-amber-200"
                  >
                    Gérer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Aucun utilisateur trouvé
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  {selectedUser.image ? (
                    <img src={selectedUser.image} alt="" className="w-12 h-12 rounded-full" />
                  ) : (
                    <span className="text-gray-600 font-bold text-xl">
                      {selectedUser.name?.charAt(0) || selectedUser.email.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedUser.name || 'Sans nom'}</h2>
                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rôle</label>
                <select
                  value={selectedUser.role}
                  onChange={(e) => updateUserRole(selectedUser.id, e.target.value)}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="CLIENT">Client</option>
                  <option value="EMPLOYEE">Employee</option>
                  <option value="OWNER">Owner</option>
                </select>
              </div>

              {/* Loyalty Info */}
              <div className="bg-amber-50 rounded-lg p-4">
                <h3 className="font-semibold text-amber-900 mb-3">Programme de fidélité</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-amber-700">Niveau</p>
                    <span className={`px-2 py-1 rounded-full text-sm font-medium ${tierColors[selectedUser.loyaltyTier]}`}>
                      {selectedUser.loyaltyTier}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-amber-700">Points actuels</p>
                    <p className="text-2xl font-bold text-amber-900">{selectedUser.loyaltyPoints.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-amber-700">Points à vie</p>
                    <p className="text-2xl font-bold text-amber-900">{selectedUser.lifetimePoints.toLocaleString()}</p>
                  </div>
                </div>
                {selectedUser.referralCode && (
                  <p className="text-sm text-amber-700">
                    Code parrainage: <span className="font-mono font-bold">{selectedUser.referralCode}</span>
                  </p>
                )}
              </div>

              {/* Adjust Points */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Ajuster les points</h3>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Montant</label>
                    <input
                      type="number"
                      placeholder="Ex: 100 ou -50"
                      value={adjustPoints.amount || ''}
                      onChange={(e) => setAdjustPoints({ ...adjustPoints, amount: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Raison</label>
                    <input
                      type="text"
                      placeholder="Raison de l'ajustement"
                      value={adjustPoints.reason}
                      onChange={(e) => setAdjustPoints({ ...adjustPoints, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <button
                  onClick={() => adjustUserPoints(selectedUser.id)}
                  disabled={saving || !adjustPoints.amount || !adjustPoints.reason}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  Appliquer l'ajustement
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Commandes</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedUser._count?.purchases || 0}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-500">Total dépensé</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedUser.totalSpent?.toFixed(2) || '0.00'} $</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Link
                  href={`/admin/commandes?user=${selectedUser.id}`}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Voir ses commandes
                </Link>
                <button className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                  Envoyer email
                </button>
                <button className="px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200">
                  Réinitialiser mot de passe
                </button>
                <button className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 ml-auto">
                  Suspendre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
