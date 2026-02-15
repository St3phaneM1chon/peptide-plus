'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Upload,
  FileDown,
  Loader2,
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
  StatusBadge,
  StatCard,
  FilterBar,
  SelectFilter,
  DataTable,
  Input,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

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

export default function InventairePage() {
  const { t, formatCurrency } = useI18n();
  const [inventory, setInventory] = useState<ProductFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ search: '', availability: '', lowStock: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportInventory = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/inventory/export');
      if (!res.ok) {
        toast.error(t('admin.inventory.exportError') || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'inventory-export.csv';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('admin.inventory.exportSuccess') || 'Inventory exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('admin.inventory.exportError') || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const availabilityConfig: Record<string, { label: string; variant: AvailabilityVariant }> = useMemo(() => ({
    IN_STOCK: { label: t('admin.inventory.availInStock'), variant: 'success' },
    OUT_OF_STOCK: { label: t('admin.inventory.availOutOfStock'), variant: 'error' },
    LOW_STOCK: { label: t('admin.inventory.lowStock'), variant: 'warning' },
    DISCONTINUED: { label: t('admin.inventory.availDiscontinued'), variant: 'neutral' },
    COMING_SOON: { label: t('admin.inventory.availComingSoon'), variant: 'info' },
    PRE_ORDER: { label: t('admin.inventory.availPreOrder'), variant: 'primary' },
  }), [t]);

  const availabilityOptions = useMemo(() => [
    { value: 'IN_STOCK', label: t('admin.inventory.availInStock') },
    { value: 'OUT_OF_STOCK', label: t('admin.inventory.availOutOfStock') },
    { value: 'DISCONTINUED', label: t('admin.inventory.availDiscontinued') },
    { value: 'COMING_SOON', label: t('admin.inventory.availComingSoon') },
  ], [t]);

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
      return <StatusBadge variant="warning" dot>{t('admin.inventory.availLowStock')}</StatusBadge>;
    }
    const config = availabilityConfig[item.availability] || { label: item.availability.replace('_', ' '), variant: 'neutral' as const };
    return <StatusBadge variant={config.variant} dot>{config.label}</StatusBadge>;
  };

  const columns: Column<ProductFormat>[] = [
    {
      key: 'product',
      header: t('admin.inventory.colProduct'),
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
      header: t('admin.inventory.colSku'),
      render: (item) => (
        <code className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
          {item.sku || '-'}
        </code>
      ),
    },
    {
      key: 'price',
      header: t('admin.inventory.colPrice'),
      sortable: true,
      render: (item) => (
        <span className="font-medium text-slate-900">{formatCurrency(item.price)}</span>
      ),
    },
    {
      key: 'stock',
      header: t('admin.inventory.colStock'),
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
      header: t('admin.inventory.colThreshold'),
      align: 'center',
      render: (item) => (
        <span className="text-slate-500">{item.lowStockThreshold}</span>
      ),
    },
    {
      key: 'status',
      header: t('admin.inventory.colStatus'),
      render: (item) => getAvailabilityBadge(item),
    },
    {
      key: 'actions',
      header: t('admin.inventory.colActions'),
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
              {t('admin.inventory.edit')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={History}
              onClick={() => setShowHistory(item.id)}
            >
              {t('admin.inventory.history')}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.inventory.title')}
        subtitle={t('admin.inventory.subtitle')}
        actions={
          <>
            <Button variant="secondary" icon={Upload}>
              {t('admin.inventory.importCsv')}
            </Button>
            <Button
              variant="secondary"
              icon={exporting ? Loader2 : FileDown}
              onClick={handleExportInventory}
              disabled={exporting}
            >
              {t('admin.inventory.export')}
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          label={t('admin.inventory.totalProducts')}
          value={stats.total}
          icon={Package}
        />
        <StatCard
          label={t('admin.inventory.inStock')}
          value={stats.inStock}
          icon={PackageCheck}
          className="border-green-200 bg-green-50"
        />
        <StatCard
          label={t('admin.inventory.lowStock')}
          value={stats.lowStock}
          icon={AlertTriangle}
          className="border-yellow-200 bg-yellow-50"
        />
        <StatCard
          label={t('admin.inventory.outOfStock')}
          value={stats.outOfStock}
          icon={PackageX}
          className="border-red-200 bg-red-50"
        />
        <StatCard
          label={t('admin.inventory.stockValue')}
          value={formatCurrency(stats.totalValue)}
          icon={DollarSign}
          className="border-emerald-200 bg-emerald-50"
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={filter.search}
        onSearchChange={(value) => setFilter({ ...filter, search: value })}
        searchPlaceholder={t('admin.inventory.searchPlaceholder')}
        actions={
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.lowStock}
              onChange={(e) => setFilter({ ...filter, lowStock: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500"
            />
            <span className="text-sm text-slate-700">{t('admin.inventory.lowStockOnly')}</span>
          </label>
        }
      >
        <SelectFilter
          label={t('admin.inventory.allStatuses')}
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
        emptyTitle={t('admin.inventory.emptyTitle')}
        emptyDescription={t('admin.inventory.emptyDescription')}
      />

      {/* Adjustment Reason Panel */}
      {editingId && (
        <div className="fixed bottom-4 right-4 bg-white rounded-xl shadow-lg border border-slate-200 p-4 w-80 z-40">
          <h4 className="font-semibold text-slate-900 mb-2">{t('admin.inventory.adjustmentReason')}</h4>
          <Input
            type="text"
            placeholder={t('admin.inventory.adjustmentPlaceholder')}
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
          />
          <p className="text-xs text-slate-400 mt-2">{t('admin.inventory.adjustmentRequired')}</p>
        </div>
      )}

      {/* History Modal */}
      <Modal
        isOpen={!!showHistory}
        onClose={() => setShowHistory(null)}
        title={t('admin.inventory.historyTitle')}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600 font-bold">+10</span>
            <span className="text-slate-500">{t('admin.inventory.historyStockReception')}</span>
            <span className="text-slate-400 ml-auto">{t('admin.inventory.historyDaysAgo2')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-red-600 font-bold">-2</span>
            <span className="text-slate-500">{t('admin.inventory.historyOrder')} #BC-2026-00001</span>
            <span className="text-slate-400 ml-auto">{t('admin.inventory.historyDaysAgo3')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-red-600 font-bold">-1</span>
            <span className="text-slate-500">{t('admin.inventory.historyOrder')} #BC-2026-00002</span>
            <span className="text-slate-400 ml-auto">{t('admin.inventory.historyDaysAgo5')}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600 font-bold">+50</span>
            <span className="text-slate-500">{t('admin.inventory.historyInitialStock')}</span>
            <span className="text-slate-400 ml-auto">{t('admin.inventory.historyDaysAgo30')}</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
