'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
  Bell,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { Modal } from '@/components/admin/Modal';
import { Input } from '@/components/admin/FormField';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { toast } from 'sonner';
import { fetchWithRetry } from '@/lib/fetch-with-retry';

// ── Types ─────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────

function stockBadgeVariant(item: ProductFormat): 'success' | 'warning' | 'error' | 'neutral' {
  if (item.stockQuantity === 0) return 'error';
  if (item.stockQuantity <= item.lowStockThreshold) return 'warning';
  if (item.availability === 'DISCONTINUED') return 'neutral';
  return 'success';
}

function stockBadgeText(item: ProductFormat, t: (key: string) => string): string {
  if (item.stockQuantity === 0) return t('admin.inventory.availOutOfStock');
  if (item.stockQuantity <= item.lowStockThreshold) return t('admin.inventory.lowStock');
  if (item.availability === 'DISCONTINUED') return t('admin.inventory.availDiscontinued');
  return t('admin.inventory.availInStock');
}

// ── Main Component ────────────────────────────────────────────

export default function InventairePage() {
  const { t, locale, formatCurrency } = useI18n();
  const [inventory, setInventory] = useState<ProductFormat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Filter state
  const [searchValue, setSearchValue] = useState('');
  const [stockFilter, setStockFilter] = useState('all');

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  // History modal state
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<Array<{
    id: string;
    type: string;
    quantity: number;
    reason: string | null;
    orderId: string | null;
    createdAt: string;
    productName: string;
    formatName: string | null;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showStockAlerts, setShowStockAlerts] = useState(false);
  const [showMonthlyStats, setShowMonthlyStats] = useState(false);

  // ─── Data fetching ──────────────────────────────────────────

  useEffect(() => {
    fetchInventory();
  }, []);

  // Fetch real history data when the history modal opens
  useEffect(() => {
    if (!showHistory) {
      setHistoryData([]);
      return;
    }

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const item = inventory.find((i) => i.id === showHistory);
        const params = new URLSearchParams();
        if (item) {
          params.set('productId', item.productId);
          params.set('formatId', showHistory);
        }
        params.set('limit', '20');

        const res = await fetch(`/api/admin/inventory/history?${params.toString()}`);
        const data = await res.json();
        setHistoryData(data.transactions || []);
      } catch (err) {
        console.error('Error fetching inventory history:', err);
        setHistoryData([]);
      }
      setHistoryLoading(false);
    };

    fetchHistory();
  }, [showHistory, inventory]);

  const fetchInventory = async () => {
    try {
      const res = await fetchWithRetry('/api/admin/inventory');
      const data = await res.json();
      setInventory(data.inventory || []);
    } catch (err) {
      console.error('Error fetching inventory:', err);
      toast.error(t('common.error'));
      setInventory([]);
    }
    setLoading(false);
  };

  const handleSelectItem = useCallback((id: string) => {
    setSelectedItemId(id);
    setEditingId(null);
    setAdjustmentReason('');
  }, []);

  // ─── Actions ──────────────────────────────────────────────

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

  const updateStock = async (id: string, newQuantity: number, reason: string) => {
    // G1-FLAW-05 FIX: Check response status and revert optimistic update on error
    const previousInventory = inventory;
    // Optimistic update
    setInventory(prev => prev.map(item =>
      item.id === id
        ? {
            ...item,
            stockQuantity: newQuantity,
            availability: newQuantity === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK',
          }
        : item
    ));
    try {
      const res = await fetch(`/api/admin/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockQuantity: newQuantity, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.updateFailed'));
        // Revert optimistic update
        setInventory(previousInventory);
      } else {
        toast.success(t('admin.inventory.stockUpdated') || 'Stock updated');
      }
    } catch (err) {
      console.error('Error updating stock:', err);
      toast.error(t('common.networkError'));
      // Revert optimistic update on network error
      setInventory(previousInventory);
    }
    setEditingId(null);
    setAdjustmentReason('');
  };

  // ─── Selected item (must be before ribbon actions that reference it) ──
  const selectedItem = useMemo(() => {
    return inventory.find((i) => i.id === selectedItemId) || null;
  }, [inventory, selectedItemId]);

  // ─── Ribbon Actions ─────────────────────────────────────────

  const ribbonAddStock = useCallback(() => {
    if (selectedItem) {
      setEditingId(selectedItem.id);
      setEditValue(selectedItem.stockQuantity);
    } else {
      toast.info(t('admin.inventory.selectItemFirst') || 'Select an item first');
    }
  }, [selectedItem, t]);

  const ribbonAdjust = useCallback(() => {
    if (selectedItem) {
      setEditingId(selectedItem.id);
      setEditValue(selectedItem.stockQuantity);
    } else {
      toast.info(t('admin.inventory.selectItemFirst') || 'Select an item first');
    }
  }, [selectedItem, t]);

  const ribbonMonthlyStats = useCallback(() => {
    setShowMonthlyStats(true);
  }, []);

  const ribbonRenewalList = useCallback(() => {
    // Generate CSV of low-stock items that need reordering
    const lowStockItems = inventory.filter(i => i.stockQuantity <= i.lowStockThreshold);
    if (lowStockItems.length === 0) {
      toast.info(t('admin.inventory.noLowStockItems') || 'No items need reordering');
      return;
    }
    const headers = ['Product', 'Format', 'SKU', 'Current Stock', 'Threshold', 'Price', 'Status'];
    const rows = lowStockItems.map(item => [
      `"${item.productName.replace(/"/g, '""')}"`,
      `"${item.formatName.replace(/"/g, '""')}"`,
      item.sku || '',
      item.stockQuantity,
      item.lowStockThreshold,
      item.price.toFixed(2),
      item.availability,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reorder-list-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(
      (t('admin.inventory.renewalListExported') || 'Reorder list exported ({count} items)').replace('{count}', String(lowStockItems.length))
    );
  }, [inventory, t]);

  const ribbonSubmissions = useCallback(() => {
    setShowStockAlerts(true);
  }, []);

  const ribbonOrderOnline = useCallback(() => {
    // Generate a CSV of out-of-stock items to order
    const outOfStock = inventory.filter(i => i.stockQuantity === 0);
    if (outOfStock.length === 0) {
      toast.info(t('admin.inventory.noOutOfStockItems') || 'No out-of-stock items');
      return;
    }
    const headers = ['Product', 'Format', 'SKU', 'Price', 'Suggested Order Qty'];
    const rows = outOfStock.map(item => [
      `"${item.productName.replace(/"/g, '""')}"`,
      `"${item.formatName.replace(/"/g, '""')}"`,
      item.sku || '',
      item.price.toFixed(2),
      Math.max(item.lowStockThreshold * 2, 10), // Suggest 2x threshold or min 10
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-order-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(
      (t('admin.inventory.purchaseOrderExported') || 'Purchase order exported ({count} items)').replace('{count}', String(outOfStock.length))
    );
  }, [inventory, t]);

  const ribbonExport = useCallback(() => {
    handleExportInventory();
  }, []);

  useRibbonAction('addStock', ribbonAddStock);
  useRibbonAction('adjust', ribbonAdjust);
  useRibbonAction('monthlyStats', ribbonMonthlyStats);
  useRibbonAction('renewalList', ribbonRenewalList);
  useRibbonAction('submissions', ribbonSubmissions);
  useRibbonAction('orderOnline', ribbonOrderOnline);
  useRibbonAction('export', ribbonExport);

  // ─── Filtering ──────────────────────────────────────────────

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      if (searchValue) {
        const search = searchValue.toLowerCase();
        if (
          !item.productName.toLowerCase().includes(search) &&
          !item.sku?.toLowerCase().includes(search) &&
          !item.formatName.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (stockFilter === 'IN_STOCK' && (item.stockQuantity === 0 || item.stockQuantity <= item.lowStockThreshold)) return false;
      if (stockFilter === 'LOW_STOCK' && (item.stockQuantity === 0 || item.stockQuantity > item.lowStockThreshold)) return false;
      if (stockFilter === 'OUT_OF_STOCK' && item.stockQuantity !== 0) return false;
      return true;
    });
  }, [inventory, searchValue, stockFilter]);

  const stats = useMemo(() => ({
    total: inventory.length,
    inStock: inventory.filter(i => i.availability === 'IN_STOCK' && i.stockQuantity > i.lowStockThreshold).length,
    lowStock: inventory.filter(i => i.stockQuantity <= i.lowStockThreshold && i.stockQuantity > 0).length,
    outOfStock: inventory.filter(i => i.stockQuantity === 0).length,
    totalValue: inventory.reduce((sum, i) => sum + (i.price * i.stockQuantity), 0),
  }), [inventory]);

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('admin.inventory.allStatuses'), count: stats.total },
    { key: 'IN_STOCK', label: t('admin.inventory.inStock'), count: stats.inStock },
    { key: 'LOW_STOCK', label: t('admin.inventory.lowStock'), count: stats.lowStock },
    { key: 'OUT_OF_STOCK', label: t('admin.inventory.outOfStock'), count: stats.outOfStock },
  ], [t, stats]);

  const listItems: ContentListItem[] = useMemo(() => {
    return filteredInventory.map((item) => ({
      id: item.id,
      avatar: { text: item.productName.charAt(0) },
      title: item.productName,
      subtitle: item.formatName + (item.sku ? ` (${item.sku})` : ''),
      preview: `${t('admin.inventory.colStock')}: ${item.stockQuantity} - ${formatCurrency(item.price)}`,
      badges: [
        {
          text: stockBadgeText(item, t),
          variant: stockBadgeVariant(item),
        },
        ...(item.stockQuantity <= item.lowStockThreshold && item.stockQuantity > 0
          ? [{ text: `${item.stockQuantity}`, variant: 'warning' as const }]
          : []),
      ],
    }));
  }, [filteredInventory, t, formatCurrency]);

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
            <h1 className="text-xl font-bold text-slate-900">{t('admin.inventory.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{t('admin.inventory.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              icon={BarChart3}
              size="sm"
              onClick={() => setShowMonthlyStats(true)}
            >
              {t('admin.inventory.statsBtn') || 'Stats'}
            </Button>
            <Button
              variant="ghost"
              icon={Bell}
              size="sm"
              onClick={() => setShowStockAlerts(true)}
              className={stats.outOfStock + stats.lowStock > 0 ? 'text-amber-600' : ''}
            >
              {t('admin.inventory.alertsBtn') || 'Alerts'}
              {(stats.outOfStock + stats.lowStock > 0) && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {stats.outOfStock + stats.lowStock}
                </span>
              )}
            </Button>
            <label className="cursor-pointer inline-block">
              <span className="inline-flex items-center justify-center font-medium rounded-lg border transition-colors duration-150 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 border-slate-300 shadow-sm h-8 px-3 text-xs gap-1.5">
                <Upload className="w-4 h-4" />
                {t('admin.inventory.importCsv')}
              </span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append('file', file);
                  try {
                    const res = await fetch('/api/admin/inventory/import', {
                      method: 'POST',
                      body: formData,
                    });
                    if (!res.ok) {
                      const data = await res.json().catch(() => ({}));
                      toast.error(data.error || t('admin.inventory.importError') || 'Import failed');
                      return;
                    }
                    const result = await res.json();
                    toast.success(
                      (t('admin.inventory.importSuccess') || 'Inventory imported successfully') +
                      (result.imported ? ` (${result.imported} items)` : '')
                    );
                    fetchInventory();
                  } catch {
                    toast.error(t('admin.inventory.importError') || 'Import failed');
                  }
                  e.target.value = '';
                }}
              />
            </label>
            <Button
              variant="secondary"
              icon={exporting ? Loader2 : FileDown}
              size="sm"
              onClick={handleExportInventory}
              disabled={exporting}
            >
              {t('admin.inventory.export')}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label={t('admin.inventory.totalProducts')} value={stats.total} icon={Package} />
          <StatCard label={t('admin.inventory.inStock')} value={stats.inStock} icon={PackageCheck} className="border-green-200 bg-green-50" />
          <StatCard label={t('admin.inventory.lowStock')} value={stats.lowStock} icon={AlertTriangle} className="border-yellow-200 bg-yellow-50" />
          <StatCard label={t('admin.inventory.outOfStock')} value={stats.outOfStock} icon={PackageX} className="border-red-200 bg-red-50" />
          <StatCard label={t('admin.inventory.stockValue')} value={formatCurrency(stats.totalValue)} icon={DollarSign} className="border-emerald-200 bg-emerald-50" />
        </div>
      </div>

      {/* Main content: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={400}
          showDetail={!!selectedItemId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedItemId}
              onSelect={handleSelectItem}
              filterTabs={filterTabs}
              activeFilter={stockFilter}
              onFilterChange={setStockFilter}
              searchValue={searchValue}
              onSearchChange={setSearchValue}
              searchPlaceholder={t('admin.inventory.searchPlaceholder')}
              loading={loading}
              emptyIcon={Package}
              emptyTitle={t('admin.inventory.emptyTitle')}
              emptyDescription={t('admin.inventory.emptyDescription')}
            />
          }
          detail={
            selectedItem ? (
              <DetailPane
                header={{
                  title: selectedItem.productName,
                  subtitle: `${selectedItem.formatName}${selectedItem.sku ? ` - SKU: ${selectedItem.sku}` : ''}`,
                  avatar: { text: selectedItem.productName.charAt(0) },
                  onBack: () => { setSelectedItemId(null); setEditingId(null); },
                  backLabel: t('admin.inventory.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={History}
                        onClick={() => setShowHistory(selectedItem.id)}
                      >
                        {t('admin.inventory.history')}
                      </Button>
                      <Link href={`/admin/produits/${selectedItem.productId}`}>
                        <Button variant="ghost" size="sm">
                          {t('admin.inventory.colProduct')}
                        </Button>
                      </Link>
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Stock Level indicator */}
                  <div className="flex flex-wrap gap-4 items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      selectedItem.stockQuantity === 0 ? 'bg-red-100 text-red-800' :
                      selectedItem.stockQuantity <= selectedItem.lowStockThreshold ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {stockBadgeText(selectedItem, t)}
                    </span>
                    {!selectedItem.isActive && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-600">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Stock details */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.inventory.colStock')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className={`text-3xl font-bold ${
                          selectedItem.stockQuantity === 0 ? 'text-red-600' :
                          selectedItem.stockQuantity <= selectedItem.lowStockThreshold ? 'text-amber-600' :
                          'text-slate-900'
                        }`}>
                          {selectedItem.stockQuantity}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{t('admin.inventory.colStock')}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-3xl font-bold text-slate-900">{selectedItem.lowStockThreshold}</p>
                        <p className="text-xs text-slate-500 mt-1">{t('admin.inventory.colThreshold')}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-3xl font-bold text-slate-900">{formatCurrency(selectedItem.price)}</p>
                        <p className="text-xs text-slate-500 mt-1">{t('admin.inventory.colPrice')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Stock Value */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-emerald-700">{t('admin.inventory.stockValue')}</p>
                        <p className="text-2xl font-bold text-emerald-800">
                          {formatCurrency(selectedItem.price * selectedItem.stockQuantity)}
                        </p>
                      </div>
                      <DollarSign className="w-8 h-8 text-emerald-400" />
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="bg-slate-50 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.inventory.colProduct')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.inventory.colProduct')}</p>
                        <Link
                          href={`/admin/produits/${selectedItem.productId}`}
                          className="text-sky-600 hover:underline font-medium"
                        >
                          {selectedItem.productName}
                        </Link>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Format</p>
                        <p className="text-slate-900">{selectedItem.formatName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.inventory.colSku')}</p>
                        <code className="text-sm text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {selectedItem.sku || '-'}
                        </code>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">{t('admin.inventory.colStatus')}</p>
                        <p className="text-slate-700">{selectedItem.availability.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </div>

                  {/* Inline stock edit */}
                  <div className="border border-slate-200 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-900 mb-3">{t('admin.inventory.adjustmentReason')}</h3>
                    {editingId === selectedItem.id ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-slate-600 w-24">{t('admin.inventory.colStock')}:</label>
                          <input
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                            className="w-24 h-9 px-3 border border-slate-300 rounded-lg text-center text-sm
                              focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            autoFocus
                          />
                        </div>
                        <div>
                          <Input
                            type="text"
                            placeholder={t('admin.inventory.adjustmentPlaceholder')}
                            value={adjustmentReason}
                            onChange={(e) => setAdjustmentReason(e.target.value)}
                          />
                          <p className="text-xs text-slate-400 mt-1">{t('admin.inventory.adjustmentRequired')}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="primary"
                            icon={Check}
                            onClick={() => {
                              if (adjustmentReason) {
                                updateStock(selectedItem.id, editValue, adjustmentReason);
                              }
                            }}
                            disabled={!adjustmentReason}
                          >
                            {t('admin.inventory.edit') || 'Save'}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={X}
                            onClick={() => { setEditingId(null); setAdjustmentReason(''); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Pencil}
                        onClick={() => {
                          setEditingId(selectedItem.id);
                          setEditValue(selectedItem.stockQuantity);
                        }}
                      >
                        {t('admin.inventory.edit')}
                      </Button>
                    )}
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Package}
                emptyTitle={t('admin.inventory.emptyTitle')}
                emptyDescription={t('admin.inventory.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* ─── HISTORY MODAL ──────────────────────────────────────── */}
      <Modal
        isOpen={!!showHistory}
        onClose={() => setShowHistory(null)}
        title={t('admin.inventory.historyTitle')}
      >
        {historyLoading ? (
          <div className="flex items-center justify-center py-8" role="status" aria-label="Loading">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" />
            <span className="sr-only">Loading...</span>
          </div>
        ) : historyData.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            {t('admin.inventory.noHistory') || 'No transaction history yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {historyData.map((tx) => {
              const isPositive = tx.quantity > 0;
              const timeAgo = new Date(tx.createdAt).toLocaleDateString(locale, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });
              return (
                <div key={tx.id} className="flex items-center gap-3 text-sm">
                  <span className={`font-bold min-w-[3rem] text-end ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {isPositive ? '+' : ''}{tx.quantity}
                  </span>
                  <span className="text-slate-600 flex-1">
                    {tx.reason || tx.type}
                  </span>
                  <span className="text-slate-400 text-xs whitespace-nowrap">{timeAgo}</span>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ─── STOCK ALERTS MODAL ──────────────────────────────────── */}
      <Modal
        isOpen={showStockAlerts}
        onClose={() => setShowStockAlerts(false)}
        title={t('admin.inventory.stockAlertsTitle') || 'Stock Alerts'}
        subtitle={t('admin.inventory.stockAlertsSubtitle') || 'Items requiring attention'}
        size="lg"
      >
        {(() => {
          const outOfStockItems = inventory.filter(i => i.stockQuantity === 0);
          const lowStockItems = inventory.filter(i => i.stockQuantity > 0 && i.stockQuantity <= i.lowStockThreshold);
          return (
            <div className="space-y-4">
              {/* Out of stock */}
              <div>
                <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2 mb-2">
                  <PackageX className="w-4 h-4" />
                  {t('admin.inventory.outOfStock') || 'Out of Stock'} ({outOfStockItems.length})
                </h4>
                {outOfStockItems.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">{t('admin.inventory.noOutOfStockItems') || 'No out-of-stock items'}</p>
                ) : (
                  <div className="border border-red-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-3 py-2 text-start text-xs font-medium text-red-600">{t('admin.inventory.colProduct')}</th>
                          <th className="px-3 py-2 text-start text-xs font-medium text-red-600">Format</th>
                          <th className="px-3 py-2 text-start text-xs font-medium text-red-600">{t('admin.inventory.colSku')}</th>
                          <th className="px-3 py-2 text-end text-xs font-medium text-red-600">{t('admin.inventory.colPrice')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100">
                        {outOfStockItems.map(item => (
                          <tr key={item.id} className="hover:bg-red-50/50">
                            <td className="px-3 py-2 text-slate-900">{item.productName}</td>
                            <td className="px-3 py-2 text-slate-600">{item.formatName}</td>
                            <td className="px-3 py-2 text-slate-500">{item.sku || '-'}</td>
                            <td className="px-3 py-2 text-end text-slate-700">{formatCurrency(item.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Low stock */}
              <div>
                <h4 className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('admin.inventory.lowStock') || 'Low Stock'} ({lowStockItems.length})
                </h4>
                {lowStockItems.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">{t('admin.inventory.noLowStockItems') || 'No low-stock items'}</p>
                ) : (
                  <div className="border border-amber-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="px-3 py-2 text-start text-xs font-medium text-amber-600">{t('admin.inventory.colProduct')}</th>
                          <th className="px-3 py-2 text-start text-xs font-medium text-amber-600">Format</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-amber-600">{t('admin.inventory.colStock')}</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-amber-600">{t('admin.inventory.colThreshold')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {lowStockItems.map(item => (
                          <tr key={item.id} className="hover:bg-amber-50/50">
                            <td className="px-3 py-2 text-slate-900">{item.productName}</td>
                            <td className="px-3 py-2 text-slate-600">{item.formatName}</td>
                            <td className="px-3 py-2 text-center font-semibold text-amber-700">{item.stockQuantity}</td>
                            <td className="px-3 py-2 text-center text-slate-500">{item.lowStockThreshold}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ─── MONTHLY STATS MODAL ──────────────────────────────────── */}
      <Modal
        isOpen={showMonthlyStats}
        onClose={() => setShowMonthlyStats(false)}
        title={t('admin.inventory.monthlyStatsTitle') || 'Inventory Summary'}
        subtitle={t('admin.inventory.monthlyStatsSubtitle') || 'Current stock overview'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500 mt-1">{t('admin.inventory.totalProducts') || 'Total Products'}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{stats.inStock}</p>
              <p className="text-xs text-emerald-600 mt-1">{t('admin.inventory.inStock') || 'In Stock'}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.lowStock}</p>
              <p className="text-xs text-amber-600 mt-1">{t('admin.inventory.lowStock') || 'Low Stock'}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.outOfStock}</p>
              <p className="text-xs text-red-600 mt-1">{t('admin.inventory.outOfStock') || 'Out of Stock'}</p>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-700">{t('admin.inventory.stockValue') || 'Total Stock Value'}</p>
                <p className="text-2xl font-bold text-emerald-800">{formatCurrency(stats.totalValue)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          {/* Stock health indicator */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">
              {t('admin.inventory.stockHealth') || 'Stock Health'}
            </h4>
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden flex">
              {stats.total > 0 && (
                <>
                  <div
                    className="bg-emerald-500 h-full"
                    style={{ width: `${(stats.inStock / stats.total) * 100}%` }}
                    title={`${t('admin.inventory.inStock') || 'In Stock'}: ${stats.inStock}`}
                  />
                  <div
                    className="bg-amber-500 h-full"
                    style={{ width: `${(stats.lowStock / stats.total) * 100}%` }}
                    title={`${t('admin.inventory.lowStock') || 'Low Stock'}: ${stats.lowStock}`}
                  />
                  <div
                    className="bg-red-500 h-full"
                    style={{ width: `${(stats.outOfStock / stats.total) * 100}%` }}
                    title={`${t('admin.inventory.outOfStock') || 'Out of Stock'}: ${stats.outOfStock}`}
                  />
                </>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full inline-block" /> {t('admin.inventory.inStock') || 'In Stock'}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full inline-block" /> {t('admin.inventory.lowStock') || 'Low Stock'}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full inline-block" /> {t('admin.inventory.outOfStock') || 'Out of Stock'}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
