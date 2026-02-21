'use client';

import { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import {
  ArrowLeft, User, Send, StickyNote, Tag, UserPlus,
  Clock, ChevronDown, AlertTriangle, CheckCircle2,
  MoreHorizontal, Paperclip,
} from 'lucide-react';
import { useI18n } from '@/i18n/client';
import CustomerSidebar from './CustomerSidebar';
import { toast } from 'sonner';

interface TimelineItem {
  type: 'inbound' | 'outbound' | 'note' | 'activity';
  id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

interface ConversationDetail {
  id: string;
  subject: string;
  status: string;
  priority: string;
  tags: string | null;
  customer: Record<string, unknown> | null;
  assignedTo: { id: string; name: string | null; email: string } | null;
}

interface ConversationThreadProps {
  conversationId: string;
  onBack: () => void;
}

const STATUS_OPTIONS = ['NEW', 'OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

export default function ConversationThread({ conversationId, onBack }: ConversationThreadProps) {
  const { t, locale } = useI18n();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [customerStats, setCustomerStats] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyMode, setReplyMode] = useState<'reply' | 'note' | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

  const fetchConversation = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/emails/inbox/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setConversation(data.conversation);
        setTimeline(data.timeline || []);
        setCustomerStats(data.customerStats);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !conversation) return;
    setSending(true);

    try {
      if (replyMode === 'reply') {
        const lastInbound = timeline.filter(t => t.type === 'inbound').pop();
        const to = (lastInbound?.data?.from as string) || '';

        await fetch(`/api/admin/emails/inbox/${conversationId}/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to,
            subject: `Re: ${conversation.subject}`,
            htmlBody: `<div>${replyContent.replace(/\n/g, '<br>')}</div>`,
            textBody: replyContent,
          }),
        });
      } else if (replyMode === 'note') {
        await fetch(`/api/admin/emails/inbox/${conversationId}/note`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: replyContent }),
        });
      }

      setReplyContent('');
      setReplyMode(null);
      fetchConversation();
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setSending(false);
    }
  };

  const updateConversation = async (updates: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/emails/inbox/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setConversation(prev => prev ? { ...prev, ...data.conversation } : null);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  };

  const formatActivity = (data: Record<string, unknown>): string => {
    const action = data.action as string;
    const details = data.details ? JSON.parse(data.details as string) : {};

    switch (action) {
      case 'status_changed':
        return `${t('admin.emails.inbox.activityStatus')} ${details.from} → ${details.to}`;
      case 'assigned':
        return t('admin.emails.inbox.activityAssigned');
      case 'priority_changed':
        return `${t('admin.emails.inbox.activityPriority')} ${details.from} → ${details.to}`;
      case 'tagged':
        return t('admin.emails.inbox.activityTagsUpdated');
      case 'email_received':
        return t('admin.emails.inbox.activityEmailReceived');
      case 'replied':
        return t('admin.emails.inbox.activityReplySent');
      case 'noted':
        return t('admin.emails.inbox.activityNoteAdded');
      default:
        return action;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="h-8 w-8 text-slate-400 mb-2" />
        <p className="text-slate-500">{t('admin.emails.inbox.conversationNotFound')}</p>
        <button onClick={onBack} className="text-sky-500 text-sm mt-2">{t('admin.emails.inbox.back')}</button>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Main thread area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 bg-white">
          <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded">
            <ArrowLeft className="h-5 w-5 text-slate-500" />
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">{conversation.subject}</h2>
            <div className="flex items-center gap-3 mt-1">
              {/* Status dropdown */}
              <select
                value={conversation.status}
                onChange={(e) => updateConversation({ status: e.target.value })}
                className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer ${
                  conversation.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                  conversation.status === 'OPEN' ? 'bg-orange-100 text-orange-700' :
                  conversation.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                  conversation.status === 'RESOLVED' ? 'bg-green-100 text-green-700' :
                  'bg-slate-100 text-slate-700'
                }`}
              >
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Priority dropdown */}
              <select
                value={conversation.priority}
                onChange={(e) => updateConversation({ priority: e.target.value })}
                className={`text-xs font-medium px-2 py-1 rounded border-0 cursor-pointer ${
                  conversation.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                  conversation.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-600'
                }`}
              >
                {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {conversation.assignedTo && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <UserPlus className="h-3 w-3" />
                  {conversation.assignedTo.name || conversation.assignedTo.email}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 hover:bg-slate-100 rounded"
          >
            <User className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
          {timeline.map((item) => (
            <div key={`${item.type}-${item.id}`}>
              {item.type === 'inbound' && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="h-3 w-3 text-slate-500" />
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      {(item.data.fromName as string) || (item.data.from as string)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(item.timestamp).toLocaleString(locale)}
                    </span>
                    {(item.data.attachments as unknown[])?.length > 0 && (
                      <Paperclip className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                  <div className="text-sm text-slate-700 prose prose-sm max-w-none">
                    {item.data.htmlBody ? (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.data.htmlBody as string) }} />
                    ) : (
                      <p className="whitespace-pre-wrap">{item.data.textBody as string}</p>
                    )}
                  </div>
                </div>
              )}

              {item.type === 'outbound' && (
                <div className="bg-sky-50 rounded-lg shadow-sm border border-sky-200 p-4 ml-8">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-sky-200 flex items-center justify-center">
                      <Send className="h-3 w-3 text-sky-600" />
                    </div>
                    <span className="text-sm font-medium text-sky-900">
                      {((item.data.sender as Record<string, unknown>)?.name as string) || 'Support'}
                    </span>
                    <span className="text-xs text-sky-400">
                      {new Date(item.timestamp).toLocaleString(locale)}
                    </span>
                    {item.data.status === 'failed' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">{t('admin.emails.inbox.failed')}</span>
                    )}
                  </div>
                  <div className="text-sm text-slate-700">
                    {item.data.htmlBody ? (
                      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.data.htmlBody as string) }} />
                    ) : (
                      <p className="whitespace-pre-wrap">{item.data.textBody as string}</p>
                    )}
                  </div>
                </div>
              )}

              {item.type === 'note' && (
                <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-3 mx-8">
                  <div className="flex items-center gap-2 mb-1">
                    <StickyNote className="h-3 w-3 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-700">
                      {t('admin.emails.inbox.internalNote')} - {((item.data.author as Record<string, unknown>)?.name as string) || t('admin.emails.inbox.agent')}
                    </span>
                    <span className="text-[10px] text-yellow-500">
                      {new Date(item.timestamp).toLocaleString(locale)}
                    </span>
                  </div>
                  <p className="text-sm text-yellow-800 whitespace-pre-wrap">{item.data.content as string}</p>
                </div>
              )}

              {item.type === 'activity' && (
                <div className="flex items-center gap-2 justify-center py-1">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[10px] text-slate-400 px-2">
                    {formatActivity(item.data)}
                  </span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
              )}
            </div>
          ))}
          <div ref={threadEndRef} />
        </div>

        {/* Reply / Note bar */}
        <div className="border-t border-slate-200 bg-white p-3">
          {replyMode ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                  replyMode === 'reply' ? 'bg-sky-100 text-sky-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {replyMode === 'reply' ? t('admin.emails.inbox.reply') : t('admin.emails.inbox.internalNote')}
                </span>
                <button onClick={() => { setReplyMode(null); setReplyContent(''); }} className="text-xs text-slate-400">
                  {t('admin.emails.inbox.cancel')}
                </button>
              </div>
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={replyMode === 'reply' ? t('admin.emails.inbox.replyPlaceholder') : t('admin.emails.inbox.notePlaceholder')}
                className={`w-full p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 ${
                  replyMode === 'note' ? 'bg-yellow-50 border-yellow-200 focus:ring-yellow-400' : 'border-slate-200 focus:ring-sky-500'
                }`}
                rows={4}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleReply}
                  disabled={sending || !replyContent.trim()}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${
                    replyMode === 'note' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-sky-500 hover:bg-sky-600'
                  }`}
                >
                  {sending ? t('admin.emails.inbox.sending') : replyMode === 'reply' ? t('admin.emails.inbox.send') : t('admin.emails.inbox.addNote')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setReplyMode('reply')}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 rounded-lg"
              >
                <Send className="h-4 w-4" /> {t('admin.emails.inbox.replyBtn')}
              </button>
              <button
                onClick={() => setReplyMode('note')}
                className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200"
              >
                <StickyNote className="h-4 w-4" /> {t('admin.emails.inbox.noteBtn')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Customer sidebar */}
      {showSidebar && conversation.customer && (
        <CustomerSidebar customer={conversation.customer} stats={customerStats} />
      )}
    </div>
  );
}
