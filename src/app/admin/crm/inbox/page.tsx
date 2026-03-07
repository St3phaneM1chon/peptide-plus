'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  Mail, MessageSquare, Phone, Send,
  CheckCircle2, User, DollarSign, Star,
  Calendar, Tag, Activity, ExternalLink,
  Clock, Hash,
} from 'lucide-react';

interface Conversation {
  id: string;
  channel: string;
  status: string;
  subject?: string | null;
  contact?: { id: string; name: string | null; email: string } | null;
  lead?: {
    id: string;
    contactName: string;
    email?: string | null;
    phone?: string | null;
    companyName?: string | null;
    score: number;
    temperature: string;
    status: string;
    source: string;
    tags: string[];
    lastContactedAt?: string | null;
    deals?: { id: string; title: string; value: number; stage: { name: string } }[];
  } | null;
  assignedTo?: { id: string; name: string | null; email: string } | null;
  slaDeadline?: string | null;
  lastMessageAt?: string | null;
  _count?: { messages: number };
  createdAt: string;
}

interface Message {
  id: string;
  direction: string;
  content: string;
  senderName?: string | null;
  senderEmail?: string | null;
  readAt?: string | null;
  createdAt: string;
}

interface ConversationDetail extends Conversation {
  messages: Message[];
}

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  EMAIL: Mail, SMS: MessageSquare, PHONE: Phone, CHAT: MessageSquare, WHATSAPP: MessageSquare,
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-teal-100 text-teal-700', PENDING: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700', CLOSED: 'bg-gray-100 text-gray-600',
};

const TEMP_COLORS: Record<string, string> = {
  HOT: 'text-red-600 bg-red-50', WARM: 'text-orange-600 bg-orange-50', COLD: 'text-teal-600 bg-teal-50',
};

