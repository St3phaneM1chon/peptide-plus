'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

const availabilityColors: Record<string, string> = {
  IN_STOCK: 'bg-green-100 text-green-800',
  OUT_OF_STOCK: 'bg-red-100 text-red-800',
  LOW_STOCK: 'bg-yellow-100 text-yellow-800',
  DISCONTINUED: 'bg-gray-100 text-gray-800',
  COMING_SOON: 'bg-blue-100 text-blue-800',
  PRE_ORDER: 'bg-purple-100 text-purple-800',
};

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
              availability: newQuantity === 0 ? 'OUT_OF_STOCK' : 'IN_STOCK'
            } 
          : item
      ));
    } catch (err) {
      console.error('Error updating stock:', err);
    }
    setEditingId(null);
    setAdjustmentReason('');
  };

  const filteredInventory = inventory.filter(item => {
    if (filter.search) {
      const search = filter.search.toLowerCase();
      if (!item.productName.toLowerCase().includes(search) &&
          !item.sku?.toLowerCase().includes(search) &&
          !item.formatName.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (filter.availability && item.availability !== filter.availability) return false;
    if (filter.lowStock && item.stockQuantity > item.lowStockThreshold) return false;
    return true;
  });

  const stats = {
    total: inventory.length,
    inStock: inventory.filter(i => i.availability === 'IN_STOCK' && i.stockQuantity > i.lowStockThreshold).length,
    lowStock: inventory.filter(i => i.stockQuantity <= i.lowStockThreshold && i.stockQuantity > 0).length,
    outOfStock: inventory.filter(i => i.stockQuantity === 0).length,
    totalValue: inventory.reduce((sum, i) => sum + (i.price * i.stockQuantity), 0),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventaire</h1>
          <p className="text-gray-500">Gérez le stock de vos produits</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importer CSV
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exporter
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total produits</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">En stock</p>
          <p className="text-2xl font-bold text-green-700">{stats.inStock}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">Stock bas</p>
          <p className="text-2xl font-bold text-yellow-700">{stats.lowStock}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">Rupture</p>
          <p className="text-2xl font-bold text-red-700">{stats.outOfStock}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Valeur stock</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalValue.toFixed(0)} $</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="text"
            placeholder="Rechercher (produit, SKU)..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500"
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          />
          <select
            className="px-4 py-2 border border-gray-300 rounded-lg"
            value={filter.availability}
            onChange={(e) => setFilter({ ...filter, availability: e.target.value })}
          >
            <option value="">Tous les statuts</option>
            <option value="IN_STOCK">En stock</option>
            <option value="OUT_OF_STOCK">Rupture</option>
            <option value="DISCONTINUED">Discontinué</option>
            <option value="COMING_SOON">Bientôt disponible</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.lowStock}
              onChange={(e) => setFilter({ ...filter, lowStock: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-sm text-gray-700">Stock bas uniquement</span>
          </label>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Produit</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">SKU</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Prix</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Seuil</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredInventory.map((item) => {
              const isLowStock = item.stockQuantity <= item.lowStockThreshold && item.stockQuantity > 0;
              return (
                <tr key={item.id} className={`hover:bg-gray-50 ${isLowStock ? 'bg-yellow-50' : ''}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/produits/${item.productId}`} className="hover:text-amber-600">
                      <p className="font-semibold text-gray-900">{item.productName}</p>
                      <p className="text-xs text-gray-500">{item.formatName}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {item.sku || '-'}
                    </code>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.price.toFixed(2)} $
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === item.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-center"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <span className={`text-lg font-bold ${
                        item.stockQuantity === 0 ? 'text-red-600' :
                        isLowStock ? 'text-yellow-600' : 'text-gray-900'
                      }`}>
                        {item.stockQuantity}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-500">
                    {item.lowStockThreshold}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      isLowStock ? 'bg-yellow-100 text-yellow-800' : availabilityColors[item.availability]
                    }`}>
                      {isLowStock ? 'STOCK BAS' : item.availability.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {editingId === item.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            if (adjustmentReason) {
                              updateStock(item.id, editValue, adjustmentReason);
                            }
                          }}
                          disabled={!adjustmentReason}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 disabled:opacity-50"
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingId(item.id);
                            setEditValue(item.stockQuantity);
                          }}
                          className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => setShowHistory(item.id)}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                        >
                          Historique
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredInventory.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Aucun produit trouvé
          </div>
        )}
      </div>

      {/* Adjustment Reason Modal */}
      {editingId && (
        <div className="fixed bottom-4 right-4 bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-80">
          <h4 className="font-semibold text-gray-900 mb-2">Raison de l'ajustement</h4>
          <input
            type="text"
            placeholder="Ex: Réception stock, Correction inventaire..."
            value={adjustmentReason}
            onChange={(e) => setAdjustmentReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <p className="text-xs text-gray-500 mt-2">Requis pour enregistrer la modification</p>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Historique des mouvements</h3>
              <button onClick={() => setShowHistory(null)} className="p-1 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-600 font-bold">+10</span>
                  <span className="text-gray-500">Réception stock</span>
                  <span className="text-gray-400 ml-auto">il y a 2 jours</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-red-600 font-bold">-2</span>
                  <span className="text-gray-500">Commande #BC-2026-00001</span>
                  <span className="text-gray-400 ml-auto">il y a 3 jours</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-red-600 font-bold">-1</span>
                  <span className="text-gray-500">Commande #BC-2026-00002</span>
                  <span className="text-gray-400 ml-auto">il y a 5 jours</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-600 font-bold">+50</span>
                  <span className="text-gray-500">Stock initial</span>
                  <span className="text-gray-400 ml-auto">il y a 30 jours</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
