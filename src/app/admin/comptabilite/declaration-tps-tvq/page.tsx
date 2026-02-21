'use client';

import { useState } from 'react';
import { FileText, Calculator, DollarSign, TrendingUp, TrendingDown, Download, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { PageHeader, SectionCard, StatCard, Button, StatusBadge } from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';
import { PROVINCIAL_TAX_RATES } from '@/lib/accounting/canadian-tax-config';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Declaration {
  period: {
    startDate: string;
    endDate: string;
    province: string;
    provinceName: string;
    provinceNameFr: string;
  };
  method: 'regular' | 'quick';
  supplies: { taxable: number; zeroRated: number; exempt: number; total: number };
  gst: {
    collected: number;
    itc: number;
    net: number;
    line105: number;
    line108: number;
    line109: number;
  };
  qst: { collected: number; itr: number; net: number };
  totalRemittance: number;
  quickMethod?: {
    revenue: number;
    gstRate: number;
    qstRate: number;
    gstRemittance: number;
    qstRemittance: number;
    totalRemittance: number;
    creditThreshold: number;
    gstCredit: number;
  };
  verification: {
    supplierTpsFromInvoices: number;
    supplierTvqFromInvoices: number;
    itcFromJournal: number;
    itrFromJournal: number;
    customerInvoiceCount: number;
    supplierInvoiceCount: number;
    journalLineCount: number;
  };
  summary: {
    isRefund: boolean;
    amountOwing: number;
    amountRefund: number;
    effectiveMethod: string;
    effectiveRemittance: number;
  };
  provinceTaxRates: ProvinceTaxInfo[];
}

interface ProvinceTaxInfo {
  provinceCode: string;
  provinceName: string;
  provinceNameFr: string;
  gstRate: number;
  pstRate: number;
  hstRate: number;
  totalRate: number;
  pstName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeclarationTpsTvqPage() {
  const { t, formatCurrency, locale } = useI18n();
  const theme = sectionThemes.compliance;

  const [declaration, setDeclaration] = useState<Declaration | null>(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const n = new Date(), q = Math.floor(n.getMonth() / 3);
    return new Date(n.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const n = new Date(), q = Math.floor(n.getMonth() / 3);
    return new Date(n.getFullYear(), q * 3 + 3, 0).toISOString().slice(0, 10);
  });
  const [method, setMethod] = useState<'regular' | 'quick'>('regular');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showTaxRates, setShowTaxRates] = useState(false);

  const fmt = (n: number) => formatCurrency(n);
  const rColor = (n: number) => n < 0 ? 'text-emerald-600' : n > 0 ? 'text-red-600' : 'text-slate-700';

  // Fetch declaration data from API
  const fetchDeclaration = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ startDate, endDate, method, province: 'QC' });
      const res = await fetch(`/api/accounting/gst-qst-declaration?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Error');
      }
      setDeclaration(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Save or submit declaration
  const saveDeclaration = async (status: string) => {
    if (!declaration) return;
    setSaving(true);
    try {
      const res = await fetch('/api/accounting/gst-qst-declaration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate, method, province: 'QC', status, data: declaration }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Error');
      }
      toast.success(
        status === 'FILED'
          ? t('admin.accounting.declaration.submitted')
          : t('admin.accounting.declaration.draftSaved')
      );
      setShowSubmitModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    if (!declaration) return;
    const d = declaration;
    const rows = [
      ['Section','Item','Amount'],
      ['Supplies','Taxable',d.supplies.taxable.toFixed(2)],['Supplies','Zero-Rated',d.supplies.zeroRated.toFixed(2)],
      ['Supplies','Exempt',d.supplies.exempt.toFixed(2)],['Supplies','Total',d.supplies.total.toFixed(2)],
      ['GST','Collected (L.105)',d.gst.collected.toFixed(2)],['GST','ITC (L.108)',d.gst.itc.toFixed(2)],['GST','Net (L.109)',d.gst.net.toFixed(2)],
      ['QST','Collected',d.qst.collected.toFixed(2)],['QST','ITR',d.qst.itr.toFixed(2)],['QST','Net',d.qst.net.toFixed(2)],
      ['Total','Remittance',d.totalRemittance.toFixed(2)],
    ];
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `declaration-tps-tvq-${startDate}-${endDate}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const Row = ({ label, value, negative, bold }: { label: string; value: string; negative?: boolean; bold?: boolean }) => (
    <div className={`flex justify-between text-sm ${bold ? 'border-t pt-2 font-semibold' : ''}`}>
      <span className={bold ? 'text-slate-800' : 'text-slate-600'}>{label}</span>
      <span className={`font-medium ${negative ? 'text-red-600' : bold ? '' : 'text-slate-900'}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t('admin.accounting.declaration.title')}
        subtitle={t('admin.accounting.declaration.subtitle')} theme={theme} />

      {/* Period Selector */}
      <SectionCard title={t('admin.accounting.declaration.period')} theme={theme}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.accounting.declaration.startDate')}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.accounting.declaration.endDate')}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('admin.accounting.declaration.method')}</label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              {(['regular', 'quick'] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${m === 'quick' ? 'border-l border-slate-300' : ''} ${
                    method === m ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {m === 'regular' ? t('admin.accounting.declaration.methodRegular') : t('admin.accounting.declaration.methodQuick')}
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" icon={Calculator} onClick={fetchDeclaration} disabled={loading} className={theme.btnPrimary}>
            {loading ? t('admin.accounting.declaration.calculating') : t('admin.accounting.declaration.calculate')}
          </Button>
        </div>
      </SectionCard>

      {declaration && (<>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={t('admin.accounting.declaration.taxableSupplies')} value={fmt(declaration.supplies.taxable)} icon={DollarSign} theme={theme} />
          <StatCard title={t('admin.accounting.declaration.netGstHst')} value={fmt(declaration.gst.net)}
            icon={declaration.gst.net >= 0 ? TrendingUp : TrendingDown} theme={theme} />
          <StatCard title={t('admin.accounting.declaration.netQst')} value={fmt(declaration.qst.net)}
            icon={declaration.qst.net >= 0 ? TrendingUp : TrendingDown} theme={theme} />
          <div className={`rounded-xl border p-4 ${declaration.totalRemittance < 0 ? 'bg-emerald-50 border-emerald-200' : declaration.totalRemittance > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className="text-sm text-slate-500">{declaration.totalRemittance < 0 ? t('admin.accounting.declaration.refund') : t('admin.accounting.declaration.amountOwing')}</p>
            <p className={`text-2xl font-bold mt-1 ${rColor(declaration.totalRemittance)}`}>{fmt(Math.abs(declaration.totalRemittance))}</p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {declaration.totalRemittance < 0
                ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600">{t('admin.accounting.declaration.refund')}</span></>
                : declaration.totalRemittance > 0
                  ? <><AlertCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-red-600">{t('admin.accounting.declaration.amountOwing')}</span></>
                  : <span className="text-slate-500">{t('admin.accounting.declaration.noBalance')}</span>}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title={t('admin.accounting.declaration.supplies')} theme={theme}>
            <div className="space-y-3">
              <Row label={t('admin.accounting.declaration.taxableSupplies')} value={fmt(declaration.supplies.taxable)} />
              <Row label={t('admin.accounting.declaration.zeroRatedSupplies')} value={fmt(declaration.supplies.zeroRated)} />
              <Row label={t('admin.accounting.declaration.exemptSupplies')} value={fmt(declaration.supplies.exempt)} />
              <Row label={t('admin.accounting.declaration.totalSupplies')} value={fmt(declaration.supplies.total)} bold />
            </div>
          </SectionCard>
          <SectionCard title="TPS/TVH (GST/HST)" theme={theme}>
            <div className="space-y-3">
              <Row label={`${t('admin.accounting.declaration.gstCollected')} (L.105)`} value={fmt(declaration.gst.line105)} />
              <Row label={`${t('admin.accounting.declaration.itc')} (L.108)`} value={`-${fmt(declaration.gst.line108)}`} negative />
              <Row label={`${t('admin.accounting.declaration.netGst')} (L.109)`} value={fmt(declaration.gst.net)} bold />
            </div>
          </SectionCard>
          <SectionCard title="TVQ (QST)" theme={theme}>
            <div className="space-y-3">
              <Row label={t('admin.accounting.declaration.qstCollected')} value={fmt(declaration.qst.collected)} />
              <Row label={t('admin.accounting.declaration.itr')} value={`-${fmt(declaration.qst.itr)}`} negative />
              <Row label={t('admin.accounting.declaration.netQst')} value={fmt(declaration.qst.net)} bold />
            </div>
          </SectionCard>
        </div>

        {/* Quick Method */}
        {method === 'quick' && declaration.quickMethod && (
          <SectionCard title={t('admin.accounting.declaration.quickMethod')} theme={theme}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div><p className="text-sm text-slate-500">{t('admin.accounting.declaration.totalRevenue')}</p>
                <p className="text-lg font-semibold text-slate-900">{fmt(declaration.quickMethod.revenue)}</p></div>
              <div><p className="text-sm text-slate-500">{t('admin.accounting.declaration.quickRateGst')}</p>
                <p className="text-lg font-semibold text-slate-900">{declaration.quickMethod.gstRate}%</p></div>
              <div><p className="text-sm text-slate-500">{t('admin.accounting.declaration.quickRateQst')}</p>
                <p className="text-lg font-semibold text-slate-900">{declaration.quickMethod.qstRate}%</p></div>
              <div><p className="text-sm text-slate-500">{t('admin.accounting.declaration.creditFirst30k')}</p>
                <p className="text-lg font-semibold text-emerald-600">-{fmt(declaration.quickMethod.gstCredit)}</p></div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="font-semibold text-slate-800">{t('admin.accounting.declaration.quickMethodRemittance')}</span>
              <span className={`text-xl font-bold ${rColor(declaration.quickMethod.totalRemittance)}`}>{fmt(declaration.quickMethod.totalRemittance)}</span>
            </div>
          </SectionCard>
        )}

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-end gap-3 bg-white border rounded-xl p-4">
          <Button variant="secondary" icon={Download} onClick={() => toast.info(t('admin.accounting.declaration.generatingPdf'))}>
            {t('admin.accounting.declaration.downloadPdf')}</Button>
          <Button variant="secondary" icon={FileText} onClick={handleExportCsv}>{t('admin.accounting.declaration.exportCsv')}</Button>
          <Button variant="secondary" onClick={() => saveDeclaration('DRAFT')} disabled={saving}>{t('admin.accounting.declaration.saveDraft')}</Button>
          <Button variant="primary" icon={Send} onClick={() => setShowSubmitModal(true)} className={theme.btnPrimary}>
            {t('admin.accounting.declaration.submitDeclaration')}</Button>
        </div>

        {/* Province Tax Rates Reference */}
        <div className="border rounded-xl overflow-hidden">
          <button onClick={() => setShowTaxRates(!showTaxRates)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
            <span className="font-medium text-slate-700">{t('admin.accounting.declaration.taxRatesRef')}</span>
            <span className="text-slate-400 text-sm">{showTaxRates ? t('admin.accounting.declaration.hide') : t('admin.accounting.declaration.show')}</span>
          </button>
          {showTaxRates && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 border-t">
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Province</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">TPS/GST</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">TVP/PST</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">TVH/HST</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Total</th>
                  <th className="px-4 py-2 text-center font-medium text-slate-600">Type</th>
                </tr></thead>
                <tbody className="divide-y">
                  {PROVINCIAL_TAX_RATES.map(p => (
                    <tr key={p.provinceCode} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-900 font-medium">{locale === 'fr' ? p.provinceNameFr : p.provinceName} <span className="text-slate-400">({p.provinceCode})</span></td>
                      <td className="px-4 py-2 text-right text-slate-700">{p.gstRate > 0 ? `${p.gstRate}%` : '-'}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{p.pstRate > 0 ? `${p.pstRate}%` : '-'}</td>
                      <td className="px-4 py-2 text-right text-slate-700">{p.hstRate > 0 ? `${p.hstRate}%` : '-'}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-900">{p.totalRate}%</td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge variant={p.hstRate > 0 ? 'info' : p.pstRate > 0 ? 'warning' : 'neutral'}>{p.pstName}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* Empty State */}
      {!declaration && !loading && (
        <div className="text-center py-16 text-slate-500">
          <Calculator className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium text-slate-600">{t('admin.accounting.declaration.emptyState')}</p>
          <p className="text-sm mt-1">{t('admin.accounting.declaration.emptyStateHint')}</p>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="submit-modal-title">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full"><AlertCircle className="w-6 h-6 text-amber-600" /></div>
              <h3 id="submit-modal-title" className="text-lg font-semibold text-slate-900">{t('admin.accounting.declaration.confirmSubmission')}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">{t('admin.accounting.declaration.confirmSubmissionDesc')}</p>
            {declaration && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">{t('admin.accounting.declaration.periodLabel')}</span><span className="font-medium">{startDate} - {endDate}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{t('admin.accounting.declaration.method')}</span><span className="font-medium">{method === 'regular' ? t('admin.accounting.declaration.methodRegular') : t('admin.accounting.declaration.methodQuick')}</span></div>
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-700">{t('admin.accounting.declaration.amount')}</span>
                  <span className={rColor(declaration.summary.effectiveRemittance)}>
                    {fmt(Math.abs(declaration.summary.effectiveRemittance))}{declaration.summary.isRefund ? ` (${t('admin.accounting.declaration.refund').toLowerCase()})` : ''}
                  </span>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowSubmitModal(false)} disabled={saving}>{t('admin.accounting.declaration.cancel')}</Button>
              <Button variant="primary" icon={Send} onClick={() => saveDeclaration('FILED')} disabled={saving} className={theme.btnPrimary}>
                {saving ? t('admin.accounting.declaration.submitting') : t('admin.accounting.declaration.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