export default function InboxPage() {
  const { t, locale } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (channelFilter) params.set('channel', channelFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/admin/crm/inbox?${params}`);
      const json = await res.json();
      if (json.success) setConversations(json.data || []);
    } catch { toast.error('Failed to load inbox'); }
    finally { setLoading(false); }
  }, [channelFilter, statusFilter]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const selectConversation = async (conv: Conversation) => {
    try {
      const res = await fetch(`/api/admin/crm/inbox/${conv.id}`);
      const json = await res.json();
      if (json.success) setSelected(json.data);
    } catch { toast.error('Failed to load conversation'); }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/crm/inbox/${selected.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyText.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setReplyText('');
        selectConversation(selected);
      } else toast.error(json.error?.message || 'Failed to send');
    } catch { toast.error('Network error'); }
    finally { setSending(false); }
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    try {
      const res = await fetch(`/api/admin/crm/inbox/${selected.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Status: ${status}`);
        fetchConversations();
        selectConversation(selected);
      }
    } catch { toast.error('Failed to update'); }
  };

  const slaRemaining = selected?.slaDeadline
    ? Math.max(0, Math.round((new Date(selected.slaDeadline).getTime() - Date.now()) / 60000))
    : null;

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Left: Conversation List */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-3 border-b space-y-2">
          <h2 className="text-lg font-semibold">{t('admin.crm.inbox') || 'Inbox'}</h2>
          <div className="flex gap-2">
            <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)} className="text-xs border rounded px-2 py-1 flex-1">
              <option value="">{t('admin.crm.allChannels') || 'All Channels'}</option>
              {['EMAIL', 'SMS', 'PHONE', 'CHAT', 'WHATSAPP'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="text-xs border rounded px-2 py-1 flex-1">
              <option value="">{t('admin.crm.allStatuses') || 'All Status'}</option>
              {['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {loading ? (
            <div className="p-4 text-center text-gray-400"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-500 mx-auto" /></div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">{t('admin.crm.noConversations') || 'No conversations'}</div>
          ) : conversations.map(conv => {
            const ChannelIcon = CHANNEL_ICONS[conv.channel] || MessageSquare;
            const isSelected = selected?.id === conv.id;
            return (
              <button key={conv.id} onClick={() => selectConversation(conv)}
                className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-teal-50 border-l-2 border-teal-500' : ''}`}>
                <div className="flex items-start gap-2">
                  <ChannelIcon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {conv.contact?.name || conv.lead?.contactName || conv.subject || 'Unknown'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[conv.status] || ''}`}>{conv.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 truncate">{conv.subject || conv.channel}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">{conv._count?.messages || 0} msgs</span>
                      {conv.lastMessageAt && <span className="text-xs text-gray-400">{new Date(conv.lastMessageAt).toLocaleDateString(locale)}</span>}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center: Messages */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>{t('admin.crm.selectConversation') || 'Select a conversation'}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{selected.contact?.name || selected.lead?.contactName || 'Unknown'}</h3>
                <p className="text-xs text-gray-500">{selected.subject || selected.channel} - {selected.status}</p>
              </div>
              <div className="flex items-center gap-2">
                {slaRemaining !== null && slaRemaining <= 30 && (
                  <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${slaRemaining <= 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    <Clock className="h-3 w-3" />
                    {slaRemaining <= 0 ? t('admin.crm.slaBreached') || 'SLA Breached' : `${slaRemaining}m`}
                  </span>
                )}
                {selected.status !== 'RESOLVED' && (
                  <button onClick={() => updateStatus('RESOLVED')} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-md hover:bg-green-100">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t('admin.crm.resolve') || 'Resolve'}
                  </button>
                )}
                {selected.status === 'RESOLVED' && (
                  <button onClick={() => updateStatus('CLOSED')} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100">
                    {t('admin.crm.close') || 'Close'}
                  </button>
                )}
                {selected.status === 'CLOSED' && (
                  <button onClick={() => updateStatus('OPEN')} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-teal-50 text-teal-700 rounded-md hover:bg-teal-100">
                    {t('admin.crm.reopen') || 'Reopen'}
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages?.map(msg => (
                <div key={msg.id} className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] rounded-lg p-3 ${
                    msg.direction === 'OUTBOUND' ? 'bg-teal-600 text-white' : 'bg-white border'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    <div className={`text-xs mt-1 ${msg.direction === 'OUTBOUND' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {msg.senderName && <span>{msg.senderName} · </span>}
                      {new Date(msg.createdAt).toLocaleString(locale)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Reply */}
            <div className="bg-white border-t p-3">
              <div className="flex gap-2">
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder={t('admin.crm.typeReply') || 'Type your reply...'}
                  rows={2}
                  className="flex-1 text-sm border rounded-md px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                />
                <button onClick={sendReply} disabled={sending || !replyText.trim()}
                  className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 disabled:opacity-50 self-end">
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right: Enhanced Contact Panel */}
      {selected && (
        <div className="w-72 border-l bg-white overflow-y-auto">
          {/* Contact Header */}
          <div className="p-4 border-b bg-gradient-to-b from-teal-50 to-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <User className="h-5 w-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{selected.contact?.name || selected.lead?.contactName || '-'}</p>
                {selected.lead?.companyName && (
                  <p className="text-xs text-gray-500 truncate">{selected.lead.companyName}</p>
                )}
              </div>
            </div>
            {selected.contact?.email && (
              <p className="text-xs text-gray-500 truncate flex items-center gap-1"><Mail className="h-3 w-3" /> {selected.contact.email}</p>
            )}
            {selected.lead?.email && !selected.contact?.email && (
              <p className="text-xs text-gray-500 truncate flex items-center gap-1"><Mail className="h-3 w-3" /> {selected.lead.email}</p>
            )}
            {selected.lead?.phone && (
              <p className="text-xs text-gray-500 truncate flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" /> {selected.lead.phone}</p>
            )}
          </div>

          {/* Lead Score & Temperature */}
          {selected.lead && (
            <div className="p-4 border-b">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('admin.crm.leadInfo') || 'Lead Info'}</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    <span className="text-lg font-bold text-gray-900">{selected.lead.score}</span>
                  </div>
                  <p className="text-xs text-gray-500">{t('admin.crm.score') || 'Score'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TEMP_COLORS[selected.lead.temperature] || 'bg-gray-100 text-gray-600'}`}>
                    {selected.lead.temperature}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{t('admin.crm.temperature') || 'Temp'}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1"><Activity className="h-3 w-3" /> {t('admin.crm.status') || 'Status'}</span>
                  <span className="font-medium text-gray-700">{selected.lead.status}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 flex items-center gap-1"><Hash className="h-3 w-3" /> {t('admin.crm.source') || 'Source'}</span>
                  <span className="font-medium text-gray-700">{selected.lead.source}</span>
                </div>
                {selected.lead.lastContactedAt && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> {t('admin.crm.lastContact') || 'Last Contact'}</span>
                    <span className="font-medium text-gray-700">{new Date(selected.lead.lastContactedAt).toLocaleDateString(locale)}</span>
                  </div>
                )}
              </div>
              {selected.lead.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selected.lead.tags.map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded flex items-center gap-0.5">
                      <Tag className="h-2.5 w-2.5" /> {tag}
                    </span>
                  ))}
                </div>
              )}
              <a href={`/admin/crm/leads/${selected.lead.id}`} className="mt-2 text-xs text-teal-600 hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> {t('admin.crm.viewLeadProfile') || 'View full profile'}
              </a>
            </div>
          )}

          {/* Active Deals */}
          {selected.lead?.deals && selected.lead.deals.length > 0 && (
            <div className="p-4 border-b">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('admin.crm.activeDeals') || 'Active Deals'}</h4>
              <div className="space-y-2">
                {selected.lead.deals.map(deal => (
                  <a key={deal.id} href={`/admin/crm/deals/${deal.id}`} className="block bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">{deal.title}</p>
                      <DollarSign className="h-3 w-3 text-green-600" />
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500">{deal.stage?.name}</span>
                      <span className="text-xs font-semibold text-green-700">
                        ${Number(deal.value).toLocaleString(locale)}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Conversation Details */}
          <div className="p-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('admin.crm.conversationDetails') || 'Conversation'}</h4>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t('admin.crm.channel') || 'Channel'}</span>
                <span className="font-medium text-gray-700">{selected.channel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t('admin.crm.assignedTo') || 'Assigned To'}</span>
                <span className="font-medium text-gray-700">{selected.assignedTo?.name || selected.assignedTo?.email || t('admin.crm.unassigned') || 'Unassigned'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t('admin.crm.messages') || 'Messages'}</span>
                <span className="font-medium text-gray-700">{selected.messages?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{t('admin.crm.created') || 'Created'}</span>
                <span className="font-medium text-gray-700">{new Date(selected.createdAt).toLocaleDateString(locale)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
