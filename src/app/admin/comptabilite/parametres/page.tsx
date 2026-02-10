'use client';

import { useState } from 'react';

export default function ParametresComptablesPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'fiscal' | 'currencies' | 'integrations'>('general');

  const [settings, setSettings] = useState({
    companyName: 'BioCycle Peptides Inc.',
    businessNumber: '123456789RC0001',
    tpsNumber: '123456789RT0001',
    tvqNumber: '1234567890TQ0001',
    fiscalYearEnd: '12-31',
    accountingMethod: 'accrual',
    defaultCurrency: 'CAD',
    taxIncluded: false,
    autoReconcile: true,
    recurringEntries: true,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres comptables</h1>
          <p className="text-gray-500">Configurez votre système comptable</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {[
            { id: 'general', label: 'Général' },
            { id: 'fiscal', label: 'Fiscal' },
            { id: 'currencies', label: 'Devises' },
            { id: 'integrations', label: 'Intégrations' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`py-3 border-b-2 font-medium text-sm ${
                activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-500'
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Informations de l'entreprise</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro d'entreprise (NEQ)</label>
                <input
                  type="text"
                  value={settings.businessNumber}
                  onChange={(e) => setSettings({ ...settings, businessNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Paramètres comptables</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fin d'exercice fiscal</label>
                <select
                  value={settings.fiscalYearEnd}
                  onChange={(e) => setSettings({ ...settings, fiscalYearEnd: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="12-31">31 décembre</option>
                  <option value="03-31">31 mars</option>
                  <option value="06-30">30 juin</option>
                  <option value="09-30">30 septembre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Méthode comptable</label>
                <select
                  value={settings.accountingMethod}
                  onChange={(e) => setSettings({ ...settings, accountingMethod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="accrual">Comptabilité d'exercice</option>
                  <option value="cash">Comptabilité de caisse</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Devise par défaut</label>
                <select
                  value={settings.defaultCurrency}
                  onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="CAD">CAD - Dollar canadien</option>
                  <option value="USD">USD - Dollar américain</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="taxIncluded"
                  checked={settings.taxIncluded}
                  onChange={(e) => setSettings({ ...settings, taxIncluded: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                />
                <label htmlFor="taxIncluded" className="text-sm text-gray-700">Prix incluent les taxes</label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Automatisations</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Rapprochement automatique</p>
                  <p className="text-sm text-gray-500">Rapprocher automatiquement les transactions correspondantes</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, autoReconcile: !settings.autoReconcile })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.autoReconcile ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.autoReconcile ? 'right-1' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Écritures récurrentes</p>
                  <p className="text-sm text-gray-500">Générer automatiquement les écritures périodiques</p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, recurringEntries: !settings.recurringEntries })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    settings.recurringEntries ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    settings.recurringEntries ? 'right-1' : 'left-1'
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
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Numéros de taxes</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro TPS (fédéral)</label>
                <input
                  type="text"
                  value={settings.tpsNumber}
                  onChange={(e) => setSettings({ ...settings, tpsNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="123456789RT0001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro TVQ (Québec)</label>
                <input
                  type="text"
                  value={settings.tvqNumber}
                  onChange={(e) => setSettings({ ...settings, tvqNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="1234567890TQ0001"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Taux de taxes</h3>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Taxe</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Juridiction</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Taux</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Actif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr><td className="px-4 py-3">TPS</td><td className="px-4 py-3 text-gray-600">Canada (fédéral)</td><td className="px-4 py-3 text-right">5%</td><td className="px-4 py-3 text-center text-green-600">✓</td></tr>
                <tr><td className="px-4 py-3">TVQ</td><td className="px-4 py-3 text-gray-600">Québec</td><td className="px-4 py-3 text-right">9.975%</td><td className="px-4 py-3 text-center text-green-600">✓</td></tr>
                <tr><td className="px-4 py-3">TVH</td><td className="px-4 py-3 text-gray-600">Ontario</td><td className="px-4 py-3 text-right">13%</td><td className="px-4 py-3 text-center text-green-600">✓</td></tr>
                <tr><td className="px-4 py-3">TVH</td><td className="px-4 py-3 text-gray-600">Nouvelle-Écosse</td><td className="px-4 py-3 text-right">15%</td><td className="px-4 py-3 text-center text-green-600">✓</td></tr>
                <tr><td className="px-4 py-3">PST</td><td className="px-4 py-3 text-gray-600">Colombie-Britannique</td><td className="px-4 py-3 text-right">7%</td><td className="px-4 py-3 text-center text-green-600">✓</td></tr>
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Fréquence de déclaration</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TPS</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="monthly">Mensuelle</option>
                  <option value="quarterly">Trimestrielle</option>
                  <option value="annual">Annuelle</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TVQ</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white">
                  <option value="monthly">Mensuelle</option>
                  <option value="quarterly">Trimestrielle</option>
                  <option value="annual">Annuelle</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Currencies */}
      {activeTab === 'currencies' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Devises configurées</h3>
              <button className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm hover:bg-emerald-200">
                + Ajouter devise
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Devise</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Symbole</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Taux (vs CAD)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Par défaut</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currencies.map((currency) => (
                  <tr key={currency.code} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{currency.code}</p>
                      <p className="text-sm text-gray-500">{currency.name}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{currency.symbol}</td>
                    <td className="px-4 py-3 text-right font-mono">{currency.rate.toFixed(4)}</td>
                    <td className="px-4 py-3 text-center">
                      {currency.isDefault && <span className="text-emerald-600">✓</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className={`w-10 h-5 rounded-full transition-colors relative ${currency.active ? 'bg-emerald-500' : 'bg-gray-300'}`}>
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
              <span className="text-blue-500">ℹ️</span>
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
              <div key={integration.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start gap-4">
                  <span className="text-3xl">{integration.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900">{integration.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        integration.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {integration.status === 'connected' ? 'Connecté' : 'Non connecté'}
                      </span>
                    </div>
                    {integration.lastSync && (
                      <p className="text-sm text-gray-500 mt-1">
                        Dernière sync: {new Date(integration.lastSync).toLocaleString('fr-CA')}
                      </p>
                    )}
                    <div className="mt-3">
                      {integration.status === 'connected' ? (
                        <div className="flex gap-2">
                          <button className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200">
                            Synchroniser
                          </button>
                          <button className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                            Configurer
                          </button>
                        </div>
                      ) : (
                        <button className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700">
                          Connecter
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Export comptable</h3>
            <p className="text-gray-600 mb-4">Exportez vos données vers un logiciel comptable externe.</p>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Export QuickBooks (.IIF)
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Export Sage (.CSV)
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                Export Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          Sauvegarder les modifications
        </button>
      </div>
    </div>
  );
}
