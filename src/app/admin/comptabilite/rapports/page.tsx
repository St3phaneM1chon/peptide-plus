'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Globe,
  DollarSign,
  TrendingDown,
  Target,
  Banknote,
  FileText,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { PageHeader, StatusBadge, Button, type Column, DataTable } from '@/components/admin';

interface TaxReport {
  id: string;
  period: string;
  periodType: string;
  year: number;
  region: string;
  regionCode: string;
  status: string;
  dueDate: string;
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  tpsPaid: number;
  tvqPaid: number;
  tvhPaid: number;
  netTps: number;
  netTvq: number;
  netTvh: number;
  netTotal: number;
  totalSales: number;
}

interface TaxSummary {
  tpsCollected: number;
  tvqCollected: number;
  tvhCollected: number;
  tpsPaid: number;
  tvqPaid: number;
  netTps: number;
  netTvq: number;
  netTvh: number;
}

type BadgeVariant = 'neutral' | 'info' | 'warning' | 'success';

export default function RapportsComptablesPage() {
  const [selectedYear, setSelectedYear] = useState('2026');
  const [taxReports, setTaxReports] = useState<TaxReport[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const managementReports = [
    { id: '1', name: 'Analyse des ventes par produit', icon: BarChart3, description: 'Répartition du CA par produit et catégorie' },
    { id: '2', name: 'Analyse des ventes par région', icon: Globe, description: 'Performance par zone géographique' },
    { id: '3', name: 'Analyse de rentabilité', icon: DollarSign, description: 'Marge par produit et coût d\'acquisition' },
    { id: '4', name: 'Analyse des dépenses', icon: TrendingDown, description: 'Répartition et tendances des dépenses' },
    { id: '5', name: 'Rapport de performance', icon: Target, description: 'KPIs et indicateurs clés' },
    { id: '6', name: 'Rapport de trésorerie', icon: Banknote, description: 'Entrées, sorties et prévisions' },
  ];

  // Fetch tax reports
  const fetchTaxReports = async (year: string) => {
    try {
      const res = await fetch(`/api/accounting/tax-reports?year=${year}`);
      if (!res.ok) throw new Error('Erreur lors du chargement des rapports');
      const data = await res.json();
      setTaxReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  };

  // Fetch tax summary for the year
  const fetchTaxSummary = async (year: string) => {
    try {
      const res = await fetch(`/api/accounting/tax-summary?from=${year}-01-01&to=${year}-12-31`);
      if (!res.ok) throw new Error('Erreur lors du chargement du sommaire');
      const data = await res.json();
      setTaxSummary(data);
    } catch (err) {
      console.error('Tax summary error:', err);
    }
  };

  // Generate PDF report
  const handleGeneratePdf = async (reportType: string) => {
    setGeneratingPdf(reportType);
    try {
      const res = await fetch(`/api/accounting/reports/pdf?type=${reportType}&period=${selectedYear}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || 'Erreur lors de la génération du rapport');
      }
      const html = await res.text();
      // Open HTML in new tab for printing/saving as PDF
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(html);
        newWindow.document.close();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la génération');
    } finally {
      setGeneratingPdf(null);
    }
  };

  // File a tax report (update status to FILED)
  const handleFileTaxReport = async (reportId: string) => {
    try {
      const res = await fetch('/api/accounting/tax-reports', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: reportId, status: 'FILED' }),
      });
      if (!res.ok) throw new Error('Erreur lors de la déclaration');
      await fetchTaxReports(selectedYear);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchTaxReports(selectedYear),
        fetchTaxSummary(selectedYear),
      ]);
      setLoading(false);
    };
    loadData();
  }, [selectedYear]);

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Erreur: {error}</div>;

  const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: 'Brouillon', variant: 'neutral' },
    GENERATED: { label: 'Généré', variant: 'info' },
    FILED: { label: 'Déclaré', variant: 'warning' },
    PAID: { label: 'Payé', variant: 'success' },
    // lowercase fallbacks
    draft: { label: 'Brouillon', variant: 'neutral' },
    generated: { label: 'Généré', variant: 'info' },
    filed: { label: 'Déclaré', variant: 'warning' },
    paid: { label: 'Payé', variant: 'success' },
  };

  const taxColumns: Column<TaxReport>[] = [
    {
      key: 'period',
      header: 'Rapport',
      render: (report) => (
        <div>
          <p className="font-medium text-slate-900">TPS/TVQ - {report.period}</p>
          <p className="text-xs text-slate-500">{report.region}</p>
        </div>
      ),
    },
    {
      key: 'tpsCollected',
      header: 'TPS collectée',
      align: 'right',
      render: (report) => <span className="text-slate-900">{report.tpsCollected.toFixed(2)} $</span>,
    },
    {
      key: 'tvqCollected',
      header: 'TVQ collectée',
      align: 'right',
      render: (report) => <span className="text-slate-900">{report.tvqCollected.toFixed(2)} $</span>,
    },
    {
      key: 'ctirti',
      header: 'CTI/RTI',
      align: 'right',
      render: (report) => (
        <span className="text-red-600">-{(report.tpsPaid + report.tvqPaid).toFixed(2)} $</span>
      ),
    },
    {
      key: 'net',
      header: 'Net à payer',
      align: 'right',
      render: (report) => {
        return <span className="font-bold text-emerald-600">{report.netTotal.toFixed(2)} $</span>;
      },
    },
    {
      key: 'dueDate',
      header: 'Échéance',
      align: 'center',
      render: (report) => (
        <span className="text-sm text-slate-600">{report.dueDate ? new Date(report.dueDate).toLocaleDateString('fr-CA') : '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (report) => {
        const cfg = statusConfig[report.status] || { label: report.status, variant: 'neutral' as BadgeVariant };
        return <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (report) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            icon={FileText}
            onClick={() => handleGeneratePdf('tax')}
            disabled={generatingPdf === 'tax'}
          >
            PDF
          </Button>
          {(report.status === 'GENERATED' || report.status === 'generated') && (
            <Button variant="primary" size="sm" onClick={() => handleFileTaxReport(report.id)}>Déclarer</Button>
          )}
        </div>
      ),
    },
  ];

  const totalTpsCollected = taxSummary?.tpsCollected ?? taxReports.reduce((s, r) => s + r.tpsCollected, 0);
  const totalTvqCollected = taxSummary?.tvqCollected ?? taxReports.reduce((s, r) => s + r.tvqCollected, 0);
  const totalCtiRti = (taxSummary?.tpsPaid ?? 0) + (taxSummary?.tvqPaid ?? 0);
  const totalNetRemit = (taxSummary?.netTps ?? 0) + (taxSummary?.netTvq ?? 0) + (taxSummary?.netTvh ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports comptables"
        subtitle="Rapports fiscaux et de gestion"
        actions={
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        }
      />

      {/* Tax Reports Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-sky-900">Rapports de taxes</h2>
            <p className="text-sm text-sky-700">TPS/TVQ et déclarations fiscales</p>
          </div>
          <Link href="/admin/fiscal" className="text-sm text-sky-600 hover:text-sky-700 inline-flex items-center gap-1">
            Module fiscal complet <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {taxReports.length > 0 ? (
          <DataTable
            columns={taxColumns}
            data={taxReports}
            keyExtractor={(r) => r.id}
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            Aucun rapport de taxes pour {selectedYear}
          </div>
        )}
      </div>

      {/* Management Reports Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Rapports de gestion</h2>
        <div className="grid grid-cols-3 gap-4">
          {managementReports.map((report) => {
            const Icon = report.icon;
            // Map management report type to API report type
            const reportTypeMap: Record<string, string> = {
              '1': 'income',  // sales analysis -> income statement
              '3': 'income',  // profitability -> income statement
              '4': 'income',  // expense analysis -> income statement
            };
            const apiType = reportTypeMap[report.id];
            return (
              <div key={report.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-slate-50 rounded-lg">
                    <Icon className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{report.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{report.description}</p>
                    <button
                      className="mt-3 text-sm text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
                      onClick={() => {
                        if (apiType) {
                          handleGeneratePdf(apiType);
                        }
                      }}
                      disabled={!!generatingPdf}
                    >
                      {generatingPdf === apiType ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Génération...
                        </>
                      ) : (
                        <>
                          Générer le rapport <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Annual Reports */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Rapports annuels</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-600">T2 - Déclaration fédérale</p>
            <p className="font-bold text-blue-900 mt-1">{parseInt(selectedYear) - 1}</p>
            <p className="text-xs text-blue-600 mt-2">Échéance: 30 juin {selectedYear}</p>
            <button className="mt-3 text-sm text-blue-700 hover:underline inline-flex items-center gap-1">Préparer <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-600">CO-17 - Déclaration Québec</p>
            <p className="font-bold text-purple-900 mt-1">{parseInt(selectedYear) - 1}</p>
            <p className="text-xs text-purple-600 mt-2">Échéance: 30 juin {selectedYear}</p>
            <button className="mt-3 text-sm text-purple-700 hover:underline inline-flex items-center gap-1">Préparer <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-600">États financiers</p>
            <p className="font-bold text-green-900 mt-1">{parseInt(selectedYear) - 1}</p>
            <p className="text-xs text-green-600 mt-2">À réviser</p>
            <button
              className="mt-3 text-sm text-green-700 hover:underline inline-flex items-center gap-1"
              onClick={() => handleGeneratePdf('income')}
            >
              Générer <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-4 bg-sky-50 rounded-lg border border-sky-200">
            <p className="text-sm text-sky-600">Rapport d&apos;audit</p>
            <p className="font-bold text-sky-900 mt-1">{parseInt(selectedYear) - 1}</p>
            <p className="text-xs text-sky-600 mt-2">Optionnel</p>
            <button className="mt-3 text-sm text-sky-700 hover:underline inline-flex items-center gap-1">Demander <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-white">
        <h3 className="font-semibold text-emerald-100 mb-4">Résumé fiscal {selectedYear}</h3>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-emerald-200 text-sm">TPS collectée</p>
            <p className="text-2xl font-bold">{Math.round(totalTpsCollected).toLocaleString()} $</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">TVQ collectée</p>
            <p className="text-2xl font-bold">{Math.round(totalTvqCollected).toLocaleString()} $</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">CTI/RTI réclamés</p>
            <p className="text-2xl font-bold">{Math.round(totalCtiRti).toLocaleString()} $</p>
          </div>
          <div>
            <p className="text-emerald-200 text-sm">Net à remettre</p>
            <p className="text-2xl font-bold">{Math.round(totalNetRemit).toLocaleString()} $</p>
          </div>
        </div>
      </div>
    </div>
  );
}
