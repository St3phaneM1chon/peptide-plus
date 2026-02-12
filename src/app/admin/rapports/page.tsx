'use client';

import { useState, useEffect } from 'react';
import {
  DollarSign,
  ShoppingCart,
  ShoppingBag,
  TrendingUp,
  FileDown,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  Button,
  SelectFilter,
} from '@/components/admin';

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports"
        subtitle="Analysez vos ventes et performances"
        actions={
          <div className="flex gap-2">
            <SelectFilter
              label="Période"
              value={period}
              onChange={(v) => setPeriod(v as '7d' | '30d' | '90d' | '1y')}
              options={[
                { value: '7d', label: '7 derniers jours' },
                { value: '30d', label: '30 derniers jours' },
                { value: '90d', label: '90 derniers jours' },
                { value: '1y', label: '12 derniers mois' },
              ]}
            />
            <Button variant="secondary" icon={FileDown}>
              Exporter PDF
            </Button>
          </div>
        }
      />

      {/* Main Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Revenu total"
          value={`${totalRevenue.toLocaleString()} $`}
          icon={DollarSign}
          trend={{ value: 12.5, label: 'vs période précédente' }}
        />
        <StatCard
          label="Commandes"
          value={totalOrders}
          icon={ShoppingCart}
          trend={{ value: 8.3, label: 'vs période précédente' }}
        />
        <StatCard
          label="Panier moyen"
          value={`${avgOrderValue.toFixed(2)} $`}
          icon={ShoppingBag}
          trend={{ value: 3.2, label: 'vs période précédente' }}
        />
        <StatCard
          label="Taux de conversion"
          value="3.8%"
          icon={TrendingUp}
          trend={{ value: -0.5, label: 'vs période précédente' }}
        />
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Revenus quotidiens</h3>
        <div className="h-64 flex items-end gap-1">
          {salesData.slice(-30).map((day) => (
            <div
              key={day.date}
              className="flex-1 bg-sky-500 rounded-t hover:bg-sky-600 cursor-pointer transition-colors relative group"
              style={{ height: `${(day.revenue / maxRevenue) * 100}%` }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                {day.date}<br/>
                {day.revenue.toLocaleString()} $<br/>
                {day.orders} commandes
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-slate-400 mt-2">
          <span>{salesData[salesData.length - 30]?.date}</span>
          <span>{salesData[salesData.length - 1]?.date}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Produits les plus vendus</h3>
          <div className="space-y-4">
            {topProducts.map((product, i) => (
              <div key={product.name} className="flex items-center gap-4">
                <span className="w-6 h-6 bg-sky-100 text-sky-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{product.name}</p>
                  <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                    <div
                      className="bg-sky-500 h-2 rounded-full"
                      style={{ width: `${topProducts[0]?.sales ? (product.sales / topProducts[0].sales) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{product.revenue.toLocaleString()} $</p>
                  <p className="text-xs text-slate-500">{product.sales} ventes</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* By Region */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Ventes par région</h3>
          <div className="space-y-4">
            {regionData.map((region) => (
              <div key={region.region} className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{region.region}</p>
                  <div className="w-full bg-slate-100 rounded-full h-2 mt-1">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${regionData[0]?.revenue ? (region.revenue / regionData[0].revenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-900">{region.revenue.toLocaleString()} $</p>
                  <p className="text-xs text-slate-500">{region.orders} commandes</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-3">Sources de trafic</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Recherche organique</span>
              <span className="font-medium">45%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Direct</span>
              <span className="font-medium">28%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Réseaux sociaux</span>
              <span className="font-medium">15%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Email</span>
              <span className="font-medium">12%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-3">Appareils</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Mobile</span>
              <span className="font-medium">62%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Desktop</span>
              <span className="font-medium">33%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Tablette</span>
              <span className="font-medium">5%</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h4 className="font-semibold text-slate-900 mb-3">Méthodes de paiement</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Carte de crédit</span>
              <span className="font-medium">78%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">PayPal</span>
              <span className="font-medium">15%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Apple Pay</span>
              <span className="font-medium">7%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
