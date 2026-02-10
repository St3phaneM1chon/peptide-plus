'use client';

import { useState, useEffect } from 'react';

interface SalesData {
  date: string;
  revenue: number;
  orders: number;
  avgOrderValue: number;
}

interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
}

interface RegionData {
  region: string;
  orders: number;
  revenue: number;
}

export default function RapportsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [loading, setLoading] = useState(true);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [regionData, setRegionData] = useState<RegionData[]>([]);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    // TODO: Replace with real API fetch
    setSalesData([]);
    setTopProducts([]);
    setRegionData([]);
    setLoading(false);
  };

  const totalRevenue = salesData.reduce((sum, d) => sum + d.revenue, 0);
  const totalOrders = salesData.reduce((sum, d) => sum + d.orders, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const maxRevenue = salesData.length > 0 ? Math.max(...salesData.map(d => d.revenue)) : 0;

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
          <h1 className="text-2xl font-bold text-gray-900">Rapports</h1>
          <p className="text-gray-500">Analysez vos ventes et performances</p>
        </div>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option value="7d">7 derniers jours</option>
            <option value="30d">30 derniers jours</option>
            <option value="90d">90 derniers jours</option>
            <option value="1y">12 derniers mois</option>
          </select>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Exporter PDF
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Revenu total</p>
          <p className="text-3xl font-bold text-gray-900">{totalRevenue.toLocaleString()} $</p>
          <p className="text-sm text-green-600 mt-1">+12.5% vs période précédente</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Commandes</p>
          <p className="text-3xl font-bold text-gray-900">{totalOrders}</p>
          <p className="text-sm text-green-600 mt-1">+8.3% vs période précédente</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Panier moyen</p>
          <p className="text-3xl font-bold text-gray-900">{avgOrderValue.toFixed(2)} $</p>
          <p className="text-sm text-green-600 mt-1">+3.2% vs période précédente</p>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">Taux de conversion</p>
          <p className="text-3xl font-bold text-gray-900">3.8%</p>
          <p className="text-sm text-red-600 mt-1">-0.5% vs période précédente</p>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Revenus quotidiens</h3>
        <div className="h-64 flex items-end gap-1">
          {salesData.slice(-30).map((day) => (
            <div
              key={day.date}
              className="flex-1 bg-amber-500 rounded-t hover:bg-amber-600 cursor-pointer transition-colors relative group"
              style={{ height: `${(day.revenue / maxRevenue) * 100}%` }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                {day.date}<br/>
                {day.revenue.toLocaleString()} $<br/>
                {day.orders} commandes
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>{salesData[salesData.length - 30]?.date}</span>
          <span>{salesData[salesData.length - 1]?.date}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Produits les plus vendus</h3>
          <div className="space-y-4">
            {topProducts.map((product, i) => (
              <div key={product.name} className="flex items-center gap-4">
                <span className="w-6 h-6 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{product.name}</p>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: `${topProducts[0]?.sales ? (product.sales / topProducts[0].sales) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{product.revenue.toLocaleString()} $</p>
                  <p className="text-xs text-gray-500">{product.sales} ventes</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Region */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Ventes par région</h3>
          <div className="space-y-4">
            {regionData.map((region) => (
              <div key={region.region} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{region.region}</p>
                  <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${regionData[0]?.revenue ? (region.revenue / regionData[0].revenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{region.revenue.toLocaleString()} $</p>
                  <p className="text-xs text-gray-500">{region.orders} commandes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-3">Sources de trafic</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Recherche organique</span>
              <span className="font-medium">45%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Direct</span>
              <span className="font-medium">28%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Réseaux sociaux</span>
              <span className="font-medium">15%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email</span>
              <span className="font-medium">12%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-3">Appareils</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Mobile</span>
              <span className="font-medium">62%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Desktop</span>
              <span className="font-medium">33%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tablette</span>
              <span className="font-medium">5%</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-3">Méthodes de paiement</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Carte de crédit</span>
              <span className="font-medium">78%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">PayPal</span>
              <span className="font-medium">15%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Apple Pay</span>
              <span className="font-medium">7%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
