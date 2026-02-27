'use client';

/**
 * Panel Admin Chat - BioCycle Peptides
 * Interface pour repondre aux messages clients
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageCircle,
  Globe,
  Mail,
  MapPin,
  Send,
  AlertTriangle,
  Bot,
  User,
  UserCog,
  Lightbulb,
  ArrowLeftRight,
  Image as ImageIcon,
  Smile,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  StatusBadge,
  EmptyState,
  Input,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

interface Message {
  id: string;
  content: string;
  contentOriginal?: string;
  sender: 'VISITOR' | 'ADMIN' | 'BOT';
  senderName?: string;
  language: string;
  translatedTo?: string;
  createdAt: string;
  isFromBot: boolean;
  isRead: boolean;
  type?: 'TEXT' | 'IMAGE' | 'FILE';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
}

interface Conversation {
  id: string;
  visitorId: string;
  visitorName?: string;
  visitorEmail?: string;
  visitorLanguage: string;
  status: string;
  isOnline: boolean;
  currentPage?: string;
  createdAt: string;
  lastMessageAt: string;
  messages: Message[];
  _count?: { messages: number };
}

interface Settings {
  isAdminOnline: boolean;
  adminLanguage: string;
  chatbotEnabled: boolean;
  notifyEmail?: string;
}

export default function AdminChatPage() {
  const { t, locale } = useI18n();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les settings
  useEffect(() => {
    fetch('/api/chat/settings')
      .then(res => res.json())
      .then(setSettings)
      .catch((err) => { console.error(err); toast.error(t('common.errorOccurred')); });
  }, []);

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?limit=100');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const interval = setInterval(loadConversations, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [loadConversations]);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ visitorId: conversations.find(c => c.id === conversationId)?.visitorId }),
      });
      const data = await res.json();
      if (data.conversation?.messages) {
        setMessages(data.conversation.messages);
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  }, [conversations]);

  // Polling pour les nouveaux messages
  useEffect(() => {
    if (!selectedConversation) return;

    const interval = setInterval(() => {
      loadMessages(selectedConversation.id);
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedConversation, loadMessages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Selectionner une conversation
  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await loadMessages(conversation.id);
  };

  // Envoyer un message
  const sendMessage = async () => {
    if (!inputValue.trim() || !selectedConversation || isLoading) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: messageContent,
          sender: 'ADMIN',
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, data.message]);
      loadConversations();
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle admin online status
  const toggleOnlineStatus = async () => {
    try {
      const res = await fetch('/api/chat/settings', {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isAdminOnline: !settings?.isAdminOnline }),
      });
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    }
  };

  // Emoji picker
  const commonEmojis = [
    '\u{1F600}', '\u{1F60A}', '\u{1F602}', '\u{1F923}', '\u{1F60D}', '\u{1F970}', '\u{1F618}', '\u{1F60E}',
    '\u{1F914}', '\u{1F605}', '\u{1F622}', '\u{1F62D}', '\u{1F621}', '\u{1F92F}', '\u{1F973}', '\u{1F929}',
    '\u{1F44D}', '\u{1F44E}', '\u2764\uFE0F', '\u{1F525}', '\u2705', '\u2B50', '\u{1F389}', '\u{1F4AF}',
    '\u{1F44B}', '\u{1F64F}', '\u{1F4AA}', '\u{1F91D}', '\u{1F44F}', '\u{1F38A}', '\u{1F4A1}', '\u{1F4E6}',
  ];

  const insertEmoji = (emoji: string) => {
    setInputValue(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Image upload handler (admin)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;

    e.target.value = '';
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('conversationId', selectedConversation.id);

      const uploadRes = await fetch('/api/chat/upload', { method: 'POST', body: formData, headers: addCSRFHeader({}) });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      const msgRes = await fetch('/api/chat/message', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: uploadData.url,
          sender: 'ADMIN',
          type: 'IMAGE',
          attachmentUrl: uploadData.url,
          attachmentName: uploadData.name,
          attachmentSize: uploadData.size,
        }),
      });

      const msgData = await msgRes.json();
      setMessages(prev => [...prev, msgData.message]);
      loadConversations();
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('Image upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getLanguageName = (code: string): string => {
    const key = `admin.chat.lang_${code}`;
    const result = t(key);
    return result === key ? code.toUpperCase() : result;
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('admin.chat.justNow');
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return t('admin.chat.daysAgo', { count: diffDays });
  };

  // Stats
  const activeChats = conversations.filter(c => c.status === 'ACTIVE').length;
  const waitingChats = conversations.filter(c => c.status === 'WAITING_ADMIN').length;
  const unreadCount = conversations.reduce((sum, c) => sum + (c._count?.messages || 0), 0);

  // ─── Ribbon action handlers ────────────────────────────────
  const handleRibbonNewMessage = useCallback(() => {
    // Focus the input field if a conversation is selected, otherwise prompt to select one
    if (!selectedConversation) {
      toast.info(t('admin.chat.selectConversation') || 'Select a conversation first');
      return;
    }
    const input = document.querySelector<HTMLInputElement>('input[type="text"]');
    if (input) input.focus();
  }, [selectedConversation, t]);

  const handleRibbonCloseConversation = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.chat.selectConversation') || 'Select a conversation first');
      return;
    }
    try {
      const res = await fetch(`/api/chat/settings`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ conversationId: selectedConversation.id, status: 'CLOSED' }),
      });
      if (res.ok) {
        toast.success(t('admin.chat.conversationClosed') || 'Conversation closed');
        setSelectedConversation(null);
        loadConversations();
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [selectedConversation, t, loadConversations]);

  const handleRibbonTransfer = useCallback(() => {
    if (!selectedConversation) {
      toast.info(t('admin.chat.selectConversation') || 'Select a conversation first');
      return;
    }
    toast.info(t('admin.chat.transferNotAvailable') || 'Transfer requires multiple agents. Configure additional agents in settings.');
  }, [selectedConversation, t]);

  const handleRibbonMarkResolved = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.chat.selectConversation') || 'Select a conversation first');
      return;
    }
    try {
      const res = await fetch(`/api/chat/settings`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ conversationId: selectedConversation.id, status: 'RESOLVED' }),
      });
      if (res.ok) {
        toast.success(t('admin.chat.conversationResolved') || 'Conversation marked as resolved');
        loadConversations();
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [selectedConversation, t, loadConversations]);

  const handleRibbonArchive = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.chat.selectConversation') || 'Select a conversation first');
      return;
    }
    try {
      const res = await fetch(`/api/chat/settings`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ conversationId: selectedConversation.id, status: 'ARCHIVED' }),
      });
      if (res.ok) {
        toast.success(t('admin.chat.conversationArchived') || 'Conversation archived');
        setSelectedConversation(null);
        loadConversations();
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [selectedConversation, t, loadConversations]);

  const handleRibbonExportHistory = useCallback(() => {
    if (!selectedConversation || messages.length === 0) {
      toast.info(t('admin.chat.noMessagesToExport') || 'No messages to export');
      return;
    }
    const BOM = '\uFEFF';
    const headers = ['Date', 'Sender', 'Language', 'Message'];
    const rows = messages.map(m => [
      new Date(m.createdAt).toLocaleString(locale),
      m.sender,
      m.language || '',
      m.content.replace(/"/g, '""'),
    ]);
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${v}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${selectedConversation.visitorId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported') || 'Exported successfully');
  }, [selectedConversation, messages, locale, t]);

  useRibbonAction('newMessage', handleRibbonNewMessage);
  useRibbonAction('closeConversation', handleRibbonCloseConversation);
  useRibbonAction('transfer', handleRibbonTransfer);
  useRibbonAction('markResolved', handleRibbonMarkResolved);
  useRibbonAction('archive', handleRibbonArchive);
  useRibbonAction('exportHistory', handleRibbonExportHistory);

  return (
    <>
      <PageHeader
        title={t('admin.chat.title')}
        subtitle={t('admin.chat.subtitle')}
        actions={
          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex gap-2 text-sm">
              <StatusBadge variant="success" dot>
                {t('admin.chat.activeCount', { count: activeChats })}
              </StatusBadge>
              {waitingChats > 0 && (
                <StatusBadge variant="warning" dot className="animate-pulse">
                  {t('admin.chat.waitingCount', { count: waitingChats })}
                </StatusBadge>
              )}
              {unreadCount > 0 && (
                <StatusBadge variant="error" dot>
                  {t('admin.chat.unreadCount', { count: unreadCount })}
                </StatusBadge>
              )}
            </div>

            {/* Online Toggle */}
            <Button
              variant={settings?.isAdminOnline ? 'primary' : 'secondary'}
              onClick={toggleOnlineStatus}
              className={settings?.isAdminOnline ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' : ''}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${settings?.isAdminOnline ? 'bg-white' : 'bg-slate-400'}`} />
              {settings?.isAdminOnline ? t('admin.chat.online') : t('admin.chat.offline')}
            </Button>
          </div>
        }
      />

      <div className="flex gap-6 h-[calc(100vh-220px)]">
        {/* Conversations List */}
        <div className="w-80 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-semibold text-slate-900">{t('admin.chat.conversations')}</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title={t('admin.chat.noConversations')}
                description={t('admin.chat.noConversationsDesc')}
              />
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full p-4 text-start border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-sky-50 border-s-4 border-s-sky-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${conv.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="font-medium text-slate-900 truncate">
                          {conv.visitorName || conv.visitorEmail || `${t('admin.chat.visitor')} ${conv.visitorId.slice(0, 8)}`}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 truncate mt-1">
                        {conv.messages?.[0]?.content?.slice(0, 50) || t('admin.chat.newConversation')}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Globe className="w-3 h-3" />
                          {conv.visitorLanguage.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">
                          {formatTimeAgo(conv.lastMessageAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ms-2 flex-shrink-0">
                      {conv.status === 'WAITING_ADMIN' && (
                        <span className="p-1 bg-yellow-50 text-yellow-600 rounded-full">
                          <AlertTriangle className="w-3.5 h-3.5" />
                        </span>
                      )}
                      {(conv._count?.messages || 0) > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded-full">
                          {conv._count?.messages}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          {!selectedConversation ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={ArrowLeftRight}
                title={t('admin.chat.selectConversation')}
                description={t('admin.chat.selectConversationDesc')}
              />
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {selectedConversation.visitorName || selectedConversation.visitorEmail || t('admin.chat.visitor')}
                    </h3>
                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />
                        {getLanguageName(selectedConversation.visitorLanguage)}
                      </span>
                      {selectedConversation.visitorEmail && (
                        <span className="inline-flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5" />
                          {selectedConversation.visitorEmail}
                        </span>
                      )}
                      {selectedConversation.currentPage && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {selectedConversation.currentPage}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge
                    variant={selectedConversation.isOnline ? 'success' : 'neutral'}
                    dot
                  >
                    {selectedConversation.isOnline ? t('admin.chat.online') : t('admin.chat.offline')}
                  </StatusBadge>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                        message.sender === 'ADMIN'
                          ? 'bg-sky-500 text-white rounded-br-md'
                          : message.sender === 'BOT'
                          ? 'bg-purple-100 text-purple-900 rounded-bl-md border border-purple-200'
                          : 'bg-white text-slate-800 rounded-bl-md shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center gap-1 text-xs font-medium opacity-70">
                          {message.sender === 'VISITOR' ? (
                            <><User className="w-3 h-3" /> {t('admin.chat.visitor')}</>
                          ) : message.sender === 'BOT' ? (
                            <><Bot className="w-3 h-3" /> {t('admin.chat.bot')}</>
                          ) : (
                            <><UserCog className="w-3 h-3" /> {t('admin.chat.you')}</>
                          )}
                        </span>
                        {message.sender === 'VISITOR' && message.language && (
                          <span className="text-xs opacity-50">[{message.language.toUpperCase()}]</span>
                        )}
                      </div>

                      {/* Message content: image or text */}
                      {message.type === 'IMAGE' && message.attachmentUrl ? (
                        <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer">
                          <img
                            src={message.attachmentUrl}
                            alt={message.attachmentName || 'Image'}
                            className="max-w-[240px] max-h-[240px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}

                      {/* Message original si different */}
                      {message.contentOriginal && message.contentOriginal !== message.content && (
                        <details className="mt-2">
                          <summary className="text-xs opacity-50 cursor-pointer">
                            {t('admin.chat.viewOriginal')}
                          </summary>
                          <p className="text-xs opacity-70 mt-1 italic">{message.contentOriginal}</p>
                        </details>
                      )}

                      <p className="text-xs mt-2 opacity-50">
                        {new Date(message.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-200 bg-white">
                <div className="flex items-center gap-2">
                  {/* Image upload button */}
                  <label className="p-2 hover:bg-slate-100 rounded-full cursor-pointer transition-colors flex-shrink-0" title="Upload image">
                    <ImageIcon className="w-5 h-5 text-slate-500" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isLoading || isUploading}
                    />
                  </label>

                  {/* Emoji picker */}
                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                      title={t('common.emoji') || 'Emoji'}
                    >
                      <Smile className="w-5 h-5 text-slate-500" />
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-10 left-0 bg-white border border-slate-200 rounded-lg shadow-xl p-2 w-64 z-50">
                        <div className="grid grid-cols-8 gap-1">
                          {commonEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => insertEmoji(emoji)}
                              className="w-7 h-7 flex items-center justify-center text-lg hover:bg-slate-100 rounded transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t('admin.chat.replyPlaceholder', { language: getLanguageName(selectedConversation.visitorLanguage) })}
                    className="flex-1 !h-11 !rounded-xl"
                    disabled={isLoading || isUploading}
                  />
                  <Button
                    variant="primary"
                    size="lg"
                    icon={isUploading ? undefined : Send}
                    onClick={sendMessage}
                    disabled={!inputValue.trim() && !isUploading}
                    loading={isLoading || isUploading}
                    className="!rounded-xl !px-6"
                  >
                    {t('admin.chat.send')}
                  </Button>
                </div>
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-2">
                  <Lightbulb className="w-3.5 h-3.5" />
                  {t('admin.chat.autoTranslateHint')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
