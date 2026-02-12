'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  Settings,
  Inbox,
  Eye,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  Button,
  Modal,
  DataTable,
  FilterBar,
  SelectFilter,
  type Column,
} from '@/components/admin';

interface Ambassador {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  referralCode: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  commissionRate: number;
  totalReferrals: number;
  totalSales: number;
  totalEarnings: number;
  pendingPayout: number;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  joinedAt: string;
}

const tierConfig: Record<string, { color: string; commission: number; minSales: number }> = {
  BRONZE: { color: 'bg-amber-100 text-amber-800', commission: 5, minSales: 0 },
  SILVER: { color: 'bg-slate-200 text-slate-700', commission: 8, minSales: 1000 },
  GOLD: { color: 'bg-yellow-100 text-yellow-800', commission: 10, minSales: 5000 },
  PLATINUM: { color: 'bg-blue-100 text-blue-800', commission: 15, minSales: 15000 },
};

const statusVariant: Record<string, 'warning' | 'success' | 'error'> = {
  PENDING: 'warning',
  ACTIVE: 'success',
  SUSPENDED: 'error',
};

const statusLabels: Record<string, string> = {
  PENDING: 'En attente',
  ACTIVE: 'Actif',
  SUSPENDED: 'Suspendu',
};

export default function AmbassadeursPage() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', tier: '', search: '' });
  const [selectedAmbassador, setSelectedAmbassador] = useState<Ambassador | null>(null);
  const [, setShowApplications] = useState(false);

  useEffect(() => {
    fetchAmbassadors();
  }, []);

  const fetchAmbassadors = async () => {
    setAmbassadors([]);
    setLoading(false);
  };

  const updateStatus = (id: string, status: 'ACTIVE' | 'SUSPENDED') => {
    setAmbassadors(ambassadors.map(a => a.id === id ? { ...a, status } : a));
  };

  const processPayout = (id: string) => {
    alert(`Paiement traité pour l'ambassadeur #${id}`);
    setAmbassadors(ambassadors.map(a => a.id === id ? { ...a, pendingPayout: 0 } : a));
  };

  const filteredAmbassadors = ambassadors.filter(amb => {
    if (filter.status && amb.status !== filter.status) return false;
    if (filter.tier && amb.tier !== filter.tier) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!amb.userName.toLowerCase().includes(search) &&
          !amb.userEmail.toLowerCase().includes(search) &&
          !amb.referralCode.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    total: ambassadors.filter(a => a.status === 'ACTIVE').length,
    totalSales: ambassadors.reduce((sum, a) => sum + a.totalSales, 0),
    totalCommissions: ambassadors.reduce((sum, a) => sum + a.totalEarnings, 0),
    pendingPayouts: ambassadors.reduce((sum, a) => sum + a.pendingPayout, 0),
  };

  const columns: Column<Ambassador>[] = [
    {
      key: 'ambassador',
      header: 'Ambassadeur',
      render: (amb) => (
        <div>
          <p className="font-medium text-slate-900">{amb.userName}</p>
          <p className="text-xs text-slate-500">{amb.userEmail}</p>
          <p className="text-xs text-slate-400">{amb.totalReferrals} parrainages</p>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      render: (amb) => (
        <code className="font-mono font-bold text-sky-600 bg-sky-50 px-2 py-1 rounded">
          {amb.referralCode}
        </code>
      ),
    },
    {
      key: 'tier',
      header: 'Niveau',
      align: 'center',
      render: (amb) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${tierConfig[amb.tier].color}`}>
          {amb.tier} ({amb.commissionRate}%)
        </span>
      ),
    },
    {
      key: 'sales',
      header: 'Ventes',
      align: 'right',
      render: (amb) => (
        <span className="font-medium text-slate-900">
          {amb.totalSales.toLocaleString()} $
        </span>
      ),
    },
    {
      key: 'earnings',
      header: 'Gains',
      align: 'right',
      render: (amb) => (
        <span className="text-slate-600">{amb.totalEarnings.toFixed(2)} $</span>
      ),
    },
    {
      key: 'pending',
      header: 'En attente',
      align: 'right',
      render: (amb) => (
        amb.pendingPayout > 0 ? (
          <span className="text-purple-600 font-medium">{amb.pendingPayout.toFixed(2)} $</span>
        ) : (
          <span className="text-slate-400">-</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (amb) => (
        <div className="flex items-center justify-center gap-2">
          {amb.status === 'PENDING' && (
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus(amb.id, 'ACTIVE'); }}
              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
            >
              Approuver
            </button>
          )}
          {amb.pendingPayout > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); processPayout(amb.id); }}
              className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
            >
              Payer
            </button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={(e) => { e.stopPropagation(); setSelectedAmbassador(amb); }}
          >
            Détails
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programme Ambassadeur"
        subtitle="Gérez vos ambassadeurs et affiliés"
        actions={
          <div className="flex gap-3">
            <Button
              variant="secondary"
              icon={Inbox}
              onClick={() => setShowApplications(true)}
            >
              <span className="w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">1</span>
              Candidatures
            </Button>
            <Button variant="primary" icon={Settings}>
              Configurer le programme
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Ambassadeurs actifs"
          value={stats.total}
          icon={Users}
        />
        <StatCard
          label="Ventes générées"
          value={`${stats.totalSales.toLocaleString()} $`}
          icon={TrendingUp}
          className="bg-green-50 border-green-200"
        />
        <StatCard
          label="Commissions versées"
          value={`${stats.totalCommissions.toLocaleString()} $`}
          icon={DollarSign}
          className="bg-sky-50 border-sky-200"
        />
        <StatCard
          label="Paiements en attente"
          value={`${stats.pendingPayouts.toFixed(2)} $`}
          icon={Clock}
          className="bg-purple-50 border-purple-200"
        />
      </div>

      {/* Tiers Info */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Niveaux de commission</h3>
        <div className="grid grid-cols-4 gap-4">
          {Object.entries(tierConfig).map(([tier, config]) => (
            <div key={tier} className={`p-3 rounded-lg ${config.color}`}>
              <p className="font-bold">{tier}</p>
              <p className="text-sm">{config.commission}% commission</p>
              <p className="text-xs opacity-75">{config.minSales > 0 ? `${config.minSales}$+ ventes` : 'Niveau de base'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(v) => setFilter({ ...filter, search: v })}
        searchPlaceholder="Rechercher..."
      >
        <SelectFilter
          label="Tous les statuts"
          value={filter.status}
          onChange={(v) => setFilter({ ...filter, status: v })}
          options={[
            { value: 'ACTIVE', label: 'Actif' },
            { value: 'PENDING', label: 'En attente' },
            { value: 'SUSPENDED', label: 'Suspendu' },
          ]}
        />
        <SelectFilter
          label="Tous les niveaux"
          value={filter.tier}
          onChange={(v) => setFilter({ ...filter, tier: v })}
          options={[
            { value: 'BRONZE', label: 'Bronze' },
            { value: 'SILVER', label: 'Silver' },
            { value: 'GOLD', label: 'Gold' },
            { value: 'PLATINUM', label: 'Platinum' },
          ]}
        />
      </FilterBar>

      {/* Ambassadors List */}
      <DataTable
        columns={columns}
        data={filteredAmbassadors}
        keyExtractor={(amb) => amb.id}
        loading={loading}
        emptyTitle="Aucun ambassadeur trouvé"
        emptyDescription="Aucun ambassadeur ne correspond aux critères de recherche."
      />

      {/* Ambassador Detail Modal */}
      <Modal
        isOpen={!!selectedAmbassador}
        onClose={() => setSelectedAmbassador(null)}
        title={selectedAmbassador?.userName || ''}
        footer={
          selectedAmbassador && (
            <>
              {selectedAmbassador.status === 'ACTIVE' ? (
                <Button
                  variant="danger"
                  onClick={() => { updateStatus(selectedAmbassador.id, 'SUSPENDED'); setSelectedAmbassador(null); }}
                >
                  Suspendre
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => { updateStatus(selectedAmbassador.id, 'ACTIVE'); setSelectedAmbassador(null); }}
                >
                  Activer
                </Button>
              )}
              <Button variant="primary">
                Modifier la commission
              </Button>
            </>
          )
        }
      >
        {selectedAmbassador && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Code de parrainage</p>
              <code className="font-mono font-bold text-lg">{selectedAmbassador.referralCode}</code>
            </div>
            <div>
              <p className="text-sm text-slate-500">Niveau</p>
              <span className={`px-2 py-1 rounded-full text-sm font-medium ${tierConfig[selectedAmbassador.tier].color}`}>
                {selectedAmbassador.tier}
              </span>
            </div>
            <div>
              <p className="text-sm text-slate-500">Commission</p>
              <p className="font-bold">{selectedAmbassador.commissionRate}%</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Parrainages</p>
              <p className="font-bold">{selectedAmbassador.totalReferrals}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Ventes générées</p>
              <p className="font-bold">{selectedAmbassador.totalSales.toLocaleString()} $</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Gains totaux</p>
              <p className="font-bold">{selectedAmbassador.totalEarnings.toFixed(2)} $</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
