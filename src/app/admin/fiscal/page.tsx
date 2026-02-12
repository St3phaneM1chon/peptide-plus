'use client';

import { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  Calendar,
  Loader2,
  DollarSign,
  Receipt,
  FileText,
  ClipboardList,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatusBadge,
  StatCard,
  FilterBar,
  SelectFilter,
  DataTable,
  type Column,
} from '@/components/admin';

interface TaxRegion {
  id: string;
  name: string;
  code: string;
  type: 'COUNTRY' | 'STATE' | 'PROVINCE';
  taxRate: number;
  taxName: string;
  isActive: boolean;
  obligations: string[];
}

interface TaxReport {
  id: string;
  region: string;
  regionCode: string;
  period: string;
  periodType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  year: number;
  month?: number;
  quarter?: number;
  totalSales: number;
  taxableAmount: number;
  taxCollected: number;
  taxRate: number;
  orderCount: number;
  status: 'DRAFT' | 'GENERATED' | 'FILED' | 'PAID';
  generatedAt: string;
  filedAt?: string;
  paidAt?: string;
  dueDate: string;
}

type TabKey = 'reports' | 'regions' | 'tasks';

const statusVariantMap: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  DRAFT: 'neutral',
  GENERATED: 'info',
  FILED: 'warning',
  PAID: 'success',
};

const regionOptions = [
  { value: 'QC', label: 'Quebec' },
  { value: 'ON', label: 'Ontario' },
  { value: 'BC', label: 'Colombie-Britannique' },
  { value: 'AB', label: 'Alberta' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'NS', label: 'Nouvelle-Ecosse' },
  { value: 'NB', label: 'Nouveau-Brunswick' },
  { value: 'US', label: 'Etats-Unis' },
  { value: 'FR', label: 'France' },
  { value: 'GB', label: 'Royaume-Uni' },
];

const yearOptions = [
  { value: '2024', label: '2024' },
  { value: '2025', label: '2025' },
  { value: '2026', label: '2026' },
];

interface TaxSummary {
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  tpsPaid: number;
  tvqPaid: number;
  tvhPaid: number;
  netTps: number;
  netTvq: number;
  netTvh: number;
  salesCount: number;
  totalSales: number;
}

