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
  const { formatCurrency, locale } = useI18n();
  const theme = sectionThemes.compliance;
  const isFr = locale === 'fr';
  const fr = (f: string, e: string) => isFr ? f : e;

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
          ? fr('Declaration soumise', 'Declaration submitted')
          : fr('Brouillon sauvegarde', 'Draft saved')
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
      <PageHeader title={fr('Declaration TPS/TVQ', 'GST/QST Return')}
        subtitle={fr('Calculez et soumettez votre declaration de taxes de vente', 'Calculate and submit your sales tax declaration')} theme={theme} />

      {/* Period Selector */}
      <SectionCard title={fr('Periode de declaration', 'Declaration Period')} theme={theme}>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{fr('Date de debut', 'Start date')}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{fr('Date de fin', 'End date')}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{fr('Methode', 'Method')}</label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              {(['regular', 'quick'] as const).map(m => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${m === 'quick' ? 'border-l border-slate-300' : ''} ${
                    method === m ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                  {m === 'regular' ? fr('Reguliere', 'Regular') : fr('Rapide', 'Quick')}
                </button>
              ))}
            </div>
          </div>
          <Button variant="primary" icon={Calculator} onClick={fetchDeclaration} disabled={loading} className={theme.btnPrimary}>
            {loading ? fr('Calcul...', 'Calculating...') : fr('Calculer', 'Calculate')}
          </Button>
        </div>
      </SectionCard>

      {declaration && (<>
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={fr('Fournitures taxables', 'Taxable Supplies')} value={fmt(declaration.supplies.taxable)} icon={DollarSign} theme={theme} />
          <StatCard title={fr('TPS/TVH nette', 'Net GST/HST')} value={fmt(declaration.gst.net)}
            icon={declaration.gst.net >= 0 ? TrendingUp : TrendingDown} theme={theme} />
          <StatCard title={fr('TVQ nette', 'Net QST')} value={fmt(declaration.qst.net)}
            icon={declaration.qst.net >= 0 ? TrendingUp : TrendingDown} theme={theme} />
          <div className={`rounded-xl border p-4 ${declaration.totalRemittance < 0 ? 'bg-emerald-50 border-emerald-200' : declaration.totalRemittance > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <p className="text-sm text-slate-500">{declaration.totalRemittance < 0 ? fr('Remboursement', 'Refund') : fr('A remettre', 'Amount owing')}</p>
            <p className={`text-2xl font-bold mt-1 ${rColor(declaration.totalRemittance)}`}>{fmt(Math.abs(declaration.totalRemittance))}</p>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {declaration.totalRemittance < 0
                ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600">{fr('Remboursement', 'Refund')}</span></>
                : declaration.totalRemittance > 0
                  ? <><AlertCircle className="w-3.5 h-3.5 text-red-500" /><span className="text-red-600">{fr('Montant du', 'Amount owing')}</span></>
                  : <span className="text-slate-500">{fr('Aucun solde', 'No balance')}</span>}
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SectionCard title={fr('Fournitures', 'Supplies')} theme={theme}>
            <div className="space-y-3">
              <Row label={fr('Fournitures taxables', 'Taxable supplies')} value={fmt(declaration.supplies.taxable)} />
              <Row label={fr('Fournitures detaxees', 'Zero-rated supplies')} value={fmt(declaration.supplies.zeroRated)} />
              <Row label={fr('Fournitures exonerees', 'Exempt supplies')} value={fmt(declaration.supplies.exempt)} />
              <Row label={fr('Total fournitures', 'Total supplies')} value={fmt(declaration.supplies.total)} bold />
            </div>
          </SectionCard>
          <SectionCard title="TPS/TVH (GST/HST)" theme={theme}>
            <div className="space-y-3">
              <Row label={`${fr('TPS percue', 'GST collected')} (L.105)`} value={fmt(declaration.gst.line105)} />
              <Row label={`${fr('CTI', 'ITC')} (L.108)`} value={`-${fmt(declaration.gst.line108)}`} negative />
              <Row label={`${fr('TPS nette', 'Net GST')} (L.109)`} value={fmt(declaration.gst.net)} bold />
            </div>
          </SectionCard>
          <SectionCard title="TVQ (QST)" theme={theme}>
            <div className="space-y-3">
              <Row label={fr('TVQ percue', 'QST collected')} value={fmt(declaration.qst.collected)} />
              <Row label={fr('RTI', 'ITR')} value={`-${fmt(declaration.qst.itr)}`} negative />
              <Row label={fr('TVQ nette', 'Net QST')} value={fmt(declaration.qst.net)} bold />
            </div>
          </SectionCard>
        </div>

        {/* Quick Method */}
        {method === 'quick' && declaration.quickMethod && (
          <SectionCard title={fr('Methode rapide', 'Quick Method')} theme={theme}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div><p className="text-sm text-slate-500">{fr('Revenus totaux (taxes incl.)', 'Total revenue (incl. taxes)')}</p>
                <p className="text-lg font-semibold text-slate-900">{fmt(declaration.quickMethod.revenue)}</p></div>
              <div><p className="text-sm text-slate-500">{fr('Taux rapide TPS', 'Quick rate GST')}</p>
                <p className="text-lg font-semibold text-slate-900">{declaration.quickMethod.gstRate}%</p></div>
              <div><p className="text-sm text-slate-500">{fr('Taux rapide TVQ', 'Quick rate QST')}</p>
                <p className="text-lg font-semibold text-slate-900">{declaration.quickMethod.qstRate}%</p></div>
              <div><p className="text-sm text-slate-500">{fr('Credit (premiers 30 000 $)', 'Credit (first $30,000)')}</p>
                <p className="text-lg font-semibold text-emerald-600">-{fmt(declaration.quickMethod.gstCredit)}</p></div>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <span className="font-semibold text-slate-800">{fr('Remise methode rapide', 'Quick method remittance')}</span>
              <span className={`text-xl font-bold ${rColor(declaration.quickMethod.totalRemittance)}`}>{fmt(declaration.quickMethod.totalRemittance)}</span>
            </div>
          </SectionCard>
        )}

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-end gap-3 bg-white border rounded-xl p-4">
          <Button variant="secondary" icon={Download} onClick={() => toast.info(fr('Generation PDF...', 'Generating PDF...'))}>
            {fr('Telecharger PDF', 'Download PDF')}</Button>
          <Button variant="secondary" icon={FileText} onClick={handleExportCsv}>{fr('Exporter CSV', 'Export CSV')}</Button>
          <Button variant="secondary" onClick={() => saveDeclaration('DRAFT')} disabled={saving}>{fr('Sauvegarder brouillon', 'Save Draft')}</Button>
          <Button variant="primary" icon={Send} onClick={() => setShowSubmitModal(true)} className={theme.btnPrimary}>
            {fr('Soumettre la declaration', 'Submit Declaration')}</Button>
        </div>

        {/* Province Tax Rates Reference */}
        <div className="border rounded-xl overflow-hidden">
          <button onClick={() => setShowTaxRates(!showTaxRates)}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
            <span className="font-medium text-slate-700">{fr('Reference: Taux de taxe par province', 'Reference: Tax Rates by Province')}</span>
            <span className="text-slate-400 text-sm">{showTaxRates ? fr('Masquer', 'Hide') : fr('Afficher', 'Show')}</span>
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
                      <td className="px-4 py-2 text-slate-900 font-medium">{isFr ? p.provinceNameFr : p.provinceName} <span className="text-slate-400">({p.provinceCode})</span></td>
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
          <p className="text-lg font-medium text-slate-600">{fr('Selectionnez une periode et cliquez sur Calculer', 'Select a period and click Calculate')}</p>
          <p className="text-sm mt-1">{fr('Les donnees seront calculees a partir de vos ecritures comptables', 'Data will be calculated from your journal entries')}</p>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-full"><AlertCircle className="w-6 h-6 text-amber-600" /></div>
              <h3 className="text-lg font-semibold text-slate-900">{fr('Confirmer la soumission', 'Confirm Submission')}</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">{fr(
              'Etes-vous sur de vouloir soumettre cette declaration TPS/TVQ? Cette action enregistrera la declaration avec le statut "Produite".',
              'Are you sure you want to submit this GST/QST declaration? This will record the declaration with "Filed" status.'
            )}</p>
            {declaration && (
              <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">{fr('Periode', 'Period')}</span><span className="font-medium">{startDate} - {endDate}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">{fr('Methode', 'Method')}</span><span className="font-medium">{method === 'regular' ? fr('Reguliere', 'Regular') : fr('Rapide', 'Quick')}</span></div>
                <div className="flex justify-between font-semibold">
                  <span className="text-slate-700">{fr('Montant', 'Amount')}</span>
                  <span className={rColor(declaration.summary.effectiveRemittance)}>
                    {fmt(Math.abs(declaration.summary.effectiveRemittance))}{declaration.summary.isRefund ? ` (${fr('remboursement', 'refund')})` : ''}
                  </span>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowSubmitModal(false)} disabled={saving}>{fr('Annuler', 'Cancel')}</Button>
              <Button variant="primary" icon={Send} onClick={() => saveDeclaration('FILED')} disabled={saving} className={theme.btnPrimary}>
                {saving ? fr('Soumission...', 'Submitting...') : fr('Confirmer', 'Confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
