'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  Eye,
  Check,
  Paperclip,
  Trash2,
  CheckCircle,
  AlertTriangle,
  FileText,
  BookOpen,
  Clock,
  Zap,
  Printer,
  Copy,
  RotateCcw,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  StatusBadge,
  StatCard,
  FilterBar,
  SelectFilter,
  DataTable,
  FormField,
  Input,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface JournalEntry {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  type: string;
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  lines: JournalLine[];
  createdBy: string;
  createdAt: string;
  reference?: string;
  attachments?: number;
}

interface JournalLine {
  id: string;
  accountCode: string;
  accountName: string;
  description?: string;
  debit: number;
  credit: number;
}

const defaultAccountOptions = [
  { value: '1010', label: '1010 - Compte bancaire principal' },
  { value: '1030', label: '1030 - Compte PayPal' },
  { value: '4010', label: '4010 - Ventes Canada' },
  { value: '6210', label: '6210 - Google Ads' },
];

export default function EcrituresPage() {
  const { t, locale } = useI18n();

  const typeConfig: Record<string, { label: string; variant: 'info' | 'success' | 'warning' | 'neutral' | 'primary' | 'error' }> = {
    MANUAL: { label: t('admin.entries.typeManual'), variant: 'info' },
    AUTO_SALE: { label: t('admin.entries.typeAutoSale'), variant: 'success' },
    AUTO_REFUND: { label: t('admin.entries.typeAutoRefund', 'Remboursement auto'), variant: 'error' },
    AUTO_STRIPE_FEE: { label: t('admin.entries.typeAutoStripeFee', 'Frais Stripe'), variant: 'warning' },
    AUTO_PAYPAL_FEE: { label: t('admin.entries.typeAutoPaypalFee', 'Frais PayPal'), variant: 'warning' },
    AUTO_SHIPPING: { label: t('admin.entries.typeAutoShipping', 'Livraison auto'), variant: 'primary' },
    AUTO_PURCHASE: { label: t('admin.entries.typeAutoPurchase'), variant: 'warning' },
    AUTO_PAYMENT: { label: t('admin.entries.typeAutoPayment'), variant: 'primary' },
    RECURRING: { label: t('admin.entries.typeRecurring'), variant: 'neutral' },
    ADJUSTMENT: { label: t('admin.entries.typeAdjustment', 'Ajustement'), variant: 'info' },
    CLOSING: { label: t('admin.entries.typeClosing', 'Clôture'), variant: 'neutral' },
  };
  const defaultTypeConfig = { label: 'Autre', variant: 'neutral' as const };

  const statusConfig: Record<string, { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }> = {
    DRAFT: { label: t('admin.entries.statusDraft'), variant: 'warning' },
    POSTED: { label: t('admin.entries.statusPosted'), variant: 'success' },
    VOIDED: { label: t('admin.entries.statusVoided'), variant: 'error' },
  };

  const typeFilterOptions = Object.entries(typeConfig).map(([value, cfg]) => ({
    value,
    label: cfg.label,
  }));

  const statusFilterOptions = [
    { value: 'DRAFT', label: t('admin.entries.statusDraft') },
    { value: 'POSTED', label: t('admin.entries.statusPosted') },
    { value: 'VOIDED', label: t('admin.entries.statusVoided') },
  ];

  const fmtCurrency = (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2 }) + ' $';
  const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [accountOptions, setAccountOptions] = useState(defaultAccountOptions);
  const [submitting, setSubmitting] = useState(false);

  // New entry form state
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryDescription, setNewEntryDescription] = useState('');
  const [newEntryReference, setNewEntryReference] = useState('');
  const [newEntryLines, setNewEntryLines] = useState([
    { accountCode: '', description: '', debit: '', credit: '' },
    { accountCode: '', description: '', debit: '', credit: '' },
  ]);

  const fetchEntries = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedStatus) params.set('status', selectedStatus);
      if (selectedType) params.set('type', selectedType);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/accounting/entries?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const mapped: JournalEntry[] = (data.entries || []).map((e: Record<string, unknown>) => ({
          id: e.id,
          entryNumber: e.entryNumber,
          date: e.date,
          description: e.description,
          type: e.type,
          status: e.status,
          reference: e.reference || undefined,
          createdBy: e.createdBy || t('admin.entries.systemUser'),
          createdAt: e.createdAt,
          attachments: e.attachments || 0,
          lines: ((e.lines || []) as Record<string, unknown>[]).map((l: Record<string, unknown>, idx: number) => ({
            id: l.id || String(idx),
            accountCode: l.accountCode,
            accountName: l.accountName,
            description: l.description || undefined,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        }));
        setEntries(mapped);
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, selectedType, searchTerm]);

  // Fetch chart of accounts for new entry form
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/accounting/chart-of-accounts');
        if (res.ok) {
          const data = await res.json();
          if (data.accounts && Array.isArray(data.accounts)) {
            setAccountOptions(
              data.accounts.map((a: Record<string, string>) => ({
                value: a.code,
                label: `${a.code} - ${a.name}`,
              }))
            );
          }
        }
      } catch (err) {
        console.error('Error fetching accounts:', err);
      }
    };
    fetchAccounts();
  }, []);

  // Post (comptabiliser) a draft entry
  const handlePostEntry = async (entryId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/accounting/entries/${entryId}/post`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchEntries();
        setShowDetailModal(false);
      } else {
        const errData = await res.json();
        toast.error(errData.error || t('admin.entries.validationError'));
      }
    } catch (err) {
      console.error('Error posting entry:', err);
      toast.error(t('admin.entries.validationError'));
    } finally {
      setSubmitting(false);
    }
  };

  // Create a new entry
  const handleCreateEntry = async (postImmediately: boolean) => {
    setSubmitting(true);
    try {
      const lines = newEntryLines
        .filter(l => l.accountCode)
        .map(l => ({
          accountCode: l.accountCode,
          description: l.description || undefined,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
        }));

      const res = await fetch('/api/accounting/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newEntryDate,
          description: newEntryDescription,
          reference: newEntryReference || undefined,
          type: 'MANUAL',
          lines,
          postImmediately,
        }),
      });

      if (res.ok) {
        setShowNewEntryModal(false);
        setNewEntryDescription('');
        setNewEntryReference('');
        setNewEntryLines([
          { accountCode: '', description: '', debit: '', credit: '' },
          { accountCode: '', description: '', debit: '', credit: '' },
        ]);
        await fetchEntries();
      } else {
        const errData = await res.json();
        toast.error(errData.error || t('admin.entries.creationError'));
      }
    } catch (err) {
      console.error('Error creating entry:', err);
      toast.error(t('admin.entries.creationError'));
    } finally {
      setSubmitting(false);
    }
  };

  const addNewLine = () => {
    setNewEntryLines(prev => [...prev, { accountCode: '', description: '', debit: '', credit: '' }]);
  };

  const removeNewLine = (index: number) => {
    setNewEntryLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateNewLine = (index: number, field: string, value: string) => {
    setNewEntryLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const newLinesTotalDebit = newEntryLines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const newLinesTotalCredit = newEntryLines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);

  const filteredEntries = entries.filter((entry) => {
    if (
      searchTerm &&
      !entry.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !entry.entryNumber.includes(searchTerm)
    ) {
      return false;
    }
    if (selectedType && entry.type !== selectedType) return false;
    if (selectedStatus && entry.status !== selectedStatus) return false;
    return true;
  });

  const totalDebit = (entry: JournalEntry) => entry.lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = (entry: JournalEntry) => entry.lines.reduce((sum, l) => sum + l.credit, 0);

  const openDetail = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    setShowDetailModal(true);
  };

  // -- DataTable columns --
  const columns: Column<JournalEntry>[] = [
    {
      key: 'entryNumber',
      header: t('admin.entries.entryNumberHeader'),
      render: (entry) => (
        <button
          onClick={(e) => { e.stopPropagation(); openDetail(entry); }}
          className="font-mono text-sm text-sky-600 hover:underline"
        >
          {entry.entryNumber}
        </button>
      ),
    },
    {
      key: 'date',
      header: t('admin.entries.dateHeader'),
      sortable: true,
      render: (entry) => (
        <span className="text-sm text-slate-900">{fmtDate(entry.date)}</span>
      ),
    },
    {
      key: 'description',
      header: t('admin.entries.descriptionHeader'),
      render: (entry) => (
        <div>
          <p className="text-sm text-slate-900 truncate max-w-xs">{entry.description}</p>
          {entry.reference && (
            <p className="text-xs text-slate-500">{t('admin.entries.refPrefix')} {entry.reference}</p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: t('admin.entries.typeHeader'),
      align: 'center',
      render: (entry) => {
        const cfg = typeConfig[entry.type] || defaultTypeConfig;
        return <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'debit',
      header: t('admin.entries.debitHeader'),
      align: 'right',
      render: (entry) => (
        <span className="font-medium text-slate-900">{fmtCurrency(totalDebit(entry))}</span>
      ),
    },
    {
      key: 'credit',
      header: t('admin.entries.creditHeader'),
      align: 'right',
      render: (entry) => (
        <span className="font-medium text-slate-900">{fmtCurrency(totalCredit(entry))}</span>
      ),
    },
    {
      key: 'status',
      header: t('admin.entries.statusHeader'),
      align: 'center',
      render: (entry) => {
        const cfg = statusConfig[entry.status] || defaultTypeConfig;
        return <StatusBadge variant={cfg.variant} dot>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'actions',
      header: t('admin.entries.actionsHeader'),
      align: 'center',
      render: (entry) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); openDetail(entry); }}
            className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded"
            title={t('admin.entries.viewDetails')}
          >
            <Eye className="w-4 h-4" />
          </button>
          {entry.status === 'DRAFT' && (
            <button
              onClick={(e) => { e.stopPropagation(); handlePostEntry(entry.id); }}
              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
              title={t('admin.entries.postEntry')}
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {entry.attachments && entry.attachments > 0 && (
            <span className="text-xs text-slate-400 ml-1">
              <Paperclip className="w-4 h-4 inline" />
            </span>
          )}
        </div>
      ),
    },
  ];

  // -- Detail modal footer --
  const detailFooter = selectedEntry ? (
    <div className="flex gap-2 w-full">
      {selectedEntry.status === 'DRAFT' && (
        <Button
          variant="primary"
          icon={Check}
          className="bg-emerald-600 hover:bg-emerald-700 border-transparent"
          onClick={() => handlePostEntry(selectedEntry.id)}
          disabled={submitting}
        >
          {submitting ? t('admin.entries.validating') : t('admin.entries.postEntry')}
        </Button>
      )}
      {selectedEntry.status === 'POSTED' && (
        <Button variant="danger" icon={RotateCcw} className="bg-red-100 text-red-700 hover:bg-red-200 border-transparent shadow-none">
          {t('admin.entries.reverseEntry')}
        </Button>
      )}
      <Button variant="secondary" icon={Copy}>{t('admin.entries.duplicate')}</Button>
      <Button variant="secondary" icon={Printer} className="ml-auto">{t('admin.entries.print')}</Button>
    </div>
  ) : null;

  // -- New entry modal footer --
  const newEntryFooter = (
    <div className="flex gap-2 w-full">
      <Button variant="ghost" onClick={() => setShowNewEntryModal(false)}>
        {t('admin.entries.cancel')}
      </Button>
      <Button variant="secondary" onClick={() => handleCreateEntry(false)} disabled={submitting}>
        {submitting ? t('admin.entries.saving') : t('admin.entries.saveDraft')}
      </Button>
      <Button
        variant="primary"
        icon={Check}
        className="ml-auto bg-emerald-600 hover:bg-emerald-700 border-transparent"
        onClick={() => handleCreateEntry(true)}
        disabled={submitting}
      >
        {submitting ? t('admin.entries.saving') : t('admin.entries.postEntry')}
      </Button>
    </div>
  );

  if (loading) return <div className="p-8 text-center">{t('admin.entries.loading')}</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={t('admin.entries.title')}
        subtitle={t('admin.entries.subtitle')}
        actions={
          <Button variant="primary" icon={Plus} className="bg-emerald-600 hover:bg-emerald-700 border-transparent" onClick={() => setShowNewEntryModal(true)}>
            {t('admin.entries.newEntry')}
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.entries.totalThisMonth')}
          value={entries.length}
          icon={FileText}
        />
        <StatCard
          label={t('admin.entries.posted')}
          value={entries.filter((e) => e.status === 'POSTED').length}
          icon={BookOpen}
          className="bg-emerald-50 border-emerald-200"
        />
        <StatCard
          label={t('admin.entries.drafts')}
          value={entries.filter((e) => e.status === 'DRAFT').length}
          icon={Clock}
          className="bg-yellow-50 border-yellow-200"
        />
        <StatCard
          label={t('admin.entries.automatic')}
          value={entries.filter((e) => e.type.startsWith('AUTO')).length}
          icon={Zap}
          className="bg-sky-50 border-sky-200"
        />
      </div>

      {/* Filters */}
      <FilterBar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t('admin.entries.searchPlaceholder')}
      >
        <SelectFilter
          label={t('admin.entries.allTypes')}
          value={selectedType}
          onChange={setSelectedType}
          options={typeFilterOptions}
        />
        <SelectFilter
          label={t('admin.entries.allStatuses')}
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusFilterOptions}
        />
      </FilterBar>

      {/* Entries Table */}
      <DataTable
        columns={columns}
        data={filteredEntries}
        keyExtractor={(entry) => entry.id}
        emptyTitle={t('admin.entries.noEntriesTitle')}
        emptyDescription={t('admin.entries.noEntriesDescription')}
        onRowClick={openDetail}
      />

      {/* Entry Detail Modal */}
      <Modal
        isOpen={showDetailModal && !!selectedEntry}
        onClose={() => setShowDetailModal(false)}
        title={selectedEntry?.entryNumber ?? ''}
        subtitle={selectedEntry?.description}
        size="lg"
        footer={detailFooter}
      >
        {selectedEntry && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-500">{t('admin.entries.dateLabel')}</p>
                <p className="font-medium text-slate-900">{fmtDate(selectedEntry.date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('admin.entries.typeLabel')}</p>
                <StatusBadge variant={(typeConfig[selectedEntry.type] || defaultTypeConfig).variant}>
                  {(typeConfig[selectedEntry.type] || defaultTypeConfig).label}
                </StatusBadge>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('admin.entries.statusLabel')}</p>
                <StatusBadge variant={(statusConfig[selectedEntry.status] || defaultTypeConfig).variant} dot>
                  {(statusConfig[selectedEntry.status] || defaultTypeConfig).label}
                </StatusBadge>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('admin.entries.createdByLabel')}</p>
                <p className="font-medium text-slate-900">{selectedEntry.createdBy}</p>
              </div>
            </div>

            {/* Journal Lines */}
            <div>
              <h4 className="font-medium text-slate-900 mb-3">{t('admin.entries.entryLines')}</h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('admin.entries.accountHeader')}</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('admin.entries.descriptionHeader')}</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t('admin.entries.debitHeader')}</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500">{t('admin.entries.creditHeader')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedEntry.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="px-4 py-2">
                          <span className="font-mono text-sm text-slate-600">{line.accountCode}</span>
                          <span className="text-sm text-slate-900 ml-2">{line.accountName}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-slate-600">{line.description || '-'}</td>
                        <td className="px-4 py-2 text-right">
                          {line.debit > 0 && (
                            <span className="font-medium text-slate-900">{fmtCurrency(line.debit)}</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {line.credit > 0 && (
                            <span className="font-medium text-slate-900">{fmtCurrency(line.credit)}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100">
                    <tr>
                      <td colSpan={2} className="px-4 py-2 font-semibold text-slate-900">{t('admin.entries.total')}</td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">
                        {fmtCurrency(totalDebit(selectedEntry))}
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">
                        {fmtCurrency(totalCredit(selectedEntry))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totalDebit(selectedEntry) === totalCredit(selectedEntry) ? (
                <p className="text-sm text-emerald-600 mt-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {t('admin.entries.entryBalanced')}
                </p>
              ) : (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {t('admin.entries.entryUnbalanced')}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* New Entry Modal */}
      <Modal
        isOpen={showNewEntryModal}
        onClose={() => setShowNewEntryModal(false)}
        title={t('admin.entries.newEntryModalTitle')}
        size="xl"
        footer={newEntryFooter}
      >
        <div className="space-y-6">
          {/* Header Fields */}
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t('admin.entries.dateLabel')}>
              <Input type="date" value={newEntryDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEntryDate(e.target.value)} />
            </FormField>
            <div className="col-span-2">
              <FormField label={t('admin.entries.descriptionHeader')}>
                <Input type="text" placeholder={t('admin.entries.descriptionPlaceholder')} value={newEntryDescription} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEntryDescription(e.target.value)} />
              </FormField>
            </div>
          </div>

          {/* Journal Lines */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-900">{t('admin.entries.entryLines')}</h4>
              <Button variant="ghost" size="sm" icon={Plus} className="text-emerald-600 hover:text-emerald-700" onClick={addNewLine}>
                {t('admin.entries.addLine')}
              </Button>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('admin.entries.accountHeader')}</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">{t('admin.entries.descriptionHeader')}</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 w-32">{t('admin.entries.debitHeader')}</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 w-32">{t('admin.entries.creditHeader')}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {newEntryLines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">
                        <select
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          value={line.accountCode}
                          onChange={(e) => updateNewLine(idx, 'accountCode', e.target.value)}
                        >
                          <option value="">{t('admin.entries.selectAccount')}</option>
                          {accountOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          placeholder={t('admin.entries.descriptionLinePlaceholder')}
                          value={line.description}
                          onChange={(e) => updateNewLine(idx, 'description', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => updateNewLine(idx, 'debit', e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                          placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => updateNewLine(idx, 'credit', e.target.value)}
                        />
                      </td>
                      <td className="px-2">
                        <button className="p-1 text-red-500 hover:bg-red-50 rounded" onClick={() => removeNewLine(idx)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100">
                  <tr>
                    <td colSpan={2} className="px-4 py-2 font-semibold text-slate-900">{t('admin.entries.total')}</td>
                    <td className="px-4 py-2 text-right font-bold text-slate-900">{fmtCurrency(newLinesTotalDebit)}</td>
                    <td className="px-4 py-2 text-right font-bold text-slate-900">{fmtCurrency(newLinesTotalCredit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Reference and Attachments */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('admin.entries.referenceLabel')}>
              <Input type="text" placeholder={t('admin.entries.referencePlaceholder')} value={newEntryReference} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewEntryReference(e.target.value)} />
            </FormField>
            <FormField label={t('admin.entries.attachmentLabel')}>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-emerald-400 cursor-pointer transition-colors">
                <p className="text-sm text-slate-500">{t('admin.entries.attachmentHint')}</p>
              </div>
            </FormField>
          </div>
        </div>
      </Modal>
    </div>
  );
}
