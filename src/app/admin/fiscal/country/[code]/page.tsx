'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { getCountryCompliance, type CountryCompliance, type AnnualTask } from '@/lib/countryObligations';

// TODO: Replace with real API fetch from database
const mockOrders: { id: string; date: string; customer: string; total: number; status: string; taxCollected: number }[] = [];

// TODO: Replace with real API fetch from database
const mockMonthlySummary: { month: string; orders: number; revenue: number; taxCollected: number; avgOrder: number }[] = [];

export default function CountryDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const countryCode = resolvedParams.code.toUpperCase();
  const country = getCountryCompliance(countryCode);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'obligations' | 'tasks' | 'orders' | 'reports'>('overview');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedMonth, _setSelectedMonth] = useState('Jan 2026');
  
  // Calculate totals - must be before conditional return to respect hooks rules
  const totals = useMemo(() => {
    const totalRevenue = mockMonthlySummary.reduce((sum, m) => sum + m.revenue, 0);
    const totalTax = mockMonthlySummary.reduce((sum, m) => sum + m.taxCollected, 0);
    const totalOrders = mockMonthlySummary.reduce((sum, m) => sum + m.orders, 0);
    return { totalRevenue, totalTax, totalOrders };
  }, []);
  
  if (!country) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Pays non trouvé</h1>
          <p className="text-gray-600 mb-6">Le code pays "{countryCode}" n'est pas configuré.</p>
          <Link href="/admin/fiscal" className="text-blue-600 hover:underline">
            ← Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-4">
            <span className="text-4xl">{getCountryFlag(country.code)}</span>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {country.name}
              </h1>
              <p className="text-gray-600">
                {country.region} {country.hasFTA && `• ${country.ftaName}`}
              </p>
            </div>
            {country.hasFTA && (
              <span className="ml-auto px-4 py-2 bg-green-100 text-green-700 font-medium rounded-lg">
                ✓ Accord de libre-échange
              </span>
            )}
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-blue-600">{totals.totalOrders}</div>
            <div className="text-sm text-gray-600">Commandes totales</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-green-600">${totals.totalRevenue.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Revenus {country.localCurrency}</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-orange-600">${totals.totalTax.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Taxes perçues</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="text-3xl font-bold text-purple-600">{country.shippingDays} j</div>
            <div className="text-sm text-gray-600">Délai livraison</div>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'overview', label: 'Vue d\'ensemble' },
                { id: 'obligations', label: 'Obligations fiscales' },
                { id: 'tasks', label: 'Tâches & Échéances' },
                { id: 'orders', label: 'Commandes' },
                { id: 'reports', label: 'Rapports' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          
          <div className="p-6">
            {activeTab === 'overview' && (
              <OverviewTab country={country} />
            )}
            {activeTab === 'obligations' && (
              <ObligationsTab country={country} />
            )}
            {activeTab === 'tasks' && (
              <TasksTab country={country} />
            )}
            {activeTab === 'orders' && (
              <OrdersTab country={country} orders={mockOrders} />
            )}
            {activeTab === 'reports' && (
              <ReportsTab country={country} monthlyData={mockMonthlySummary} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({ country }: { country: CountryCompliance }) {
  return (
    <div className="space-y-6">
      {/* Canadian Export Obligations */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          Obligations d'exportation canadiennes
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-500">Taxes canadiennes</div>
            <div className={`font-bold ${country.canadianObligations.zeroRated ? 'text-green-600' : 'text-orange-600'}`}>
              {country.canadianObligations.zeroRated ? '0% (Détaxé)' : 'Taxable'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-500">Déclaration SCDE</div>
            <div className={`font-bold ${country.canadianObligations.cersRequired ? 'text-purple-600' : 'text-gray-600'}`}>
              {country.canadianObligations.cersRequired ? `Requis (>${country.canadianObligations.cersThreshold}$)` : 'Non requis'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-500">Certificat d'origine</div>
            <div className={`font-bold ${country.canadianObligations.certificateOfOrigin ? 'text-green-600' : 'text-gray-600'}`}>
              {country.canadianObligations.certificateOfOrigin ? 'Requis' : 'Non requis'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-gray-500">Permis d'exportation</div>
            <div className={`font-bold ${country.canadianObligations.exportPermit ? 'text-red-600' : 'text-gray-600'}`}>
              {country.canadianObligations.exportPermit ? 'Requis' : 'Non requis'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Shipping Info */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Informations de livraison
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-500">Délai estimé</div>
            <div className="font-bold">{country.shippingDays} jours ouvrables</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Frais de base</div>
            <div className="font-bold">${country.shippingCost} CAD</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Devise locale</div>
            <div className="font-bold">{country.localCurrencySymbol} {country.localCurrency}</div>
          </div>
        </div>
      </div>
      
      {/* Notes */}
      <div className="bg-yellow-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-yellow-900 mb-4">
          Notes importantes
        </h3>
        <ul className="space-y-2">
          {country.notes.map((note, index) => (
            <li key={index} className="flex items-start gap-2 text-sm text-yellow-800">
              <span className="text-yellow-600">•</span>
              {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Obligations Tab Component
function ObligationsTab({ country }: { country: CountryCompliance }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">
        Obligations fiscales pour {country.name}
      </h3>
      
      {country.destinationObligations.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Aucune obligation fiscale spécifique configurée pour ce pays
        </div>
      ) : (
        <div className="space-y-4">
          {country.destinationObligations.map((obligation, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{obligation.name}</h4>
                  <p className="text-sm text-gray-500">{obligation.nameFr}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  obligation.required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {obligation.required ? 'Obligatoire' : 'Optionnel'}
                </span>
              </div>
              
              <p className="text-gray-700 mb-4">{obligation.description}</p>
              
              <div className="grid grid-cols-3 gap-4 text-sm">
                {obligation.rate && (
                  <div>
                    <span className="text-gray-500">Taux:</span>
                    <span className="ml-2 font-medium">{obligation.rate}</span>
                  </div>
                )}
                {obligation.threshold && (
                  <div>
                    <span className="text-gray-500">Seuil:</span>
                    <span className="ml-2 font-medium">{obligation.threshold}</span>
                  </div>
                )}
                {obligation.frequency && (
                  <div>
                    <span className="text-gray-500">Fréquence:</span>
                    <span className="ml-2 font-medium capitalize">{obligation.frequency}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Tasks Tab Component
function TasksTab({ country }: { country: CountryCompliance }) {
  const [tasks, setTasks] = useState<(AnnualTask & { status: string })[]>(
    country.annualTasks.map(t => ({ ...t, status: t.status || 'pending' }))
  );
  
  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' }
        : t
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Tâches et échéances
        </h3>
        <div className="text-sm text-gray-500">
          {tasks.filter(t => t.status === 'completed').length}/{tasks.length} complétées
        </div>
      </div>
      
      {tasks.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Aucune tâche récurrente configurée pour ce pays
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div 
              key={task.id} 
              className={`rounded-lg p-4 border ${
                task.status === 'completed' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    task.status === 'completed'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-green-500'
                  }`}
                >
                  {task.status === 'completed' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                
                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold ${task.status === 'completed' ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                      {task.name}
                    </h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      task.frequency === 'monthly' ? 'bg-blue-100 text-blue-700' :
                      task.frequency === 'quarterly' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {task.frequency === 'monthly' ? 'Mensuel' :
                       task.frequency === 'quarterly' ? 'Trimestriel' :
                       task.frequency === 'annually' ? 'Annuel' : 'Unique'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>📅 Échéance: {task.dueDate}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Orders Tab Component
function OrdersTab({ country, orders }: { country: CountryCompliance; orders: typeof mockOrders }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Commandes récentes - {country.name}
        </h3>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
          Exporter CSV
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">N° Commande</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Client</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Total</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Taxes</th>
              <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Statut</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium text-blue-600">{order.id}</td>
                <td className="py-3 px-4 text-gray-600">{order.date}</td>
                <td className="py-3 px-4 text-gray-900">{order.customer}</td>
                <td className="py-3 px-4 text-right font-medium">${order.total.toFixed(2)}</td>
                <td className="py-3 px-4 text-right text-gray-600">${order.taxCollected.toFixed(2)}</td>
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
  );
}

// Reports Tab Component
function ReportsTab({ country, monthlyData }: { country: CountryCompliance; monthlyData: typeof mockMonthlySummary }) {
  const totals = {
    orders: monthlyData.reduce((sum, m) => sum + m.orders, 0),
    revenue: monthlyData.reduce((sum, m) => sum + m.revenue, 0),
    tax: monthlyData.reduce((sum, m) => sum + m.taxCollected, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Rapports mensuels - {country.name}
        </h3>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm">
            Exporter Excel
          </button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">
            Imprimer PDF
          </button>
        </div>
      </div>
      
      {/* Monthly Summary Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Mois</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Commandes</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Revenus</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Taxes perçues</th>
              <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Panier moyen</th>
            </tr>
          </thead>
          <tbody>
            {monthlyData.map((month) => (
              <tr key={month.month} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{month.month}</td>
                <td className="py-3 px-4 text-right">{month.orders}</td>
                <td className="py-3 px-4 text-right font-medium text-green-600">${month.revenue.toLocaleString()}</td>
                <td className="py-3 px-4 text-right text-orange-600">${month.taxCollected.toLocaleString()}</td>
                <td className="py-3 px-4 text-right">${month.avgOrder.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold">
              <td className="py-3 px-4">TOTAL</td>
              <td className="py-3 px-4 text-right">{totals.orders}</td>
              <td className="py-3 px-4 text-right text-green-600">${totals.revenue.toLocaleString()}</td>
              <td className="py-3 px-4 text-right text-orange-600">${totals.tax.toLocaleString()}</td>
              <td className="py-3 px-4 text-right">${totals.orders > 0 ? (totals.revenue / totals.orders).toFixed(2) : '0.00'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      {/* Tax Remittance Summary */}
      <div className="bg-orange-50 rounded-lg p-6 border border-orange-200">
        <h4 className="font-semibold text-orange-900 mb-4">Résumé des taxes à remettre</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-orange-600">Taxes perçues (6 mois)</div>
            <div className="text-2xl font-bold text-orange-900">${totals.tax.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-orange-600">Devise</div>
            <div className="text-2xl font-bold text-orange-900">{country.localCurrency}</div>
          </div>
          <div>
            <div className="text-sm text-orange-600">Prochaine échéance</div>
            <div className="text-2xl font-bold text-orange-900">31 Jan 2026</div>
          </div>
          <div>
            <div className="text-sm text-orange-600">Statut</div>
            <div className="text-lg font-bold text-green-600">À jour</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get country flag emoji
function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    CA: '🇨🇦',
    US: '🇺🇸',
    EU: '🇪🇺',
    GB: '🇬🇧',
    JP: '🇯🇵',
    AU: '🇦🇺',
    AE: '🇦🇪',
    IL: '🇮🇱',
    CL: '🇨🇱',
    PE: '🇵🇪',
    FR: '🇫🇷',
    DE: '🇩🇪',
    MX: '🇲🇽',
  };
  return flags[code] || '🌍';
}