export default function FiscalPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('reports');
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TaxReport | null>(null);
  const [regions, setRegions] = useState<TaxRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);

  const fetchReports = async (year: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/accounting/tax-reports?year=${year}`);
      if (!res.ok) throw new Error('Erreur lors du chargement des rapports');
      const data = await res.json();
      const mapped: TaxReport[] = (data.reports || []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        region: r.region as string,
        regionCode: r.regionCode as string,
        period: r.period as string,
        periodType: (r.periodType as string) || 'MONTHLY',
        year: r.year as number,
        month: r.month as number | undefined,
        quarter: r.quarter as number | undefined,
        totalSales: (r.totalSales as number) || 0,
        taxableAmount: ((r.totalSales as number) || 0) * 0.95,
        taxCollected: ((r.tpsCollected as number) || 0) + ((r.tvqCollected as number) || 0) + ((r.tvhCollected as number) || 0) + ((r.otherTaxCollected as number) || 0),
        taxRate: r.regionCode === 'QC' ? 14.975 : r.regionCode === 'ON' ? 13 : r.regionCode === 'BC' ? 12 : 5,
        orderCount: (r.salesCount as number) || 0,
        status: (r.status as TaxReport['status']) || 'DRAFT',
        generatedAt: (r.createdAt as string) || new Date().toISOString(),
        filedAt: r.filedAt as string | undefined,
        paidAt: r.paidAt as string | undefined,
        dueDate: (r.dueDate as string) || new Date().toISOString(),
      }));
      setReports(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const fetchTaxSummary = async (year: number) => {
    try {
      const from = `${year}-01-01`;
      const to = `${year}-12-31`;
      const res = await fetch(`/api/accounting/tax-summary?from=${from}&to=${to}`);
      if (!res.ok) return;
      const data = await res.json();
      setTaxSummary(data);
    } catch {
      // Tax summary is supplementary, don't block on error
    }
  };

  useEffect(() => {
    fetchReports(selectedYear);
    fetchTaxSummary(selectedYear);
  }, [selectedYear]);

  const generateAllReports = async () => {
    setGenerating(true);
    try {
      const regions = ['QC', 'ON', 'BC', 'AB'];
      for (const regionCode of regions) {
        for (let month = 1; month <= 12; month++) {
          await fetch('/api/accounting/tax-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              period: `${selectedYear}-${String(month).padStart(2, '0')}`,
              periodType: 'MONTHLY',
              year: selectedYear,
              month,
              regionCode,
            }),
          });
        }
      }
      alert('Tous les rapports ont ete generes!');
      await fetchReports(selectedYear);
    } catch (err) {
      alert('Erreur lors de la generation des rapports');
    } finally {
      setGenerating(false);
    }
  };

  const markAsFiled = async (reportId: string) => {
    try {
      const res = await fetch('/api/accounting/tax-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status: 'FILED' }),
      });
      if (!res.ok) throw new Error('Erreur');
      setReports(reports.map(r =>
        r.id === reportId ? { ...r, status: 'FILED' as const, filedAt: new Date().toISOString() } : r
      ));
    } catch {
      alert('Erreur lors de la mise a jour du statut');
    }
  };

  const markAsPaid = async (reportId: string) => {
    try {
      const res = await fetch('/api/accounting/tax-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status: 'PAID', paidAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error('Erreur');
      setReports(reports.map(r =>
        r.id === reportId ? { ...r, status: 'PAID' as const, paidAt: new Date().toISOString() } : r
      ));
    } catch {
      alert('Erreur lors de la mise a jour du statut');
    }
  };

  const exportReport = (report: TaxReport, format: 'PDF' | 'CSV' | 'EXCEL') => {
    alert(`Export ${format} du rapport ${report.region} - ${report.period}`);
  };

  const filteredReports = reports.filter(r => {
    if (selectedRegion && r.regionCode !== selectedRegion) return false;
    return true;
  });

  const monthlyReports = filteredReports.filter(r => r.periodType === 'MONTHLY');
  const annualReports = filteredReports.filter(r => r.periodType === 'ANNUAL');

  const totalTaxCollected = taxSummary
    ? taxSummary.tpsCollected + taxSummary.tvqCollected + taxSummary.tvhCollected
    : monthlyReports.reduce((sum, r) => sum + r.taxCollected, 0);
  const totalSales = taxSummary
    ? taxSummary.totalSales
    : monthlyReports.reduce((sum, r) => sum + r.totalSales, 0);
  const pendingReports = reports.filter(r => r.status === 'GENERATED' || r.status === 'DRAFT').length;

  const [settings, setSettings] = useState({
    taxIncludedInPrice: false,
    displayTaxSeparately: true,
    applyTaxToShipping: true,
    taxExemptProducts: [] as string[],
  });

  const [, setSelectedRegionDetail] = useState<TaxRegion | null>(null);

  // --- Column definitions for DataTable ---

  const annualColumns: Column<TaxReport>[] = [
    {
      key: 'region',
      header: 'Region',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.region}</p>
          <p className="text-xs text-slate-500">{r.regionCode}</p>
        </div>
      ),
    },
    {
      key: 'totalSales',
      header: 'Ventes',
      align: 'right',
      render: (r) => <span className="font-medium text-slate-900">{r.totalSales.toLocaleString()} $</span>,
    },
    {
      key: 'taxableAmount',
      header: 'Montant taxable',
      align: 'right',
      render: (r) => <span className="text-slate-600">{r.taxableAmount.toLocaleString()} $</span>,
    },
    {
      key: 'taxRate',
      header: 'Taux',
      align: 'right',
      render: (r) => <span className="text-slate-600">{r.taxRate > 0 ? `${r.taxRate}%` : 'Variable'}</span>,
    },
    {
      key: 'taxCollected',
      header: 'Taxes collectees',
      align: 'right',
      render: (r) => <span className="font-bold text-green-600">{r.taxCollected.toLocaleString()} $</span>,
    },
    {
      key: 'orderCount',
      header: 'Commandes',
      align: 'center',
      render: (r) => <span className="text-slate-600">{r.orderCount}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (r) => <StatusBadge variant={statusVariantMap[r.status] || 'neutral'}>{r.status}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          <Button size="sm" variant="primary" onClick={() => setSelectedReport(r)}>
            Details
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportReport(r, 'PDF')}>
            PDF
          </Button>
        </div>
      ),
    },
  ];

  const monthlyColumns: Column<TaxReport>[] = [
    {
      key: 'region',
      header: 'Region',
      render: (r) => <p className="font-medium text-slate-900">{r.region}</p>,
    },
    {
      key: 'period',
      header: 'Periode',
      render: (r) => <span className="text-slate-600 capitalize">{r.period}</span>,
    },
    {
      key: 'totalSales',
      header: 'Ventes',
      align: 'right',
      render: (r) => <span className="font-medium text-slate-900">{r.totalSales.toLocaleString()} $</span>,
    },
    {
      key: 'taxCollected',
      header: 'Taxes',
      align: 'right',
      render: (r) => <span className="font-medium text-green-600">{r.taxCollected.toLocaleString()} $</span>,
    },
    {
      key: 'orderCount',
      header: 'Cmd',
      align: 'center',
      render: (r) => <span className="text-slate-600">{r.orderCount}</span>,
    },
    {
      key: 'dueDate',
      header: 'Echeance',
      render: (r) => <span className="text-slate-500 text-sm">{new Date(r.dueDate).toLocaleDateString('fr-CA')}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (r) => <StatusBadge variant={statusVariantMap[r.status] || 'neutral'}>{r.status}</StatusBadge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (r) => (
        <div className="flex items-center justify-center gap-1">
          {r.status === 'GENERATED' && (
            <Button size="sm" variant="outline" onClick={() => markAsFiled(r.id)}>
              Declarer
            </Button>
          )}
          {r.status === 'FILED' && (
            <Button size="sm" variant="outline" onClick={() => markAsPaid(r.id)}>
              Paye
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => exportReport(r, 'PDF')}>
            PDF
          </Button>
        </div>
      ),
    },
  ];

  const regionColumns: Column<TaxRegion>[] = [
    {
      key: 'name',
      header: 'Region',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.name}</p>
          <p className="text-xs text-slate-500">{r.code}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <span className="text-slate-600">{r.type}</span>,
    },
    {
      key: 'taxRate',
      header: 'Taux',
      align: 'right',
      render: (r) => <span className="font-medium text-slate-900">{r.taxRate > 0 ? `${r.taxRate}%` : 'Variable'}</span>,
    },
    {
      key: 'taxName',
      header: 'Nom taxe',
      render: (r) => <span className="text-slate-600">{r.taxName}</span>,
    },
    {
      key: 'isActive',
      header: 'Actif',
      align: 'center',
      render: (r) => (
        <button
          onClick={() => setRegions(regions.map(reg => reg.id === r.id ? { ...reg, isActive: !reg.isActive } : reg))}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            r.isActive ? 'bg-green-500' : 'bg-slate-300'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            r.isActive ? 'right-0.5' : 'left-0.5'
          }`} />
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (r) => (
        <Button size="sm" variant="primary" onClick={() => setSelectedRegionDetail(r)}>
          Details
        </Button>
      ),
    },
  ];

  const regionColumns2: Column<TaxRegion>[] = [
    {
      key: 'name',
      header: 'Region',
      render: (r) => (
        <div>
          <p className="font-medium text-slate-900">{r.name}</p>
          <p className="text-xs text-slate-500">{r.code}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <span className="text-slate-600">{r.type}</span>,
    },
    {
      key: 'taxRate',
      header: 'Taux',
      align: 'right',
      render: (r) => <span className="font-medium text-slate-900">{r.taxRate > 0 ? `${r.taxRate}%` : 'Variable'}</span>,
    },
    {
      key: 'taxName',
      header: 'Nom taxe',
      render: (r) => <span className="text-slate-600">{r.taxName}</span>,
    },
    {
      key: 'isActive',
      header: 'Actif',
      align: 'center',
      render: (r) => (
        <button
          onClick={() => setRegions(regions.map(reg => reg.id === r.id ? { ...reg, isActive: !reg.isActive } : reg))}
          className={`w-10 h-5 rounded-full transition-colors relative ${
            r.isActive ? 'bg-green-500' : 'bg-slate-300'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
            r.isActive ? 'right-0.5' : 'left-0.5'
          }`} />
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (r) => (
        <Button size="sm" variant="primary" onClick={() => setSelectedRegion(r.code)}>
          Voir rapports
        </Button>
      ),
    },
  ];

  // --- Tab definitions ---

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'reports', label: 'Rapports de taxes' },
    { key: 'regions', label: 'Regions fiscales' },
    { key: 'tasks', label: 'Taches & Echeances' },
  ];

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Erreur: {error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fiscal & Taxes"
        subtitle="Rapports de taxes et obligations fiscales"
        actions={
          <Button
            variant="primary"
            icon={generating ? Loader2 : FileBarChart}
            loading={generating}
            onClick={generateAllReports}
          >
            {generating ? 'Generation...' : 'Generer tous les rapports'}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label={`Ventes totales (${selectedYear})`}
          value={`${totalSales.toLocaleString()} $`}
          icon={DollarSign}
        />
        <StatCard
          label="Taxes collectees"
          value={`${totalTaxCollected.toLocaleString()} $`}
          icon={Receipt}
          className="bg-green-50 border-green-200"
        />
        <StatCard
          label="Rapports generes"
          value={reports.length}
          icon={FileText}
          className="bg-blue-50 border-blue-200"
        />
        <StatCard
          label="A declarer"
          value={pendingReports}
          icon={ClipboardList}
          className="bg-yellow-50 border-yellow-200"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'reports' && (
        <>
          {/* Filters */}
          <FilterBar
            actions={
              <div className="flex gap-2">
                <Button variant="secondary" icon={Download} onClick={() => alert('Export PDF')}>
                  Exporter tout (PDF)
                </Button>
                <Button variant="secondary" icon={Download} onClick={() => alert('Export Excel')}>
                  Exporter tout (Excel)
                </Button>
              </div>
            }
          >
            <SelectFilter
              label="Annee"
              value={String(selectedYear)}
              onChange={(v) => setSelectedYear(parseInt(v) || 2026)}
              options={yearOptions}
            />
            <SelectFilter
              label="Toutes les regions"
              value={selectedRegion}
              onChange={setSelectedRegion}
              options={regionOptions}
            />
          </FilterBar>

          {/* Annual Reports */}
          <div>
            <div className="px-4 py-3 bg-sky-50 border border-slate-200 border-b-0 rounded-t-lg flex items-center gap-2">
              <FileBarChart className="w-5 h-5 text-sky-700" />
              <h3 className="font-semibold text-sky-900">Rapports Annuels {selectedYear}</h3>
            </div>
            <DataTable
              columns={annualColumns}
              data={annualReports}
              keyExtractor={(r) => r.id}
              emptyTitle="Aucun rapport annuel"
              emptyDescription="Generez les rapports pour voir les donnees annuelles."
            />
            {annualReports.length > 0 && (
              <div className="bg-sky-50 border border-slate-200 border-t-0 rounded-b-lg px-4 py-3">
                <div className="flex items-center text-sm">
                  <span className="font-bold text-sky-900 w-[200px]">TOTAL ANNUEL</span>
                  <span className="font-bold text-sky-900 flex-1 text-right">
                    {annualReports.reduce((s, r) => s + r.totalSales, 0).toLocaleString()} $
                  </span>
                  <span className="font-bold text-sky-900 flex-1 text-right">
                    {annualReports.reduce((s, r) => s + r.taxableAmount, 0).toLocaleString()} $
                  </span>
                  <span className="flex-1" />
                  <span className="font-bold text-green-700 flex-1 text-right">
                    {annualReports.reduce((s, r) => s + r.taxCollected, 0).toLocaleString()} $
                  </span>
                  <span className="font-bold text-sky-900 flex-1 text-center">
                    {annualReports.reduce((s, r) => s + r.orderCount, 0)}
                  </span>
                  <span className="flex-1" />
                  <span className="flex-1" />
                </div>
              </div>
            )}
          </div>

          {/* Monthly Reports */}
          <div>
            <div className="px-4 py-3 bg-blue-50 border border-slate-200 border-b-0 rounded-t-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-700" />
              <h3 className="font-semibold text-blue-900">Rapports Mensuels {selectedYear}</h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <DataTable
                columns={monthlyColumns}
                data={monthlyReports.sort((a, b) => (b.month || 0) - (a.month || 0))}
                keyExtractor={(r) => r.id}
                emptyTitle="Aucun rapport mensuel"
                emptyDescription="Generez les rapports pour voir les donnees mensuelles."
              />
            </div>
          </div>
        </>
      )}

      {activeTab === 'regions' && (
        <>
          {/* Global Settings */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Parametres globaux</h3>
            <div className="space-y-4">
              <ToggleSetting
                title="Prix TTC (taxes incluses)"
                description="Afficher les prix avec taxes incluses"
                checked={settings.taxIncludedInPrice}
                onChange={() => setSettings({ ...settings, taxIncludedInPrice: !settings.taxIncludedInPrice })}
              />
              <ToggleSetting
                title="Afficher les taxes separement"
                description="Montrer le detail des taxes au checkout"
                checked={settings.displayTaxSeparately}
                onChange={() => setSettings({ ...settings, displayTaxSeparately: !settings.displayTaxSeparately })}
              />
              <ToggleSetting
                title="Taxer les frais de livraison"
                description="Appliquer les taxes sur la livraison"
                checked={settings.applyTaxToShipping}
                onChange={() => setSettings({ ...settings, applyTaxToShipping: !settings.applyTaxToShipping })}
              />
            </div>
          </div>

          {/* Tax Regions */}
          <div>
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 border-b-0 rounded-t-lg">
              <h3 className="font-semibold text-slate-900">Regions fiscales</h3>
            </div>
            <DataTable
              columns={regionColumns}
              data={regions}
              keyExtractor={(r) => r.id}
              emptyTitle="Aucune region fiscale"
              emptyDescription="Ajoutez des regions fiscales pour commencer."
            />
          </div>

          {/* Tax Regions Table (configured) */}
          <div>
            <div className="px-4 py-3 bg-slate-50 border border-slate-200 border-b-0 rounded-t-lg">
              <h3 className="font-semibold text-slate-900">Regions fiscales configurees</h3>
            </div>
            <DataTable
              columns={regionColumns2}
              data={regions}
              keyExtractor={(r) => `${r.id}-configured`}
              emptyTitle="Aucune region configuree"
              emptyDescription="Configurez des regions pour les voir ici."
            />
          </div>
        </>
      )}

      {activeTab === 'tasks' && (
        <>
          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Echeances a venir</h3>
            <div className="space-y-3">
              {reports
                .filter(r => r.status === 'GENERATED' || r.status === 'FILED')
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                .slice(0, 10)
                .map((report) => {
                  const daysUntil = Math.ceil((new Date(report.dueDate).getTime() - Date.now()) / 86400000);
                  const isUrgent = daysUntil <= 7;
                  const isPast = daysUntil < 0;
                  return (
                    <div
                      key={report.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isPast ? 'bg-red-50 border-red-200' :
                        isUrgent ? 'bg-yellow-50 border-yellow-200' :
                        'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${isPast ? 'text-red-800' : isUrgent ? 'text-yellow-800' : 'text-slate-800'}`}>
                          {report.region} - {report.period}
                        </p>
                        <p className={`text-sm ${isPast ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-slate-600'}`}>
                          Echeance: {new Date(report.dueDate).toLocaleDateString('fr-CA')}
                          {isPast && ' (EN RETARD)'}
                          {!isPast && isUrgent && ` (${daysUntil} jours)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge variant={statusVariantMap[report.status] || 'neutral'}>
                          {report.status}
                        </StatusBadge>
                        {report.status === 'GENERATED' && (
                          <Button size="sm" variant="outline" onClick={() => markAsFiled(report.id)}>
                            Declarer
                          </Button>
                        )}
                        {report.status === 'FILED' && (
                          <Button size="sm" variant="outline" onClick={() => markAsPaid(report.id)}>
                            Marquer paye
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Annual Tasks */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Taches fiscales annuelles</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div>
                  <p className="font-medium text-yellow-800">Declaration TPS/TVQ Q4 2025</p>
                  <p className="text-sm text-yellow-600">Echeance: 31 janvier 2026</p>
                </div>
                <StatusBadge variant="warning">En cours</StatusBadge>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <p className="font-medium text-green-800">Declaration TPS/TVQ Q3 2025</p>
                  <p className="text-sm text-green-600">Completee le 30 octobre 2025</p>
                </div>
                <StatusBadge variant="success">Complete</StatusBadge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-slate-800">Rapport annuel 2025</p>
                  <p className="text-sm text-slate-600">Echeance: 30 avril 2026</p>
                </div>
                <StatusBadge variant="neutral">A venir</StatusBadge>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <p className="font-medium text-slate-800">Renouvellement numeros de taxe</p>
                  <p className="text-sm text-slate-600">Verifier avant le 31 decembre 2026</p>
                </div>
                <StatusBadge variant="neutral">A venir</StatusBadge>
              </div>
            </div>
          </div>

          {/* Summary by Region */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Resume par region ({selectedYear})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {annualReports.map((report) => (
                <div key={report.id} className="p-4 bg-slate-50 rounded-lg">
                  <p className="font-medium text-slate-900">{report.region}</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{report.taxCollected.toLocaleString()} $</p>
                  <p className="text-xs text-slate-500 mt-1">{report.orderCount} commandes</p>
                  <p className="text-xs text-slate-500">{report.taxRate}% taux</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Report Detail Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={`Rapport fiscal - ${selectedReport?.region ?? ''}`}
        subtitle={selectedReport?.period}
        size="lg"
        footer={
          selectedReport && (
            <div className="flex flex-wrap gap-3 w-full">
              <Button variant="danger" icon={Download} onClick={() => exportReport(selectedReport, 'PDF')}>
                Exporter PDF
              </Button>
              <Button variant="secondary" icon={Download} onClick={() => exportReport(selectedReport, 'EXCEL')}>
                Exporter Excel
              </Button>
              <Button variant="ghost" icon={Download} onClick={() => exportReport(selectedReport, 'CSV')}>
                Exporter CSV
              </Button>
              {selectedReport.status === 'GENERATED' && (
                <Button
                  variant="primary"
                  className="ml-auto"
                  onClick={() => {
                    markAsFiled(selectedReport.id);
                    setSelectedReport({ ...selectedReport, status: 'FILED', filedAt: new Date().toISOString() });
                  }}
                >
                  Marquer comme declare
                </Button>
              )}
              {selectedReport.status === 'FILED' && (
                <Button
                  variant="primary"
                  className="ml-auto"
                  onClick={() => {
                    markAsPaid(selectedReport.id);
                    setSelectedReport({ ...selectedReport, status: 'PAID', paidAt: new Date().toISOString() });
                  }}
                >
                  Marquer comme paye
                </Button>
              )}
            </div>
          )
        }
      >
        {selectedReport && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-sm text-slate-500">Ventes totales</p>
                <p className="text-xl font-bold text-slate-900">{selectedReport.totalSales.toLocaleString()} $</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-sm text-slate-500">Montant taxable</p>
                <p className="text-xl font-bold text-slate-900">{selectedReport.taxableAmount.toLocaleString()} $</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-sm text-green-600">Taxes collectees</p>
                <p className="text-xl font-bold text-green-700">{selectedReport.taxCollected.toLocaleString()} $</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-sm text-blue-600">Commandes</p>
                <p className="text-xl font-bold text-blue-700">{selectedReport.orderCount}</p>
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Informations</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Region</span>
                    <span className="font-medium">{selectedReport.region} ({selectedReport.regionCode})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Periode</span>
                    <span className="font-medium">{selectedReport.period}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type</span>
                    <span className="font-medium">{selectedReport.periodType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Taux de taxe</span>
                    <span className="font-medium">{selectedReport.taxRate}%</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Statut</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Statut actuel</span>
                    <StatusBadge variant={statusVariantMap[selectedReport.status] || 'neutral'}>
                      {selectedReport.status}
                    </StatusBadge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Genere le</span>
                    <span className="font-medium">{new Date(selectedReport.generatedAt).toLocaleDateString('fr-CA')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Echeance</span>
                    <span className="font-medium">{new Date(selectedReport.dueDate).toLocaleDateString('fr-CA')}</span>
                  </div>
                  {selectedReport.filedAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Declare le</span>
                      <span className="font-medium">{new Date(selectedReport.filedAt).toLocaleDateString('fr-CA')}</span>
                    </div>
                  )}
                  {selectedReport.paidAt && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Paye le</span>
                      <span className="font-medium">{new Date(selectedReport.paidAt).toLocaleDateString('fr-CA')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="bg-slate-50 rounded-lg p-4">
              <h4 className="font-medium text-slate-900 mb-3">Detail du calcul</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Ventes brutes</span>
                  <span>{selectedReport.totalSales.toLocaleString()} $</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Ventes non taxables (5%)</span>
                  <span>-{(selectedReport.totalSales * 0.05).toLocaleString()} $</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-medium">Montant taxable</span>
                  <span className="font-medium">{selectedReport.taxableAmount.toLocaleString()} $</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Taux de taxe</span>
                  <span>x {selectedReport.taxRate}%</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-2">
                  <span className="font-bold text-green-700">Taxes a remettre</span>
                  <span className="font-bold text-green-700">{selectedReport.taxCollected.toLocaleString()} $</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// --- Helper component for toggle settings ---

function ToggleSetting({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center justify-between">
      <div>
        <p className="font-medium text-slate-700">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`w-12 h-6 rounded-full transition-colors relative ${
          checked ? 'bg-green-500' : 'bg-slate-300'
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'right-1' : 'left-1'
        }`} />
      </button>
    </label>
  );
}
