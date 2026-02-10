'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

// TODO: Replace with real API fetch
const mockSalesData: { code: string; country: string; flag: string; orders: number; revenue: number; taxCollected: number; avgOrder: number; growth: number }[] = [];

// TODO: Replace with real API fetch
const mockMonthlyTrend: { month: string; orders: number; revenue: number }[] = [];

// TODO: Replace with real API fetch
const mockRecentOrders: { id: string; date: string; country: string; customer: string; total: number; status: string }[] = [];

export default function GlobalReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [sortBy, setSortBy] = useState<'revenue' | 'orders' | 'growth'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Calculate totals
  const totals = useMemo(() => {
    const totalOrders = mockSalesData.reduce((sum, c) => sum + c.orders, 0);
    const totalRevenue = mockSalesData.reduce((sum, c) => sum + c.revenue, 0);
    const totalTax = mockSalesData.reduce((sum, c) => sum + c.taxCollected, 0);
    const avgGrowth = mockSalesData.length > 0 ? mockSalesData.reduce((sum, c) => sum + c.growth, 0) / mockSalesData.length : 0;
    return { totalOrders, totalRevenue, totalTax, avgGrowth };
  }, []);
  
  // Sort countries
  const sortedCountries = useMemo(() => {
    return [...mockSalesData].sort((a, b) => {
      const multiplier = sortOrder === 'desc' ? -1 : 1;
      return multiplier * (a[sortBy] - b[sortBy]);
    });
  }, [sortBy, sortOrder]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/admin/fiscal" className="text-gray-500 hover:text-gray-700">
              ← Obligations Fiscales
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Rapport Global des Ventes
              </h1>
              <p className="text-gray-600 mt-1">
                Vue consolidée de toutes les ventes par pays
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                Exporter Excel
              </button>
              <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                Imprimer PDF
              </button>
            </div>
          </div>
        </div>
        
        {/* Period Selector */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-600">Période:</span>
            {[
              { value: '1month', label: '1 mois' },
              { value: '3months', label: '3 mois' },
              { value: '6months', label: '6 mois' },
              { value: '1year', label: '1 an' },
              { value: 'all', label: 'Tout' },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => setSelectedPeriod(period.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPeriod === period.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Global Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-blue-100 text-sm">Commandes totales</div>
            <div className="text-4xl font-bold mt-1">{totals.totalOrders.toLocaleString()}</div>
            <div className="text-blue-200 text-sm mt-2">Tous pays confondus</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-green-100 text-sm">Revenus totaux</div>
            <div className="text-4xl font-bold mt-1">${(totals.totalRevenue / 1000).toFixed(0)}K</div>
            <div className="text-green-200 text-sm mt-2">CAD</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-orange-100 text-sm">Taxes perçues</div>
            <div className="text-4xl font-bold mt-1">${(totals.totalTax / 1000).toFixed(0)}K</div>
            <div className="text-orange-200 text-sm mt-2">À remettre</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm p-6 text-white">
            <div className="text-purple-100 text-sm">Croissance moyenne</div>
            <div className="text-4xl font-bold mt-1">+{totals.avgGrowth.toFixed(1)}%</div>
            <div className="text-purple-200 text-sm mt-2">vs période précédente</div>
          </div>
        </div>
        
        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Sales by Country */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Ventes par pays</h2>
                <div className="flex gap-2">
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1"
                  >
                    <option value="revenue">Par revenus</option>
                    <option value="orders">Par commandes</option>
                    <option value="growth">Par croissance</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1"
                  >
                    {sortOrder === 'desc' ? '↓' : '↑'}
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Pays</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Commandes</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Revenus</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Taxes</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Croissance</th>
                    <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCountries.map((country) => (
                    <tr key={country.code} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{country.flag}</span>
                          <span className="font-medium">{country.country}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-medium">{country.orders.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        ${country.revenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-orange-600">
                        ${country.taxCollected.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-medium ${country.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {country.growth >= 0 ? '+' : ''}{country.growth}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link 
                          href={`/admin/fiscal/country/${country.code}`}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Détails →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 font-bold">
                    <td className="py-3 px-4">TOTAL</td>
                    <td className="py-3 px-4 text-right">{totals.totalOrders.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-green-600">${totals.totalRevenue.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-orange-600">${totals.totalTax.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-green-600">+{totals.avgGrowth.toFixed(1)}%</td>
                    <td className="py-3 px-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          {/* Revenue Distribution Pie Chart (simplified) */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Distribution des revenus</h2>
            <div className="space-y-3">
              {sortedCountries.length === 0 ? (
                <div className="text-sm text-gray-500">Aucune donnée disponible</div>
              ) : (
                <>
                  {sortedCountries.slice(0, 6).map((country) => {
                    const percentage = totals.totalRevenue > 0 ? (country.revenue / totals.totalRevenue * 100).toFixed(1) : '0.0';
                    return (
                      <div key={country.code}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="flex items-center gap-2">
                            <span>{country.flag}</span>
                            <span>{country.country}</span>
                          </span>
                          <span className="font-medium">{percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {sortedCountries.length > 6 && (
                    <div className="pt-2 border-t border-gray-100 text-sm text-gray-500">
                      + {sortedCountries.length - 6} autres pays
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Monthly Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Évolution mensuelle</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Mois</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Commandes</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Revenus</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Moyenne/commande</th>
                  <th className="py-3 px-4 text-sm font-medium text-gray-500">Tendance</th>
                </tr>
              </thead>
              <tbody>
                {mockMonthlyTrend.map((month, index) => {
                  const prevRevenue = index > 0 ? mockMonthlyTrend[index - 1].revenue : month.revenue;
                  const change = ((month.revenue - prevRevenue) / prevRevenue * 100).toFixed(1);
                  return (
                    <tr key={month.month} className="border-b border-gray-50">
                      <td className="py-3 px-4 font-medium">{month.month}</td>
                      <td className="py-3 px-4 text-right">{month.orders}</td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        ${month.revenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        ${(month.revenue / month.orders).toFixed(2)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-grow bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${(month.revenue / 180000) * 100}%` }}
                            />
                          </div>
                          <span className={`text-xs font-medium ${parseFloat(change) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {parseFloat(change) >= 0 ? '+' : ''}{change}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Commandes récentes (tous pays)</h2>
              <Link href="/admin" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                Voir toutes →
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">N° Commande</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Pays</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody>
                {mockRecentOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-blue-600">{order.id}</td>
                    <td className="py-3 px-4 text-gray-600">{order.date}</td>
                    <td className="py-3 px-4">
                      <span className="text-lg">{getCountryFlag(order.country)}</span>
                    </td>
                    <td className="py-3 px-4">{order.customer}</td>
                    <td className="py-3 px-4 text-right font-medium">${order.total.toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status === 'delivered' ? 'Livré' :
                         order.status === 'shipped' ? 'Expédié' : 'En traitement'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function
function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    CA: '🇨🇦', US: '🇺🇸', GB: '🇬🇧', FR: '🇫🇷', DE: '🇩🇪', 
    JP: '🇯🇵', AU: '🇦🇺', AE: '🇦🇪', IL: '🇮🇱', CL: '🇨🇱', PE: '🇵🇪',
  };
  return flags[code] || '🌍';
}
