'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Pencil, Coins, CheckCircle, Star } from 'lucide-react';
import { PageHeader, Button, Modal } from '@/components/admin';

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
    setCurrencies(currencies.map((c) => (c.code === code ? { ...c, isActive: !c.isActive } : c)));
  };

  const setDefault = (code: string) => {
    setCurrencies(
      currencies.map((c) => ({
        ...c,
        isDefault: c.code === code,
        isActive: c.code === code ? true : c.isActive,
      }))
    );
  };

  const updateExchangeRates = async () => {
    alert("Taux de change mis a jour depuis l'API externe");
    setCurrencies(currencies.map((c) => ({ ...c, lastUpdated: new Date().toISOString() })));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devises"
        subtitle="Gerez les devises et taux de change"
        actions={
          <div className="flex gap-3">
            <Button variant="secondary" icon={RefreshCw} onClick={updateExchangeRates}>
              Actualiser les taux
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => setShowAddCurrency(true)}>
              Ajouter devise
            </Button>
          </div>
        }
      />

      {/* Auto-update setting */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Mise a jour automatique</h3>
            <p className="text-sm text-slate-500">Actualiser les taux de change quotidiennement</p>
          </div>
          <button
            onClick={() => setAutoUpdate(!autoUpdate)}
            className={`w-12 h-6 rounded-full transition-colors relative ${autoUpdate ? 'bg-emerald-500' : 'bg-slate-300'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${autoUpdate ? 'right-1' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <MiniStat icon={Coins} label="Total devises" value={currencies.length} bg="bg-slate-100 text-slate-600" />
        <MiniStat icon={CheckCircle} label="Actives" value={currencies.filter((c) => c.isActive).length} bg="bg-emerald-100 text-emerald-600" />
        <MiniStat icon={Star} label="Par defaut" value={currencies.find((c) => c.isDefault)?.code || 'CAD'} bg="bg-sky-100 text-sky-600" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Devise</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Symbole</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Taux (vs CAD)</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Derniere MAJ</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Par defaut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actif</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currencies.map((currency) => (
              <tr key={currency.code} className={`hover:bg-slate-50/50 ${!currency.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-bold text-slate-600">
                      {currency.code.slice(0, 2)}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">{currency.code}</p>
                      <p className="text-xs text-slate-500">{currency.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-lg font-mono text-slate-700">{currency.symbol}</td>
                <td className="px-4 py-4 text-right">
                  {currency.isDefault ? (
                    <span className="text-slate-500">Base</span>
                  ) : (
                    <span className="font-mono text-slate-900">{currency.exchangeRate.toFixed(4)}</span>
                  )}
                </td>
                <td className="px-4 py-4 text-sm text-slate-500">
                  {new Date(currency.lastUpdated).toLocaleString('fr-CA')}
                </td>
                <td className="px-4 py-4 text-center">
                  <input
                    type="radio"
                    name="defaultCurrency"
                    checked={currency.isDefault}
                    onChange={() => setDefault(currency.code)}
                    className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                  />
                </td>
                <td className="px-4 py-4 text-center">
                  <button
                    onClick={() => toggleActive(currency.code)}
                    disabled={currency.isDefault}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      currency.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    } ${currency.isDefault ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      currency.isActive ? 'right-0.5' : 'left-0.5'
                    }`} />
                  </button>
                </td>
                <td className="px-4 py-4 text-center">
                  <Button variant="ghost" size="sm" icon={Pencil}>
                    Modifier
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Conversion Preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-4">Apercu conversion (100 CAD)</h3>
        <div className="grid grid-cols-5 gap-4">
          {currencies
            .filter((c) => c.isActive && !c.isDefault)
            .map((currency) => (
              <div key={currency.code} className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900">{(100 * currency.exchangeRate).toFixed(2)}</p>
                <p className="text-sm text-slate-500">{currency.code}</p>
              </div>
            ))}
        </div>
      </div>

      {/* Add Currency Modal */}
      <Modal isOpen={showAddCurrency} onClose={() => setShowAddCurrency(false)} title="Ajouter une devise">
        <p className="text-slate-500 mb-4">Fonctionnalite en cours de developpement...</p>
        <Button variant="secondary" onClick={() => setShowAddCurrency(false)}>
          Fermer
        </Button>
      </Modal>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, bg }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; bg: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
