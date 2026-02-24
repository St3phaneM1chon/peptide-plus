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
} from 'lucide-react';
import { Button, StatusBadge } from '@/components/admin';
import {
  ContentList,
  DetailPane,
  MobileSplitLayout,
} from '@/components/admin/outlook';
import type { ContentListItem } from '@/components/admin/outlook';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';

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
  const { t, formatCurrency } = useI18n();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Business logic (unchanged) ─────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/admin/products/export');
      if (!res.ok) {
        toast.error(t('admin.products.exportError') || 'Export failed');
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
      toast.success(t('admin.products.exportSuccess') || 'Products exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('admin.products.exportError') || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        toast.error(data.error || 'Import failed');
        return;
      }

      const { summary } = data;
      toast.success(
        `Import: ${summary.created} created, ${summary.updated} updated` +
        (summary.errors.length > 0 ? `, ${summary.errors.length} errors` : '')
      );

      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(t('admin.products.importError') || 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.products.confirmDelete'))) return;

    setDeleting(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
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
      handleDelete(selectedProductId);
    } else {
      toast.info(t('admin.products.selectFirst') || 'Select a product first');
    }
  }, [selectedProductId, handleDelete, t]);

  const handleDuplicate = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handlePublish = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleUnpublish = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handleCategoriesFilter = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handlePopularPages = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

  const handlePdfCatalog = useCallback(() => {
    toast.info(t('common.comingSoon'));
  }, [t]);

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
          ? `${p.formats.length} format${p.formats.length > 1 ? 's' : ''}`
          : t('admin.products.noFormats'),
        timestamp: p.createdAt,
        badges,
      };
    }),
  [filteredProducts, t]);

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
                {t('admin.products.importCsv') || 'Import CSV'}
              </Button>
            )}
            <Button
              variant="secondary"
              icon={exporting ? Loader2 : FileDown}
              onClick={handleExport}
              disabled={exporting}
              size="sm"
            >
              {t('admin.products.export') || 'Export CSV'}
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
                          onClick={() => handleDelete(selectedProduct.id)}
                          disabled={deleting === selectedProduct.id}
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
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(Number(selectedProduct.price))}</p>
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
                              <th className="px-3 py-2 text-start text-xs font-medium text-slate-500 uppercase">Format</th>
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
