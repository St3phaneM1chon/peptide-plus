'use client';

/**
 * Customer Self-Service Portal (E18)
 * Customer-facing page with: My tickets, Create ticket, KB search, Recent orders
 */

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Ticket, Search, Plus, BookOpen, ShoppingBag,
  Clock, CheckCircle2, AlertTriangle, X, Send,
  ChevronRight, ExternalLink,
} from 'lucide-react';

interface PortalTicket {
  id: string;
  number: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface KBResult {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  categoryName: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  NEW: { label: 'New', color: 'text-blue-600 bg-blue-50', icon: AlertTriangle },
  OPEN: { label: 'Open', color: 'text-teal-600 bg-teal-50', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', color: 'text-indigo-600 bg-indigo-50', icon: Clock },
  WAITING_CUSTOMER: { label: 'Awaiting Your Reply', color: 'text-yellow-600 bg-yellow-50', icon: AlertTriangle },
  WAITING_INTERNAL: { label: 'Under Review', color: 'text-amber-600 bg-amber-50', icon: Clock },
  RESOLVED: { label: 'Resolved', color: 'text-green-600 bg-green-50', icon: CheckCircle2 },
  CLOSED: { label: 'Closed', color: 'text-gray-500 bg-gray-50', icon: CheckCircle2 },
};

const CATEGORIES = [
  'GENERAL', 'BILLING', 'TECHNICAL', 'SHIPPING', 'RETURNS',
  'PRODUCT_INQUIRY', 'COMPLAINT', 'FEATURE_REQUEST', 'OTHER',
];

export default function CustomerPortalPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'tickets' | 'kb' | 'create'>('tickets');
  const [tickets, setTickets] = useState<PortalTicket[]>([]);
  const [kbResults, setKbResults] = useState<KBResult[]>([]);
  const [kbSearch, setKbSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Create ticket form
  const [formSubject, setFormSubject] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('GENERAL');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/portal/tickets');
      if (res.ok) {
        const data = await res.json();
        setTickets(data.data || data.tickets || []);
      }
    } catch {
      // Portal tickets endpoint may not exist yet - graceful fallback
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  const searchKB = useCallback(async (query: string) => {
    if (!query.trim()) { setKbResults([]); return; }
    try {
      const res = await fetch(`/api/portal/kb?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setKbResults(data.data || data.articles || []);
      }
    } catch {
      setKbResults([]);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { if (kbSearch) searchKB(kbSearch); }, 300);
    return () => clearTimeout(timer);
  }, [kbSearch, searchKB]);

  const handleSubmitTicket = async () => {
    if (!formSubject.trim()) {
      toast.error(t('portal.subjectRequired') || 'Subject is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/portal/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: formSubject,
          description: formDescription,
          category: formCategory,
        }),
      });

      if (res.ok) {
        toast.success(t('portal.ticketCreated') || 'Ticket submitted successfully');
        setFormSubject('');
        setFormDescription('');
        setFormCategory('GENERAL');
        setActiveTab('tickets');
        loadTickets();
      } else {
        toast.error(t('portal.ticketError') || 'Failed to submit ticket');
      }
    } catch {
      toast.error(t('common.errorOccurred') || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          {t('portal.title') || 'Support Portal'}
        </h1>
        <p className="text-slate-500 mt-2">
          {t('portal.subtitle') || 'Get help, track tickets, and find answers'}
        </p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => setActiveTab('tickets')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            activeTab === 'tickets' ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <Ticket className="w-6 h-6 text-teal-600 mb-2" />
          <h3 className="font-semibold text-slate-900">{t('portal.myTickets') || 'My Tickets'}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('portal.myTicketsDesc') || 'View and track your requests'}</p>
        </button>
        <button
          onClick={() => setActiveTab('kb')}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            activeTab === 'kb' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-slate-300 bg-white'
          }`}
        >
          <BookOpen className="w-6 h-6 text-purple-600 mb-2" />
          <h3 className="font-semibold text-slate-900">{t('portal.knowledgeBase') || 'Knowledge Base'}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('portal.kbDesc') || 'Search help articles'}</p>
        </button>
        <a
          href="/dashboard"
          className="p-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white text-left transition-all"
        >
          <ShoppingBag className="w-6 h-6 text-emerald-600 mb-2" />
          <h3 className="font-semibold text-slate-900">{t('portal.recentOrders') || 'Recent Orders'}</h3>
          <p className="text-sm text-slate-500 mt-1">{t('portal.ordersDesc') || 'View order history and status'}</p>
        </a>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* My Tickets */}
        {activeTab === 'tickets' && (
          <div>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">{t('portal.myTickets') || 'My Tickets'}</h2>
              <button
                onClick={() => setActiveTab('create')}
                className="flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700"
              >
                <Plus className="w-4 h-4" />
                {t('portal.newTicket') || 'New Ticket'}
              </button>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-slate-400">{t('common.loading') || 'Loading...'}</div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-center">
                <Ticket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{t('portal.noTickets') || 'No tickets yet'}</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-3 text-sm text-teal-600 hover:text-teal-700"
                >
                  {t('portal.createFirst') || 'Create your first ticket'}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {tickets.map((ticket) => {
                  const statusInfo = STATUS_LABELS[ticket.status] || STATUS_LABELS.OPEN;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <div key={ticket.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-400">{ticket.number}</span>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusInfo.label}
                            </span>
                          </div>
                          <h3 className="font-medium text-slate-900 mt-1">{ticket.subject}</h3>
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                            <span>{ticket.category.replace(/_/g, ' ')}</span>
                            <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Knowledge Base Search */}
        {activeTab === 'kb' && (
          <div>
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={kbSearch}
                  onChange={(e) => setKbSearch(e.target.value)}
                  placeholder={t('portal.searchKB') || 'Search help articles...'}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {kbResults.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {kbResults.map((article) => (
                  <a
                    key={article.id}
                    href={`/learn/${article.slug}`}
                    className="block p-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900">{article.title}</h3>
                        {article.excerpt && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{article.excerpt}</p>
                        )}
                        {article.categoryName && (
                          <span className="inline-flex mt-2 px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                            {article.categoryName}
                          </span>
                        )}
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                    </div>
                  </a>
                ))}
              </div>
            ) : kbSearch ? (
              <div className="p-8 text-center text-slate-400">
                {t('portal.noResults') || 'No articles found'}
              </div>
            ) : (
              <div className="p-8 text-center">
                <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">{t('portal.searchPrompt') || 'Type to search help articles'}</p>
              </div>
            )}
          </div>
        )}

        {/* Create Ticket */}
        {activeTab === 'create' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-slate-900">
                {t('portal.createTicket') || 'Submit a Request'}
              </h2>
              <button onClick={() => setActiveTab('tickets')} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('portal.subject') || 'Subject'} *
                </label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  placeholder={t('portal.subjectPlaceholder') || 'Briefly describe your issue'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('portal.category') || 'Category'}
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

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('portal.description') || 'Description'}
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  placeholder={t('portal.descriptionPlaceholder') || 'Provide details about your request...'}
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSubmitTicket}
                  disabled={isSubmitting || !formSubject.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting
                    ? (t('portal.submitting') || 'Submitting...')
                    : (t('portal.submit') || 'Submit')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
