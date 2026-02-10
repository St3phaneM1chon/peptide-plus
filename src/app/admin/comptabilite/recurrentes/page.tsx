'use client';

import { useState, useEffect } from 'react';

interface RecurringEntry {
  id: string;
  name: string;
  description: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  dayOfMonth?: number;
  amount: number;
  lines: { accountCode: string; accountName: string; debit: number; credit: number }[];
  nextRunDate: Date;
  lastRunDate?: Date;
  isActive: boolean;
  autoPost: boolean;
  totalRuns: number;
}

const frequencyLabels: Record<string, string> = {
  DAILY: 'Quotidien',
  WEEKLY: 'Hebdomadaire',
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
};

const predefinedTemplates = [
  { name: 'Amortissement équipement', description: 'Amortissement mensuel', frequency: 'MONTHLY', amount: 125 },
  { name: 'Hébergement Azure', description: 'Frais mensuels Azure', frequency: 'MONTHLY', amount: 185.50 },
  { name: 'Abonnement OpenAI', description: 'API ChatGPT', frequency: 'MONTHLY', amount: 50 },
  { name: 'Domaines & SSL', description: 'Renouvellement annuel', frequency: 'YEARLY', amount: 200 },
  { name: 'Assurance entreprise', description: 'Prime mensuelle', frequency: 'MONTHLY', amount: 150 },
];

