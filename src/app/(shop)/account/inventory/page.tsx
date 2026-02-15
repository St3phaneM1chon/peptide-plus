'use client';

/**
 * PAGE MON INVENTAIRE DE RECHERCHE - BioCycle Peptides
 * Gestion complète des peptides commandés par le client
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from '@/hooks/useTranslations';

// Types
interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  formatName: string;
  quantity: number;
  unitPrice: number;
  sku?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: string;
  items: OrderItem[];
}

interface ProductInventory {
  productId: string;
  productName: string;
  category: string;
  formats: {
    formatName: string;
    totalQuantity: number;
    totalSpent: number;
    orderCount: number;
    lastOrderDate: string;
    orders: { orderNumber: string; date: string; quantity: number; price: number }[];
  }[];
  totalQuantity: number;
  totalSpent: number;
  totalOrders: number;
  firstOrderDate: string;
  lastOrderDate: string;
  stockStatus: 'full' | 'low' | 'empty' | 'unknown';
  notes: string;
}

interface InventoryStats {
  totalProducts: number;
  totalFormats: number;
  totalQuantity: number;
  totalSpent: number;
  firstOrderDate: string | null;
  mostOrderedProduct: string | null;
  averageOrderFrequency: number | null; // jours entre commandes
}

type ViewMode = 'cards' | 'table';
type StockFilter = 'all' | 'full' | 'low' | 'empty';
type SortBy = 'name' | 'quantity' | 'recent' | 'spent';

export default function InventoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslations();
  
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('recent');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<ProductInventory | null>(null);
  
  // Stock status & notes persistence (localStorage)
  const [stockStatuses, setStockStatuses] = useState<Record<string, 'full' | 'low' | 'empty' | 'unknown'>>({});
  const [productNotes, setProductNotes] = useState<Record<string, string>>({});

  // Auth check
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin?callbackUrl=/account/inventory');
    }
  }, [status, router]);

  // Load saved data from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedStatuses = localStorage.getItem('inventory_stock_statuses');
      const savedNotes = localStorage.getItem('inventory_notes');
      if (savedStatuses) setStockStatuses(JSON.parse(savedStatuses));
      if (savedNotes) setProductNotes(JSON.parse(savedNotes));
    }
  }, []);

  // Fetch orders
  useEffect(() => {
    if (session?.user) {
      fetchOrders();
    }
  }, [session]);

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process orders into inventory
  const inventory = useMemo((): ProductInventory[] => {
    const productMap = new Map<string, ProductInventory>();

    orders.forEach(order => {
      if (order.status === 'CANCELLED') return;

      order.items.forEach(item => {
        const key = item.productId || item.productName;
        
        if (!productMap.has(key)) {
          productMap.set(key, {
            productId: item.productId,
            productName: item.productName,
            category: detectCategory(item.productName),
            formats: [],
            totalQuantity: 0,
            totalSpent: 0,
            totalOrders: 0,
            firstOrderDate: order.createdAt,
            lastOrderDate: order.createdAt,
            stockStatus: stockStatuses[key] || 'unknown',
            notes: productNotes[key] || '',
          });
        }

        const product = productMap.get(key)!;
        product.totalQuantity += item.quantity;
        product.totalSpent += item.quantity * Number(item.unitPrice);
        product.totalOrders += 1;

        if (new Date(order.createdAt) < new Date(product.firstOrderDate)) {
          product.firstOrderDate = order.createdAt;
        }
        if (new Date(order.createdAt) > new Date(product.lastOrderDate)) {
          product.lastOrderDate = order.createdAt;
        }

        // Add format info
        let format = product.formats.find(f => f.formatName === item.formatName);
        if (!format) {
          format = {
            formatName: item.formatName || 'Standard',
            totalQuantity: 0,
            totalSpent: 0,
            orderCount: 0,
            lastOrderDate: order.createdAt,
            orders: [],
          };
          product.formats.push(format);
        }

        format.totalQuantity += item.quantity;
        format.totalSpent += item.quantity * Number(item.unitPrice);
        format.orderCount += 1;
        if (new Date(order.createdAt) > new Date(format.lastOrderDate)) {
          format.lastOrderDate = order.createdAt;
        }
        format.orders.push({
          orderNumber: order.orderNumber,
          date: order.createdAt,
          quantity: item.quantity,
          price: Number(item.unitPrice),
        });
      });
    });

    return Array.from(productMap.values());
  }, [orders, stockStatuses, productNotes]);

  // Calculate stats
  const stats = useMemo((): InventoryStats => {
    if (inventory.length === 0) {
      return {
        totalProducts: 0,
        totalFormats: 0,
        totalQuantity: 0,
        totalSpent: 0,
        firstOrderDate: null,
        mostOrderedProduct: null,
        averageOrderFrequency: null,
      };
    }

    const totalFormats = inventory.reduce((sum, p) => sum + p.formats.length, 0);
    const totalQuantity = inventory.reduce((sum, p) => sum + p.totalQuantity, 0);
    const totalSpent = inventory.reduce((sum, p) => sum + p.totalSpent, 0);
    
    const dates = inventory.map(p => new Date(p.firstOrderDate).getTime());
    const firstOrderDate = new Date(Math.min(...dates)).toISOString();

    const mostOrdered = [...inventory].sort((a, b) => b.totalQuantity - a.totalQuantity)[0];

    // Calculate average frequency
    let avgFrequency: number | null = null;
    if (orders.length >= 2) {
      const sortedDates = orders.map(o => new Date(o.createdAt).getTime()).sort((a, b) => a - b);
      const gaps = [];
      for (let i = 1; i < sortedDates.length; i++) {
        gaps.push((sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24));
      }
      avgFrequency = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    }

    return {
      totalProducts: inventory.length,
      totalFormats,
      totalQuantity,
      totalSpent,
      firstOrderDate,
      mostOrderedProduct: mostOrdered?.productName || null,
      averageOrderFrequency: avgFrequency,
    };
  }, [inventory, orders]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(inventory.map(p => p.category));
    return ['all', ...Array.from(cats)];
  }, [inventory]);

  // Filter and sort inventory
  const filteredInventory = useMemo(() => {
    let result = [...inventory];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.productName.toLowerCase().includes(term) ||
        p.formats.some(f => f.formatName.toLowerCase().includes(term))
      );
    }

    // Stock filter
    if (stockFilter !== 'all') {
      result = result.filter(p => p.stockStatus === stockFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }

    // Sort
    switch (sortBy) {
      case 'name':
        result.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case 'quantity':
        result.sort((a, b) => b.totalQuantity - a.totalQuantity);
        break;
      case 'spent':
        result.sort((a, b) => b.totalSpent - a.totalSpent);
        break;
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime());
    }

    return result;
  }, [inventory, searchTerm, stockFilter, categoryFilter, sortBy]);

  // Update stock status
  const updateStockStatus = (productId: string, status: 'full' | 'low' | 'empty' | 'unknown') => {
    const newStatuses = { ...stockStatuses, [productId]: status };
    setStockStatuses(newStatuses);
    localStorage.setItem('inventory_stock_statuses', JSON.stringify(newStatuses));
  };

  // Update notes
  const updateNotes = (productId: string, notes: string) => {
    const newNotes = { ...productNotes, [productId]: notes };
    setProductNotes(newNotes);
    localStorage.setItem('inventory_notes', JSON.stringify(newNotes));
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [t('account.inventory.csvProduct'), t('account.inventory.csvCategory'), t('account.inventory.csvFormat'), t('account.inventory.csvTotalQuantity'), t('account.inventory.csvTotalSpent'), t('account.inventory.csvLastOrder'), t('account.inventory.csvStockStatus'), t('account.inventory.csvNotes')];
    const rows = filteredInventory.flatMap(p => 
      p.formats.map(f => [
        p.productName,
        p.category,
        f.formatName,
        f.totalQuantity,
        f.totalSpent.toFixed(2),
        new Date(f.lastOrderDate).toLocaleDateString('fr-CA'),
        p.stockStatus,
        p.notes.replace(/,/g, ';'),
      ])
    );

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `inventaire-biocycle-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Loading state
  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('account.inventory.loading')}</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  // Alerts (low stock items)
  const lowStockItems = inventory.filter(p => p.stockStatus === 'low' || p.stockStatus === 'empty');

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <nav className="text-sm text-gray-500 mb-2">
            <Link href="/" className="hover:text-orange-600">{t('account.inventory.breadcrumbHome')}</Link>
            <span className="mx-2">/</span>
            <Link href="/dashboard/customer" className="hover:text-orange-600">{t('account.inventory.breadcrumbDashboard')}</Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{t('account.inventory.breadcrumbInventory')}</span>
          </nav>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t('account.inventory.title')}</h1>
              <p className="text-gray-600 mt-1">{t('account.inventory.subtitle')}</p>
            </div>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              {t('account.inventory.exportCsv')}
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard icon="🧪" label={t('account.inventory.statProducts')} value={stats.totalProducts} />
          <StatCard icon="📦" label={t('account.inventory.statFormats')} value={stats.totalFormats} />
          <StatCard icon="🔢" label={t('account.inventory.statTotalUnits')} value={stats.totalQuantity} />
          <StatCard icon="💰" label={t('account.inventory.statTotalSpent')} value={`$${stats.totalSpent.toFixed(0)}`} />
          <StatCard
            icon="📅"
            label={t('account.inventory.statFirstOrder')}
            value={stats.firstOrderDate ? formatRelativeDate(stats.firstOrderDate, t) : '-'}
          />
          <StatCard
            icon="⏱️"
            label={t('account.inventory.statAvgFrequency')}
            value={stats.averageOrderFrequency ? `${stats.averageOrderFrequency}${t('account.inventory.daysSuffix')}` : '-'}
          />
        </div>

        {/* Alerts */}
        {lowStockItems.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-semibold text-amber-800">{t('account.inventory.stockAlerts')}</h3>
                <p className="text-amber-700 text-sm mt-1">
                  {lowStockItems.length} {t('account.inventory.stockAlertCount', { count: lowStockItems.length })}:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {lowStockItems.map(item => (
                    <span 
                      key={item.productId}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        item.stockStatus === 'empty' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.productName}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters & Controls */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('account.inventory.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
            </div>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? t('account.inventory.allCategories') : cat}
                </option>
              ))}
            </select>

            {/* Stock Filter */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as StockFilter)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{t('account.inventory.allStatuses')}</option>
              <option value="full">{t('account.inventory.stockFull')}</option>
              <option value="low">{t('account.inventory.stockLow')}</option>
              <option value="empty">{t('account.inventory.stockEmpty')}</option>
              <option value="unknown">{t('account.inventory.stockUnknown')}</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="recent">{t('account.inventory.sortRecent')}</option>
              <option value="name">{t('account.inventory.sortName')}</option>
              <option value="quantity">{t('account.inventory.sortQuantity')}</option>
              <option value="spent">{t('account.inventory.sortSpent')}</option>
            </select>

            {/* View Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('cards')}
                className={`px-4 py-2 ${viewMode === 'cards' ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                ▦
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 ${viewMode === 'table' ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                ≡
              </button>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredInventory.length === 0 && (
          <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
            <div className="w-20 h-20 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">🧪</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {searchTerm || stockFilter !== 'all' || categoryFilter !== 'all'
                ? t('account.inventory.noProductFound')
                : t('account.inventory.emptyInventory')}
            </h2>
            <p className="text-gray-600 mb-6">
              {searchTerm || stockFilter !== 'all' || categoryFilter !== 'all'
                ? t('account.inventory.tryModifyFilters')
                : t('account.inventory.startOrdering')}
            </p>
            <Link
              href="/shop"
              className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {t('account.inventory.discoverProducts')}
            </Link>
          </div>
        )}

        {/* Inventory Grid/Table */}
        {filteredInventory.length > 0 && viewMode === 'cards' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInventory.map(product => (
              <ProductCard
                key={product.productId}
                product={product}
                onUpdateStock={updateStockStatus}
                onViewDetails={() => setSelectedProduct(product)}
                t={t}
              />
            ))}
          </div>
        )}

        {filteredInventory.length > 0 && viewMode === 'table' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{t('account.inventory.tableProduct')}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{t('account.inventory.tableCategory')}</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{t('account.inventory.tableFormats')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{t('account.inventory.tableTotalQty')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{t('account.inventory.tableTotal')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{t('account.inventory.tableLastOrder')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{t('account.inventory.tableStock')}</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">{t('account.inventory.tableActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map(product => (
                    <tr key={product.productId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{product.productName}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                          {product.category}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {product.formats.map(f => (
                            <span key={f.formatName} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              {f.formatName} ({f.totalQuantity})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">{product.totalQuantity}</td>
                      <td className="py-3 px-4 text-center text-orange-600 font-semibold">
                        ${product.totalSpent.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-500">
                        {formatDate(product.lastOrderDate)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StockBadge status={product.stockStatus} t={t} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="text-orange-600 hover:text-orange-700 text-sm font-medium"
                        >
                          {t('account.inventory.details')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Product Detail Modal */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onUpdateStock={updateStockStatus}
            onUpdateNotes={updateNotes}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

// ============================================
// COMPOSANTS
// ============================================

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StockBadge({ status, t }: { status: string; t?: (key: string) => string }) {
  const styles: Record<string, string> = {
    full: 'bg-green-100 text-green-800',
    low: 'bg-amber-100 text-amber-800',
    empty: 'bg-red-100 text-red-800',
    unknown: 'bg-gray-100 text-gray-600',
  };
  const getLabel = (s: string) => {
    if (!t) {
      const fallback: Record<string, string> = { full: 'Full', low: 'Low', empty: 'Empty', unknown: '?' };
      return fallback[s] || '?';
    }
    const keys: Record<string, string> = {
      full: 'account.inventory.badgeFull',
      low: 'account.inventory.badgeLow',
      empty: 'account.inventory.badgeEmpty',
      unknown: 'account.inventory.badgeUnknown',
    };
    return t(keys[s] || keys.unknown);
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.unknown}`}>
      {getLabel(status)}
    </span>
  );
}

function ProductCard({
  product,
  onUpdateStock,
  onViewDetails,
  t,
}: {
  product: ProductInventory;
  onUpdateStock: (id: string, status: 'full' | 'low' | 'empty' | 'unknown') => void;
  onViewDetails: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [showStockMenu, setShowStockMenu] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded mb-2 inline-block">
              {product.category}
            </span>
            <h3 className="font-semibold text-gray-900 line-clamp-2">{product.productName}</h3>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowStockMenu(!showStockMenu)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <StockBadge status={product.stockStatus} t={t} />
            </button>
            {showStockMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[120px]">
                {(['full', 'low', 'empty', 'unknown'] as const).map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      onUpdateStock(product.productId, status);
                      setShowStockMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                  >
                    <StockBadge status={status} t={t} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Formats */}
      <div className="p-4 bg-gray-50">
        <p className="text-xs text-gray-500 mb-2">{t('account.inventory.orderedFormats')}</p>
        <div className="flex flex-wrap gap-2">
          {product.formats.map(f => (
            <div key={f.formatName} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm">
              <span className="font-medium">{f.formatName}</span>
              <span className="text-gray-500 ml-1">×{f.totalQuantity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">{t('account.inventory.totalQuantity')}</p>
          <p className="text-xl font-bold text-gray-900">{product.totalQuantity}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">{t('account.inventory.totalSpent')}</p>
          <p className="text-xl font-bold text-orange-600">${product.totalSpent.toFixed(2)}</p>
        </div>
      </div>

      {/* Notes */}
      {product.notes && (
        <div className="px-4 pb-4">
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-xs text-amber-700">📝 {product.notes}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 border-t border-gray-100 flex gap-2">
        <button
          onClick={onViewDetails}
          className="flex-1 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
        >
          {t('account.inventory.viewDetails')}
        </button>
        <Link
          href={`/shop?search=${encodeURIComponent(product.productName)}`}
          className="flex-1 py-2 text-sm font-medium text-center bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
        >
          {t('account.inventory.order')}
        </Link>
      </div>

      {/* Last order */}
      <div className="px-4 pb-4 text-center">
        <p className="text-xs text-gray-400">
          {t('account.inventory.lastOrderLabel')}: {formatRelativeDate(product.lastOrderDate, t)}
        </p>
      </div>
    </div>
  );
}

function ProductDetailModal({
  product,
  onClose,
  onUpdateStock,
  onUpdateNotes,
  t,
}: {
  product: ProductInventory;
  onClose: () => void;
  onUpdateStock: (id: string, status: 'full' | 'low' | 'empty' | 'unknown') => void;
  onUpdateNotes: (id: string, notes: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const [notes, setNotes] = useState(product.notes);
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');

  const saveNotes = () => {
    onUpdateNotes(product.productId, notes);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded mb-2 inline-block">
                {product.category}
              </span>
              <h2 className="text-xl font-bold text-gray-900">{product.productName}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview' 
                ? 'border-orange-500 text-orange-600' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('account.inventory.tabOverview')}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t('account.inventory.tabHistory')}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{product.totalQuantity}</p>
                  <p className="text-xs text-gray-500">{t('account.inventory.statTotalUnits')}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-orange-600">${product.totalSpent.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{t('account.inventory.totalSpent')}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{product.totalOrders}</p>
                  <p className="text-xs text-gray-500">{t('account.inventory.modalOrders')}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{product.formats.length}</p>
                  <p className="text-xs text-gray-500">{t('account.inventory.statFormats')}</p>
                </div>
              </div>

              {/* Formats breakdown */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">{t('account.inventory.formatBreakdown')}</h3>
                <div className="space-y-2">
                  {product.formats.map(f => (
                    <div key={f.formatName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{f.formatName}</p>
                        <p className="text-sm text-gray-500">{f.orderCount} {t('account.inventory.orderCount', { count: f.orderCount })}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">{f.totalQuantity} {t('account.inventory.units')}</p>
                        <p className="text-sm text-orange-600">${f.totalSpent.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stock Status */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">{t('account.inventory.stockStatusTitle')}</h3>
                <div className="flex gap-2">
                  {(['full', 'low', 'empty', 'unknown'] as const).map(status => (
                    <button
                      key={status}
                      onClick={() => onUpdateStock(product.productId, status)}
                      className={`flex-1 py-3 rounded-lg border-2 transition-all ${
                        product.stockStatus === status 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <StockBadge status={status} t={t} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">{t('account.inventory.personalNotes')}</h3>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  onBlur={saveNotes}
                  placeholder={t('account.inventory.notesPlaceholder')}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                  rows={3}
                />
              </div>

              {/* Timeline info */}
              <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-200">
                <span>{t('account.inventory.firstOrderLabel')}: {formatDate(product.firstOrderDate)}</span>
                <span>{t('account.inventory.lastOrderLabel')}: {formatDate(product.lastOrderDate)}</span>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {product.formats.map(format => (
                <div key={format.formatName}>
                  <h3 className="font-semibold text-gray-900 mb-3">{format.formatName}</h3>
                  <div className="space-y-2">
                    {format.orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((order, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{order.orderNumber}</p>
                          <p className="text-sm text-gray-500">{formatDate(order.date)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">×{order.quantity}</p>
                          <p className="text-sm text-orange-600">${(order.quantity * order.price).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('account.inventory.close')}
          </button>
          <Link
            href={`/shop?search=${encodeURIComponent(product.productName)}`}
            className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium text-center transition-colors"
          >
            {t('account.inventory.reorder')}
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPERS
// ============================================

function detectCategory(productName: string): string {
  const name = productName.toLowerCase();
  if (name.includes('bpc') || name.includes('tb-500') || name.includes('healing')) return 'Recovery';
  if (name.includes('sema') || name.includes('tirz') || name.includes('glp')) return 'Metabolic';
  if (name.includes('ghrp') || name.includes('cjc') || name.includes('ipamorelin')) return 'Growth Hormone';
  if (name.includes('pt-141') || name.includes('melano')) return 'Sexual Health';
  if (name.includes('nad') || name.includes('epitalon')) return 'Anti-Aging';
  if (name.includes('ss-31') || name.includes('mots')) return 'Mitochondrial';
  return 'Peptides';
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeDate(dateString: string, t?: (key: string) => string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (t) {
    if (diffDays === 0) return t('account.inventory.today');
    if (diffDays === 1) return t('account.inventory.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('account.inventory.daysAgo')}`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} ${t('account.inventory.weeksAgo')}`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} ${t('account.inventory.monthsAgo')}`;
  } else {
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  }
  return formatDate(dateString);
}
