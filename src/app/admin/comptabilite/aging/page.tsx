'use client';

import { useState, useEffect } from 'react';

interface AgingBucket {
  label: string;
  count: number;
  total: number;
  percentage: number;
}

interface CustomerAging {
  name: string;
  email?: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
  oldestInvoiceDays: number;
}

interface AgingReport {
  type: 'RECEIVABLE' | 'PAYABLE';
  totalOutstanding: number;
  totalOverdue: number;
  averageDaysOutstanding: number;
  buckets: AgingBucket[];
  byCustomer: CustomerAging[];
}

interface AgingStats {
  currentPercentage: number;
  overduePercentage: number;
  criticalPercentage: number;
  healthScore: number;
  recommendations: string[];
}

export default function AgingPage() {
  const [reportType, setReportType] = useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [report, setReport] = useState<AgingReport | null>(null);
  const [stats, setStats] = useState<AgingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAgingReport();
  }, [reportType]);

  const fetchAgingReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/accounting/aging?type=${reportType}`);
      const data = await response.json();
      setReport(data.report);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching aging report:', error);
      setReport(null);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    setExporting(true);
    try {
      const response = await fetch(`/api/accounting/aging?type=${reportType}&format=csv`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aging-${reportType.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBucketColor = (index: number) => {
    const colors = [
      'bg-green-100 text-green-800',
      'bg-blue-100 text-blue-800',
      'bg-yellow-100 text-yellow-800',
      'bg-orange-100 text-orange-800',
      'bg-red-100 text-red-800',
    ];
    return colors[index] || colors[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Rapport d&apos;aging
          </h1>
          <p className="text-neutral-600">
            Analyse de l&apos;âge des créances et dettes
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Type Selector */}
          <div className="flex bg-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setReportType('RECEIVABLE')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                reportType === 'RECEIVABLE'
                  ? 'bg-white text-neutral-900 shadow'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Comptes clients
            </button>
            <button
              onClick={() => setReportType('PAYABLE')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                reportType === 'PAYABLE'
                  ? 'bg-white text-neutral-900 shadow'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Comptes fournisseurs
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={exportCSV}
            disabled={exporting}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 flex items-center gap-2"
          >
            {exporting ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Export...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exporter CSV
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      ) : report && stats ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <p className="text-sm text-neutral-500 mb-1">Total en souffrance</p>
              <p className="text-2xl font-bold text-neutral-900">
                {report.totalOutstanding.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <p className="text-sm text-neutral-500 mb-1">Total en retard</p>
              <p className="text-2xl font-bold text-red-600">
                {report.totalOverdue.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <p className="text-sm text-neutral-500 mb-1">Jours moyens</p>
              <p className="text-2xl font-bold text-neutral-900">
                {report.averageDaysOutstanding} <span className="text-sm font-normal">jours</span>
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 shadow-sm border">
              <p className="text-sm text-neutral-500 mb-1">Score de santé</p>
              <div className="flex items-center gap-2">
                <p className={`text-2xl font-bold ${getHealthScoreColor(stats.healthScore)}`}>
                  {stats.healthScore}/100
                </p>
                <div className="flex-1 bg-neutral-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      stats.healthScore >= 80 ? 'bg-green-500' :
                      stats.healthScore >= 60 ? 'bg-yellow-500' :
                      stats.healthScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${stats.healthScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Aging Buckets Chart */}
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Répartition par âge
            </h2>
            
            {/* Visual Bar Chart */}
            <div className="mb-6">
              <div className="flex h-8 rounded-lg overflow-hidden">
                {report.buckets.map((bucket, index) => (
                  bucket.percentage > 0 && (
                    <div
                      key={bucket.label}
                      className={`${getBucketColor(index)} flex items-center justify-center text-xs font-medium`}
                      style={{ width: `${bucket.percentage}%` }}
                      title={`${bucket.label}: ${bucket.percentage.toFixed(1)}%`}
                    >
                      {bucket.percentage >= 10 && `${bucket.percentage.toFixed(0)}%`}
                    </div>
                  )
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-neutral-500">
                {report.buckets.map((bucket, index) => (
                  <div key={bucket.label} className="flex items-center gap-1">
                    <span className={`w-3 h-3 rounded ${getBucketColor(index)}`} />
                    {bucket.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Bucket Table */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Période</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">Factures</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">Montant</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">%</th>
                </tr>
              </thead>
              <tbody>
                {report.buckets.map((bucket, index) => (
                  <tr key={bucket.label} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getBucketColor(index)}`}>
                        {bucket.label}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4 font-medium">{bucket.count}</td>
                    <td className="text-right py-3 px-4 font-medium">
                      {bucket.total.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                    </td>
                    <td className="text-right py-3 px-4 text-neutral-500">{bucket.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-neutral-50 font-semibold">
                  <td className="py-3 px-4">Total</td>
                  <td className="text-right py-3 px-4">{report.buckets.reduce((s, b) => s + b.count, 0)}</td>
                  <td className="text-right py-3 px-4">
                    {report.totalOutstanding.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                  </td>
                  <td className="text-right py-3 px-4">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* By Customer/Supplier */}
          <div className="bg-white rounded-xl p-6 shadow-sm border">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">
              Par {reportType === 'RECEIVABLE' ? 'client' : 'fournisseur'}
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-neutral-500">Nom</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">Courant</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">1-30j</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">31-60j</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">61-90j</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">90j+</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-neutral-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCustomer.slice(0, 15).map((customer) => (
                    <tr key={customer.name} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-neutral-900">{customer.name}</p>
                          {customer.email && (
                            <p className="text-xs text-neutral-500">{customer.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 text-green-600">
                        {customer.current > 0 ? customer.current.toFixed(2) + ' $' : '-'}
                      </td>
                      <td className="text-right py-3 px-4 text-blue-600">
                        {customer.days1to30 > 0 ? customer.days1to30.toFixed(2) + ' $' : '-'}
                      </td>
                      <td className="text-right py-3 px-4 text-yellow-600">
                        {customer.days31to60 > 0 ? customer.days31to60.toFixed(2) + ' $' : '-'}
                      </td>
                      <td className="text-right py-3 px-4 text-orange-600">
                        {customer.days61to90 > 0 ? customer.days61to90.toFixed(2) + ' $' : '-'}
                      </td>
                      <td className="text-right py-3 px-4 text-red-600 font-medium">
                        {customer.over90 > 0 ? customer.over90.toFixed(2) + ' $' : '-'}
                      </td>
                      <td className="text-right py-3 px-4 font-semibold">
                        {customer.total.toFixed(2)} $
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          {stats.recommendations.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-amber-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="font-semibold text-amber-800 mb-2">Recommandations</h3>
                  <ul className="space-y-1">
                    {stats.recommendations.map((rec, i) => (
                      <li key={i} className="text-amber-700 text-sm flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-neutral-500">Aucune donnée disponible</p>
        </div>
      )}
    </div>
  );
}

