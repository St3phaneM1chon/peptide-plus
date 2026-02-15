'use client';

import { useState, useRef, useMemo } from 'react';
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
  ImageIcon,
  Upload,
  FileDown,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  FilterBar,
  SelectFilter,
  DataTable,
  StatusBadge,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

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
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      if (summary.errors.length > 0) {
        console.warn('Import errors:', summary.errors);
      }

      // Reload the page to refresh data
      window.location.reload();
    } catch (error) {
      console.error('Import error:', error);
      toast.error(t('admin.products.importError') || 'Import failed');
    } finally {
      setImporting(false);
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (
        search &&
        !product.name.toLowerCase().includes(search.toLowerCase()) &&
        !product.slug.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }

      if (categoryFilter && product.category.slug !== categoryFilter) {
        return false;
      }

      if (statusFilter === 'active' && !product.isActive) return false;
      if (statusFilter === 'inactive' && product.isActive) return false;
      if (statusFilter === 'featured' && !product.isFeatured) return false;

      if (stockFilter && product.formats) {
        const hasOutOfStock = product.formats.some((f) => f.availability === 'OUT_OF_STOCK');
        const allOutOfStock = product.formats.every(
          (f) => f.availability === 'OUT_OF_STOCK' || f.availability === 'DISCONTINUED'
        );
        const hasLowStock = product.formats.some((f) => f.stockQuantity > 0 && f.stockQuantity <= 10);

        if (stockFilter === 'outOfStock' && !hasOutOfStock) return false;
        if (stockFilter === 'allOutOfStock' && !allOutOfStock) return false;
        if (stockFilter === 'lowStock' && !hasLowStock) return false;
      }

      return true;
    });
  }, [products, search, categoryFilter, stockFilter, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('admin.products.confirmDelete'))) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(products.filter((p) => p.id !== id));
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

  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name }));

  const stockOptions = [
    { value: 'lowStock', label: t('admin.products.filterLowStock') },
    { value: 'outOfStock', label: t('admin.products.filterWithOutOfStock') },
    { value: 'allOutOfStock', label: t('admin.products.filterAllOutOfStock') },
  ];

  const statusOptions = [
    { value: 'active', label: t('admin.products.filterActive') },
    { value: 'inactive', label: t('admin.products.filterInactive') },
    { value: 'featured', label: t('admin.products.filterFeatured') },
  ];

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: t('admin.products.colProduct'),
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
            {product.imageUrl ? (
              <Image src={product.imageUrl} alt={product.name} width={44} height={44} className="w-full h-full object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <ImageIcon className="w-5 h-5" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-slate-900 truncate">{product.name}</p>
            <p className="text-xs text-slate-400 truncate">{product.slug}</p>
            {product.purity && (
              <p className="text-xs text-emerald-600">{t('admin.products.purity')}: {product.purity}%</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: t('admin.products.colCategory'),
      render: (product) => (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
          {product.category.name}
        </span>
      ),
    },
    {
      key: 'price',
      header: t('admin.products.colPrice'),
      sortable: true,
      align: 'right',
      render: (product) => (
        <span className="font-semibold text-slate-900">${Number(product.price).toFixed(2)}</span>
      ),
    },
    {
      key: 'formats',
      header: t('admin.products.colFormats'),
      align: 'center',
      render: (product) => (
        <span className="text-sm text-slate-500">{product.formats?.length || 0}</span>
      ),
    },
    {
      key: 'stock',
      header: t('admin.products.colStock'),
      render: (product) => {
        const stockStatus = getProductStockStatus(product, t);
        return <StatusBadge variant={stockStatus.variant}>{stockStatus.label}</StatusBadge>;
      },
    },
    {
      key: 'status',
      header: t('admin.products.colStatus'),
      render: (product) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge variant={product.isActive ? 'success' : 'error'}>
            {product.isActive ? t('admin.products.active') : t('admin.products.inactive')}
          </StatusBadge>
          {product.isFeatured && (
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('admin.products.colActions'),
      align: 'right',
      render: (product) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/admin/produits/${product.id}`}>
            <Button variant="ghost" size="sm" icon={Pencil}>
              {t('admin.products.edit')}
            </Button>
          </Link>
          <Link href={`/product/${product.slug}`} target="_blank">
            <Button variant="ghost" size="sm" icon={ExternalLink} />
          </Link>
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              icon={deleting === product.id ? Loader2 : Trash2}
              onClick={() => handleDelete(product.id)}
              disabled={deleting === product.id}
              className="text-slate-400 hover:text-red-600"
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImport}
        className="hidden"
      />

      <PageHeader
        title={t('admin.products.title')}
        subtitle={t('admin.products.subtitle', { total: stats.total, active: stats.active, featured: stats.featured })}
        actions={
          <>
            {isOwner && (
              <Button
                variant="secondary"
                icon={importing ? Loader2 : Upload}
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {t('admin.products.importCsv') || 'Import CSV'}
              </Button>
            )}
            <Button
              variant="secondary"
              icon={exporting ? Loader2 : FileDown}
              onClick={handleExport}
              disabled={exporting}
            >
              {t('admin.products.export') || 'Export CSV'}
            </Button>
            <Link href="/admin/produits/nouveau">
              <Button variant="primary" icon={Plus}>
                {t('admin.products.newProduct')}
              </Button>
            </Link>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={Package} label={t('common.total')} value={stats.total} />
        <MiniStat icon={FlaskConical} label={t('admin.products.peptides')} value={stats.peptides} />
        <MiniStat icon={Pill} label={t('admin.products.supplements')} value={stats.supplements} />
        <MiniStat icon={Wrench} label={t('admin.products.accessories')} value={stats.accessories} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('admin.products.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.products.allCategories')}
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categoryOptions}
        />
        <SelectFilter
          label={t('admin.products.allStock')}
          value={stockFilter}
          onChange={setStockFilter}
          options={stockOptions}
        />
        <SelectFilter
          label={t('admin.products.allStatuses')}
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
        />
      </FilterBar>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredProducts}
        keyExtractor={(p) => p.id}
        emptyTitle={t('admin.products.emptyTitle')}
        emptyDescription={t('admin.products.emptyDescription')}
        emptyAction={
          <Link href="/admin/produits/nouveau">
            <Button variant="primary" icon={Plus}>
              {t('admin.products.createProduct')}
            </Button>
          </Link>
        }
      />
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
