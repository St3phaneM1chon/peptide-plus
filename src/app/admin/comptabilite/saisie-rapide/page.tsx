'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { CANADIAN_PROVINCES } from '@/lib/canadianTaxes';

/**
 * SECURITY: Safe formula evaluator using a recursive descent parser.
 * Only supports basic arithmetic: +, -, *, /, (, ), and named variables.
 * No eval() or new Function() - fully parsed and computed manually.
 */
function safeEvalFormula(formula: string, vars: Record<string, number>): number {
  try {
    // Replace variable names with their values (word-boundary safe)
    let expr = formula;
    // Sort variable names by length descending to avoid partial replacements
    const sortedKeys = Object.keys(vars).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      expr = expr.replace(new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), String(vars[key]));
    }
    // Validate: only allow digits, decimal points, arithmetic operators, parentheses, spaces
    if (!/^[\d\s+\-*/().]+$/.test(expr)) {
      return 0;
    }
    return Number(parseArithmeticExpr(expr)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Recursive descent parser for safe arithmetic evaluation.
 * Grammar: expr = term (('+' | '-') term)*
 *          term = factor (('*' | '/') factor)*
 *          factor = unary | '(' expr ')' | number
 *          unary = ('-' | '+') factor
 */
function parseArithmeticExpr(input: string): number {
  const tokens = input.match(/(\d+\.?\d*|[+\-*/()])/g) || [];
  let pos = 0;

  function peek(): string | undefined { return tokens[pos]; }
  function consume(): string { return tokens[pos++]; }

  function parseExpr(): number {
    let result = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      const right = parseFactor();
      result = op === '*' ? result * right : right !== 0 ? result / right : 0;
    }
    return result;
  }

  function parseFactor(): number {
    // Unary minus / plus
    if (peek() === '-') {
      consume();
      return -parseFactor();
    }
    if (peek() === '+') {
      consume();
      return parseFactor();
    }
    // Parenthesized expression
    if (peek() === '(') {
      consume(); // '('
      const result = parseExpr();
      if (peek() === ')') consume(); // ')'
      return result;
    }
    // Number
    const token = consume();
    const num = parseFloat(token);
    if (isNaN(num)) return 0;
    return num;
  }

  const result = parseExpr();
  return result;
}

interface Template {
  id: string;
  name: string;
  category: string;
  description: string;
  shortcut?: string;
  frequency: number;
  lines: { accountCode: string; accountName: string; debitFormula?: string; creditFormula?: string }[];
}

interface RecentEntry {
  id: string;
  date: Date;
  description: string;
  amount: number;
  status: string;
}

const categoryColors: Record<string, string> = {
  SALES: 'bg-green-900/30 text-green-400',
  PURCHASES: 'bg-blue-900/30 text-blue-400',
  PAYROLL: 'bg-purple-900/30 text-purple-400',
  TAXES: 'bg-yellow-900/30 text-yellow-400',
  ADJUSTMENTS: 'bg-red-900/30 text-red-400',
  OTHER: 'bg-neutral-700 text-neutral-300',
};

