'use client';

import { useState, useEffect } from 'react';

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

export default function FiscalPage() {
  const [activeTab, setActiveTab] = useState<'regions' | 'reports' | 'tasks'>('reports');
  const [reports, setReports] = useState<TaxReport[]>([]);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TaxReport | null>(null);

  const [regions, setRegions] = useState<TaxRegion[]>([]);

  useEffect(() => {
    generateMockReports();
  }, [selectedYear]);

  const generateMockReports = () => {
    // TODO: Replace with real API fetch
    setReports([]);
  };

  // For future use: generate individual report for a specific region
  /* const generateReport = async (regionCode: string, periodType: 'MONTHLY' | 'ANNUAL', month?: number) => {
    setGenerating(true);
    await new Promise(r => setTimeout(r, 1500));
    alert(`Rapport ${periodType === 'ANNUAL' ? 'annuel' : 'mensuel'} généré pour ${regionCode}!`);
    setGenerating(false);
  }; */

  const generateAllReports = async () => {
    setGenerating(true);
    // TODO: Replace with real API call to generate reports
    await new Promise(r => setTimeout(r, 500));
    alert('Tous les rapports ont été générés!');
    setGenerating(false);
  };

  const markAsFiled = (reportId: string) => {
    setReports(reports.map(r => r.id === reportId ? { ...r, status: 'FILED' as const, filedAt: new Date().toISOString() } : r));
  };

  const markAsPaid = (reportId: string) => {
    setReports(reports.map(r => r.id === reportId ? { ...r, status: 'PAID' as const, paidAt: new Date().toISOString() } : r));
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

  const totalTaxCollected = monthlyReports.reduce((sum, r) => sum + r.taxCollected, 0);
  const totalSales = monthlyReports.reduce((sum, r) => sum + r.totalSales, 0);
  const pendingReports = reports.filter(r => r.status === 'GENERATED' || r.status === 'DRAFT').length;

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    GENERATED: 'bg-blue-100 text-blue-800',
    FILED: 'bg-yellow-100 text-yellow-800',
    PAID: 'bg-green-100 text-green-800',
  };
  
  const [settings, setSettings] = useState({
    taxIncludedInPrice: false,
    displayTaxSeparately: true,
    applyTaxToShipping: true,
    taxExemptProducts: [] as string[],
  });

  const [, setSelectedRegionDetail] = useState<TaxRegion | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fiscal & Taxes</h1>
          <p className="text-gray-500">Rapports de taxes et obligations fiscales</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generateAllReports}
            disabled={generating}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Génération...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Générer tous les rapports
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Ventes totales ({selectedYear})</p>
          <p className="text-2xl font-bold text-gray-900">{totalSales.toLocaleString()} $</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Taxes collectées</p>
          <p className="text-2xl font-bold text-green-700">{totalTaxCollected.toLocaleString()} $</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Rapports générés</p>
          <p className="text-2xl font-bold text-blue-700">{reports.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <p className="text-sm text-yellow-600">À déclarer</p>
          <p className="text-2xl font-bold text-yellow-700">{pendingReports}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'reports'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Rapports de taxes
          </button>
          <button
            onClick={() => setActiveTab('regions')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'regions'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Régions fiscales
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'tasks'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tâches & Échéances
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'reports' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Année</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={2024}>2024</option>
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Région</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Toutes les régions</option>
                  <option value="QC">Québec</option>
                  <option value="ON">Ontario</option>
                  <option value="BC">Colombie-Britannique</option>
                  <option value="AB">Alberta</option>
                  <option value="MB">Manitoba</option>
                  <option value="SK">Saskatchewan</option>
                  <option value="NS">Nouvelle-Écosse</option>
                  <option value="NB">Nouveau-Brunswick</option>
                  <option value="US">États-Unis</option>
                  <option value="FR">France</option>
                  <option value="GB">Royaume-Uni</option>
                </select>
              </div>
              <div className="ml-auto flex gap-2">
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exporter tout (PDF)
                </button>
                <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exporter tout (Excel)
                </button>
              </div>
            </div>
          </div>

          {/* Annual Reports */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-amber-50">
              <h3 className="font-semibold text-amber-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Rapports Annuels {selectedYear}
              </h3>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Région</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Montant taxable</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Taux</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Taxes collectées</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Commandes</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {annualReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{report.region}</p>
                      <p className="text-xs text-gray-500">{report.regionCode}</p>
                    </td>
                    <td className="px-4 py-4 text-right font-medium text-gray-900">
                      {report.totalSales.toLocaleString()} $
                    </td>
                    <td className="px-4 py-4 text-right text-gray-600">
                      {report.taxableAmount.toLocaleString()} $
                    </td>
                    <td className="px-4 py-4 text-right text-gray-600">
                      {report.taxRate > 0 ? `${report.taxRate}%` : 'Variable'}
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-green-600">
                      {report.taxCollected.toLocaleString()} $
                    </td>
                    <td className="px-4 py-4 text-center text-gray-600">
                      {report.orderCount}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[report.status]}`}>
                        {report.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedReport(report)}
                          className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200"
                        >
                          Détails
                        </button>
                        <button
                          onClick={() => exportReport(report, 'PDF')}
                          className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                        >
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-amber-50">
                <tr>
                  <td className="px-4 py-3 font-bold text-amber-900">TOTAL ANNUEL</td>
                  <td className="px-4 py-3 text-right font-bold text-amber-900">
                    {annualReports.reduce((s, r) => s + r.totalSales, 0).toLocaleString()} $
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-amber-900">
                    {annualReports.reduce((s, r) => s + r.taxableAmount, 0).toLocaleString()} $
                  </td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-bold text-green-700">
                    {annualReports.reduce((s, r) => s + r.taxCollected, 0).toLocaleString()} $
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-amber-900">
                    {annualReports.reduce((s, r) => s + r.orderCount, 0)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Monthly Reports */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-blue-50">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Rapports Mensuels {selectedYear}
              </h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Région</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Période</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Ventes</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Taxes</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Cmd</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Échéance</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {monthlyReports.sort((a, b) => (b.month || 0) - (a.month || 0)).map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{report.region}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">
                        {report.period}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {report.totalSales.toLocaleString()} $
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-600">
                        {report.taxCollected.toLocaleString()} $
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600">
                        {report.orderCount}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {new Date(report.dueDate).toLocaleDateString('fr-CA')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[report.status]}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {report.status === 'GENERATED' && (
                            <button
                              onClick={() => markAsFiled(report.id)}
                              className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200"
                            >
                              Déclarer
                            </button>
                          )}
                          {report.status === 'FILED' && (
                            <button
                              onClick={() => markAsPaid(report.id)}
                              className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                            >
                              Payé
                            </button>
                          )}
                          <button
                            onClick={() => exportReport(report, 'PDF')}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs hover:bg-gray-200"
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'regions' && (
        <>
          {/* Global Settings */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Paramètres globaux</h3>
        <div className="space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700">Prix TTC (taxes incluses)</p>
              <p className="text-sm text-gray-500">Afficher les prix avec taxes incluses</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, taxIncludedInPrice: !settings.taxIncludedInPrice })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.taxIncludedInPrice ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.taxIncludedInPrice ? 'right-1' : 'left-1'
              }`} />
            </button>
          </label>
          
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700">Afficher les taxes séparément</p>
              <p className="text-sm text-gray-500">Montrer le détail des taxes au checkout</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, displayTaxSeparately: !settings.displayTaxSeparately })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.displayTaxSeparately ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.displayTaxSeparately ? 'right-1' : 'left-1'
              }`} />
            </button>
          </label>
          
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-700">Taxer les frais de livraison</p>
              <p className="text-sm text-gray-500">Appliquer les taxes sur la livraison</p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, applyTaxToShipping: !settings.applyTaxToShipping })}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                settings.applyTaxToShipping ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.applyTaxToShipping ? 'right-1' : 'left-1'
              }`} />
            </button>
          </label>
        </div>
      </div>

      {/* Tax Regions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Régions fiscales</h3>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Région</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Taux</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nom taxe</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actif</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {regions.map((region) => (
              <tr key={region.id} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <p className="font-medium text-gray-900">{region.name}</p>
                  <p className="text-xs text-gray-500">{region.code}</p>
                </td>
                <td className="px-4 py-4 text-gray-600">{region.type}</td>
                <td className="px-4 py-4 text-right font-medium text-gray-900">
                  {region.taxRate > 0 ? `${region.taxRate}%` : 'Variable'}
                </td>
                <td className="px-4 py-4 text-gray-600">{region.taxName}</td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => setRegions(regions.map(r => r.id === region.id ? { ...r, isActive: !r.isActive } : r))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      region.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      region.isActive ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => setSelectedRegionDetail(region)}
                    className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                  >
                    Détails
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tax Regions Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">Régions fiscales configurées</h3>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Région</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Taux</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nom taxe</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actif</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {regions.map((region) => (
                  <tr key={region.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <p className="font-medium text-gray-900">{region.name}</p>
                      <p className="text-xs text-gray-500">{region.code}</p>
                    </td>
                    <td className="px-4 py-4 text-gray-600">{region.type}</td>
                    <td className="px-4 py-4 text-right font-medium text-gray-900">
                      {region.taxRate > 0 ? `${region.taxRate}%` : 'Variable'}
                    </td>
                    <td className="px-4 py-4 text-gray-600">{region.taxName}</td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => setRegions(regions.map(r => r.id === region.id ? { ...r, isActive: !r.isActive } : r))}
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          region.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          region.isActive ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => setSelectedRegion(region.code)}
                        className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                      >
                        Voir rapports
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'tasks' && (
        <>
          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Échéances à venir</h3>
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
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${isPast ? 'text-red-800' : isUrgent ? 'text-yellow-800' : 'text-gray-800'}`}>
                          {report.region} - {report.period}
                        </p>
                        <p className={`text-sm ${isPast ? 'text-red-600' : isUrgent ? 'text-yellow-600' : 'text-gray-600'}`}>
                          Échéance: {new Date(report.dueDate).toLocaleDateString('fr-CA')}
                          {isPast && ' (EN RETARD)'}
                          {!isPast && isUrgent && ` (${daysUntil} jours)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-sm ${statusColors[report.status]}`}>
                          {report.status}
                        </span>
                        {report.status === 'GENERATED' && (
                          <button
                            onClick={() => markAsFiled(report.id)}
                            className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-sm hover:bg-yellow-200"
                          >
                            Déclarer
                          </button>
                        )}
                        {report.status === 'FILED' && (
                          <button
                            onClick={() => markAsPaid(report.id)}
                            className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200"
                          >
                            Marquer payé
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Annual Tasks */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Tâches fiscales annuelles</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div>
                  <p className="font-medium text-yellow-800">Déclaration TPS/TVQ Q4 2025</p>
                  <p className="text-sm text-yellow-600">Échéance: 31 janvier 2026</p>
                </div>
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">En cours</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div>
                  <p className="font-medium text-green-800">Déclaration TPS/TVQ Q3 2025</p>
                  <p className="text-sm text-green-600">Complétée le 30 octobre 2025</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">Complété</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-800">Rapport annuel 2025</p>
                  <p className="text-sm text-gray-600">Échéance: 30 avril 2026</p>
                </div>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">À venir</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div>
                  <p className="font-medium text-gray-800">Renouvellement numéros de taxe</p>
                  <p className="text-sm text-gray-600">Vérifier avant le 31 décembre 2026</p>
                </div>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">À venir</span>
              </div>
            </div>
          </div>

          {/* Summary by Region */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Résumé par région ({selectedYear})</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {annualReports.map((report) => (
                <div key={report.id} className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">{report.region}</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{report.taxCollected.toLocaleString()} $</p>
                  <p className="text-xs text-gray-500 mt-1">{report.orderCount} commandes</p>
                  <p className="text-xs text-gray-500">{report.taxRate}% taux</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">Rapport fiscal - {selectedReport.region}</h3>
                <p className="text-sm text-gray-500">{selectedReport.period}</p>
              </div>
              <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Ventes totales</p>
                  <p className="text-xl font-bold text-gray-900">{selectedReport.totalSales.toLocaleString()} $</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Montant taxable</p>
                  <p className="text-xl font-bold text-gray-900">{selectedReport.taxableAmount.toLocaleString()} $</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg text-center">
                  <p className="text-sm text-green-600">Taxes collectées</p>
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
                  <h4 className="font-medium text-gray-900 mb-3">Informations</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Région</span>
                      <span className="font-medium">{selectedReport.region} ({selectedReport.regionCode})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Période</span>
                      <span className="font-medium">{selectedReport.period}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Type</span>
                      <span className="font-medium">{selectedReport.periodType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Taux de taxe</span>
                      <span className="font-medium">{selectedReport.taxRate}%</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Statut</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Statut actuel</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[selectedReport.status]}`}>
                        {selectedReport.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Généré le</span>
                      <span className="font-medium">{new Date(selectedReport.generatedAt).toLocaleDateString('fr-CA')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Échéance</span>
                      <span className="font-medium">{new Date(selectedReport.dueDate).toLocaleDateString('fr-CA')}</span>
                    </div>
                    {selectedReport.filedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Déclaré le</span>
                        <span className="font-medium">{new Date(selectedReport.filedAt).toLocaleDateString('fr-CA')}</span>
                      </div>
                    )}
                    {selectedReport.paidAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Payé le</span>
                        <span className="font-medium">{new Date(selectedReport.paidAt).toLocaleDateString('fr-CA')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Calculation Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Détail du calcul</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ventes brutes</span>
                    <span>{selectedReport.totalSales.toLocaleString()} $</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ventes non taxables (5%)</span>
                    <span>-{(selectedReport.totalSales * 0.05).toLocaleString()} $</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-medium">Montant taxable</span>
                    <span className="font-medium">{selectedReport.taxableAmount.toLocaleString()} $</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Taux de taxe</span>
                    <span>× {selectedReport.taxRate}%</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="font-bold text-green-700">Taxes à remettre</span>
                    <span className="font-bold text-green-700">{selectedReport.taxCollected.toLocaleString()} $</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => exportReport(selectedReport, 'PDF')}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exporter PDF
                </button>
                <button
                  onClick={() => exportReport(selectedReport, 'EXCEL')}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exporter Excel
                </button>
                <button
                  onClick={() => exportReport(selectedReport, 'CSV')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exporter CSV
                </button>
                {selectedReport.status === 'GENERATED' && (
                  <button
                    onClick={() => { markAsFiled(selectedReport.id); setSelectedReport({ ...selectedReport, status: 'FILED', filedAt: new Date().toISOString() }); }}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 ml-auto"
                  >
                    Marquer comme déclaré
                  </button>
                )}
                {selectedReport.status === 'FILED' && (
                  <button
                    onClick={() => { markAsPaid(selectedReport.id); setSelectedReport({ ...selectedReport, status: 'PAID', paidAt: new Date().toISOString() }); }}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 ml-auto"
                  >
                    Marquer comme payé
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