export default function RecurringEntriesPage() {
  const [entries, setEntries] = useState<RecurringEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState<RecurringEntry | null>(null);
  const [, setEditingEntry] = useState<RecurringEntry | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    amount: 0,
    debitAccount: '6800',
    creditAccount: '1590',
    autoPost: true,
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const response = await fetch('/api/accounting/recurring-entries');
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error) {
      console.error('Error loading recurring entries:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessDue = async () => {
    setProcessing(true);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    alert('Écritures récurrentes traitées avec succès!');
    setProcessing(false);
    loadEntries();
  };

  const handleToggleActive = (id: string) => {
    setEntries(prev => prev.map(e => 
      e.id === id ? { ...e, isActive: !e.isActive } : e
    ));
  };

  const handleSave = () => {
    const newEntry: RecurringEntry = {
      id: `rec-${Date.now()}`,
      name: formData.name,
      description: formData.description,
      frequency: formData.frequency as RecurringEntry['frequency'],
      dayOfMonth: formData.dayOfMonth,
      amount: formData.amount,
      lines: [
        { accountCode: formData.debitAccount, accountName: 'Compte débit', debit: formData.amount, credit: 0 },
        { accountCode: formData.creditAccount, accountName: 'Compte crédit', debit: 0, credit: formData.amount },
      ],
      nextRunDate: new Date(formData.startDate),
      isActive: true,
      autoPost: formData.autoPost,
      totalRuns: 0,
    };
    setEntries(prev => [...prev, newEntry]);
    setShowModal(false);
    setFormData({
      name: '',
      description: '',
      frequency: 'MONTHLY',
      dayOfMonth: 1,
      amount: 0,
      debitAccount: '6800',
      creditAccount: '1590',
      autoPost: true,
      startDate: new Date().toISOString().split('T')[0],
    });
  };

  const applyTemplate = (template: typeof predefinedTemplates[0]) => {
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      frequency: template.frequency,
      amount: template.amount,
    }));
  };

  const getDaysUntil = (date: Date) => {
    const now = new Date();
    const diff = Math.ceil((new Date(date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  // Stats
  const totalActive = entries.filter(e => e.isActive).length;
  const totalMonthly = entries.filter(e => e.isActive).reduce((sum, e) => {
    const multiplier = { DAILY: 30, WEEKLY: 4, MONTHLY: 1, QUARTERLY: 0.33, YEARLY: 0.083 };
    return sum + (e.amount * (multiplier[e.frequency] || 1));
  }, 0);
  const nextDue = entries.filter(e => e.isActive).sort((a, b) => 
    new Date(a.nextRunDate).getTime() - new Date(b.nextRunDate).getTime()
  )[0];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Écritures récurrentes</h1>
          <p className="text-neutral-400 mt-1">Automatisez vos écritures périodiques</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleProcessDue}
            disabled={processing}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {processing ? (
              <><span className="animate-spin">⏳</span> Traitement...</>
            ) : (
              <><span>▶</span> Exécuter maintenant</>
            )}
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-2"
          >
            <span>+</span> Nouvelle récurrence
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Récurrences actives</p>
          <p className="text-2xl font-bold text-white mt-1">{totalActive}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Coût mensuel estimé</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{totalMonthly.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Prochaine exécution</p>
          <p className="text-2xl font-bold text-white mt-1">
            {nextDue ? `${getDaysUntil(nextDue.nextRunDate)} jours` : '-'}
          </p>
          {nextDue && <p className="text-xs text-neutral-500">{nextDue.name}</p>}
        </div>
        <div className="bg-neutral-800 rounded-xl p-4 border border-neutral-700">
          <p className="text-sm text-neutral-400">Exécutions ce mois</p>
          <p className="text-2xl font-bold text-white mt-1">{entries.reduce((sum, e) => sum + e.totalRuns, 0)}</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-neutral-800 rounded-xl border border-neutral-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Nom</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Fréquence</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Montant</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-400 uppercase">Prochaine</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-400 uppercase">Auto-post</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-400 uppercase">Statut</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-neutral-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-700">
            {entries.map(entry => (
              <tr key={entry.id} className={`hover:bg-neutral-700/30 ${!entry.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{entry.name}</p>
                  <p className="text-sm text-neutral-400">{entry.description}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-neutral-700 text-neutral-300 rounded text-sm">
                    {frequencyLabels[entry.frequency]}
                  </span>
                  {entry.dayOfMonth && (
                    <span className="ml-1 text-sm text-neutral-500">le {entry.dayOfMonth}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-white">
                  {entry.amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                </td>
                <td className="px-4 py-3">
                  <p className="text-white">{new Date(entry.nextRunDate).toLocaleDateString('fr-CA')}</p>
                  <p className="text-xs text-neutral-500">
                    Dans {getDaysUntil(entry.nextRunDate)} jours
                  </p>
                </td>
                <td className="px-4 py-3 text-center">
                  {entry.autoPost ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    <span className="text-neutral-500">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleToggleActive(entry.id)}
                    className={`px-2 py-1 rounded text-xs ${
                      entry.isActive
                        ? 'bg-green-900/30 text-green-400'
                        : 'bg-neutral-700 text-neutral-400'
                    }`}
                  >
                    {entry.isActive ? 'Actif' : 'Inactif'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowPreview(entry)}
                      className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white"
                      title="Aperçu"
                    >
                      👁
                    </button>
                    <button
                      onClick={() => setEditingEntry(entry)}
                      className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-white"
                      title="Modifier"
                    >
                      ✏️
                    </button>
                    <button
                      className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-red-400"
                      title="Supprimer"
                    >
                      🗑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-700">
              <h2 className="text-xl font-bold text-white">Nouvelle écriture récurrente</h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Templates rapides */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Templates rapides</label>
                <div className="flex flex-wrap gap-2">
                  {predefinedTemplates.map((tpl, i) => (
                    <button
                      key={i}
                      onClick={() => applyTemplate(tpl)}
                      className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-sm text-neutral-300 rounded-full"
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Nom</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                    placeholder="Ex: Amortissement mensuel"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Montant</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Fréquence</label>
                  <select
                    value={formData.frequency}
                    onChange={e => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    {Object.entries(frequencyLabels).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Jour du mois</label>
                  <select
                    value={formData.dayOfMonth}
                    onChange={e => setFormData(prev => ({ ...prev, dayOfMonth: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Date début</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Compte débit</label>
                  <select
                    value={formData.debitAccount}
                    onChange={e => setFormData(prev => ({ ...prev, debitAccount: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    <option value="6800">6800 - Amortissement</option>
                    <option value="6310">6310 - Hébergement</option>
                    <option value="6330">6330 - Services SaaS</option>
                    <option value="6210">6210 - Marketing</option>
                    <option value="6010">6010 - Frais de livraison</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">Compte crédit</label>
                  <select
                    value={formData.creditAccount}
                    onChange={e => setFormData(prev => ({ ...prev, creditAccount: e.target.value }))}
                    className="w-full px-3 py-2 bg-neutral-700 border border-neutral-600 rounded-lg text-white"
                  >
                    <option value="1590">1590 - Amort. cumulé</option>
                    <option value="1010">1010 - Banque</option>
                    <option value="2000">2000 - Fournisseurs</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.autoPost}
                  onChange={e => setFormData(prev => ({ ...prev, autoPost: e.target.checked }))}
                  className="rounded border-neutral-600 bg-neutral-700 text-amber-500"
                />
                <span className="text-neutral-300">Valider automatiquement les écritures</span>
              </label>
            </div>

            <div className="p-6 border-t border-neutral-700 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-neutral-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.amount}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
              >
                Créer la récurrence
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-800 rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Aperçu des prochaines exécutions</h2>
              <button onClick={() => setShowPreview(null)} className="text-neutral-400 hover:text-white">✕</button>
            </div>
            <div className="p-6">
              <h3 className="font-medium text-white mb-4">{showPreview.name}</h3>
              <div className="space-y-2">
                {[0, 1, 2, 3, 4, 5].map(i => {
                  const date = new Date(showPreview.nextRunDate);
                  if (showPreview.frequency === 'MONTHLY') date.setMonth(date.getMonth() + i);
                  else if (showPreview.frequency === 'WEEKLY') date.setDate(date.getDate() + 7 * i);
                  else if (showPreview.frequency === 'QUARTERLY') date.setMonth(date.getMonth() + 3 * i);
                  else if (showPreview.frequency === 'YEARLY') date.setFullYear(date.getFullYear() + i);
                  
                  return (
                    <div key={i} className="flex justify-between items-center p-3 bg-neutral-700/50 rounded-lg">
                      <span className="text-neutral-300">{date.toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                      <span className="font-medium text-amber-400">{showPreview.amount.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-neutral-500 mt-4">Coût annuel estimé: {(showPreview.amount * (showPreview.frequency === 'MONTHLY' ? 12 : showPreview.frequency === 'WEEKLY' ? 52 : showPreview.frequency === 'QUARTERLY' ? 4 : 1)).toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
