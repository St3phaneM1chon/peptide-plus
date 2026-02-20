'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, AlertTriangle, Bell, Plus, Filter } from 'lucide-react';
import {
  PageHeader,
  SectionCard,
  StatCard,
  StatusBadge,
  Button,
  Modal,
  FormField,
  Input,
  SelectFilter,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { sectionThemes } from '@/lib/admin/section-themes';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FiscalEvent {
  id: string;
  title: string;
  titleFr: string | null;
  description: string | null;
  descriptionFr: string | null;
  dueDate: string;
  reminderDate: string | null;
  category: string;
  authority: string;
  frequency: string;
  status: string;
  completedAt: string | null;
  completedBy: string | null;
  amount: number | null;
  notes: string | null;
  isRecurring: boolean;
}

interface Stats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const authorityColors: Record<string, string> = {
  CRA: 'bg-blue-100 text-blue-800 border-blue-200',
  RQ: 'bg-purple-100 text-purple-800 border-purple-200',
  BOTH: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  SERVICE_CANADA: 'bg-green-100 text-green-800 border-green-200',
};

const authorityBorderColors: Record<string, string> = {
  CRA: 'border-l-blue-500',
  RQ: 'border-l-purple-500',
  BOTH: 'border-l-indigo-500',
  SERVICE_CANADA: 'border-l-green-500',
};

const categoryLabels: Record<string, { en: string; fr: string }> = {
  payroll: { en: 'Payroll', fr: 'Paie' },
  corporate_tax: { en: 'Corporate Tax', fr: 'Imp\u00f4t corporatif' },
  sales_tax: { en: 'Sales Tax', fr: 'Taxes de vente' },
  information_return: { en: 'Information Return', fr: 'D\u00e9claration' },
  installment: { en: 'Installment', fr: 'Acompte provisionnel' },
  other: { en: 'Other', fr: 'Autre' },
};

const statusOptions = [
  { value: 'PENDING', label: 'Pending / En attente' },
  { value: 'COMPLETED', label: 'Completed / Compl\u00e9t\u00e9' },
  { value: 'OVERDUE', label: 'Overdue / En retard' },
  { value: 'SKIPPED', label: 'Skipped / Ignor\u00e9' },
];

const categoryOptions = Object.entries(categoryLabels).map(([value, labels]) => ({
  value,
  label: `${labels.en} / ${labels.fr}`,
}));

const authorityOptions = [
  { value: 'CRA', label: 'CRA' },
  { value: 'RQ', label: 'Revenu Qu\u00e9bec' },
  { value: 'BOTH', label: 'CRA + RQ' },
  { value: 'SERVICE_CANADA', label: 'Service Canada' },
];

const frequencyOptions = [
  { value: 'once', label: 'Once / Une fois' },
  { value: 'monthly', label: 'Monthly / Mensuel' },
  { value: 'quarterly', label: 'Quarterly / Trimestriel' },
  { value: 'annual', label: 'Annual / Annuel' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CalendrierFiscalPage() {
  const { t, locale, formatCurrency, formatDate } = useI18n();
  const theme = sectionThemes.compliance;
  const isFr = locale === 'fr';

  // State
  const [events, setEvents] = useState<FiscalEvent[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, pending: 0, completed: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formTitleFr, setFormTitleFr] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDescriptionFr, setFormDescriptionFr] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formReminderDate, setFormReminderDate] = useState('');
  const [formCategory, setFormCategory] = useState('payroll');
  const [formAuthority, setFormAuthority] = useState('CRA');
  const [formFrequency, setFormFrequency] = useState('once');
  const [formAmount, setFormAmount] = useState('');
  const [formIsRecurring, setFormIsRecurring] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams({ year: String(selectedYear) });
      if (selectedCategory) params.set('category', selectedCategory);
      if (selectedStatus) params.set('status', selectedStatus);

      const res = await fetch(`/api/accounting/fiscal-calendar?${params.toString()}`);
      const json = await res.json();

      if (json.events) setEvents(json.events);
      if (json.stats) setStats(json.stats);
    } catch (err) {
      console.error('Error fetching fiscal calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedCategory, selectedStatus]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleComplete = async (eventId: string) => {
    try {
      const res = await fetch('/api/accounting/fiscal-calendar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: eventId, status: 'COMPLETED' }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to complete event');
        return;
      }
      toast.success(isFr ? '\u00c9v\u00e9nement compl\u00e9t\u00e9' : 'Event completed');
      await fetchEvents();
    } catch (err) {
      console.error('Error completing event:', err);
      toast.error(isFr ? 'Erreur lors de la mise \u00e0 jour' : 'Error updating event');
    }
  };

  const handleAddEvent = async () => {
    if (!formTitle || !formDueDate) {
      toast.error(isFr ? 'Titre et date requis' : 'Title and date required');
      return;
    }

    try {
      const res = await fetch('/api/accounting/fiscal-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          titleFr: formTitleFr || null,
          description: formDescription || null,
          descriptionFr: formDescriptionFr || null,
          dueDate: formDueDate,
          reminderDate: formReminderDate || null,
          category: formCategory,
          authority: formAuthority,
          frequency: formFrequency,
          amount: formAmount || null,
          isRecurring: formIsRecurring,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Failed to create event');
        return;
      }

      toast.success(isFr ? '\u00c9v\u00e9nement cr\u00e9\u00e9' : 'Event created');
      setShowAddModal(false);
      resetForm();
      await fetchEvents();
    } catch (err) {
      console.error('Error creating event:', err);
      toast.error(isFr ? 'Erreur lors de la cr\u00e9ation' : 'Error creating event');
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormTitleFr('');
    setFormDescription('');
    setFormDescriptionFr('');
    setFormDueDate('');
    setFormReminderDate('');
    setFormCategory('payroll');
    setFormAuthority('CRA');
    setFormFrequency('once');
    setFormAmount('');
    setFormIsRecurring(false);
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getEventTitle = (event: FiscalEvent) => {
    return isFr && event.titleFr ? event.titleFr : event.title;
  };

  const getEventDescription = (event: FiscalEvent) => {
    return isFr && event.descriptionFr ? event.descriptionFr : event.description;
  };

  const getCategoryLabel = (cat: string) => {
    const labels = categoryLabels[cat] || categoryLabels.other;
    return isFr ? labels.fr : labels.en;
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'neutral' => {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PENDING': return 'warning';
      case 'OVERDUE': return 'error';
      default: return 'neutral';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return isFr ? 'Compl\u00e9t\u00e9' : 'Completed';
      case 'PENDING': return isFr ? 'En attente' : 'Pending';
      case 'OVERDUE': return isFr ? 'En retard' : 'Overdue';
      case 'SKIPPED': return isFr ? 'Ignor\u00e9' : 'Skipped';
      default: return status;
    }
  };

  const isOverdue = (event: FiscalEvent) =>
    event.status === 'PENDING' && new Date(event.dueDate) < new Date();

  const getDaysUntilDue = (dueDate: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Group events by month
  const eventsByMonth: Record<string, FiscalEvent[]> = {};
  events.forEach((event) => {
    const date = new Date(event.dueDate);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!eventsByMonth[monthKey]) eventsByMonth[monthKey] = [];
    eventsByMonth[monthKey].push(event);
  });

  const monthNames = Object.keys(eventsByMonth).sort();

  const formatMonthLabel = (key: string) => {
    const [y, m] = key.split('-');
    const date = new Date(parseInt(y), parseInt(m) - 1, 1);
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
  };

  const yearOptions = [
    { value: '2024', label: '2024' },
    { value: '2025', label: '2025' },
    { value: '2026', label: '2026' },
    { value: '2027', label: '2027' },
  ];

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div aria-live="polite" aria-busy="true" className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={isFr ? 'Calendrier Fiscal' : 'Fiscal Calendar'}
        subtitle={isFr
          ? '\u00c9ch\u00e9ances et obligations CRA / Revenu Qu\u00e9bec'
          : 'CRA / Revenu Qu\u00e9bec deadlines and obligations'}
        theme={theme}
        actions={
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className={`${theme.btnPrimary} border-transparent text-white`}
          >
            {isFr ? 'Ajouter un \u00e9v\u00e9nement' : 'Add Event'}
          </Button>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label={isFr ? 'Total \u00e9v\u00e9nements' : 'Total Events'}
          value={stats.total}
          icon={Calendar}
          theme={theme}
        />
        <StatCard
          label={isFr ? 'En attente' : 'Pending'}
          value={stats.pending}
          icon={Clock}
          theme={theme}
        />
        <StatCard
          label={isFr ? 'Compl\u00e9t\u00e9s' : 'Completed'}
          value={stats.completed}
          icon={CheckCircle}
          theme={theme}
        />
        <StatCard
          label={isFr ? 'En retard' : 'Overdue'}
          value={stats.overdue}
          icon={stats.overdue > 0 ? AlertTriangle : Clock}
          theme={theme}
          className={stats.overdue > 0 ? 'ring-2 ring-red-200' : ''}
        />
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Filter className="w-4 h-4" />
          <span>{isFr ? 'Filtres' : 'Filters'}:</span>
        </div>
        <SelectFilter
          label={isFr ? 'Ann\u00e9e' : 'Year'}
          value={String(selectedYear)}
          onChange={(v) => setSelectedYear(parseInt(v) || new Date().getFullYear())}
          options={yearOptions}
        />
        <SelectFilter
          label={isFr ? 'Cat\u00e9gorie' : 'Category'}
          value={selectedCategory}
          onChange={setSelectedCategory}
          options={categoryOptions}
        />
        <SelectFilter
          label={isFr ? 'Statut' : 'Status'}
          value={selectedStatus}
          onChange={setSelectedStatus}
          options={statusOptions}
        />
      </div>

      {/* Calendar Timeline View */}
      {monthNames.length === 0 ? (
        <SectionCard title={isFr ? 'Aucun \u00e9v\u00e9nement' : 'No Events'} theme={theme}>
          <div className="text-center py-12 text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-lg font-medium">
              {isFr ? 'Aucun \u00e9v\u00e9nement fiscal trouv\u00e9' : 'No fiscal events found'}
            </p>
            <p className="text-sm mt-1">
              {isFr
                ? 'Ajoutez des \u00e9v\u00e9nements ou modifiez vos filtres'
                : 'Add events or adjust your filters'}
            </p>
          </div>
        </SectionCard>
      ) : (
        monthNames.map((monthKey) => (
          <SectionCard
            key={monthKey}
            title={formatMonthLabel(monthKey)}
            theme={theme}
          >
            <div className="space-y-3">
              {eventsByMonth[monthKey].map((event) => {
                const daysUntil = getDaysUntilDue(event.dueDate);
                const overdue = isOverdue(event);
                const effectiveStatus = overdue ? 'OVERDUE' : event.status;

                return (
                  <div
                    key={event.id}
                    className={`flex items-start gap-4 p-4 rounded-lg border border-l-4 bg-white
                      ${authorityBorderColors[event.authority] || 'border-l-slate-300'}
                      ${overdue ? 'border-red-200 bg-red-50/30' : 'border-slate-200'}
                      hover:shadow-sm transition-shadow`}
                  >
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-slate-900 truncate">
                          {getEventTitle(event)}
                        </h3>
                        {overdue && (
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        )}
                      </div>

                      {getEventDescription(event) && (
                        <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">
                          {getEventDescription(event)}
                        </p>
                      )}

                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {/* Due date */}
                        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(event.dueDate)}
                        </span>

                        {/* Days until due */}
                        {event.status === 'PENDING' && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            daysUntil < 0
                              ? 'bg-red-100 text-red-700'
                              : daysUntil <= 7
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-green-100 text-green-700'
                          }`}>
                            {daysUntil < 0
                              ? (isFr ? `${Math.abs(daysUntil)}j en retard` : `${Math.abs(daysUntil)}d overdue`)
                              : daysUntil === 0
                                ? (isFr ? "Aujourd'hui" : 'Today')
                                : (isFr ? `${daysUntil}j restants` : `${daysUntil}d left`)}
                          </span>
                        )}

                        {/* Category badge */}
                        <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {getCategoryLabel(event.category)}
                        </span>

                        {/* Authority badge */}
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full border ${authorityColors[event.authority] || 'bg-slate-100 text-slate-600'}`}>
                          {event.authority}
                        </span>

                        {/* Status badge */}
                        <StatusBadge variant={getStatusVariant(effectiveStatus)}>
                          {getStatusLabel(effectiveStatus)}
                        </StatusBadge>

                        {/* Amount */}
                        {event.amount != null && (
                          <span className="text-xs font-medium text-slate-700">
                            {formatCurrency(Number(event.amount))}
                          </span>
                        )}

                        {/* Reminder indicator */}
                        {event.reminderDate && (
                          <span className="inline-flex items-center gap-0.5 text-xs text-amber-600">
                            <Bell className="w-3 h-3" />
                            {isFr ? 'Rappel' : 'Reminder'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {event.status === 'PENDING' && (
                        <button
                          onClick={() => handleComplete(event.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium
                            text-emerald-700 bg-emerald-50 border border-emerald-200
                            rounded-md hover:bg-emerald-100 transition-colors"
                          title={isFr ? 'Marquer compl\u00e9t\u00e9' : 'Mark complete'}
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          {isFr ? 'Compl\u00e9ter' : 'Complete'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        ))
      )}

      {/* Add Event Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={isFr ? 'Ajouter un \u00e9v\u00e9nement fiscal' : 'Add Fiscal Event'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>
              {isFr ? 'Annuler' : 'Cancel'}
            </Button>
            <Button
              onClick={handleAddEvent}
              className={`${theme.btnPrimary} border-transparent text-white shadow-sm`}
            >
              {isFr ? 'Cr\u00e9er' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Title EN / FR */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={isFr ? 'Titre (EN)' : 'Title (EN)'}>
              <Input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="e.g. GST/QST remittance"
              />
            </FormField>
            <FormField label={isFr ? 'Titre (FR)' : 'Title (FR)'}>
              <Input
                type="text"
                value={formTitleFr}
                onChange={(e) => setFormTitleFr(e.target.value)}
                placeholder="ex. Remise TPS/TVQ"
              />
            </FormField>
          </div>

          {/* Description EN / FR */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Description (EN)">
              <Input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Details..."
              />
            </FormField>
            <FormField label="Description (FR)">
              <Input
                type="text"
                value={formDescriptionFr}
                onChange={(e) => setFormDescriptionFr(e.target.value)}
                placeholder="D\u00e9tails..."
              />
            </FormField>
          </div>

          {/* Due date & Reminder date */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={isFr ? 'Date d\'\u00e9ch\u00e9ance' : 'Due Date'}>
              <Input
                type="date"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </FormField>
            <FormField label={isFr ? 'Date de rappel' : 'Reminder Date'}>
              <Input
                type="date"
                value={formReminderDate}
                onChange={(e) => setFormReminderDate(e.target.value)}
              />
            </FormField>
          </div>

          {/* Category & Authority */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={isFr ? 'Cat\u00e9gorie' : 'Category'}>
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label={isFr ? 'Autorit\u00e9' : 'Authority'}>
              <select
                value={formAuthority}
                onChange={(e) => setFormAuthority(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
              >
                {authorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Frequency & Amount */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label={isFr ? 'Fr\u00e9quence' : 'Frequency'}>
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white
                  focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
              >
                {frequencyOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label={isFr ? 'Montant ($)' : 'Amount ($)'}>
              <Input
                type="number"
                step="0.01"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                placeholder="0.00"
              />
            </FormField>
          </div>

          {/* Recurring checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRecurring"
              checked={formIsRecurring}
              onChange={(e) => setFormIsRecurring(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-amber-600"
            />
            <label htmlFor="isRecurring" className="text-sm text-slate-700">
              {isFr ? '\u00c9v\u00e9nement r\u00e9current' : 'Recurring event'}
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
