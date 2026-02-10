'use client';

import { useState } from 'react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  category: string;
  balance: number;
  isActive: boolean;
  parentId?: string;
  children?: Account[];
}

const accountTypes = {
  ASSET: { label: 'Actif', color: 'blue', prefix: '1' },
  LIABILITY: { label: 'Passif', color: 'red', prefix: '2' },
  EQUITY: { label: 'Capitaux propres', color: 'purple', prefix: '3' },
  REVENUE: { label: 'Revenus', color: 'green', prefix: '4' },
  EXPENSE: { label: 'Dépenses', color: 'orange', prefix: '5-6-7' },
};

export default function PlanComptablePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['1000', '2000', '4000', '5000']));
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const accounts: Account[] = [
    // ACTIFS (1000-1999)
    { id: '1', code: '1000', name: 'Encaisse et banque', type: 'ASSET', category: 'Actifs courants', balance: 45230.50, isActive: true },
    { id: '2', code: '1010', name: 'Compte bancaire principal (CAD)', type: 'ASSET', category: 'Actifs courants', balance: 32450.00, isActive: true, parentId: '1' },
    { id: '3', code: '1020', name: 'Compte bancaire USD', type: 'ASSET', category: 'Actifs courants', balance: 5200.00, isActive: true, parentId: '1' },
    { id: '4', code: '1030', name: 'Compte PayPal', type: 'ASSET', category: 'Actifs courants', balance: 3580.50, isActive: true, parentId: '1' },
    { id: '5', code: '1040', name: 'Compte Stripe', type: 'ASSET', category: 'Actifs courants', balance: 4000.00, isActive: true, parentId: '1' },
    { id: '6', code: '1100', name: 'Comptes clients', type: 'ASSET', category: 'Actifs courants', balance: 8750.00, isActive: true },
    { id: '7', code: '1110', name: 'Comptes clients Canada', type: 'ASSET', category: 'Actifs courants', balance: 6200.00, isActive: true, parentId: '6' },
    { id: '8', code: '1120', name: 'Comptes clients USA', type: 'ASSET', category: 'Actifs courants', balance: 2550.00, isActive: true, parentId: '6' },
    { id: '9', code: '1200', name: 'Stocks', type: 'ASSET', category: 'Actifs courants', balance: 35600.00, isActive: true },
    { id: '10', code: '1210', name: 'Stock de marchandises', type: 'ASSET', category: 'Actifs courants', balance: 34000.00, isActive: true, parentId: '9' },
    { id: '11', code: '1220', name: 'Stock en transit', type: 'ASSET', category: 'Actifs courants', balance: 2500.00, isActive: true, parentId: '9' },
    { id: '12', code: '1230', name: 'Provision pour désuétude', type: 'ASSET', category: 'Actifs courants', balance: -900.00, isActive: true, parentId: '9' },
    { id: '13', code: '1500', name: 'Immobilisations', type: 'ASSET', category: 'Actifs non courants', balance: 8500.00, isActive: true },
    { id: '14', code: '1510', name: 'Équipement informatique', type: 'ASSET', category: 'Actifs non courants', balance: 5000.00, isActive: true, parentId: '13' },
    { id: '15', code: '1590', name: 'Amortissement cumulé', type: 'ASSET', category: 'Actifs non courants', balance: -1500.00, isActive: true, parentId: '13' },

    // PASSIFS (2000-2999)
    { id: '16', code: '2000', name: 'Comptes fournisseurs', type: 'LIABILITY', category: 'Passifs courants', balance: 12300.00, isActive: true },
    { id: '17', code: '2100', name: 'Taxes à payer', type: 'LIABILITY', category: 'Passifs courants', balance: 4250.00, isActive: true },
    { id: '18', code: '2110', name: 'TPS à payer', type: 'LIABILITY', category: 'Passifs courants', balance: 1420.00, isActive: true, parentId: '17' },
    { id: '19', code: '2120', name: 'TVQ à payer', type: 'LIABILITY', category: 'Passifs courants', balance: 2830.00, isActive: true, parentId: '17' },
    { id: '20', code: '2300', name: 'Revenus reportés', type: 'LIABILITY', category: 'Passifs courants', balance: 1500.00, isActive: true },

    // CAPITAUX PROPRES (3000-3999)
    { id: '21', code: '3000', name: 'Capital-actions', type: 'EQUITY', category: 'Capitaux propres', balance: 50000.00, isActive: true },
    { id: '22', code: '3100', name: 'Bénéfices non répartis', type: 'EQUITY', category: 'Capitaux propres', balance: 28530.50, isActive: true },

    // REVENUS (4000-4999)
    { id: '23', code: '4000', name: 'Ventes de marchandises', type: 'REVENUE', category: 'Revenus', balance: 285000.00, isActive: true },
    { id: '24', code: '4010', name: 'Ventes Canada', type: 'REVENUE', category: 'Revenus', balance: 195000.00, isActive: true, parentId: '23' },
    { id: '25', code: '4020', name: 'Ventes USA', type: 'REVENUE', category: 'Revenus', balance: 65000.00, isActive: true, parentId: '23' },
    { id: '26', code: '4030', name: 'Ventes Europe', type: 'REVENUE', category: 'Revenus', balance: 18000.00, isActive: true, parentId: '23' },
    { id: '27', code: '4040', name: 'Ventes autres pays', type: 'REVENUE', category: 'Revenus', balance: 7000.00, isActive: true, parentId: '23' },
    { id: '28', code: '4100', name: 'Frais de livraison facturés', type: 'REVENUE', category: 'Revenus', balance: 12500.00, isActive: true },
    { id: '29', code: '4900', name: 'Remises et retours', type: 'REVENUE', category: 'Revenus', balance: -8500.00, isActive: true },

    // CMV (5000-5999)
    { id: '30', code: '5000', name: 'Coût des marchandises vendues', type: 'EXPENSE', category: 'CMV', balance: 108000.00, isActive: true },
    { id: '31', code: '5010', name: 'Achats de marchandises', type: 'EXPENSE', category: 'CMV', balance: 95000.00, isActive: true, parentId: '30' },
    { id: '32', code: '5100', name: 'Frais de douane et importation', type: 'EXPENSE', category: 'CMV', balance: 8500.00, isActive: true, parentId: '30' },
    { id: '33', code: '5200', name: 'Frais de transport entrant', type: 'EXPENSE', category: 'CMV', balance: 4500.00, isActive: true, parentId: '30' },

    // DÉPENSES D'EXPLOITATION (6000-6999)
    { id: '34', code: '6000', name: 'Frais de livraison', type: 'EXPENSE', category: 'Exploitation', balance: 28500.00, isActive: true },
    { id: '35', code: '6010', name: 'Postes Canada', type: 'EXPENSE', category: 'Exploitation', balance: 18000.00, isActive: true, parentId: '34' },
    { id: '36', code: '6020', name: 'UPS/FedEx', type: 'EXPENSE', category: 'Exploitation', balance: 8500.00, isActive: true, parentId: '34' },
    { id: '37', code: '6030', name: 'Livraison internationale', type: 'EXPENSE', category: 'Exploitation', balance: 2000.00, isActive: true, parentId: '34' },
    { id: '38', code: '6100', name: 'Frais bancaires et paiement', type: 'EXPENSE', category: 'Exploitation', balance: 8900.00, isActive: true },
    { id: '39', code: '6110', name: 'Frais Stripe', type: 'EXPENSE', category: 'Exploitation', balance: 6200.00, isActive: true, parentId: '38' },
    { id: '40', code: '6120', name: 'Frais PayPal', type: 'EXPENSE', category: 'Exploitation', balance: 2400.00, isActive: true, parentId: '38' },
    { id: '41', code: '6130', name: 'Frais bancaires', type: 'EXPENSE', category: 'Exploitation', balance: 300.00, isActive: true, parentId: '38' },
    { id: '42', code: '6200', name: 'Marketing et publicité', type: 'EXPENSE', category: 'Exploitation', balance: 18500.00, isActive: true },
    { id: '43', code: '6210', name: 'Google Ads', type: 'EXPENSE', category: 'Exploitation', balance: 8000.00, isActive: true, parentId: '42' },
    { id: '44', code: '6220', name: 'Facebook/Meta Ads', type: 'EXPENSE', category: 'Exploitation', balance: 6500.00, isActive: true, parentId: '42' },
    { id: '45', code: '6230', name: 'Marketing d\'influence', type: 'EXPENSE', category: 'Exploitation', balance: 2500.00, isActive: true, parentId: '42' },
    { id: '46', code: '6240', name: 'Codes promo (rabais accordés)', type: 'EXPENSE', category: 'Exploitation', balance: 1500.00, isActive: true, parentId: '42' },
    { id: '47', code: '6300', name: 'Frais d\'hébergement et tech', type: 'EXPENSE', category: 'Exploitation', balance: 4800.00, isActive: true },
    { id: '48', code: '6310', name: 'Azure/Hébergement', type: 'EXPENSE', category: 'Exploitation', balance: 3600.00, isActive: true, parentId: '47' },
    { id: '49', code: '6320', name: 'Domaines et SSL', type: 'EXPENSE', category: 'Exploitation', balance: 400.00, isActive: true, parentId: '47' },
    { id: '50', code: '6330', name: 'Services SaaS', type: 'EXPENSE', category: 'Exploitation', balance: 800.00, isActive: true, parentId: '47' },
    { id: '51', code: '6700', name: 'Frais professionnels', type: 'EXPENSE', category: 'Exploitation', balance: 3500.00, isActive: true },
    { id: '52', code: '6710', name: 'Comptable', type: 'EXPENSE', category: 'Exploitation', balance: 2500.00, isActive: true, parentId: '51' },
    { id: '53', code: '6720', name: 'Avocat', type: 'EXPENSE', category: 'Exploitation', balance: 1000.00, isActive: true, parentId: '51' },
    { id: '54', code: '6800', name: 'Amortissement', type: 'EXPENSE', category: 'Exploitation', balance: 1500.00, isActive: true },

    // AUTRES (7000-7999)
    { id: '55', code: '7000', name: 'Gains/pertes de change', type: 'EXPENSE', category: 'Autres', balance: -850.00, isActive: true },
  ];

  const toggleCategory = (code: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedCategories(newExpanded);
  };

  const filteredAccounts = accounts.filter(account => {
    if (searchTerm && !account.name.toLowerCase().includes(searchTerm.toLowerCase()) && !account.code.includes(searchTerm)) {
      return false;
    }
    if (selectedType && account.type !== selectedType) {
      return false;
    }
    return true;
  });

  const parentAccounts = filteredAccounts.filter(a => !a.parentId);
  
  const getChildren = (parentId: string) => filteredAccounts.filter(a => a.parentId === parentId);

  const typeColors: Record<string, string> = {
    ASSET: 'bg-blue-100 text-blue-800',
    LIABILITY: 'bg-red-100 text-red-800',
    EQUITY: 'bg-purple-100 text-purple-800',
    REVENUE: 'bg-green-100 text-green-800',
    EXPENSE: 'bg-orange-100 text-orange-800',
  };

  const totals = {
    ASSET: accounts.filter(a => a.type === 'ASSET' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    LIABILITY: accounts.filter(a => a.type === 'LIABILITY' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    EQUITY: accounts.filter(a => a.type === 'EQUITY' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    REVENUE: accounts.filter(a => a.type === 'REVENUE' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    EXPENSE: accounts.filter(a => a.type === 'EXPENSE' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Plan Comptable</h1>
          <p className="text-gray-500">Structure des comptes selon NCECF</p>
        </div>
        <button
          onClick={() => { setEditingAccount(null); setShowModal(true); }}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Nouveau compte
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(accountTypes).map(([key, value]) => (
          <div key={key} className={`bg-${value.color}-50 rounded-xl p-4 border border-${value.color}-200`}>
            <p className={`text-sm text-${value.color}-600`}>{value.label}</p>
            <p className={`text-xl font-bold text-${value.color}-900`}>
              {totals[key as keyof typeof totals].toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {accounts.filter(a => a.type === key && !a.parentId).length} comptes
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher par nom ou code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white"
          >
            <option value="">Tous les types</option>
            <option value="ASSET">Actifs</option>
            <option value="LIABILITY">Passifs</option>
            <option value="EQUITY">Capitaux propres</option>
            <option value="REVENUE">Revenus</option>
            <option value="EXPENSE">Dépenses</option>
          </select>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exporter
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Nom du compte</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Catégorie</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Solde</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {parentAccounts.map((account) => {
              const children = getChildren(account.id);
              const hasChildren = children.length > 0;
              const isExpanded = expandedCategories.has(account.code);

              return (
                <>
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasChildren && (
                          <button
                            onClick={() => toggleCategory(account.code)}
                            className="p-0.5 hover:bg-gray-200 rounded"
                          >
                            <svg 
                              className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        )}
                        <span className="font-mono font-medium text-gray-900">{account.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{account.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[account.type]}`}>
                        {accountTypes[account.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{account.category}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${account.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {account.balance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {account.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setEditingAccount(account); setShowModal(true); }}
                          className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Voir transactions"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Child accounts */}
                  {isExpanded && children.map((child) => (
                    <tr key={child.id} className="bg-gray-50/50 hover:bg-gray-100">
                      <td className="px-4 py-2 pl-12">
                        <span className="font-mono text-sm text-gray-600">{child.code}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-sm text-gray-700">{child.name}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[child.type]}`}>
                          {accountTypes[child.type].label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-sm">{child.category}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-sm ${child.balance >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                          {child.balance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          child.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {child.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setEditingAccount(child); setShowModal(true); }}
                            className="p-1 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Account Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingAccount ? 'Modifier le compte' : 'Nouveau compte'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                  <input
                    type="text"
                    defaultValue={editingAccount?.code || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    defaultValue={editingAccount?.type || 'ASSET'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="ASSET">Actif</option>
                    <option value="LIABILITY">Passif</option>
                    <option value="EQUITY">Capitaux propres</option>
                    <option value="REVENUE">Revenus</option>
                    <option value="EXPENSE">Dépenses</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du compte</label>
                <input
                  type="text"
                  defaultValue={editingAccount?.name || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Encaisse et banque"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <input
                  type="text"
                  defaultValue={editingAccount?.category || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Actifs courants"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compte parent (optionnel)</label>
                <select
                  defaultValue={editingAccount?.parentId || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"
                >
                  <option value="">Aucun (compte principal)</option>
                  {parentAccounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  defaultChecked={editingAccount?.isActive ?? true}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Compte actif</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={() => { alert('Compte sauvegardé!'); setShowModal(false); }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                {editingAccount ? 'Mettre à jour' : 'Créer le compte'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
