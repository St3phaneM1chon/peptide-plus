'use client';

import { useState, useEffect } from 'react';

interface Currency {
  code: string;
  name: string;
  symbol: string;
  exchangeRate: number;
  isActive: boolean;
  isDefault: boolean;
  lastUpdated: string;
}

export default function DevisesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const [showAddCurrency, setShowAddCurrency] = useState(false);

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const fetchCurrencies = async () => {
    try {
      const res = await fetch('/api/admin/currencies');
      const data = await res.json();
      setCurrencies(data.currencies || []);
    } catch (err) {
      console.error('Error fetching currencies:', err);
      setCurrencies([]);
    }
    setLoading(false);
  };

  const toggleActive = (code: string) => {
    setCurrencies(currencies.map(c => 
      c.code === code ? { ...c, isActive: !c.isActive } : c
    ));
  };

  const setDefault = (code: string) => {
    setCurrencies(currencies.map(c => ({
      ...c,
      isDefault: c.code === code,
      isActive: c.code === code ? true : c.isActive,
    })));
  };

  const updateExchangeRates = async () => {
    // Simulate API call
    alert('Taux de change mis à jour depuis l\'API externe');
    setCurrencies(currencies.map(c => ({
      ...c,
      lastUpdated: new Date().toISOString(),
    })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devises</h1>
          <p className="text-gray-500">Gérez les devises et taux de change</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={updateExchangeRates}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualiser les taux
          </button>
          <button
            onClick={() => setShowAddCurrency(true)}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter devise
          </button>
        </div>
      </div>

      {/* Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Mise à jour automatique</h3>
            <p className="text-sm text-gray-500">Actualiser les taux de change quotidiennement</p>
          </div>
          <button
            onClick={() => setAutoUpdate(!autoUpdate)}
            className={`w-12 h-6 rounded-full transition-colors relative ${
              autoUpdate ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
              autoUpdate ? 'right-1' : 'left-1'
            }`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total devises</p>
          <p className="text-2xl font-bold text-gray-900">{currencies.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Actives</p>
          <p className="text-2xl font-bold text-green-700">{currencies.filter(c => c.isActive).length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-600">Par défaut</p>
          <p className="text-2xl font-bold text-amber-700">
            {currencies.find(c => c.isDefault)?.code || 'CAD'}
          </p>
        </div>
      </div>

      {/* Currencies Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Devise</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Symbole</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Taux (vs CAD)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Dernière MAJ</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Par défaut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actif</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currencies.map((currency) => (
              <tr key={currency.code} className={`hover:bg-gray-50 ${!currency.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">
                      {currency.code.slice(0, 2)}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-900">{currency.code}</p>
                      <p className="text-xs text-gray-500">{currency.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-lg font-mono text-gray-700">{currency.symbol}</td>
                <td className="px-4 py-4 text-right">
                  {currency.isDefault ? (
                    <span className="text-gray-500">Base</span>
                  ) : (
                    <span className="font-mono text-gray-900">{currency.exchangeRate.toFixed(4)}</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-gray-500">
                  {new Date(currency.lastUpdated).toLocaleString('fr-CA')}
                </td>
                <td className="px-4 py-4 text-center">
                  <input
                    type="radio"
                    name="defaultCurrency"
                    checked={currency.isDefault}
                    onChange={() => setDefault(currency.code)}
                    className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                  />
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleActive(currency.code)}
                    disabled={currency.isDefault}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      currency.isActive ? 'bg-green-500' : 'bg-gray-300'
                    } ${currency.isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      currency.isActive ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200"
                  >
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conversion Preview */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Aperçu conversion (100 CAD)</h3>
        <div className="grid grid-cols-5 gap-4">
          {currencies.filter(c => c.isActive && !c.isDefault).map((currency) => (
            <div key={currency.code} className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">
                {(100 * currency.exchangeRate).toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">{currency.code}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Add Currency Modal */}
      {showAddCurrency && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Ajouter une devise</h2>
            <p className="text-gray-500 mb-4">Fonctionnalité en cours de développement...</p>
            <button
              onClick={() => setShowAddCurrency(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
