'use client';

import { useState, useEffect } from 'react';
import { Plus, Download, ChevronRight, Pencil, ClipboardList } from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  FilterBar,
  SelectFilter,
  FormField,
  Input,
  StatusBadge,
} from '@/components/admin';

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
  EXPENSE: { label: 'D\u00e9penses', color: 'sky', prefix: '5-6-7' },
};

export default function PlanComptablePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['1000', '2000', '4000', '5000']));
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounting/chart-of-accounts');
      const json = await res.json();
      if (json.accounts) {
        const mapped: Account[] = json.accounts.map((a: Record<string, unknown>) => ({
          id: a.id as string,
          code: a.code as string,
          name: a.name as string,
          type: a.type as Account['type'],
          category: (a.description as string) || getCategoryFromType(a.type as string, a.code as string),
          balance: 0,
          isActive: a.isActive as boolean,
          parentId: (a.parentId as string) || undefined,
        }));
        setAccounts(mapped);
      }
    } catch (err) {
      console.error('Error fetching chart of accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryFromType = (type: string, code: string): string => {
    const codeNum = parseInt(code);
    if (type === 'ASSET') return codeNum < 1500 ? 'Actifs courants' : 'Actifs non courants';
    if (type === 'LIABILITY') return 'Passifs courants';
    if (type === 'EQUITY') return 'Capitaux propres';
    if (type === 'REVENUE') return 'Revenus';
    if (type === 'EXPENSE') {
      if (codeNum < 6000) return 'CMV';
      if (codeNum < 7000) return 'Exploitation';
      return 'Autres';
    }
    return '';
  };

  const handleSaveAccount = async () => {
    const codeInput = document.querySelector<HTMLInputElement>('#accountCode');
    const typeSelect = document.querySelector<HTMLSelectElement>('#accountType');
    const nameInput = document.querySelector<HTMLInputElement>('#accountName');
    const categoryInput = document.querySelector<HTMLInputElement>('#accountCategory');
    const parentSelect = document.querySelector<HTMLSelectElement>('#accountParent');
    const activeCheckbox = document.querySelector<HTMLInputElement>('#isActive');

    const payload: Record<string, unknown> = {
      code: codeInput?.value || '',
      name: nameInput?.value || '',
      type: typeSelect?.value || 'ASSET',
      normalBalance: ['ASSET', 'EXPENSE'].includes(typeSelect?.value || '') ? 'DEBIT' : 'CREDIT',
      description: categoryInput?.value || '',
      parentId: parentSelect?.value || null,
      isActive: activeCheckbox?.checked ?? true,
    };

    try {
      if (editingAccount) {
        const res = await fetch('/api/accounting/chart-of-accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingAccount.id,
            name: payload.name,
            description: payload.description,
            isActive: payload.isActive,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'Erreur lors de la mise \u00e0 jour');
          return;
        }
      } else {
        const res = await fetch('/api/accounting/chart-of-accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'Erreur lors de la cr\u00e9ation');
          return;
        }
      }
      setShowModal(false);
      await fetchAccounts();
    } catch (err) {
      console.error('Error saving account:', err);
      alert('Erreur lors de la sauvegarde');
    }
  };

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
    EXPENSE: 'bg-sky-100 text-sky-800',
  };

  const totals = {
    ASSET: accounts.filter(a => a.type === 'ASSET' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    LIABILITY: accounts.filter(a => a.type === 'LIABILITY' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    EQUITY: accounts.filter(a => a.type === 'EQUITY' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    REVENUE: accounts.filter(a => a.type === 'REVENUE' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
    EXPENSE: accounts.filter(a => a.type === 'EXPENSE' && !a.parentId).reduce((sum, a) => sum + a.balance, 0),
  };

  const typeFilterOptions = [
    { value: 'ASSET', label: 'Actifs' },
    { value: 'LIABILITY', label: 'Passifs' },
    { value: 'EQUITY', label: 'Capitaux propres' },
    { value: 'REVENUE', label: 'Revenus' },
    { value: 'EXPENSE', label: 'D\u00e9penses' },
  ];

  const summaryCardColors: Record<string, { bg: string; border: string; text: string; value: string }> = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600', value: 'text-blue-900' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600', value: 'text-red-900' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', value: 'text-purple-900' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600', value: 'text-green-900' },
    sky: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-600', value: 'text-sky-900' },
  };

  if (loading) return <div className="p-8 text-center">Chargement...</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plan Comptable"
        subtitle="Structure des comptes selon NCECF"
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => { setEditingAccount(null); setShowModal(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
          >
            Nouveau compte
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(accountTypes).map(([key, value]) => {
          const colors = summaryCardColors[value.color];
          return (
            <div key={key} className={`${colors.bg} rounded-xl p-4 border ${colors.border}`}>
              <p className={`text-sm ${colors.text}`}>{value.label}</p>
              <p className={`text-xl font-bold ${colors.value}`}>
                {totals[key as keyof typeof totals].toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {accounts.filter(a => a.type === key && !a.parentId).length} comptes
              </p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Rechercher par nom ou code..."
        actions={
          <Button variant="secondary" icon={Download}>
            Exporter
          </Button>
        }
      >
        <SelectFilter
          label="Tous les types"
          value={selectedType}
          onChange={setSelectedType}
          options={typeFilterOptions}
        />
      </FilterBar>

      {/* Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Code</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Nom du compte</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cat\u00e9gorie</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Solde</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {parentAccounts.map((account) => {
              const children = getChildren(account.id);
              const hasChildren = children.length > 0;
              const isExpanded = expandedCategories.has(account.code);

              return (
                <>
                  <tr key={account.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasChildren && (
                          <button
                            onClick={() => toggleCategory(account.code)}
                            className="p-0.5 hover:bg-slate-200 rounded"
                          >
                            <ChevronRight
                              className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            />
                          </button>
                        )}
                        <span className="font-mono font-medium text-slate-900">{account.code}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">{account.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[account.type]}`}>
                        {accountTypes[account.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{account.category}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-medium ${account.balance >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                        {account.balance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge variant={account.isActive ? 'success' : 'neutral'}>
                        {account.isActive ? 'Actif' : 'Inactif'}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => { setEditingAccount(account); setShowModal(true); }}
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Voir transactions"
                        >
                          <ClipboardList className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Child accounts */}
                  {isExpanded && children.map((child) => (
                    <tr key={child.id} className="bg-slate-50/50 hover:bg-slate-100">
                      <td className="px-4 py-2 pl-12">
                        <span className="font-mono text-sm text-slate-600">{child.code}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-sm text-slate-700">{child.name}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[child.type]}`}>
                          {accountTypes[child.type].label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-500 text-sm">{child.category}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={`text-sm ${child.balance >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                          {child.balance.toLocaleString('fr-CA', { style: 'currency', currency: 'CAD' })}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <StatusBadge variant={child.isActive ? 'success' : 'neutral'}>
                          {child.isActive ? 'Actif' : 'Inactif'}
                        </StatusBadge>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setEditingAccount(child); setShowModal(true); }}
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Pencil className="w-3.5 h-3.5" />
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
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingAccount ? 'Modifier le compte' : 'Nouveau compte'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveAccount}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white border-transparent shadow-sm"
            >
              {editingAccount ? 'Mettre \u00e0 jour' : 'Cr\u00e9er le compte'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Code">
              <Input
                id="accountCode"
                type="text"
                defaultValue={editingAccount?.code || ''}
                placeholder="1000"
              />
            </FormField>
            <FormField label="Type">
              <select
                id="accountType"
                defaultValue={editingAccount?.type || 'ASSET'}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                  focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
              >
                <option value="ASSET">Actif</option>
                <option value="LIABILITY">Passif</option>
                <option value="EQUITY">Capitaux propres</option>
                <option value="REVENUE">Revenus</option>
                <option value="EXPENSE">D\u00e9penses</option>
              </select>
            </FormField>
          </div>
          <FormField label="Nom du compte">
            <Input
              id="accountName"
              type="text"
              defaultValue={editingAccount?.name || ''}
              placeholder="Encaisse et banque"
            />
          </FormField>
          <FormField label="Cat\u00e9gorie">
            <Input
              id="accountCategory"
              type="text"
              defaultValue={editingAccount?.category || ''}
              placeholder="Actifs courants"
            />
          </FormField>
          <FormField label="Compte parent (optionnel)">
            <select
              id="accountParent"
              defaultValue={editingAccount?.parentId || ''}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-shadow"
            >
              <option value="">Aucun (compte principal)</option>
              {parentAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
              ))}
            </select>
          </FormField>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              defaultChecked={editingAccount?.isActive ?? true}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600"
            />
            <label htmlFor="isActive" className="text-sm text-slate-700">Compte actif</label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
