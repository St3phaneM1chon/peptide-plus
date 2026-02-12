'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import {
  PageHeader,
  Button,
  FilterBar,
  SelectFilter,
  DataTable,
  EmptyState,
  StatusBadge,
  type Column,
} from '@/components/admin';

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

function getProductStockStatus(product: Product) {
  if (!product.formats || product.formats.length === 0) {
    return { label: 'Aucun format', variant: 'neutral' as const };
  }

  const activeFormats = product.formats.filter((f) => f.isActive);
  const outOfStock = activeFormats.filter(
    (f) => f.availability === 'OUT_OF_STOCK' || f.availability === 'DISCONTINUED'
  );
  const lowStock = activeFormats.filter((f) => f.stockQuantity > 0 && f.stockQuantity <= 10);

  if (outOfStock.length === activeFormats.length) {
    return { label: 'Tous rupture', variant: 'error' as const };
  }
  if (outOfStock.length > 0) {
    return { label: `${outOfStock.length}/${activeFormats.length} rupture`, variant: 'warning' as const };
  }
  if (lowStock.length > 0) {
    return { label: `${lowStock.length} stock faible`, variant: 'warning' as const };
  }
  return { label: 'En stock', variant: 'success' as const };
}

export default function ProductsListClient({
  initialProducts,
  categories,
  stats,
  isOwner,
}: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

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
    if (!confirm('Etes-vous sur de vouloir supprimer ce produit? Cette action est irreversible.')) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(products.filter((p) => p.id !== id));
      } else {
        alert('Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  };

  const categoryOptions = categories.map((c) => ({ value: c.slug, label: c.name }));

  const stockOptions = [
    { value: 'lowStock', label: 'Stock faible' },
    { value: 'outOfStock', label: 'Avec ruptures' },
    { value: 'allOutOfStock', label: 'Tous en rupture' },
  ];

  const statusOptions = [
    { value: 'active', label: 'Actifs' },
    { value: 'inactive', label: 'Inactifs' },
    { value: 'featured', label: 'En vedette' },
  ];

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Produit',
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
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
              <p className="text-xs text-emerald-600">Purete: {product.purity}%</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Categorie',
      render: (product) => (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
          {product.category.name}
        </span>
      ),
    },
    {
      key: 'price',
      header: 'Prix',
      sortable: true,
      align: 'right',
      render: (product) => (
        <span className="font-semibold text-slate-900">${Number(product.price).toFixed(2)}</span>
      ),
    },
    {
      key: 'formats',
      header: 'Formats',
      align: 'center',
      render: (product) => (
        <span className="text-sm text-slate-500">{product.formats?.length || 0}</span>
      ),
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (product) => {
        const stockStatus = getProductStockStatus(product);
        return <StatusBadge variant={stockStatus.variant}>{stockStatus.label}</StatusBadge>;
      },
    },
    {
      key: 'status',
      header: 'Statut',
      render: (product) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge variant={product.isActive ? 'success' : 'error'}>
            {product.isActive ? 'Actif' : 'Inactif'}
          </StatusBadge>
          {product.isFeatured && (
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (product) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/admin/produits/${product.id}`}>
            <Button variant="ghost" size="sm" icon={Pencil}>
              Modifier
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
      <PageHeader
        title="Gestion des produits"
        subtitle={`${stats.total} produits \u00B7 ${stats.active} actifs \u00B7 ${stats.featured} en vedette`}
        actions={
          <Link href="/admin/produits/nouveau">
            <Button variant="primary" icon={Plus}>
              Nouveau produit
            </Button>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={Package} label="Total" value={stats.total} />
        <MiniStat icon={FlaskConical} label="Peptides" value={stats.peptides} />
        <MiniStat icon={Pill} label="Supplements" value={stats.supplements} />
        <MiniStat icon={Wrench} label="Accessoires" value={stats.accessories} />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher un produit..."
      >
        <SelectFilter
          label="Toutes categories"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={categoryOptions}
        />
        <SelectFilter
          label="Tous les stocks"
          value={stockFilter}
          onChange={setStockFilter}
          options={stockOptions}
        />
        <SelectFilter
          label="Tous statuts"
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
        emptyTitle="Aucun produit trouve"
        emptyDescription="Aucun produit ne correspond a vos filtres."
        emptyAction={
          <Link href="/admin/produits/nouveau">
            <Button variant="primary" icon={Plus}>
              Creer un produit
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
