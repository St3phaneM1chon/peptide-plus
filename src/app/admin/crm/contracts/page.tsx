'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Loader2,
  AlertTriangle,
  Calendar,
  DollarSign,
  XCircle,
  Save,
  RefreshCw,
  Clock,
  CheckCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Contract {
  id: string;
  title: string;
  dealId: string | null;
  contactId: string | null;
  companyName: string | null;
  status: 'DRAFT' | 'PENDING_SIGNATURE' | 'ACTIVE' | 'EXPIRED' | 'RENEWED' | 'CANCELLED' | 'TERMINATED';
  startDate: string;
  endDate: string;
  value: number;
  currency: string;
  renewalType: string;
  renewalNoticeDays: number;
  terms: string | null;
  documentUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Status Badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Contract['status'] }) {
  const config: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
    DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
    PENDING_SIGNATURE: { label: 'Pending Signature', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    EXPIRED: { label: 'Expired', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
    RENEWED: { label: 'Renewed', color: 'bg-teal-100 text-teal-700', icon: RefreshCw },
    CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle },
    TERMINATED: { label: 'Terminated', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  const { label, color, icon: Icon } = config[status] || config.DRAFT;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Renewal Alert
// ---------------------------------------------------------------------------

function isExpiringSoon(endDate: string, days: number = 30): boolean {
  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return diff > 0 && diff <= days * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Create/Edit Modal
// ---------------------------------------------------------------------------

interface ContractModalProps {
  contract: Contract | null;
  onClose: () => void;
  onSave: () => void;
}

function ContractModal({ contract, onClose, onSave }: ContractModalProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(contract?.title || '');
  const [companyName, setCompanyName] = useState(contract?.companyName || '');
  const [status, setStatus] = useState<Contract['status']>(contract?.status || 'DRAFT');
  const [startDate, setStartDate] = useState(
    contract?.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState(
    contract?.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : ''
  );
  const [value, setValue] = useState(contract?.value?.toString() || '');
  const [currency, setCurrency] = useState(contract?.currency || 'CAD');
  const [renewalType, setRenewalType] = useState(contract?.renewalType || 'manual');
  const [renewalNoticeDays, setRenewalNoticeDays] = useState(contract?.renewalNoticeDays?.toString() || '30');
  const [terms, setTerms] = useState(contract?.terms || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !startDate || !endDate || !value) {
      toast.error(t('admin.crm.contracts.requiredFields') || 'Title, dates, and value are required');
      return;
    }

    setSaving(true);
    try {
      const url = contract
        ? `/api/admin/crm/contracts/${contract.id}`
        : '/api/admin/crm/contracts';

      const res = await fetch(url, {
        method: contract ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          companyName: companyName.trim() || undefined,
          status,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          value: parseFloat(value),
          currency,
          renewalType,
          renewalNoticeDays: parseInt(renewalNoticeDays, 10),
          terms: terms.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || 'Failed to save contract');
      }

      toast.success(
        contract
          ? (t('admin.crm.contracts.updated') || 'Contract updated')
          : (t('admin.crm.contracts.created') || 'Contract created')
      );
      onSave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600" />
            {contract
              ? (t('admin.crm.contracts.editContract') || 'Edit Contract')
              : (t('admin.crm.contracts.createContract') || 'Create Contract')}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('common.title') || 'Title'} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.contracts.companyName') || 'Company Name'}
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.contracts.startDate') || 'Start Date'} *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.contracts.endDate') || 'End Date'} *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.contracts.value') || 'Value'} *
              </label>
              <input
                type="number"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('common.currency') || 'Currency'}
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="CAD">CAD</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('common.status') || 'Status'}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Contract['status'])}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING_SIGNATURE">Pending Signature</option>
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="RENEWED">Renewed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                {t('admin.crm.contracts.renewalType') || 'Renewal Type'}
              </label>
              <select
                value={renewalType}
                onChange={(e) => setRenewalType(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                <option value="manual">Manual</option>
                <option value="auto">Auto-Renew</option>
                <option value="none">No Renewal</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.contracts.renewalNoticeDays') || 'Renewal Notice (days)'}
            </label>
            <input
              type="number"
              value={renewalNoticeDays}
              onChange={(e) => setRenewalNoticeDays(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {t('admin.crm.contracts.terms') || 'Terms & Conditions'}
            </label>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? (t('common.saving') || 'Saving...') : (t('common.save') || 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ContractsPage() {
  const { t } = useI18n();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'renewals'>('all');
  const [modal, setModal] = useState<{ contract: Contract | null } | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab === 'renewals' ? '?upcomingRenewals=true&days=30' : '';
      const res = await fetch(`/api/admin/crm/contracts${params}`);
      const json = await res.json();

      if (json.success) {
        setContracts(json.data || json.items || []);
      }
    } catch {
      toast.error(t('admin.crm.contracts.loadError') || 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [t, activeTab]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const renewalCount = contracts.filter((c) =>
    (c.status === 'ACTIVE' || c.status === 'PENDING_SIGNATURE') && isExpiringSoon(c.endDate, 30)
  ).length;

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-teal-600" />
            {t('admin.crm.contracts.title') || 'Contracts'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('admin.crm.contracts.subtitle') || 'Manage contracts and track renewals'}
          </p>
        </div>
        <button
          onClick={() => setModal({ contract: null })}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700"
        >
          <Plus className="h-4 w-4" />
          {t('admin.crm.contracts.create') || 'Create Contract'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 max-w-sm">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          {t('admin.crm.contracts.allTab') || 'All Contracts'}
        </button>
        <button
          onClick={() => setActiveTab('renewals')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'renewals'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          {t('admin.crm.contracts.renewalsTab') || 'Renewals'}
          {renewalCount > 0 && activeTab !== 'renewals' && (
            <span className="bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
              {renewalCount}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
        </div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            {activeTab === 'renewals'
              ? (t('admin.crm.contracts.noRenewals') || 'No upcoming renewals')
              : (t('admin.crm.contracts.noContracts') || 'No contracts yet')}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {activeTab === 'renewals'
              ? (t('admin.crm.contracts.noRenewalsDesc') || 'No contracts are expiring within 30 days')
              : (t('admin.crm.contracts.noContractsDesc') || 'Create your first contract to start tracking')}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    {t('common.title') || 'Title'}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    {t('common.status') || 'Status'}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    {t('admin.crm.contracts.dates') || 'Dates'}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    {t('admin.crm.contracts.value') || 'Value'}
                  </th>
                  <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    {t('admin.crm.contracts.renewalType') || 'Renewal'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {contracts.map((contract) => (
                  <tr
                    key={contract.id}
                    onClick={() => setModal({ contract })}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{contract.title}</p>
                        {contract.companyName && (
                          <p className="text-xs text-gray-500">{contract.companyName}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={contract.status} />
                      {isExpiringSoon(contract.endDate) && contract.status === 'ACTIVE' && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-orange-600">
                          <AlertTriangle className="h-3 w-3" />
                          {t('admin.crm.contracts.expiringSoon') || 'Expiring soon'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="h-3.5 w-3.5 text-gray-400" />
                        <span>
                          {new Date(contract.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span>
                          {new Date(contract.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
                        <DollarSign className="h-3.5 w-3.5 text-gray-400" />
                        {formatCurrency(contract.value, contract.currency)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 capitalize">{contract.renewalType}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <ContractModal
          contract={modal.contract}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            fetchContracts();
          }}
        />
      )}
    </div>
  );
}
