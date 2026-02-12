'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileDown,
  Package,
  PackageCheck,
  AlertTriangle,
  PackageX,
  DollarSign,
  Pencil,
  History,
  Check,
  X,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  EmptyState,
  StatusBadge,
  StatCard,
  FilterBar,
  SelectFilter,
  DataTable,
  Input,
  type Column,
} from '@/components/admin';

interface ProductFormat {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  formatName: string;
  sku?: string;
  price: number;
  stockQuantity: number;
  lowStockThreshold: number;
  availability: string;
  isActive: boolean;
}

type AvailabilityVariant = 'success' | 'error' | 'warning' | 'neutral' | 'info' | 'primary';

const availabilityConfig: Record<string, { label: string; variant: AvailabilityVariant }> = {
  IN_STOCK: { label: 'En stock', variant: 'success' },
  OUT_OF_STOCK: { label: 'Rupture', variant: 'error' },
  LOW_STOCK: { label: 'Stock bas', variant: 'warning' },
  DISCONTINUED: { label: 'Discontinue', variant: 'neutral' },
  COMING_SOON: { label: 'Bientot disponible', variant: 'info' },
  PRE_ORDER: { label: 'Pre-commande', variant: 'primary' },
};

const availabilityOptions = [
  { value: 'IN_STOCK', label: 'En stock' },
  { value: 'OUT_OF_STOCK', label: 'Rupture' },
  { value: 'DISCONTINUED', label: 'Discontinue' },
  { value: 'COMING_SOON', label: 'Bientot disponible' },
];

