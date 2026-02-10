'use client';

import { useState, useEffect, useCallback } from 'react';

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
  TAXES: 'bg-amber-900/30 text-amber-400',
  ADJUSTMENTS: 'bg-red-900/30 text-red-400',
  OTHER: 'bg-neutral-700 text-neutral-300',
};

const categoryLabels: Record<string, string> = {
  SALES: 'Ventes',
  PURCHASES: 'Achats',
  PAYROLL: 'Salaires',
  TAXES: 'Taxes',
  ADJUSTMENTS: 'Ajustements',
  OTHER: 'Autres',
};

export default function QuickEntryPage() {
  const [templates, setTemplates] = useState<Template[]>([
    {
      id: 'tpl-1',
      name: 'Vente avec taxes (QC)',
      category: 'SALES',
      description: 'Vente à un client québécois avec TPS/TVQ',
      shortcut: 'Ctrl+Shift+V',
      frequency: 45,
      lines: [
        { accountCode: '1110', accountName: 'Comptes clients', debitFormula: 'amount * 1.14975' },
        { accountCode: '4010', accountName: 'Ventes', creditFormula: 'amount' },
        { accountCode: '2110', accountName: 'TPS à payer', creditFormula: 'amount * 0.05' },
        { accountCode: '2120', accountName: 'TVQ à payer', creditFormula: 'amount * 0.09975' },
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
        { accountCode: '1115', accountName: 'TPS à recevoir', debitFormula: 'amount * 0.05' },
        { accountCode: '1116', accountName: 'TVQ à recevoir', debitFormula: 'amount * 0.09975' },
        { accountCode: '2000', accountName: 'Fournisseurs', creditFormula: 'amount * 1.14975' },
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
      description: 'Frais de livraison payés',
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
      description: 'Paiement des taxes à Revenu Québec',
      frequency: 4,
      lines: [
        { accountCode: '2110', accountName: 'TPS à payer', debitFormula: 'gst' },
        { accountCode: '2120', accountName: 'TVQ à payer', debitFormula: 'qst' },
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
        { accountCode: '1590', accountName: 'Amort. cumulé', creditFormula: 'amount' },
      ],
    },
  ]);

  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [recentEntries, setRecentEntries] = useState<RecentEntry[]>([
    { id: 'e1', date: new Date(), description: 'Vente ORD-2026-0089', amount: 234.50, status: 'POSTED' },
    { id: 'e2', date: new Date(Date.now() - 3600000), description: 'Achat Azure', amount: 185.50, status: 'DRAFT' },
    { id: 'e3', date: new Date(Date.now() - 7200000), description: 'Frais Stripe', amount: 12.34, status: 'POSTED' },
  ]);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const amount = parseFloat(formValues.amount || '0');
    const newEntry: RecentEntry = {
      id: `e-${Date.now()}`,
      date: new Date(),
      description: selectedTemplate?.name || 'Nouvelle écriture',
      amount,
      status: andPost ? 'POSTED' : 'DRAFT',
    };
    
    setRecentEntries(prev => [newEntry, ...prev.slice(0, 4)]);
    setSaving(false);
    setSelectedTemplate(null);
    setFormValues({});
    
    // Update template frequency
    if (selectedTemplate) {
      setTemplates(prev => prev.map(t =>
        t.id === selectedTemplate.id ? { ...t, frequency: t.frequency + 1 } : t
      ));
    }
  };

  const calculatePreview = () => {
    if (!selectedTemplate) return [];
    
    const amount = parseFloat(formValues.amount || '0');
    const gst = parseFloat(formValues.gst || '0');
    const qst = parseFloat(formValues.qst || '0');
    const total = amount * 1.14975;
    
    return selectedTemplate.lines.map(line => {
      let debit = 0;
      let credit = 0;
      
      if (line.debitFormula) {
        debit = eval(line.debitFormula.replace(/amount/g, String(amount)).replace(/gst/g, String(gst)).replace(/qst/g, String(qst)).replace(/total/g, String(total)));
      }
      if (line.creditFormula) {
        credit = eval(line.creditFormula.replace(/amount/g, String(amount)).replace(/gst/g, String(gst)).replace(/qst/g, String(qst)).replace(/total/g, String(total)));
      }
      
      return {
        ...line,
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
      };
    });
  };

  const sortedTemplates = [...templates].sort((a, b) => b.frequency - a.frequency);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Saisie rapide</h1>
          <p className="text-neutral-400 mt-1">Templates et raccourcis pour accélérer la saisie</p>
        </div>
        <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
          + Nouveau template
        </button>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="bg-neutral-800/50 rounded-xl p-4 border border-neutral-700">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-neutral-400">Raccourcis clavier:</span>
          {templates.filter(t => t.shortcut).map(t => (
            <span key={t.id} className="px-2 py-1 bg-neutral-700 rounded text-neutral-300 font-mono text-xs">
              {t.shortcut} → {t.name}
            </span>
          ))}
          <span className="px-2 py-1 bg-neutral-700 rounded text-neutral-300 font-mono text-xs">
            Ctrl+Enter → Sauvegarder et valider
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-medium text-white">Templates (par fréquence d'utilisation)</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedTemplates.map(template => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedTemplate?.id === template.id
                    ? 'bg-amber-600/20 border-amber-500'
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
                    Utilisé {template.frequency}x
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent entries */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-white">Écritures récentes</h2>
          
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
                      {entry.date.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-white">
                      {entry.amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                    </p>
                    <span className={`text-xs ${entry.status === 'POSTED' ? 'text-green-400' : 'text-amber-400'}`}>
                      {entry.status === 'POSTED' ? 'Validée' : 'Brouillon'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Quick duplicate */}
          <div className="bg-neutral-800 rounded-xl p-4 border border-dashed border-neutral-600">
            <p className="text-sm text-neutral-400 text-center">
              Cliquez sur une écriture récente pour la dupliquer
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
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Date</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    {selectedTemplate.category === 'TAXES' ? 'TPS' : 'Montant HT'}
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
                    <label className="block text-sm font-medium text-neutral-300 mb-1">TVQ</label>
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
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Référence</label>
                  <input
                    type="text"
                    value={formValues.reference || ''}
                    onChange={e => setFormValues(prev => ({ ...prev, reference: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    placeholder="N° commande, facture..."
                  />
                </div>
              </div>

              {/* Preview */}
              <div>
                <h3 className="text-sm font-medium text-neutral-300 mb-2">Aperçu de l'écriture</h3>
                <div className="bg-neutral-900 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs text-neutral-400">Compte</th>
                        <th className="px-3 py-2 text-right text-xs text-neutral-400">Débit</th>
                        <th className="px-3 py-2 text-right text-xs text-neutral-400">Crédit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                      {calculatePreview().map((line, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <span className="text-neutral-400 mr-2">{line.accountCode}</span>
                            <span className="text-white">{line.accountName}</span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-green-400">
                            {line.debit > 0 ? line.debit.toFixed(2) : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-red-400">
                            {line.credit > 0 ? line.credit.toFixed(2) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-neutral-700/30">
                      <tr>
                        <td className="px-3 py-2 font-medium text-white">Total</td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-green-400">
                          {calculatePreview().reduce((sum, l) => sum + l.debit, 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-medium text-red-400">
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
                Annuler (Esc)
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSave(false)}
                  disabled={saving || !formValues.amount}
                  className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer brouillon'}
                </button>
                <button
                  onClick={() => handleSave(true)}
                  disabled={saving || !formValues.amount}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : 'Enregistrer et valider (Ctrl+Enter)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
