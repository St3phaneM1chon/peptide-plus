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
} from 'lucide-react';
import {
  PageHeader,
  Button,
  StatusBadge,
  EmptyState,
  Input,
} from '@/components/admin';

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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Charger les settings
  useEffect(() => {
    fetch('/api/chat/settings')
      .then(res => res.json())
      .then(setSettings)
      .catch(console.error);
  }, []);

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?limit=100');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Load conversations error:', error);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId: conversations.find(c => c.id === conversationId)?.visitorId }),
      });
      const data = await res.json();
      if (data.conversation?.messages) {
        setMessages(data.conversation.messages);
      }
    } catch (error) {
      console.error('Load messages error:', error);
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
        headers: { 'Content-Type': 'application/json' },
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
      console.error('Send message error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle admin online status
  const toggleOnlineStatus = async () => {
    try {
      const res = await fetch('/api/chat/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdminOnline: !settings?.isAdminOnline }),
      });
      const data = await res.json();
      setSettings(data);
    } catch (error) {
      console.error('Toggle status error:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Stats
  const activeChats = conversations.filter(c => c.status === 'ACTIVE').length;
  const waitingChats = conversations.filter(c => c.status === 'WAITING_ADMIN').length;
  const unreadCount = conversations.reduce((sum, c) => sum + (c._count?.messages || 0), 0);

  return (
    <>
      <PageHeader
        title="Centre de Chat"
        subtitle="Gerez vos conversations clients"
        actions={
          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex gap-2 text-sm">
              <StatusBadge variant="success" dot>
                {activeChats} actifs
              </StatusBadge>
              {waitingChats > 0 && (
                <StatusBadge variant="warning" dot className="animate-pulse">
                  {waitingChats} en attente
                </StatusBadge>
              )}
              {unreadCount > 0 && (
                <StatusBadge variant="error" dot>
                  {unreadCount} non lus
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
              {settings?.isAdminOnline ? 'En ligne' : 'Hors ligne'}
            </Button>
          </div>
        }
      />

      <div className="flex gap-6 h-[calc(100vh-220px)]">
        {/* Conversations List */}
        <div className="w-80 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-semibold text-slate-900">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="Aucune conversation"
                description="Les nouvelles conversations apparaitront ici"
              />
            ) : (
              conversations.map(conv => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full p-4 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-sky-50 border-l-4 border-l-sky-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${conv.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        <span className="font-medium text-slate-900 truncate">
                          {conv.visitorName || conv.visitorEmail || `Visiteur ${conv.visitorId.slice(0, 8)}`}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 truncate mt-1">
                        {conv.messages?.[0]?.content?.slice(0, 50) || 'Nouvelle conversation'}
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
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
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
                title="Selectionnez une conversation"
                description="Choisissez une conversation dans la liste pour commencer"
              />
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {selectedConversation.visitorName || selectedConversation.visitorEmail || 'Visiteur'}
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
                    {selectedConversation.isOnline ? 'En ligne' : 'Hors ligne'}
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
                            <><User className="w-3 h-3" /> Visiteur</>
                          ) : message.sender === 'BOT' ? (
                            <><Bot className="w-3 h-3" /> Bot</>
                          ) : (
                            <><UserCog className="w-3 h-3" /> Vous</>
                          )}
                        </span>
                        {message.sender === 'VISITOR' && message.language && (
                          <span className="text-xs opacity-50">[{message.language.toUpperCase()}]</span>
                        )}
                      </div>

                      {/* Message traduit (pour les messages visiteur) */}
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {/* Message original si different */}
                      {message.contentOriginal && message.contentOriginal !== message.content && (
                        <details className="mt-2">
                          <summary className="text-xs opacity-50 cursor-pointer">
                            Voir l&apos;original
                          </summary>
                          <p className="text-xs opacity-70 mt-1 italic">{message.contentOriginal}</p>
                        </details>
                      )}

                      <p className="text-xs mt-2 opacity-50">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-slate-200 bg-white">
                <div className="flex gap-3">
                  <Input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={`Repondre en francais (sera traduit en ${getLanguageName(selectedConversation.visitorLanguage)})...`}
                    className="flex-1 !h-11 !rounded-xl"
                    disabled={isLoading}
                  />
                  <Button
                    variant="primary"
                    size="lg"
                    icon={Send}
                    onClick={sendMessage}
                    disabled={!inputValue.trim()}
                    loading={isLoading}
                    className="!rounded-xl !px-6"
                  >
                    Envoyer
                  </Button>
                </div>
                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400 mt-2">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Votre message sera automatiquement traduit dans la langue du client
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Helpers
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'A l\'instant';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}j`;
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'Anglais',
    fr: 'Francais',
    es: 'Espagnol',
    de: 'Allemand',
    it: 'Italien',
    pt: 'Portugais',
    zh: 'Chinois',
    ar: 'Arabe',
    ru: 'Russe',
    ja: 'Japonais',
    ko: 'Coreen',
  };
  return languages[code] || code.toUpperCase();
}
