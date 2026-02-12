'use client';

import { useState, useEffect } from 'react';
import {
  Repeat,
  Users,
  Pause,
  DollarSign,
  Settings,
  Eye,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  Button,
  Modal,
  EmptyState,
  DataTable,
  FilterBar,
  SelectFilter,
  type Column,
} from '@/components/admin';

interface Subscription {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  productId: string;
  productName: string;
  formatName: string;
  quantity: number;
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'BIMONTHLY';
  price: number;
  discount: number;
  nextDelivery: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  createdAt: string;
}

const frequencyLabels: Record<string, string> = {
  WEEKLY: 'Hebdomadaire',
  BIWEEKLY: 'Toutes les 2 semaines',
  MONTHLY: 'Mensuel',
  BIMONTHLY: 'Tous les 2 mois',
};

const statusVariant: Record<string, 'success' | 'warning' | 'error'> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  CANCELLED: 'error',
};

const statusLabels: Record<string, string> = {
  ACTIVE: 'Actif',
  PAUSED: 'En pause',
  CANCELLED: 'Annulé',
};

export default function AbonnementsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', search: '' });
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/admin/subscriptions');
      const data = await res.json();
      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setSubscriptions([]);
    }
    setLoading(false);
  };

  const updateStatus = (id: string, status: 'ACTIVE' | 'PAUSED' | 'CANCELLED') => {
    setSubscriptions(subscriptions.map(s => s.id === id ? { ...s, status } : s));
  };

  const filteredSubscriptions = subscriptions.filter(sub => {
    if (filter.status && sub.status !== filter.status) return false;
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!sub.userName.toLowerCase().includes(search) &&
          !sub.userEmail.toLowerCase().includes(search) &&
          !sub.productName.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const stats = {
    active: subscriptions.filter(s => s.status === 'ACTIVE').length,
    paused: subscriptions.filter(s => s.status === 'PAUSED').length,
    monthlyRevenue: subscriptions.filter(s => s.status === 'ACTIVE').reduce((sum, s) => {
      const multiplier = s.frequency === 'WEEKLY' ? 4 : s.frequency === 'BIWEEKLY' ? 2 : s.frequency === 'MONTHLY' ? 1 : 0.5;
      return sum + (s.price * (1 - s.discount / 100) * multiplier);
    }, 0),
  };

  const columns: Column<Subscription>[] = [
    {
      key: 'client',
      header: 'Client',
      render: (sub) => (
        <div>
          <p className="font-medium text-slate-900">{sub.userName}</p>
          <p className="text-xs text-slate-500">{sub.userEmail}</p>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Produit',
      render: (sub) => (
        <div>
          <p className="font-medium text-slate-900">{sub.productName}</p>
          <p className="text-xs text-slate-500">{sub.formatName} x {sub.quantity}</p>
        </div>
      ),
    },
    {
      key: 'frequency',
      header: 'Fréquence',
      render: (sub) => (
        <span className="text-slate-600">{frequencyLabels[sub.frequency]}</span>
      ),
    },
    {
      key: 'price',
      header: 'Prix',
      align: 'right',
      render: (sub) => (
        <div>
          <p className="font-medium text-slate-900">{(sub.price * (1 - sub.discount / 100)).toFixed(2)} $</p>
          <p className="text-xs text-green-600">-{sub.discount}%</p>
        </div>
      ),
    },
    {
      key: 'nextDelivery',
      header: 'Prochaine livraison',
      render: (sub) => (
        <span className="text-slate-600">
          {sub.status === 'ACTIVE'
            ? new Date(sub.nextDelivery).toLocaleDateString('fr-CA')
            : '-'
          }
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (sub) => (
        <StatusBadge variant={statusVariant[sub.status]} dot>
          {statusLabels[sub.status]}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (sub) => (
        <div className="flex items-center justify-center gap-2">
          {sub.status === 'ACTIVE' && (
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus(sub.id, 'PAUSED'); }}
              className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200"
            >
              Pause
            </button>
          )}
          {sub.status === 'PAUSED' && (
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus(sub.id, 'ACTIVE'); }}
              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
            >
              Reprendre
            </button>
          )}
          <Button
            size="sm"
            variant="ghost"
            icon={Eye}
            onClick={(e) => { e.stopPropagation(); setSelectedSub(sub); }}
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
        title="Abonnements"
        subtitle="Gérez les abonnements récurrents"
        actions={
          <Button variant="primary" icon={Settings}>
            Configurer les options
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total"
          value={subscriptions.length}
          icon={Repeat}
        />
        <StatCard
          label="Actifs"
          value={stats.active}
          icon={Users}
          className="bg-green-50 border-green-200"
        />
        <StatCard
          label="En pause"
          value={stats.paused}
          icon={Pause}
          className="bg-yellow-50 border-yellow-200"
        />
        <StatCard
          label="Revenu mensuel estimé"
          value={`${stats.monthlyRevenue.toFixed(0)} $`}
          icon={DollarSign}
          className="bg-sky-50 border-sky-200"
        />
      </div>

      {/* Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 mb-3">Configuration des abonnements</h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <p className="font-bold text-lg">15%</p>
            <p className="text-sm text-slate-500">Réduction abonnés</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <p className="font-bold text-lg">GRATUITE</p>
            <p className="text-sm text-slate-500">Livraison abonnés</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <p className="font-bold text-lg">3 jours</p>
            <p className="text-sm text-slate-500">Rappel avant livraison</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-center">
            <p className="font-bold text-lg">1 pause/an</p>
            <p className="text-sm text-slate-500">Pause autorisée</p>
          </div>
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
            { value: 'PAUSED', label: 'En pause' },
            { value: 'CANCELLED', label: 'Annulé' },
          ]}
        />
      </FilterBar>

      {/* Subscriptions List */}
      <DataTable
        columns={columns}
        data={filteredSubscriptions}
        keyExtractor={(sub) => sub.id}
        loading={loading}
        emptyTitle="Aucun abonnement trouvé"
        emptyDescription="Aucun abonnement ne correspond aux critères de recherche."
      />

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedSub}
        onClose={() => setSelectedSub(null)}
        title="Détails de l'abonnement"
        footer={
          selectedSub && (
            <>
              {selectedSub.status !== 'CANCELLED' && (
                <Button
                  variant="danger"
                  onClick={() => { updateStatus(selectedSub.id, 'CANCELLED'); setSelectedSub(null); }}
                >
                  Annuler
                </Button>
              )}
              <Button variant="primary">
                Modifier
              </Button>
            </>
          )
        }
      >
        {selectedSub && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-500">Client</p>
              <p className="font-medium">{selectedSub.userName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Statut</p>
              <StatusBadge variant={statusVariant[selectedSub.status]} dot>
                {statusLabels[selectedSub.status]}
              </StatusBadge>
            </div>
            <div>
              <p className="text-sm text-slate-500">Produit</p>
              <p className="font-medium">{selectedSub.productName}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Format</p>
              <p className="font-medium">{selectedSub.formatName} x {selectedSub.quantity}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Fréquence</p>
              <p className="font-medium">{frequencyLabels[selectedSub.frequency]}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Prix</p>
              <p className="font-medium">{(selectedSub.price * (1 - selectedSub.discount / 100)).toFixed(2)} $</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Créé le</p>
              <p className="font-medium">{new Date(selectedSub.createdAt).toLocaleDateString('fr-CA')}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Prochaine livraison</p>
              <p className="font-medium">
                {selectedSub.status === 'ACTIVE'
                  ? new Date(selectedSub.nextDelivery).toLocaleDateString('fr-CA')
                  : '-'
                }
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