export default function InventairePage() {
  const [inventory, setInventory] = useState<ProductFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ search: '', availability: '', lowStock: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showHistory, setShowHistory] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/admin/inventory');
      const data = await res.json();
      setInventory(data.inventory || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setInventory([]);
    }
    setLoading(false);
  };

  const updateStock = async (id: string, newQuantity: number, reason: string) => {
    try {
      await fetch(`/api/admin/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockQuantity: newQuantity, reason }),
      });
      setInventory(inventory.map(item =>
        item.id === id
          ? {
              ...item,
              stockQuantity: newQuantity,
              availability: newQuantity === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK',
            }
          : item
      ));
    } catch (err) {
      console.error('Error updating stock:', err);
    }
    setEditingId(null);
    setAdjustmentReason('');
  };

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (filter.search) {
        const search = filter.search.toLowerCase();
        if (
          !item.productName.toLowerCase().includes(search) &&
          !item.sku?.toLowerCase().includes(search) &&
          !item.formatName.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (filter.availability && item.availability !== filter.availability) return false;
      if (filter.lowStock && item.stockQuantity > item.lowStockThreshold) return false;
      return true;
    });
  }, [inventory, filter]);

  const stats = useMemo(() => ({
    total: inventory.length,
    inStock: inventory.filter(i => i.availability === 'IN_STOCK' && i.stockQuantity > i.lowStockThreshold).length,
    lowStock: inventory.filter(i => i.stockQuantity <= i.lowStockThreshold && i.stockQuantity > 0).length,
    outOfStock: inventory.filter(i => i.stockQuantity === 0).length,
    totalValue: inventory.reduce((sum, i) => sum + (i.price * i.stockQuantity), 0),
  }), [inventory]);

  const getAvailabilityBadge = (item: ProductFormat) => {
    const isLowStock = item.stockQuantity <= item.lowStockThreshold && item.stockQuantity > 0;
    if (isLowStock) {
      return <StatusBadge variant="warning" dot>STOCK BAS</StatusBadge>;
    }
    const config = availabilityConfig[item.availability] || { label: item.availability.replace('_', ' '), variant: 'neutral' as const };
    return <StatusBadge variant={config.variant} dot>{config.label}</StatusBadge>;
  };

  const columns: Column<ProductFormat>[] = [
    {
      key: 'product',
      header: 'Produit',
      sortable: true,
      render: (item) => (
        <Link href={`/admin/produits/${item.productId}`} className="hover:text-sky-600 transition-colors">
          <p className="font-semibold text-slate-900">{item.productName}</p>
          <p className="text-xs text-slate-500">{item.formatName}</p>
        </Link>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      render: (item) => (
        <code className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
          {item.sku || '-'}
        </code>
      ),
    },
    {
      key: 'price',
      header: 'Prix',
      sortable: true,
      render: (item) => (
        <span className="font-medium text-slate-900">{item.price.toFixed(2)} $</span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'center',
      sortable: true,
      render: (item) => {
        const isLowStock = item.stockQuantity <= item.lowStockThreshold && item.stockQuantity > 0;
        if (editingId === item.id) {
          return (
            <div className="flex items-center justify-center gap-2">
              <input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                className="w-20 h-8 px-2 border border-slate-300 rounded-lg text-center text-sm
                  focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                autoFocus
              />
            </div>
          );
        }
        return (
          <span className={`text-lg font-bold ${
            item.stockQuantity === 0 ? 'text-red-600' :
            isLowStock ? 'text-yellow-600' : 'text-slate-900'
          }`}>
            {item.stockQuantity}
          </span>
        );
      },
    },
    {
      key: 'threshold',
      header: 'Seuil',
      align: 'center',
      render: (item) => (
        <span className="text-slate-500">{item.lowStockThreshold}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      render: (item) => getAvailabilityBadge(item),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (item) => {
        if (editingId === item.id) {
          return (
            <div className="flex items-center justify-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                icon={Check}
                onClick={() => {
                  if (adjustmentReason) {
                    updateStock(item.id, editValue, adjustmentReason);
                  }
                }}
                disabled={!adjustmentReason}
                className="text-green-700 hover:bg-green-50"
              />
              <Button
                size="sm"
                variant="ghost"
                icon={X}
                onClick={() => setEditingId(null)}
                className="text-red-700 hover:bg-red-50"
              />
            </div>
          );
        }
        return (
          <div className="flex items-center justify-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              icon={Pencil}
              onClick={() => {
                setEditingId(item.id);
                setEditValue(item.stockQuantity);
              }}
            >
              Modifier
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={History}
              onClick={() => setShowHistory(item.id)}
            >
              Historique
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventaire"
        subtitle="Gerez le stock de vos produits"
        actions={
          <>
            <Button variant="secondary" icon={Upload}>
              Importer CSV
            </Button>
            <Button variant="secondary" icon={FileDown}>
              Exporter
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label="Total produits"
          value={stats.total}
          icon={Package}
        />
        <StatCard
          label="En stock"
          value={stats.inStock}
          icon={PackageCheck}
          className="border-green-200 bg-green-50"
        />
        <StatCard
          label="Stock bas"
          value={stats.lowStock}
          icon={AlertTriangle}
          className="border-yellow-200 bg-yellow-50"
        />
        <StatCard
          label="Rupture"
          value={stats.outOfStock}
          icon={PackageX}
          className="border-red-200 bg-red-50"
        />
        <StatCard
          label="Valeur stock"
          value={`${stats.totalValue.toFixed(0)} $`}
          icon={DollarSign}
          className="border-emerald-200 bg-emerald-50"
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(value) => setFilter({ ...filter, search: value })}
        searchPlaceholder="Rechercher (produit, SKU)..."
        actions={
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.lowStock}
              onChange={(e) => setFilter({ ...filter, lowStock: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-700">Stock bas uniquement</span>
          </label>
        }
      >
        <SelectFilter
          label="Tous les statuts"
          value={filter.availability}
          onChange={(value) => setFilter({ ...filter, availability: value })}
          options={availabilityOptions}
        />
      </FilterBar>

      {/* Inventory Table */}
      <DataTable
        columns={columns}
        data={filteredInventory}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyTitle="Aucun produit trouve"
        emptyDescription="Aucun produit ne correspond aux filtres selectionnes."
      />

      {/* Adjustment Reason Panel */}
      {editingId && (
        <div className="fixed bottom-4 right-4 bg-white rounded-xl shadow-lg border border-slate-200 p-4 w-80 z-40">
          <h4 className="font-semibold text-slate-900 mb-2">Raison de l&apos;ajustement</h4>
          <Input
            type="text"
            placeholder="Ex: Reception stock, Correction inventaire..."
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-2">Requis pour enregistrer la modification</p>
        </div>
      )}

      {/* History Modal */}
      <Modal
        isOpen={!!showHistory}
        onClose={() => setShowHistory(null)}
        title="Historique des mouvements"
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600 font-bold">+10</span>
            <span className="text-slate-500">Reception stock</span>
            <span className="text-slate-400 ml-auto">il y a 2 jours</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-red-600 font-bold">-2</span>
            <span className="text-slate-500">Commande #BC-2026-00001</span>
            <span className="text-slate-400 ml-auto">il y a 3 jours</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-red-600 font-bold">-1</span>
            <span className="text-slate-500">Commande #BC-2026-00002</span>
            <span className="text-slate-400 ml-auto">il y a 5 jours</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600 font-bold">+50</span>
            <span className="text-slate-500">Stock initial</span>
            <span className="text-slate-400 ml-auto">il y a 30 jours</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
