'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

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

/* StockBadge - Reserved for future use
const StockBadge = ({ availability, stockQuantity }: { availability: string; stockQuantity: number }) => {
  const getStyle = () => {
    switch (availability) {
      case 'IN_STOCK':
        return stockQuantity > 10 
          ? 'bg-green-100 text-green-800' 
          : 'bg-yellow-100 text-yellow-800';
      case 'OUT_OF_STOCK':
        return 'bg-red-100 text-red-800';
      case 'DISCONTINUED':
        return 'bg-gray-100 text-gray-800';
      case 'COMING_SOON':
        return 'bg-blue-100 text-blue-800';
      case 'PRE_ORDER':
        return 'bg-purple-100 text-purple-800';
      case 'LIMITED':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getLabel = () => {
    switch (availability) {
      case 'IN_STOCK':
        return stockQuantity > 10 ? `${stockQuantity} en stock` : `Stock faible (${stockQuantity})`;
      case 'OUT_OF_STOCK':
        return 'Rupture';
      case 'DISCONTINUED':
        return 'Arrêté';
      case 'COMING_SOON':
        return 'Bientôt';
      case 'PRE_ORDER':
        return 'Précommande';
      case 'LIMITED':
        return 'Limité';
      default:
        return availability;
    }
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStyle()}`}>
      {getLabel()}
    </span>
  );
};
*/

export default function ProductsListClient({ 
  initialProducts, 
  categories, 
  stats,
  isOwner 
}: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      // Search filter
      if (search && !product.name.toLowerCase().includes(search.toLowerCase()) &&
          !product.slug.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && product.category.slug !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter === 'active' && !product.isActive) return false;
      if (statusFilter === 'inactive' && product.isActive) return false;
      if (statusFilter === 'featured' && !product.isFeatured) return false;

      // Stock filter - check formats
      if (stockFilter !== 'all' && product.formats) {
        const hasOutOfStock = product.formats.some(f => f.availability === 'OUT_OF_STOCK');
        const allOutOfStock = product.formats.every(f => f.availability === 'OUT_OF_STOCK' || f.availability === 'DISCONTINUED');
        const hasLowStock = product.formats.some(f => f.stockQuantity > 0 && f.stockQuantity <= 10);
        
        if (stockFilter === 'outOfStock' && !hasOutOfStock) return false;
        if (stockFilter === 'allOutOfStock' && !allOutOfStock) return false;
        if (stockFilter === 'lowStock' && !hasLowStock) return false;
      }

      return true;
    });
  }, [products, search, categoryFilter, stockFilter, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit? Cette action est irréversible.')) {
      return;
    }

    setDeleting(id);
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setProducts(products.filter(p => p.id !== id));
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

  const getProductStockStatus = (product: Product) => {
    if (!product.formats || product.formats.length === 0) {
      return { status: 'none', label: 'Aucun format', color: 'gray' };
    }

    const activeFormats = product.formats.filter(f => f.isActive);
    const outOfStock = activeFormats.filter(f => f.availability === 'OUT_OF_STOCK' || f.availability === 'DISCONTINUED');
    const lowStock = activeFormats.filter(f => f.stockQuantity > 0 && f.stockQuantity <= 10);

    if (outOfStock.length === activeFormats.length) {
      return { status: 'outOfStock', label: 'Tous rupture', color: 'red' };
    }
    if (outOfStock.length > 0) {
      return { status: 'partial', label: `${outOfStock.length}/${activeFormats.length} rupture`, color: 'orange' };
    }
    if (lowStock.length > 0) {
      return { status: 'lowStock', label: `${lowStock.length} stock faible`, color: 'yellow' };
    }
    return { status: 'inStock', label: 'En stock', color: 'green' };
  };

  return (
    <div className="min-h-screen bg-neutral-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Gestion des produits</h1>
            <p className="text-neutral-500 text-sm mt-1">
              {stats.total} produits • {stats.active} actifs • {stats.featured} en vedette
            </p>
          </div>
          <Link
            href="/admin/produits/nouveau"
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau produit
          </Link>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Recherche */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Catégorie */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Toutes catégories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
              ))}
            </select>

            {/* Stock */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Tous les stocks</option>
              <option value="lowStock">Stock faible</option>
              <option value="outOfStock">Avec ruptures</option>
              <option value="allOutOfStock">Tous en rupture</option>
            </select>

            {/* Statut */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">Tous statuts</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
              <option value="featured">En vedette</option>
            </select>
          </div>
        </div>

        {/* Liste des produits */}
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Produit</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Catégorie</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Prix</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Formats</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredProducts.map((product) => {
                  const stockStatus = getProductStockStatus(product);
                  return (
                    <tr key={product.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0">
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-400">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900">{product.name}</p>
                            <p className="text-xs text-neutral-500">{product.slug}</p>
                            {product.purity && (
                              <p className="text-xs text-green-600">Pureté: {product.purity}%</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-neutral-100 text-neutral-700">
                          {product.category.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-neutral-900">${Number(product.price).toFixed(2)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-neutral-600">
                          {product.formats?.length || 0} formats
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          stockStatus.color === 'green' ? 'bg-green-100 text-green-700' :
                          stockStatus.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                          stockStatus.color === 'orange' ? 'bg-orange-100 text-orange-700' :
                          stockStatus.color === 'red' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {stockStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${product.isActive ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-sm text-neutral-600">
                            {product.isActive ? 'Actif' : 'Inactif'}
                          </span>
                          {product.isFeatured && (
                            <span className="ml-1 text-orange-500" title="En vedette">★</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/produits/${product.id}`}
                            className="p-2 text-neutral-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Link>
                          <Link
                            href={`/product/${product.slug}`}
                            target="_blank"
                            className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Voir"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                          {isOwner && (
                            <button
                              onClick={() => handleDelete(product.id)}
                              disabled={deleting === product.id}
                              className="p-2 text-neutral-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Supprimer"
                            >
                              {deleting === product.id ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-neutral-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-neutral-500">Aucun produit trouvé</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
