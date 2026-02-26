'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Plus,
  Pencil,
  ExternalLink,
  Trash2,
  Loader2,
  Package,
  Star,
  FlaskConical,
  Pill,
  Wrench,
  Upload,
  FileDown,
  Percent,
  AlertTriangle,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { Button, StatusBadge, Modal } from '@/components/admin';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  productType: string;
  isActive: boolean;
  isFeatured: boolean;
  isNew: boolean;
  isBestseller: boolean;
  purity: number | null;
  purchaseCount: number;
  reorderPoint: number | null;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  formats?: {
    id: string;
    name: string;
    price: number;
    stockQuantity: number;
    availability: string;
    isActive: boolean;
  }[];
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Stats {
  total: number;
  active: number;
  peptides: number;
  supplements: number;
  accessories: number;
  featured: number;
}

interface Props {
  initialProducts: Product[];
  categories: Category[];
  stats: Stats;
  isOwner: boolean;
}

/**
 * ABC classification based on revenue contribution.
 * A = top 80% of revenue, B = next 15%, C = remaining 5%.
 */
function computeABCClassification(products: Product[]): Record<string, 'A' | 'B' | 'C'> {
  const result: Record<string, 'A' | 'B' | 'C'> = {};

  // Estimate revenue as price * purchaseCount for each product
  const withRevenue = products.map((p) => {
    const activeFormats = (p.formats || []).filter(f => f.isActive);
    const avgPrice = activeFormats.length > 0
      ? activeFormats.reduce((sum, f) => sum + Number(f.price), 0) / activeFormats.length
      : Number(p.price);
    return {
      id: p.id,
      revenue: avgPrice * (p.purchaseCount || 0),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = withRevenue.reduce((sum, p) => sum + p.revenue, 0);
  if (totalRevenue === 0) {
    // No revenue data: all products are C
    for (const p of products) result[p.id] = 'C';
    return result;
  }

  let cumulativeRevenue = 0;
  for (const p of withRevenue) {
    cumulativeRevenue += p.revenue;
    const ratio = cumulativeRevenue / totalRevenue;
    if (ratio <= 0.80) {
      result[p.id] = 'A';
    } else if (ratio <= 0.95) {
      result[p.id] = 'B';
    } else {
      result[p.id] = 'C';
    }
  }
  return result;
}

/** Get products that are below their reorder point */
function getReorderAlerts(products: Product[]): Product[] {
  return products.filter((p) => {
    if (!p.reorderPoint || !p.formats || p.formats.length === 0) return false;
    const totalStock = p.formats
      .filter(f => f.isActive)
      .reduce((sum, f) => sum + f.stockQuantity, 0);
    return totalStock <= p.reorderPoint;
  });
}

function getProductStockStatus(product: Product, t: (key: string, params?: Record<string, string | number>) => string) {
  if (!product.formats || product.formats.length === 0) {
    return { label: t('admin.products.noFormats'), variant: 'neutral' as const };
  }

  const activeFormats = product.formats.filter((f) => f.isActive);
  const outOfStock = activeFormats.filter(
    (f) => f.availability === 'OUT_OF_STOCK' || f.availability === 'DISCONTINUED'
  );
  const lowStock = activeFormats.filter((f) => f.stockQuantity > 0 && f.stockQuantity <= 10);

  if (outOfStock.length === activeFormats.length) {
    return { label: t('admin.products.allOutOfStock'), variant: 'error' as const };
  }
  if (outOfStock.length > 0) {
    return { label: t('admin.products.partialOutOfStock', { out: outOfStock.length, total: activeFormats.length }), variant: 'warning' as const };
  }
  if (lowStock.length > 0) {
    return { label: t('admin.products.lowStockCount', { count: lowStock.length }), variant: 'warning' as const };
  }
  return { label: t('admin.products.inStock'), variant: 'success' as const };
}

export default function ProductsListClient({
  initialProducts,
  categories,
  stats,
  isOwner,
}: Props) {
  const { t, tp, formatCurrency } = useI18n();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showBulkPriceModal, setShowBulkPriceModal] = useState(false);
  const [bulkPricePercent, setBulkPricePercent] = useState<number>(0);
  const [bulkPriceApplying, setBulkPriceApplying] = useState(false);
  const [bulkPriceDirection, setBulkPriceDirection] = useState<'increase' | 'decrease'>('increase');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scheduled publish
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleAction, setScheduleAction] = useState<'publish' | 'unpublish'>('publish');
  const [schedulingSave, setSchedulingSave] = useState(false);

  // ABC Classification
  const abcClassification = useMemo(() => computeABCClassification(products), [products]);

  // Reorder alerts
  const reorderAlerts = useMemo(() => getReorderAlerts(products), [products]);

  // ─── Business logic (unchanged) ─────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/products/export');
      if (!res.ok) {
        toast.error(t('admin.products.exportError'));
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || 'products-export.csv';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(t('admin.products.exportSuccess'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('admin.products.exportError'));
    } finally {
      setExporting(false);
    }
  };

  const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024; // 5MB - must match server limit in /api/admin/products/import

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side file size validation (matches server-side 5MB limit)
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      toast.error(t('admin.products.fileTooLarge') || 'File too large. Maximum size: 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/admin/products/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t('admin.products.importError'));
        return;
      }

      const { summary } = data;
      toast.success(
        summary.errors.length > 0
          ? t('admin.products.importSummaryWithErrors', { created: summary.created, updated: summary.updated, errors: summary.errors.length })
          : t('admin.products.importSummary', { created: summary.created, updated: summary.updated })
      );

      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(t('admin.products.importError'));
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(null);
    setDeleting(id);
    try {
      // NOTE: DELETE handler at /api/products/[id] requires OWNER role + CSRF + rate-limit (secured)
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE', headers: addCSRFHeader() });
      if (res.ok) {
        setProducts(products.filter((p) => p.id !== id));
        if (selectedProductId === id) {
          setSelectedProductId(null);
        }
      } else {
        toast.error(t('admin.products.deleteError'));
      }
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(t('admin.products.deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  // ─── Ribbon Actions ────────────────────────────────────────

  const handleNewProduct = useCallback(() => {
    router.push('/admin/produits/nouveau');
  }, [router]);

  const handleRibbonDelete = useCallback(() => {
    if (selectedProductId) {
      setConfirmDeleteId(selectedProductId);
    } else {
      toast.info(t('admin.products.selectFirst'));
    }
  }, [selectedProductId, t]);

  const handleDuplicate = useCallback(async () => {
    if (!selectedProductId) {
      toast.info(t('admin.products.selectFirst'));
      return;
    }
    try {
      const res = await fetch(`/api/admin/products/${selectedProductId}/duplicate`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.products.duplicateError') || 'Failed to duplicate product');
        return;
      }
      const data = await res.json();
      toast.success(t('admin.products.duplicateSuccess') || 'Product duplicated');
      if (data.product?.id) {
        router.push(`/admin/produits/${data.product.id}`);
      } else {
        window.location.reload();
      }
    } catch {
      toast.error(t('admin.products.duplicateError') || 'Failed to duplicate product');
    }
  }, [selectedProductId, t, router]);

  const handlePublish = useCallback(async () => {
    if (!selectedProductId) {
      toast.info(t('admin.products.selectFirst'));
      return;
    }
    try {
      const res = await fetch(`/api/products/${selectedProductId}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === selectedProductId ? { ...p, isActive: true } : p));
        toast.success(t('admin.products.publishSuccess') || 'Product published');
      } else {
        toast.error(t('admin.products.publishError') || 'Failed to publish product');
      }
    } catch {
      toast.error(t('admin.products.publishError') || 'Failed to publish product');
    }
  }, [selectedProductId, t]);

  const handleUnpublish = useCallback(async () => {
    if (!selectedProductId) {
      toast.info(t('admin.products.selectFirst'));
      return;
    }
    try {
      const res = await fetch(`/api/products/${selectedProductId}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isActive: false }),
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === selectedProductId ? { ...p, isActive: false } : p));
        toast.success(t('admin.products.unpublishSuccess') || 'Product unpublished');
      } else {
        toast.error(t('admin.products.unpublishError') || 'Failed to unpublish product');
      }
    } catch {
      toast.error(t('admin.products.unpublishError') || 'Failed to unpublish product');
    }
  }, [selectedProductId, t]);

  const handleCategoriesFilter = useCallback(() => {
    // Focus the category filter dropdown
    const select = document.querySelector('select[class*="border-slate"]') as HTMLSelectElement | null;
    if (select) {
      select.focus();
      select.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleBulkPriceUpdate = useCallback(() => {
    setShowBulkPriceModal(true);
    setBulkPricePercent(0);
    setBulkPriceDirection('increase');
  }, []);

  const applyBulkPriceUpdate = useCallback(async () => {
    if (bulkPricePercent <= 0 || bulkPricePercent > 100) {
      toast.error(t('admin.products.bulkPriceInvalidPercent') || 'Enter a valid percentage (1-100)');
      return;
    }
    setBulkPriceApplying(true);
    try {
      const res = await fetch('/api/admin/products/bulk-price', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          percentage: bulkPricePercent,
          direction: bulkPriceDirection,
          categoryFilter: categoryFilter || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.products.bulkPriceError') || 'Failed to update prices');
        return;
      }
      const data = await res.json();
      toast.success(
        (t('admin.products.bulkPriceSuccess') || 'Prices updated for {count} products').replace('{count}', String(data.updated || 0))
      );
      setShowBulkPriceModal(false);
      window.location.reload();
    } catch {
      toast.error(t('admin.products.bulkPriceError') || 'Failed to update prices');
    } finally {
      setBulkPriceApplying(false);
    }
  }, [bulkPricePercent, bulkPriceDirection, categoryFilter, t]);

  const handleSchedulePublish = useCallback(async () => {
    if (!selectedProductId || !scheduleDate) {
      toast.error(t('admin.products.scheduleSelectDate') || 'Sélectionnez une date');
      return;
    }
    setSchedulingSave(true);
    try {
      const res = await fetch(`/api/admin/products/${selectedProductId}/schedule`, {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          action: scheduleAction,
          scheduledAt: new Date(scheduleDate).toISOString(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('admin.products.scheduleError') || 'Erreur lors de la planification');
        return;
      }
      toast.success(
        scheduleAction === 'publish'
          ? (t('admin.products.schedulePublishSuccess') || 'Publication planifiée')
          : (t('admin.products.scheduleUnpublishSuccess') || 'Dépublication planifiée')
      );
      setShowScheduleModal(false);
      setScheduleDate('');
    } catch {
      toast.error(t('admin.products.scheduleError') || 'Erreur lors de la planification');
    } finally {
      setSchedulingSave(false);
    }
  }, [selectedProductId, scheduleDate, scheduleAction, t]);

  const handlePopularPages = useCallback(() => {
    // Navigate to analytics/stats page if it exists, otherwise link to products stats
    router.push('/admin/analytics');
  }, [router]);

  const handlePdfCatalog = useCallback(() => {
    // Generate a client-side CSV catalog of all products
    const headers = ['ID', 'Name', 'SKU', 'Price', 'Category', 'Type', 'Active', 'Featured'];
    const rows = products.map(p => {
      const activeFormats = (p.formats || []).filter(f => f.isActive);
      const minPrice = activeFormats.length > 0
        ? Math.min(...activeFormats.map(f => Number(f.price)))
        : Number(p.price);
      return [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        p.slug,
        minPrice.toFixed(2),
        `"${p.category.name.replace(/"/g, '""')}"`,
        p.productType,
        p.isActive ? 'Yes' : 'No',
        p.isFeatured ? 'Yes' : 'No',
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product-catalog-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    toast.success(t('admin.products.catalogExportSuccess') || 'Catalog exported');
  }, [products, t]);

  const handleImportCsv = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRibbonExport = useCallback(() => {
    handleExport();
  }, [handleExport]);

  useRibbonAction('newProduct', handleNewProduct);
  useRibbonAction('delete', handleRibbonDelete);
  useRibbonAction('duplicate', handleDuplicate);
  useRibbonAction('publish', handlePublish);
  useRibbonAction('unpublish', handleUnpublish);
  useRibbonAction('categoriesFilter', handleCategoriesFilter);
  useRibbonAction('bulkPrice', handleBulkPriceUpdate);
  useRibbonAction('popularPages', handlePopularPages);
  useRibbonAction('pdfCatalog', handlePdfCatalog);
  useRibbonAction('importCsv', handleImportCsv);
  useRibbonAction('export', handleRibbonExport);

  // ─── Filtering ──────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (
        search &&
        !product.name.toLowerCase().includes(search.toLowerCase()) &&
        !product.slug.toLowerCase().includes(search.toLowerCase()) &&
        !product.category.name.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      if (categoryFilter && product.category.slug !== categoryFilter) return false;
      if (statusFilter === 'active' && !product.isActive) return false;
      if (statusFilter === 'inactive' && product.isActive) return false;
      if (statusFilter === 'featured' && !product.isFeatured) return false;
      if (statusFilter === 'peptide' && product.productType !== 'PEPTIDE') return false;
      if (statusFilter === 'supplement' && product.productType !== 'SUPPLEMENT') return false;
      if (statusFilter === 'accessory' && product.productType !== 'ACCESSORY') return false;
      return true;
    });
  }, [products, search, statusFilter, categoryFilter]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  // ─── ContentList data ───────────────────────────────────────

  const filterTabs = useMemo(() => [
    { key: 'all', label: t('common.total'), count: stats.total },
    { key: 'active', label: t('admin.products.active'), count: stats.active },
    { key: 'peptide', label: t('admin.products.peptides'), count: stats.peptides },
    { key: 'supplement', label: t('admin.products.supplements'), count: stats.supplements },
    { key: 'accessory', label: t('admin.products.accessories'), count: stats.accessories },
  ], [t, stats]);

  const listItems: ContentListItem[] = useMemo(() =>
    filteredProducts.map((p) => {
      const stockStatus = getProductStockStatus(p, t);
      const badges: ContentListItem['badges'] = [
        { text: stockStatus.label, variant: stockStatus.variant },
      ];
      if (!p.isActive) badges.push({ text: t('admin.products.inactive'), variant: 'error' });
      if (p.isFeatured) badges.push({ text: '★', variant: 'warning' });

      // ABC classification badge
      const abc = abcClassification[p.id];
      if (abc === 'A') {
        badges.push({ text: 'A', variant: 'success' });
      } else if (abc === 'B') {
        badges.push({ text: 'B', variant: 'info' });
      } else if (abc === 'C') {
        badges.push({ text: 'C', variant: 'neutral' });
      }

      // FIX: BUG-070 - Show format price range instead of base product price
      const activeFormats = (p.formats || []).filter((f: { isActive: boolean; price: unknown }) => f.isActive);
      let priceDisplay: string;
      if (activeFormats.length > 0) {
        const prices = activeFormats.map((f: { price: unknown }) => Number(f.price));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        priceDisplay = minPrice === maxPrice
          ? formatCurrency(minPrice)
          : `${formatCurrency(minPrice)}\u2013${formatCurrency(maxPrice)}`;
      } else {
        priceDisplay = formatCurrency(Number(p.price));
      }

      return {
        id: p.id,
        avatar: p.imageUrl ? { text: p.name, imageUrl: p.imageUrl } : { text: p.name },
        title: p.name,
        subtitle: `${p.category.name} · ${priceDisplay}`,
        preview: p.formats
          ? tp('admin.products.formatCount', p.formats.length)
          : t('admin.products.noFormats'),
        timestamp: p.createdAt,
        badges,
      };
    }),
  [filteredProducts, t, abcClassification]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col">
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImport}
        className="hidden"
      />

      {/* Header + Stats */}
      <div className="p-4 lg:p-6 pb-0 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('admin.products.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {t('admin.products.subtitle', { total: stats.total, active: stats.active, featured: stats.featured })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isOwner && (
              <Button
                variant="secondary"
                icon={importing ? Loader2 : Upload}
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                size="sm"
              >
                {t('admin.products.importCsv')}
              </Button>
            )}
            <Button
              variant="secondary"
              icon={exporting ? Loader2 : FileDown}
              onClick={handleExport}
              disabled={exporting}
              size="sm"
            >
              {t('admin.products.export')}
            </Button>
            <Link href="/admin/produits/nouveau">
              <Button variant="primary" icon={Plus} size="sm">
                {t('admin.products.newProduct')}
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <MiniStat icon={Package} label={t('common.total')} value={stats.total} />
          <MiniStat icon={FlaskConical} label={t('admin.products.peptides')} value={stats.peptides} />
          <MiniStat icon={Pill} label={t('admin.products.supplements')} value={stats.supplements} />
          <MiniStat icon={Wrench} label={t('admin.products.accessories')} value={stats.accessories} />
        </div>

        {/* Reorder Alerts Banner */}
        {reorderAlerts.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-amber-800">
                  {t('admin.products.reorderAlertTitle') || 'Alerte de réapprovisionnement'}
                  <span className="ml-1 font-normal text-amber-600">({reorderAlerts.length})</span>
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {reorderAlerts.slice(0, 5).map((p) => {
                    const totalStock = (p.formats || [])
                      .filter(f => f.isActive)
                      .reduce((sum, f) => sum + f.stockQuantity, 0);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedProductId(p.id)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-white border border-amber-200 rounded text-xs text-amber-800 hover:bg-amber-100 transition-colors"
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-amber-600">
                          ({t('admin.products.reorderStock') || 'Stock'}: {totalStock}/{p.reorderPoint})
                        </span>
                      </button>
                    );
                  })}
                  {reorderAlerts.length > 5 && (
                    <span className="text-xs text-amber-600 py-1">
                      +{reorderAlerts.length - 5} {t('admin.products.reorderMore') || 'autres'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category filter */}
        {categories.length > 0 && (
          <div className="mb-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="">{t('admin.products.allCategories')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main: list + detail */}
      <div className="flex-1 min-h-0">
        <MobileSplitLayout
          listWidth={380}
          showDetail={!!selectedProductId}
          list={
            <ContentList
              items={listItems}
              selectedId={selectedProductId}
              onSelect={setSelectedProductId}
              filterTabs={filterTabs}
              activeFilter={statusFilter}
              onFilterChange={setStatusFilter}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder={t('admin.products.searchPlaceholder')}
              emptyIcon={Package}
              emptyTitle={t('admin.products.emptyTitle')}
              emptyDescription={t('admin.products.emptyDescription')}
            />
          }
          detail={
            selectedProduct ? (
              <DetailPane
                header={{
                  title: selectedProduct.name,
                  subtitle: selectedProduct.category.name,
                  avatar: selectedProduct.imageUrl
                    ? { text: selectedProduct.name, imageUrl: selectedProduct.imageUrl }
                    : { text: selectedProduct.name },
                  onBack: () => setSelectedProductId(null),
                  backLabel: t('admin.products.title'),
                  actions: (
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/produits/${selectedProduct.id}`}>
                        <Button variant="primary" size="sm" icon={Pencil}>
                          {t('admin.products.edit')}
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Calendar}
                        onClick={() => {
                          setScheduleAction('publish');
                          setScheduleDate('');
                          setShowScheduleModal(true);
                        }}
                        title={t('admin.products.schedulePublish') || 'Planifier publication'}
                      >
                        {t('admin.products.schedule') || 'Planifier'}
                      </Button>
                      <Link href={`/product/${selectedProduct.slug}`} target="_blank">
                        <Button variant="ghost" size="sm" icon={ExternalLink}>
                          {t('admin.outlook.viewSite')}
                        </Button>
                      </Link>
                      {isOwner && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={deleting === selectedProduct.id ? Loader2 : Trash2}
                          onClick={() => setConfirmDeleteId(selectedProduct.id)}
                          disabled={deleting === selectedProduct.id}
                          aria-label="Supprimer le produit"
                        />
                      )}
                    </div>
                  ),
                }}
              >
                <div className="space-y-6">
                  {/* Product Image */}
                  {selectedProduct.imageUrl && (
                    <div className="rounded-lg overflow-hidden border border-slate-200">
                      <Image
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.name}
                        width={400}
                        height={300}
                        className="w-full h-48 object-cover"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">{t('admin.products.colPrice')}</p>
                      {/* BUG-070 FIX: Show format price range instead of base price */}
                      {(() => {
                        const af = (selectedProduct.formats || []).filter(f => f.isActive);
                        if (af.length > 0) {
                          const prices = af.map(f => Number(f.price));
                          const minP = Math.min(...prices);
                          const maxP = Math.max(...prices);
                          return (
                            <p className="text-xl font-bold text-slate-900">
                              {minP === maxP ? formatCurrency(minP) : `${formatCurrency(minP)}\u2013${formatCurrency(maxP)}`}
                            </p>
                          );
                        }
                        return <p className="text-xl font-bold text-slate-900">{formatCurrency(Number(selectedProduct.price))}</p>;
                      })()}
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">{t('admin.products.colStatus')}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge variant={selectedProduct.isActive ? 'success' : 'error'}>
                          {selectedProduct.isActive ? t('admin.products.active') : t('admin.products.inactive')}
                        </StatusBadge>
                        {selectedProduct.isFeatured && <Star className="w-4 h-4 text-amber-500 fill-amber-500" />}
                      </div>
                    </div>
                    {selectedProduct.purity && (
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">{t('admin.products.purity')}</p>
                        <p className="text-lg font-bold text-emerald-700">{selectedProduct.purity}%</p>
                      </div>
                    )}
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">{t('admin.products.colCategory')}</p>
                      <p className="text-sm font-medium text-slate-900">{selectedProduct.category.name}</p>
                    </div>
                    {/* ABC Classification */}
                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500">{t('admin.products.abcClassification') || 'Classification ABC'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <TrendingUp className="w-4 h-4 text-slate-400" />
                        {(() => {
                          const abc = abcClassification[selectedProduct.id];
                          const configs = {
                            A: { label: 'A - ' + (t('admin.products.abcA') || 'Haute contribution'), className: 'text-emerald-700 bg-emerald-100' },
                            B: { label: 'B - ' + (t('admin.products.abcB') || 'Contribution moyenne'), className: 'text-sky-700 bg-sky-100' },
                            C: { label: 'C - ' + (t('admin.products.abcC') || 'Faible contribution'), className: 'text-slate-600 bg-slate-100' },
                          };
                          const config = configs[abc || 'C'];
                          return (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.className}`}>
                              {config.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.isNew && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700">
                        {t('admin.products.new')}
                      </span>
                    )}
                    {selectedProduct.isBestseller && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                        {t('admin.products.bestseller')}
                      </span>
                    )}
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
                      {selectedProduct.productType}
                    </span>
                  </div>

                  {/* Formats Table */}
                  {selectedProduct.formats && selectedProduct.formats.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-3">
                        {t('admin.products.colFormats')} ({selectedProduct.formats.length})
                      </h3>
                      <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-3 py-2 text-start text-xs font-medium text-slate-500 uppercase">{t('admin.products.colFormat')}</th>
                              <th className="px-3 py-2 text-end text-xs font-medium text-slate-500 uppercase">{t('admin.products.colPrice')}</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">{t('admin.products.colStock')}</th>
                              <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">{t('admin.products.colStatus')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedProduct.formats.map((fmt) => (
                              <tr key={fmt.id}>
                                <td className="px-3 py-2 text-sm text-slate-900">{fmt.name}</td>
                                <td className="px-3 py-2 text-sm text-end text-slate-700">{formatCurrency(Number(fmt.price))}</td>
                                <td className="px-3 py-2 text-sm text-center">
                                  <span className={`font-medium ${
                                    fmt.stockQuantity === 0 ? 'text-red-600' :
                                    fmt.stockQuantity <= 10 ? 'text-amber-600' :
                                    'text-slate-700'
                                  }`}>
                                    {fmt.stockQuantity}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <StatusBadge
                                    variant={
                                      fmt.availability === 'OUT_OF_STOCK' || fmt.availability === 'DISCONTINUED'
                                        ? 'error'
                                        : fmt.isActive
                                          ? 'success'
                                          : 'neutral'
                                    }
                                  >
                                    {fmt.availability === 'OUT_OF_STOCK' ? t('admin.products.outOfStock') :
                                     fmt.availability === 'DISCONTINUED' ? t('admin.products.discontinued') :
                                     fmt.isActive ? t('admin.products.active') : t('admin.products.inactive')}
                                  </StatusBadge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Slug */}
                  <div className="text-xs text-slate-400">
                    Slug: <code className="bg-slate-100 px-1 py-0.5 rounded">{selectedProduct.slug}</code>
                  </div>
                </div>
              </DetailPane>
            ) : (
              <DetailPane
                isEmpty
                emptyIcon={Package}
                emptyTitle={t('admin.products.emptyTitle')}
                emptyDescription={t('admin.products.emptyDescription')}
              />
            )
          }
        />
      </div>

      {/* ─── DELETE CONFIRM DIALOG ─────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title={t('admin.products.deleteTitle') || 'Delete Product'}
        message={t('admin.products.confirmDelete') || 'Are you sure you want to delete this product? This action cannot be undone.'}
        variant="danger"
        confirmLabel={t('common.delete') || 'Delete'}
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* ─── SCHEDULED PUBLISH MODAL ─────────────────────────────── */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title={t('admin.products.scheduleTitle') || 'Planifier la publication'}
        subtitle={selectedProduct ? selectedProduct.name : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
              {t('common.cancel') || 'Annuler'}
            </Button>
            <Button
              variant="primary"
              icon={schedulingSave ? Loader2 : Calendar}
              loading={schedulingSave}
              onClick={handleSchedulePublish}
              disabled={schedulingSave || !scheduleDate}
            >
              {t('admin.products.scheduleConfirm') || 'Planifier'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('admin.products.scheduleActionLabel') || 'Action'}
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleAction"
                  checked={scheduleAction === 'publish'}
                  onChange={() => setScheduleAction('publish')}
                  className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  {t('admin.products.scheduleActionPublish') || 'Publier'}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scheduleAction"
                  checked={scheduleAction === 'unpublish'}
                  onChange={() => setScheduleAction('unpublish')}
                  className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  {t('admin.products.scheduleActionUnpublish') || 'Dépublier'}
                </span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('admin.products.scheduleDateLabel') || 'Date et heure'}
            </label>
            <input
              type="datetime-local"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          {scheduleDate && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
              <p className="text-sm text-sky-800">
                {scheduleAction === 'publish'
                  ? (t('admin.products.schedulePublishPreview') || 'Le produit sera publié le')
                  : (t('admin.products.scheduleUnpublishPreview') || 'Le produit sera dépublié le')
                }{' '}
                <strong>{new Date(scheduleDate).toLocaleString('fr-CA')}</strong>
              </p>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── BULK PRICE UPDATE MODAL ─────────────────────────────── */}
      <Modal
        isOpen={showBulkPriceModal}
        onClose={() => setShowBulkPriceModal(false)}
        title={t('admin.products.bulkPriceTitle') || 'Bulk Price Update'}
        subtitle={t('admin.products.bulkPriceSubtitle') || 'Adjust prices for all products by a percentage'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowBulkPriceModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              variant="primary"
              icon={bulkPriceApplying ? Loader2 : Percent}
              loading={bulkPriceApplying}
              onClick={applyBulkPriceUpdate}
              disabled={bulkPriceApplying || bulkPricePercent <= 0}
            >
              {t('admin.products.bulkPriceApply') || 'Apply'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('admin.products.bulkPriceDirectionLabel') || 'Direction'}
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priceDirection"
                  checked={bulkPriceDirection === 'increase'}
                  onChange={() => setBulkPriceDirection('increase')}
                  className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  {t('admin.products.bulkPriceIncrease') || 'Increase'}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="priceDirection"
                  checked={bulkPriceDirection === 'decrease'}
                  onChange={() => setBulkPriceDirection('decrease')}
                  className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500"
                />
                <span className="text-sm text-slate-700">
                  {t('admin.products.bulkPriceDecrease') || 'Decrease'}
                </span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t('admin.products.bulkPricePercentLabel') || 'Percentage (%)'}
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={bulkPricePercent}
              onChange={(e) => setBulkPricePercent(parseFloat(e.target.value) || 0)}
              className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              placeholder="e.g. 10"
            />
          </div>
          {categoryFilter && (
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2">
              {(t('admin.products.bulkPriceCategoryNote') || 'Only products in the currently filtered category will be affected.').replace('{category}', categoryFilter)}
            </p>
          )}
          {bulkPricePercent > 0 && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-3">
              <p className="text-sm text-sky-800">
                {bulkPriceDirection === 'increase' ? '+' : '-'}{bulkPricePercent}%{' '}
                {t('admin.products.bulkPricePreview') || 'will be applied to all product format prices'}
                {categoryFilter ? ` (${categoryFilter})` : ''}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className="w-9 h-9 bg-sky-50 rounded-lg flex items-center justify-center text-sky-600 flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
