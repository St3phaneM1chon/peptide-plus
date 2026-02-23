'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Inbox, Search, Filter, User, Clock, Tag,
  ChevronRight, Circle, AlertCircle, CheckCircle2, Pause, XCircle,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  subject: string;
  status: string;
  priority: string;
  tags: string | null;
  lastMessageAt: string;
  createdAt: string;
  customer: { id: string; name: string | null; email: string; loyaltyTier: string; image: string | null } | null;
  assignedTo: { id: string; name: string | null; email: string; image: string | null } | null;
  inboundEmails: Array<{ id: string; from: string; fromName: string | null; subject: string; textBody: string | null; receivedAt: string }>;
  _count: { inboundEmails: number; outboundReplies: number; notes: number };
}

interface InboxViewProps {
  onSelectConversation: (id: string) => void;
  selectedId?: string;
}

const statusIcons: Record<string, typeof Circle> = {
  NEW: Circle,
  OPEN: AlertCircle,
  PENDING: Pause,
  RESOLVED: CheckCircle2,
  CLOSED: XCircle,
};

const statusColors: Record<string, string> = {
  NEW: 'text-blue-500',
  OPEN: 'text-orange-500',
  PENDING: 'text-yellow-500',
  RESOLVED: 'text-green-500',
  CLOSED: 'text-slate-400',
};

const priorityColors: Record<string, string> = {
  URGENT: 'border-l-red-500',
  HIGH: 'border-l-orange-500',
  NORMAL: 'border-l-transparent',
  LOW: 'border-l-slate-300',
};

export default function InboxView({ onSelectConversation, selectedId }: InboxViewProps) {
  const { t, locale } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState<Record<string, number>>({});

  const fetchInbox = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/admin/emails/inbox?${params}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
        setCounts(data.counts || {});
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchInbox();
    // Poll for new messages every 30s
    const interval = setInterval(fetchInbox, 30000);
    return () => clearInterval(interval);
  }, [fetchInbox]);

  const statuses = [
    { key: 'ALL', label: t('admin.emails.inbox.filterAll'), count: counts.total || 0 },
    { key: 'NEW', label: t('admin.emails.inbox.filterNew'), count: counts.NEW || 0 },
    { key: 'OPEN', label: t('admin.emails.inbox.filterOpen'), count: counts.OPEN || 0 },
    { key: 'PENDING', label: t('admin.emails.inbox.filterPending'), count: counts.PENDING || 0 },
    { key: 'RESOLVED', label: t('admin.emails.inbox.filterResolved'), count: counts.RESOLVED || 0 },
  ];

  const formatRelativeTime = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('admin.emails.inbox.justNow');
    if (minutes < 60) return `${minutes}${t('admin.emails.inbox.minutesShort')}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}${t('admin.emails.inbox.hoursShort')}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}${t('admin.emails.inbox.daysShort')}`;
    return new Date(dateStr).toLocaleDateString(locale);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('admin.emails.inbox.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Status filters */}
      <div className="flex gap-1 p-2 border-b border-slate-200 overflow-x-auto">
        {statuses.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              statusFilter === s.key
                ? 'bg-sky-100 text-sky-700'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {s.label}
            {s.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                statusFilter === s.key ? 'bg-sky-200' : 'bg-slate-200'
              }`}>
                {s.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32" role="status" aria-label="Loading">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-500" />
            <span className="sr-only">Loading...</span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Inbox className="h-10 w-10 mb-2" />
            <p className="text-sm">{t('admin.emails.inbox.noConversations')}</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const StatusIcon = statusIcons[conv.status] || Circle;
            const lastEmail = conv.inboundEmails[0];
            // #24 Security fix: wrap JSON.parse in try-catch to avoid crash on malformed tags
            let tags: string[] = [];
            if (conv.tags) {
              try { const parsed = JSON.parse(conv.tags); tags = Array.isArray(parsed) ? parsed : []; } catch { tags = []; }
            }
            const isSelected = selectedId === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full text-left p-3 border-b border-slate-100 border-l-4 transition-colors ${
                  priorityColors[conv.priority] || ''
                } ${isSelected ? 'bg-sky-50' : 'hover:bg-slate-50'}`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                    {conv.customer?.image ? (
                      <img src={conv.customer.image} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <User className="h-4 w-4 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900 truncate">
                        {conv.customer?.name || lastEmail?.fromName || lastEmail?.from || t('admin.emails.inbox.unknown')}
                      </span>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(conv.lastMessageAt)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-700 truncate">{conv.subject}</p>

                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {lastEmail?.textBody?.slice(0, 100) || ''}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusIcon className={`h-3 w-3 ${statusColors[conv.status]}`} />
                      {conv.assignedTo && (
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <User className="h-2.5 w-2.5" />
                          {conv.assignedTo.name || conv.assignedTo.email}
                        </span>
                      )}
                      {tags.slice(0, 2).map((tag: string) => (
                        <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-500 rounded">
                          {tag}
                        </span>
                      ))}
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {conv._count.inboundEmails + conv._count.outboundReplies} {t('admin.emails.inbox.messagesShort')}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