export default function QuickEntryPage() {
  const { t, locale } = useI18n();

  const categoryLabels: Record<string, string> = {
    SALES: t('admin.quickEntry.categorySales'),
    PURCHASES: t('admin.quickEntry.categoryPurchases'),
    PAYROLL: t('admin.quickEntry.categoryPayroll'),
    TAXES: t('admin.quickEntry.categoryTaxes'),
    ADJUSTMENTS: t('admin.quickEntry.categoryAdjustments'),
    OTHER: t('admin.quickEntry.categoryOther'),
  };

  // Use real tax rates from the Canadian provinces library
  const qcTax = CANADIAN_PROVINCES.QC;
  const gstRate = qcTax.gst || 0.05;
  const qstRate = qcTax.qst || 0.09975;
  const totalTaxRate = qcTax.totalRate || 0.14975;

  const defaultTemplates: Template[] = [
    {
      id: 'tpl-1',
      name: 'Vente avec taxes (QC)',
      category: 'SALES',
      description: 'Vente \u00e0 un client qu\u00e9b\u00e9cois avec TPS/TVQ',
      shortcut: 'Ctrl+Shift+V',
      frequency: 45,
      lines: [
        { accountCode: '1110', accountName: 'Comptes clients', debitFormula: `amount * ${1 + totalTaxRate}` },
        { accountCode: '4010', accountName: 'Ventes', creditFormula: 'amount' },
        { accountCode: '2110', accountName: 'TPS \u00e0 payer', creditFormula: `amount * ${gstRate}` },
        { accountCode: '2120', accountName: 'TVQ \u00e0 payer', creditFormula: `amount * ${qstRate}` },
      ],
    },
    {
      id: 'tpl-2',
      name: 'Achat avec taxes (QC)',
      category: 'PURCHASES',
      description: 'Achat fournisseur avec CTI/RTI',
      shortcut: 'Ctrl+Shift+A',
      frequency: 32,
      lines: [
        { accountCode: '5010', accountName: 'Achats', debitFormula: 'amount' },
        { accountCode: '1115', accountName: 'TPS \u00e0 recevoir', debitFormula: `amount * ${gstRate}` },
        { accountCode: '1116', accountName: 'TVQ \u00e0 recevoir', debitFormula: `amount * ${qstRate}` },
        { accountCode: '2000', accountName: 'Fournisseurs', creditFormula: `amount * ${1 + totalTaxRate}` },
      ],
    },
    {
      id: 'tpl-3',
      name: 'Frais Stripe',
      category: 'OTHER',
      description: 'Frais de paiement Stripe',
      shortcut: 'Ctrl+Shift+S',
      frequency: 28,
      lines: [
        { accountCode: '6110', accountName: 'Frais Stripe', debitFormula: 'amount' },
        { accountCode: '1040', accountName: 'Compte Stripe', creditFormula: 'amount' },
      ],
    },
    {
      id: 'tpl-4',
      name: 'Frais de livraison',
      category: 'PURCHASES',
      description: 'Frais de livraison pay\u00e9s',
      frequency: 22,
      lines: [
        { accountCode: '6010', accountName: 'Frais de livraison', debitFormula: 'amount' },
        { accountCode: '1010', accountName: 'Compte bancaire', creditFormula: 'amount' },
      ],
    },
    {
      id: 'tpl-5',
      name: 'Paiement TPS/TVQ',
      category: 'TAXES',
      description: 'Paiement des taxes \u00e0 Revenu Qu\u00e9bec',
      frequency: 4,
      lines: [
        { accountCode: '2110', accountName: 'TPS \u00e0 payer', debitFormula: 'gst' },
        { accountCode: '2120', accountName: 'TVQ \u00e0 payer', debitFormula: 'qst' },
        { accountCode: '1010', accountName: 'Compte bancaire', creditFormula: 'gst + qst' },
      ],
    },
    {
      id: 'tpl-6',
      name: 'Amortissement',
      category: 'ADJUSTMENTS',
      description: 'Dotation aux amortissements',
      frequency: 12,
      lines: [
        { accountCode: '6800', accountName: 'Amortissement', debitFormula: 'amount' },
        { accountCode: '1590', accountName: 'Amort. cumul\u00e9', creditFormula: 'amount' },
      ],
    },
  ];

  const [templates, setTemplates] = useState<Template[]>(defaultTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);

  // Fetch recent entries from API
  useEffect(() => {
    const fetchRecentEntries = async () => {
      try {
        const res = await fetch('/api/accounting/entries?limit=5');
        if (res.ok) {
          const data = await res.json();
          const mapped: RecentEntry[] = (data.entries || []).slice(0, 5).map((e: Record<string, unknown>) => ({
            id: e.id as string,
            date: new Date((e.createdAt || e.date) as string),
            description: e.description as string,
            amount: (e.totalDebits as number) || (e.lines as Record<string, unknown>[])?.reduce((s: number, l: Record<string, unknown>) => s + (Number(l.debit) || 0), 0) || 0,
            status: e.status as string,
          }));
          setRecentEntries(mapped);
        }
      } catch (err) {
        console.error('Error fetching recent entries:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRecentEntries();
  }, []);

  // Fetch chart of accounts to enrich template account names
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/accounting/chart-of-accounts');
        if (res.ok) {
          const data = await res.json();
          if (data.accounts && Array.isArray(data.accounts)) {
            const accountMap = new Map<string, string>();
            data.accounts.forEach((a: Record<string, string>) => accountMap.set(a.code, a.name));

            // Update template account names from real chart of accounts
            setTemplates(prev => prev.map(tpl => ({
              ...tpl,
              lines: tpl.lines.map(line => ({
                ...line,
                accountName: accountMap.get(line.accountCode) || line.accountName,
              })),
            })));
          }
        }
      } catch (err) {
        console.error('Error fetching chart of accounts:', err);
      }
    };
    fetchAccounts();
  }, []);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey) {
      const template = templates.find(t =>
        t.shortcut?.toLowerCase() === `ctrl+shift+${e.key.toLowerCase()}`
      );
      if (template) {
        e.preventDefault();
        setSelectedTemplate(template);
      }
    }

    if (e.key === 'Escape') {
      setSelectedTemplate(null);
    }
  }, [templates]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleSave = async (andPost: boolean = false) => {
    if (!selectedTemplate) return;
    setSaving(true);

    try {
      const previewLines = calculatePreview();
      const lines = previewLines.map(line => ({
        accountCode: line.accountCode,
        description: selectedTemplate.name,
        debit: line.debit,
        credit: line.credit,
      }));

      const res = await fetch('/api/accounting/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: entryDate,
          description: `${selectedTemplate.name}${formValues.reference ? ` - ${formValues.reference}` : ''}`,
          type: 'MANUAL',
          reference: formValues.reference || undefined,
          lines,
          postImmediately: andPost,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const amount = parseFloat(formValues.amount || formValues.gst || '0');
        const newEntry: RecentEntry = {
          id: data.entry?.id || `e-${Date.now()}`,
          date: new Date(),
          description: selectedTemplate.name,
          amount,
          status: andPost ? 'POSTED' : 'DRAFT',
        };

        setRecentEntries(prev => [newEntry, ...prev.slice(0, 4)]);
        setSelectedTemplate(null);
        setFormValues({});
        setEntryDate(new Date().toISOString().split('T')[0]);

        // Update template frequency
        setTemplates(prev => prev.map(t =>
          t.id === selectedTemplate.id ? { ...t, frequency: t.frequency + 1 } : t
        ));
      } else {
        const errData = await res.json();
        toast.error(errData.error || t('admin.quickEntry.createError'));
      }
    } catch (err) {
      console.error('Error saving entry:', err);
      toast.error(t('admin.quickEntry.createEntryError'));
    } finally {
      setSaving(false);
    }
  };

  const calculatePreview = () => {
    if (!selectedTemplate) return [];

    const amount = parseFloat(formValues.amount || '0');
    const gst = parseFloat(formValues.gst || '0');
    const qst = parseFloat(formValues.qst || '0');
    const total = amount * (1 + totalTaxRate);

    return selectedTemplate.lines.map(line => {
      let debit = 0;
      let credit = 0;

      // SECURITY FIX: Replace eval() with safe arithmetic parser
      if (line.debitFormula) {
        debit = safeEvalFormula(line.debitFormula, { amount, gst, qst, total });
      }
      if (line.creditFormula) {
        credit = safeEvalFormula(line.creditFormula, { amount, gst, qst, total });
      }

      return {
        ...line,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
      };
    });
  };

  const sortedTemplates = [...templates].sort((a, b) => b.frequency - a.frequency);

  if (loading) return <div className="p-8 text-center">{t('admin.quickEntry.loading')}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">{t('admin.quickEntry.title')}</h1>
          <p className="text-neutral-400 mt-1">{t('admin.quickEntry.subtitle')}</p>
        </div>
        <button className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg">
          {t('admin.quickEntry.newTemplate')}
        </button>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="bg-neutral-800/50 rounded-xl p-4 border border-neutral-700">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-400">{t('admin.quickEntry.keyboardShortcuts')}</span>
          {templates.filter(t => t.shortcut).map(t => (
            <span key={t.id} className="px-2 py-1 bg-neutral-700 rounded text-neutral-300 font-mono text-xs">
              {t.shortcut} → {t.name}
            </span>
          ))}
          <span className="px-2 py-1 bg-neutral-700 rounded text-neutral-300 font-mono text-xs">
            {t('admin.quickEntry.ctrlEnterSave')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-medium text-white">{t('admin.quickEntry.templatesByFrequency')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`p-4 rounded-xl border text-start transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'bg-sky-600/20 border-sky-500'
                    : 'bg-neutral-800 border-neutral-700 hover:border-neutral-600'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium text-white">{template.name}</h3>
                    <p className="text-sm text-neutral-400 mt-1">{template.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${categoryColors[template.category]}`}>
                    {categoryLabels[template.category]}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-3">
                  {template.shortcut && (
                    <span className="px-2 py-0.5 bg-neutral-700 rounded text-xs text-neutral-400 font-mono">
                      {template.shortcut}
                    </span>
                  )}
                  <span className="text-xs text-neutral-500">
                    {t('admin.quickEntry.usedCount', { count: template.frequency })}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent entries */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-white">{t('admin.quickEntry.recentEntries')}</h2>

          <div className="bg-neutral-800 rounded-xl border border-neutral-700">
            {recentEntries.map((entry, i) => (
              <div
                key={entry.id}
                className={`p-3 ${i < recentEntries.length - 1 ? 'border-b border-neutral-700' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-white">{entry.description}</p>
                    <p className="text-xs text-neutral-500">
                      {entry.date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-medium text-white">
                      {entry.amount.toLocaleString(locale, { style: 'currency', currency: 'CAD' })}
                    </p>
                    <span className={`text-xs ${entry.status === 'POSTED' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {entry.status === 'POSTED' ? t('admin.quickEntry.statusPosted') : t('admin.quickEntry.statusDraft')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick duplicate */}
          <div className="bg-neutral-800 rounded-xl p-4 border border-dashed border-neutral-600">
            <p className="text-sm text-neutral-400 text-center">
              {t('admin.quickEntry.duplicateHint')}
            </p>
          </div>
        </div>
      </div>

      {/* Entry Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedTemplate.name}</h2>
                <p className="text-sm text-neutral-400">{selectedTemplate.description}</p>
              </div>
              <button onClick={() => setSelectedTemplate(null)} className="text-neutral-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Form inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.quickEntry.date')}</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    {selectedTemplate.category === 'TAXES' ? t('admin.quickEntry.tps') : t('admin.quickEntry.amountExclTax')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formValues.amount || formValues.gst || ''}
                    onChange={e => setFormValues(prev => ({
                      ...prev,
                      [selectedTemplate.category === 'TAXES' ? 'gst' : 'amount']: e.target.value
                    }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                {selectedTemplate.category === 'TAXES' && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.quickEntry.tvq')}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formValues.qst || ''}
                      onChange={e => setFormValues(prev => ({ ...prev, qst: e.target.value }))}
                      className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                      placeholder="0.00"
                    />
                  </div>
                )}
                <div className={selectedTemplate.category === 'TAXES' ? '' : 'col-span-2'}>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">{t('admin.quickEntry.reference')}</label>
                  <input
                    type="text"
                    value={formValues.reference || ''}
                    onChange={e => setFormValues(prev => ({ ...prev, reference: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    placeholder={t('admin.quickEntry.referencePlaceholder')}
                  />
                </div>
              </div>

              {/* Preview */}
              <div>
                <h3 className="text-sm font-medium text-neutral-300 mb-2">{t('admin.quickEntry.entryPreview')}</h3>
                <div className="bg-neutral-900 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-700/50">
                      <tr>
                        <th className="px-3 py-2 text-start text-xs text-neutral-400">{t('admin.quickEntry.account')}</th>
                        <th className="px-3 py-2 text-end text-xs text-neutral-400">{t('admin.quickEntry.debit')}</th>
                        <th className="px-3 py-2 text-end text-xs text-neutral-400">{t('admin.quickEntry.credit')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                      {calculatePreview().map((line, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <span className="text-neutral-400 me-2">{line.accountCode}</span>
                            <span className="text-white">{line.accountName}</span>
                          </td>
                          <td className="px-3 py-2 text-end font-mono text-green-400">
                            {line.debit > 0 ? line.debit.toFixed(2) : ''}
                          </td>
                          <td className="px-3 py-2 text-end font-mono text-red-400">
                            {line.credit > 0 ? line.credit.toFixed(2) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-neutral-700/30">
                      <tr>
                        <td className="px-3 py-2 font-medium text-white">{t('admin.quickEntry.totalRow')}</td>
                        <td className="px-3 py-2 text-end font-mono font-medium text-green-400">
                          {calculatePreview().reduce((sum, l) => sum + l.debit, 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-end font-mono font-medium text-red-400">
                          {calculatePreview().reduce((sum, l) => sum + l.credit, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-neutral-700 flex justify-between">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-4 py-2 text-neutral-400 hover:text-white"
              >
                {t('admin.quickEntry.cancelEsc')}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || !formValues.amount}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? t('admin.quickEntry.saving') : t('admin.quickEntry.saveDraft')}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || !formValues.amount}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? t('admin.quickEntry.saving') : t('admin.quickEntry.saveAndPost')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
