'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { Check, ShoppingCart, DollarSign, Receipt, Truck, FileSpreadsheet, Printer, Calendar, ClipboardList } from 'lucide-react';
import { getCountryCompliance, type CountryCompliance, type AnnualTask } from '@/lib/countryObligations';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  Button,
  DataTable,
  EmptyState,
  type Column,
} from '@/components/admin';

type OrderItem = { id: string; date: string; customer: string; total: number; status: string; taxCollected: number };
type MonthlySummaryItem = { month: string; orders: number; revenue: number; taxCollected: number; avgOrder: number };

export default function CountryDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = use(params);
  const countryCode = resolvedParams.code.toUpperCase();
  const country = getCountryCompliance(countryCode);

  const [activeTab, setActiveTab] = useState<'overview' | 'obligations' | 'tasks' | 'orders' | 'reports'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummaryItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch tax reports for this region/country code
        const reportsRes = await fetch(`/api/accounting/tax-reports?regionCode=${countryCode}`);
        if (reportsRes.ok) {
          const data = await reportsRes.json();
          const reports = data.reports || [];

          // Build monthly summary from reports
          const monthMap = new Map<string, { orders: number; revenue: number; taxCollected: number }>();
          for (const r of reports) {
            if (r.periodType === 'MONTHLY' && r.month) {
              const monthKey = `${r.year}-${String(r.month).padStart(2, '0')}`;
              const existing = monthMap.get(monthKey) || { orders: 0, revenue: 0, taxCollected: 0 };
              existing.orders += r.salesCount || 0;
              existing.revenue += r.totalSales || 0;
              existing.taxCollected += (r.tpsCollected || 0) + (r.tvqCollected || 0) + (r.tvhCollected || 0) + (r.otherTaxCollected || 0);
              monthMap.set(monthKey, existing);
            }
          }

          const builtMonthly: MonthlySummaryItem[] = Array.from(monthMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, data]) => ({
              month,
              orders: data.orders,
              revenue: Math.round(data.revenue),
              taxCollected: Math.round(data.taxCollected),
              avgOrder: data.orders > 0 ? Math.round(data.revenue / data.orders * 100) / 100 : 0,
            }));
          setMonthlySummary(builtMonthly);
        }

        // Orders are not available via a dedicated country-specific API, keep empty
        setOrders([]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [countryCode]);

  // Calculate totals - must be before conditional return to respect hooks rules
  const totals = useMemo(() => {
    const totalRevenue = monthlySummary.reduce((sum, m) => sum + m.revenue, 0);
    const totalTax = monthlySummary.reduce((sum, m) => sum + m.taxCollected, 0);
    const totalOrders = monthlySummary.reduce((sum, m) => sum + m.orders, 0);
    return { totalRevenue, totalTax, totalOrders };
  }, [monthlySummary]);

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Erreur: {error}</div>;

  if (!country) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Pays non trouve</h1>
          <p className="text-slate-600 mb-6">Le code pays &quot;{countryCode}&quot; n&apos;est pas configure.</p>
          <Link href="/admin/fiscal" className="text-blue-600 hover:underline">
            &larr; Retour a la liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <PageHeader
        title={country.name}
        subtitle={`${country.region}${country.hasFTA ? ` \u2022 ${country.ftaName}` : ''}`}
        backHref="/admin/fiscal"
        backLabel="Obligations Fiscales"
        badge={
          <>
            <span className="text-4xl">{getCountryFlag(country.code)}</span>
            {country.hasFTA && (
              <StatusBadge variant="success">
                Accord de libre-echange
              </StatusBadge>
            )}
          </>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Commandes totales"
          value={totals.totalOrders}
          icon={ShoppingCart}
        />
        <StatCard
          label={`Revenus ${country.localCurrency}`}
          value={`$${totals.totalRevenue.toLocaleString()}`}
          icon={DollarSign}
        />
        <StatCard
          label="Taxes percues"
          value={`$${totals.totalTax.toLocaleString()}`}
          icon={Receipt}
        />
        <StatCard
          label="Delai livraison"
          value={`${country.shippingDays} j`}
          icon={Truck}
        />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="border-b border-slate-200">
          <nav className="flex -mb-px">
            {[
              { id: 'overview', label: 'Vue d\'ensemble' },
              { id: 'obligations', label: 'Obligations fiscales' },
              { id: 'tasks', label: 'Taches & Echeances' },
              { id: 'orders', label: 'Commandes' },
              { id: 'reports', label: 'Rapports' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
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
            <OrdersTab country={country} orders={orders} />
          )}
          {activeTab === 'reports' && (
            <ReportsTab country={country} monthlyData={monthlySummary} />
          )}
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
          Obligations d&apos;exportation canadiennes
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-slate-500">Taxes canadiennes</div>
            <div className={`font-bold ${country.canadianObligations.zeroRated ? 'text-green-600' : 'text-sky-600'}`}>
              {country.canadianObligations.zeroRated ? '0% (Detaxe)' : 'Taxable'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-slate-500">Declaration SCDE</div>
            <div className={`font-bold ${country.canadianObligations.cersRequired ? 'text-purple-600' : 'text-slate-600'}`}>
              {country.canadianObligations.cersRequired ? `Requis (>${country.canadianObligations.cersThreshold}$)` : 'Non requis'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-slate-500">Certificat d&apos;origine</div>
            <div className={`font-bold ${country.canadianObligations.certificateOfOrigin ? 'text-green-600' : 'text-slate-600'}`}>
              {country.canadianObligations.certificateOfOrigin ? 'Requis' : 'Non requis'}
            </div>
          </div>
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm text-slate-500">Permis d&apos;exportation</div>
            <div className={`font-bold ${country.canadianObligations.exportPermit ? 'text-red-600' : 'text-slate-600'}`}>
              {country.canadianObligations.exportPermit ? 'Requis' : 'Non requis'}
            </div>
          </div>
        </div>
      </div>

      {/* Shipping Info */}
      <div className="bg-slate-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Informations de livraison
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-slate-500">Delai estime</div>
            <div className="font-bold">{country.shippingDays} jours ouvrables</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Frais de base</div>
            <div className="font-bold">${country.shippingCost} CAD</div>
          </div>
          <div>
            <div className="text-sm text-slate-500">Devise locale</div>
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
              <span className="text-yellow-600">&bull;</span>
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
      <h3 className="text-lg font-semibold text-slate-900">
        Obligations fiscales pour {country.name}
      </h3>

      {country.destinationObligations.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune obligation fiscale"
          description="Aucune obligation fiscale specifique configuree pour ce pays"
        />
      ) : (
        <div className="space-y-4">
          {country.destinationObligations.map((obligation, index) => (
            <div key={index} className="bg-slate-50 rounded-lg p-6 border border-slate-200">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-slate-900">{obligation.name}</h4>
                  <p className="text-sm text-slate-500">{obligation.nameFr}</p>
                </div>
                <StatusBadge variant={obligation.required ? 'error' : 'neutral'}>
                  {obligation.required ? 'Obligatoire' : 'Optionnel'}
                </StatusBadge>
              </div>

              <p className="text-slate-700 mb-4">{obligation.description}</p>

              <div className="grid grid-cols-3 gap-4 text-sm">
                {obligation.rate && (
                  <div>
                    <span className="text-slate-500">Taux:</span>
                    <span className="ml-2 font-medium">{obligation.rate}</span>
                  </div>
                )}
                {obligation.threshold && (
                  <div>
                    <span className="text-slate-500">Seuil:</span>
                    <span className="ml-2 font-medium">{obligation.threshold}</span>
                  </div>
                )}
                {obligation.frequency && (
                  <div>
                    <span className="text-slate-500">Frequence:</span>
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
        <h3 className="text-lg font-semibold text-slate-900">
          Taches et echeances
        </h3>
        <div className="text-sm text-slate-500">
          {tasks.filter(t => t.status === 'completed').length}/{tasks.length} completees
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Aucune tache recurrente"
          description="Aucune tache recurrente configuree pour ce pays"
        />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`rounded-lg p-4 border ${
                task.status === 'completed'
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    task.status === 'completed'
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-slate-300 hover:border-green-500'
                  }`}
                >
                  {task.status === 'completed' && (
                    <Check className="w-4 h-4" />
                  )}
                </button>

                <div className="flex-grow">
                  <div className="flex items-center justify-between">
                    <h4 className={`font-semibold ${task.status === 'completed' ? 'text-green-800 line-through' : 'text-slate-900'}`}>
                      {task.name}
                    </h4>
                    <StatusBadge variant={
                      task.frequency === 'monthly' ? 'info' :
                      task.frequency === 'quarterly' ? 'primary' :
                      'warning'
                    }>
                      {task.frequency === 'monthly' ? 'Mensuel' :
                       task.frequency === 'quarterly' ? 'Trimestriel' :
                       task.frequency === 'annually' ? 'Annuel' : 'Unique'}
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{task.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>Echeance: {task.dueDate}</span>
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
function OrdersTab({ country, orders }: { country: CountryCompliance; orders: OrderItem[] }) {
  const orderColumns: Column<OrderItem>[] = [
    {
      key: 'id',
      header: 'N Commande',
      render: (order) => <span className="font-medium text-blue-600">{order.id}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      render: (order) => <span className="text-slate-600">{order.date}</span>,
    },
    {
      key: 'customer',
      header: 'Client',
      render: (order) => <span className="text-slate-900">{order.customer}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (order) => <span className="font-medium">${order.total.toFixed(2)}</span>,
    },
    {
      key: 'taxCollected',
      header: 'Taxes',
      align: 'right',
      render: (order) => <span className="text-slate-600">${order.taxCollected.toFixed(2)}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (order) => {
        const variant = order.status === 'delivered' ? 'success' as const
          : order.status === 'shipped' ? 'info' as const
          : 'warning' as const;
        const label = order.status === 'delivered' ? 'Livre'
          : order.status === 'shipped' ? 'Expedie' : 'En traitement';
        return <StatusBadge variant={variant}>{label}</StatusBadge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Commandes recentes - {country.name}
        </h3>
        <Button variant="primary" icon={FileSpreadsheet} size="sm">
          Exporter CSV
        </Button>
      </div>

      <DataTable
        columns={orderColumns}
        data={orders}
        keyExtractor={(order) => order.id}
        emptyTitle="Aucune commande"
        emptyDescription="Aucune commande enregistree pour ce pays"
      />
    </div>
  );
}

// Reports Tab Component
function ReportsTab({ country, monthlyData }: { country: CountryCompliance; monthlyData: MonthlySummaryItem[] }) {
  const totals = {
    orders: monthlyData.reduce((sum, m) => sum + m.orders, 0),
    revenue: monthlyData.reduce((sum, m) => sum + m.revenue, 0),
    tax: monthlyData.reduce((sum, m) => sum + m.taxCollected, 0),
  };

  const monthColumns: Column<MonthlySummaryItem>[] = [
    {
      key: 'month',
      header: 'Mois',
      render: (m) => <span className="font-medium">{m.month}</span>,
    },
    {
      key: 'orders',
      header: 'Commandes',
      align: 'right',
      render: (m) => m.orders,
    },
    {
      key: 'revenue',
      header: 'Revenus',
      align: 'right',
      render: (m) => <span className="font-medium text-green-600">${m.revenue.toLocaleString()}</span>,
    },
    {
      key: 'taxCollected',
      header: 'Taxes percues',
      align: 'right',
      render: (m) => <span className="text-sky-600">${m.taxCollected.toLocaleString()}</span>,
    },
    {
      key: 'avgOrder',
      header: 'Panier moyen',
      align: 'right',
      render: (m) => `$${m.avgOrder.toFixed(2)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          Rapports mensuels - {country.name}
        </h3>
        <div className="flex gap-2">
          <Button variant="primary" icon={FileSpreadsheet} size="sm">
            Exporter Excel
          </Button>
          <Button variant="secondary" icon={Printer} size="sm">
            Imprimer PDF
          </Button>
        </div>
      </div>

      {/* Monthly Summary Table */}
      <DataTable
        columns={monthColumns}
        data={monthlyData}
        keyExtractor={(m) => m.month}
        emptyTitle="Aucune donnee"
        emptyDescription="Aucune donnee mensuelle disponible"
      />

      {/* Totals row displayed separately when data exists */}
      {monthlyData.length > 0 && (
        <div className="bg-slate-100 rounded-lg p-4 grid grid-cols-5 gap-4 text-sm font-bold">
          <div>TOTAL</div>
          <div className="text-right">{totals.orders}</div>
          <div className="text-right text-green-600">${totals.revenue.toLocaleString()}</div>
          <div className="text-right text-sky-600">${totals.tax.toLocaleString()}</div>
          <div className="text-right">${totals.orders > 0 ? (totals.revenue / totals.orders).toFixed(2) : '0.00'}</div>
        </div>
      )}

      {/* Tax Remittance Summary */}
      <div className="bg-sky-50 rounded-lg p-6 border border-sky-200">
        <h4 className="font-semibold text-sky-900 mb-4">Resume des taxes a remettre</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-sky-600">Taxes percues (6 mois)</div>
            <div className="text-2xl font-bold text-sky-900">${totals.tax.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-sky-600">Devise</div>
            <div className="text-2xl font-bold text-sky-900">{country.localCurrency}</div>
          </div>
          <div>
            <div className="text-sm text-sky-600">Prochaine echeance</div>
            <div className="text-2xl font-bold text-sky-900">31 Jan 2026</div>
          </div>
          <div>
            <div className="text-sm text-sky-600">Statut</div>
            <div className="text-lg font-bold text-green-600">A jour</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get country flag emoji
function getCountryFlag(code: string): string {
  const flags: Record<string, string> = {
    CA: '\u{1F1E8}\u{1F1E6}',
    US: '\u{1F1FA}\u{1F1F8}',
    EU: '\u{1F1EA}\u{1F1FA}',
    GB: '\u{1F1EC}\u{1F1E7}',
    JP: '\u{1F1EF}\u{1F1F5}',
    AU: '\u{1F1E6}\u{1F1FA}',
    AE: '\u{1F1E6}\u{1F1EA}',
    IL: '\u{1F1EE}\u{1F1F1}',
    CL: '\u{1F1E8}\u{1F1F1}',
    PE: '\u{1F1F5}\u{1F1EA}',
    FR: '\u{1F1EB}\u{1F1F7}',
    DE: '\u{1F1E9}\u{1F1EA}',
    MX: '\u{1F1F2}\u{1F1FD}',
  };
  return flags[code] || '\u{1F30D}';
}
