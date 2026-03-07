'use client';

/**
 * CRM Tickets Admin Page (E19)
 * Ticket management: list, search, filter, create, priority color coding
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Search, Plus, Ticket, X, Save, AlertTriangle,
  Clock, CheckCircle2, User, MessageSquare,
} from 'lucide-react';
import { addCSRFHeader } from '@/lib/csrf';

interface CrmTicket {
  id: string;
  number: string;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  contactName: string | null;
  contactEmail: string | null;
  assignedToId: string | null;
  tags: string[];
  createdAt: string;
  resolvedAt: string | null;
  comments: { content: string; authorName: string | null; createdAt: string }[];
  _count: { comments: number };
}

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-300',
  URGENT: 'bg-orange-100 text-orange-700 border-orange-300',
  HIGH: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  MEDIUM: 'bg-teal-100 text-teal-700 border-teal-300',
  LOW: 'bg-gray-100 text-gray-600 border-gray-300',
};

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-teal-100 text-teal-700',
  OPEN: 'bg-teal-100 text-teal-700',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
  WAITING_CUSTOMER: 'bg-yellow-100 text-yellow-700',
  WAITING_INTERNAL: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

const STATUS_ICONS: Record<string, typeof Clock> = {
  NEW: AlertTriangle,
  OPEN: Clock,
  IN_PROGRESS: Clock,
  WAITING_CUSTOMER: User,
  WAITING_INTERNAL: MessageSquare,
  RESOLVED: CheckCircle2,
  CLOSED: CheckCircle2,
};

const STATUSES = ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['CRITICAL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const CATEGORIES = ['GENERAL', 'BILLING', 'TECHNICAL', 'SHIPPING', 'RETURNS', 'PRODUCT_INQUIRY', 'COMPLAINT', 'FEATURE_REQUEST', 'OTHER'];

export default function TicketsPage() {
  const { t, locale } = useI18n();
  const [tickets, setTickets] = useState<CrmTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Create form state
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState('MEDIUM');
  const [formCategory, setFormCategory] = useState('GENERAL');
  const [formContactName, setFormContactName] = useState('');
  const [formContactEmail, setFormContactEmail] = useState('');
  const [formTags, setFormTags] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (categoryFilter) params.set('category', categoryFilter);

      const res = await fetch(`/api/admin/crm/tickets?${params}`);
      const data = await res.json();

      if (data.success) {
        setTickets(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter, categoryFilter, t]);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const handleCreate = async () => {
    if (!formSubject.trim()) {
      toast.error(t('admin.tickets.subjectRequired') || 'Subject is required');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/crm/tickets', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          subject: formSubject,
          description: formDescription || undefined,
          priority: formPriority,
          category: formCategory,
          contactName: formContactName || undefined,
          contactEmail: formContactEmail || undefined,
          tags: formTags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(t('admin.tickets.ticketCreated') || 'Ticket created');
        setShowModal(false);
        resetForm();
        loadTickets();
      } else {
        toast.error(data.error?.message || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormSubject('');
    setFormDescription('');
    setFormPriority('MEDIUM');
    setFormCategory('GENERAL');
    setFormContactName('');
    setFormContactEmail('');
    setFormTags('');
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Ticket className="w-7 h-7 text-teal-600" />
            {t('admin.tickets.title') || 'Support Tickets'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('admin.tickets.subtitle') || 'Manage customer support tickets'} ({total})
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('admin.tickets.newTicket') || 'New Ticket'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('admin.tickets.searchPlaceholder') || 'Search tickets...'}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">{t('admin.tickets.allStatuses') || 'All statuses'}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">{t('admin.tickets.allPriorities') || 'All priorities'}</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">{t('admin.tickets.allCategories') || 'All categories'}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {(search || statusFilter || priorityFilter || categoryFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setPriorityFilter(''); setCategoryFilter(''); setPage(1); }}
            className="p-2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tickets Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">{t('common.loading') || 'Loading...'}</div>
        ) : tickets.length === 0 ? (
          <div className="p-12 text-center">
            <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">{t('admin.tickets.noTickets') || 'No tickets found'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">#</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{t('admin.tickets.subject') || 'Subject'}</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">{t('admin.tickets.status') || 'Status'}</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">{t('admin.tickets.priority') || 'Priority'}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{t('admin.tickets.category') || 'Category'}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{t('admin.tickets.contact') || 'Contact'}</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">{t('admin.tickets.created') || 'Created'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((ticket) => {
                const StatusIcon = STATUS_ICONS[ticket.status] || Clock;
                return (
                  <tr key={ticket.id} className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{ticket.number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{ticket.subject}</div>
                      {ticket._count.comments > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MessageSquare className="w-3 h-3" /> {ticket._count.comments}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ticket.status] || ''}`}>
                        <StatusIcon className="w-3 h-3" />
                        {ticket.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[ticket.priority] || ''}`}>
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{ticket.category.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900 text-xs">{ticket.contactName || '-'}</div>
                      {ticket.contactEmail && (
                        <div className="text-slate-400 text-xs">{ticket.contactEmail}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(ticket.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              {t('common.previous') || 'Previous'}
            </button>
            <span className="text-sm text-slate-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border rounded disabled:opacity-50"
            >
              {t('common.next') || 'Next'}
            </button>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-slate-900">
                {t('admin.tickets.createTicket') || 'Create Ticket'}
              </h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.tickets.subject') || 'Subject'} *
                </label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.tickets.description') || 'Description'}
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('admin.tickets.priority') || 'Priority'}
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('admin.tickets.category') || 'Category'}
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('admin.tickets.contactName') || 'Contact Name'}
                  </label>
                  <input
                    type="text"
                    value={formContactName}
                    onChange={(e) => setFormContactName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('admin.tickets.contactEmail') || 'Contact Email'}
                  </label>
                  <input
                    type="email"
                    value={formContactEmail}
                    onChange={(e) => setFormContactEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('admin.tickets.tags') || 'Tags'} ({t('admin.tickets.commaSeparated') || 'comma separated'})
                </label>
                <input
                  type="text"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="billing, urgent, vip"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreate}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? (t('common.saving') || 'Saving...') : (t('admin.tickets.create') || 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
