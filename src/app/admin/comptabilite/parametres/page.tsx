'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Settings, Download } from 'lucide-react';
import { PageHeader, Button, StatusBadge, FormField, Input } from '@/components/admin';

interface AccountingSettingsData {
  companyName: string;
  neq: string;
  tpsNumber: string;
  tvqNumber: string;
  fiscalYearStart: number;
  accountingMethod: string;
  defaultCurrency: string;
  taxFilingFrequency: string;
  autoCreateSaleEntries: boolean;
  autoReconcileStripe: boolean;
  [key: string]: unknown;
}

export default function ParametresComptablesPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'fiscal' | 'currencies' | 'integrations'>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [settings, setSettings] = useState<AccountingSettingsData>({
    companyName: '',
    neq: '',
    tpsNumber: '',
    tvqNumber: '',
    fiscalYearStart: 1,
    accountingMethod: 'ACCRUAL',
    defaultCurrency: 'CAD',
    taxFilingFrequency: 'MONTHLY',
    autoCreateSaleEntries: true,
    autoReconcileStripe: true,
  });

  const currencies = [
    { code: 'CAD', name: 'Dollar canadien', symbol: '$', rate: 1, isDefault: true, active: true },
    { code: 'USD', name: 'Dollar américain', symbol: '$', rate: 1.36, isDefault: false, active: true },
    { code: 'EUR', name: 'Euro', symbol: '€', rate: 1.47, isDefault: false, active: true },
    { code: 'GBP', name: 'Livre sterling', symbol: '£', rate: 1.71, isDefault: false, active: false },
  ];

  const integrations = [
    { id: 'stripe', name: 'Stripe', status: 'connected', lastSync: '2026-01-25T14:30:00Z', icon: '💳' },
    { id: 'paypal', name: 'PayPal', status: 'connected', lastSync: '2026-01-25T14:30:00Z', icon: '🅿️' },
    { id: 'quickbooks', name: 'QuickBooks', status: 'not_connected', lastSync: null, icon: '📊' },
    { id: 'bank', name: 'Desjardins', status: 'connected', lastSync: '2026-01-25T10:00:00Z', icon: '🏦' },
  ];

  // Fetch settings from API
  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/accounting/settings');
      if (!res.ok) throw new Error('Erreur lors du chargement des paramètres');
      const data = await res.json();
      if (data.settings) {
        setSettings({
          companyName: data.settings.companyName || '',
          neq: data.settings.neq || '',
          tpsNumber: data.settings.tpsNumber || '',
          tvqNumber: data.settings.tvqNumber || '',
          fiscalYearStart: data.settings.fiscalYearStart || 1,
          accountingMethod: data.settings.accountingMethod || 'ACCRUAL',
          defaultCurrency: data.settings.defaultCurrency || 'CAD',
          taxFilingFrequency: data.settings.taxFilingFrequency || 'MONTHLY',
          autoCreateSaleEntries: data.settings.autoCreateSaleEntries ?? true,
          autoReconcileStripe: data.settings.autoReconcileStripe ?? true,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  // Save settings to API
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/accounting/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur lors de la sauvegarde');
      }
      setSaveMessage('Paramètres sauvegardés avec succès');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Map fiscal year start month to month-day format for display
  const fiscalYearEndMap: Record<number, string> = {
    1: '12-31',   // fiscal year starts Jan -> ends Dec 31
    4: '03-31',   // starts April -> ends March 31
    7: '06-30',   // starts July -> ends June 30
    10: '09-30',  // starts October -> ends September 30
  };
  const fiscalYearDisplay = fiscalYearEndMap[settings.fiscalYearStart] || '12-31';

  const handleFiscalYearChange = (endDate: string) => {
    const reverseMap: Record<string, number> = {
      '12-31': 1,
      '03-31': 4,
      '06-30': 7,
      '09-30': 10,
    };
    setSettings({ ...settings, fiscalYearStart: reverseMap[endDate] || 1 });
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;
  if (error) return <div className="p-8 text-center text-red-600">Erreur: {error}</div>;

  const tabs = [
    { id: 'general' as const, label: 'Général' },
    { id: 'fiscal' as const, label: 'Fiscal' },
    { id: 'currencies' as const, label: 'Devises' },
    { id: 'integrations' as const, label: 'Intégrations' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paramètres comptables"
        subtitle="Configurez votre système comptable"
      />

      {/* Save success message */}
      {saveMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 text-sm">
          {saveMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* General Settings */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Informations de l&apos;entreprise</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label="Nom de l'entreprise">
                <Input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                />
              </FormField>
              <FormField label="Numéro d'entreprise (NEQ)">
                <Input
                  type="text"
                  value={settings.neq}
                  onChange={(e) => setSettings({ ...settings, neq: e.target.value })}
                />
              </FormField>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Paramètres comptables</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label="Fin d'exercice fiscal">
                <select
                  value={fiscalYearDisplay}
                  onChange={(e) => handleFiscalYearChange(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="12-31">31 décembre</option>
                  <option value="03-31">31 mars</option>
                  <option value="06-30">30 juin</option>
                  <option value="09-30">30 septembre</option>
                </select>
              </FormField>
              <FormField label="Méthode comptable">
                <select
                  value={settings.accountingMethod}
                  onChange={(e) => setSettings({ ...settings, accountingMethod: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="ACCRUAL">Comptabilité d&apos;exercice</option>
                  <option value="CASH">Comptabilité de caisse</option>
                </select>
              </FormField>
              <FormField label="Devise par défaut">
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="CAD">CAD - Dollar canadien</option>
                  <option value="USD">USD - Dollar américain</option>
                </select>
              </FormField>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Automatisations</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Rapprochement automatique Stripe</p>
                  <p className="text-sm text-slate-500">Rapprocher automatiquement les transactions Stripe</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, autoReconcileStripe: !settings.autoReconcileStripe })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.autoReconcileStripe ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.autoReconcileStripe ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Écritures de vente automatiques</p>
                  <p className="text-sm text-slate-500">Générer automatiquement les écritures lors des ventes</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, autoCreateSaleEntries: !settings.autoCreateSaleEntries })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.autoCreateSaleEntries ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.autoCreateSaleEntries ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fiscal Settings */}
      {activeTab === 'fiscal' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Numéros de taxes</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label="Numéro TPS (fédéral)">
                <Input
                  type="text"
                  value={settings.tpsNumber}
                  onChange={(e) => setSettings({ ...settings, tpsNumber: e.target.value })}
                  placeholder="123456789RT0001"
                />
              </FormField>
              <FormField label="Numéro TVQ (Québec)">
                <Input
                  type="text"
                  value={settings.tvqNumber}
                  onChange={(e) => setSettings({ ...settings, tvqNumber: e.target.value })}
                  placeholder="1234567890TQ0001"
                />
              </FormField>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Taux de taxes</h3>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Taxe</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">Juridiction</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">Taux</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500 uppercase">Actif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr><td className="px-4 py-3">TPS</td><td className="px-4 py-3 text-slate-600">Canada (fédéral)</td><td className="px-4 py-3 text-right">5%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
                <tr><td className="px-4 py-3">TVQ</td><td className="px-4 py-3 text-slate-600">Québec</td><td className="px-4 py-3 text-right">9.975%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
                <tr><td className="px-4 py-3">TVH</td><td className="px-4 py-3 text-slate-600">Ontario</td><td className="px-4 py-3 text-right">13%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
                <tr><td className="px-4 py-3">TVH</td><td className="px-4 py-3 text-slate-600">Nouvelle-Écosse</td><td className="px-4 py-3 text-right">15%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
                <tr><td className="px-4 py-3">PST</td><td className="px-4 py-3 text-slate-600">Colombie-Britannique</td><td className="px-4 py-3 text-right">7%</td><td className="px-4 py-3 text-center text-green-600">&#10003;</td></tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Fréquence de déclaration</h3>
            <div className="grid grid-cols-2 gap-6">
              <FormField label="TPS/TVQ">
                <select
                  value={settings.taxFilingFrequency}
                  onChange={(e) => setSettings({ ...settings, taxFilingFrequency: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                >
                  <option value="MONTHLY">Mensuelle</option>
                  <option value="QUARTERLY">Trimestrielle</option>
                  <option value="ANNUAL">Annuelle</option>
                </select>
              </FormField>
            </div>
          </div>
        </div>
      )}

      {/* Currencies */}
      {activeTab === 'currencies' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Devises configurées</h3>
              <Button variant="ghost" size="sm" icon={Plus} className="text-emerald-700 hover:bg-emerald-50">
                Ajouter devise
              </Button>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Devise</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Symbole</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Taux (vs CAD)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Par défaut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {currencies.map((currency) => (
                  <tr key={currency.code} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{currency.code}</p>
                      <p className="text-sm text-slate-500">{currency.name}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{currency.symbol}</td>
                    <td className="px-4 py-3 text-right font-mono">{currency.rate.toFixed(4)}</td>
                    <td className="px-4 py-3 text-center">
                      {currency.isDefault && <span className="text-emerald-600">&#10003;</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className={`w-10 h-5 rounded-full transition-colors relative ${currency.active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${currency.active ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="text-blue-500">&#8505;&#65039;</span>
              <div>
                <p className="font-medium text-blue-900">Mise à jour automatique des taux</p>
                <p className="text-sm text-blue-700">Les taux de change sont mis à jour quotidiennement depuis la Banque du Canada.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Integrations */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {integrations.map((integration) => (
              <div key={integration.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{integration.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-900">{integration.name}</h3>
                      <StatusBadge
                        variant={integration.status === 'connected' ? 'success' : 'neutral'}
                        dot
                      >
                        {integration.status === 'connected' ? 'Connecté' : 'Non connecté'}
                      </StatusBadge>
                    </div>
                    {integration.lastSync && (
                      <p className="text-sm text-slate-500 mt-1">
                        Dernière sync: {new Date(integration.lastSync).toLocaleString('fr-CA')}
                      </p>
                    )}
                    <div className="mt-3">
                      {integration.status === 'connected' ? (
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" icon={RefreshCw} className="text-blue-700 hover:bg-blue-50">
                            Synchroniser
                          </Button>
                          <Button variant="ghost" size="sm" icon={Settings}>
                            Configurer
                          </Button>
                        </div>
                      ) : (
                        <Button variant="primary" size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                          Connecter
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-900 mb-4">Export comptable</h3>
            <p className="text-slate-600 mb-4">Exportez vos données vers un logiciel comptable externe.</p>
            <div className="flex gap-3">
              <Button variant="secondary" icon={Download}>Export QuickBooks (.IIF)</Button>
              <Button variant="secondary" icon={Download}>Export Sage (.CSV)</Button>
              <Button variant="secondary" icon={Download}>Export Excel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          variant="primary"
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Sauvegarde...' : 'Sauvegarder les modifications'}
        </Button>
      </div>
    </div>
  );
}
