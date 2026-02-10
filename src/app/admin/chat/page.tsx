'use client';

/**
 * Panel Admin Chat - BioCycle Peptides
 * Interface pour répondre aux messages clients
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

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

  // Sélectionner une conversation
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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">💬 Centre de Chat</h1>
            <p className="text-sm text-gray-500">Gérez vos conversations clients</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Stats */}
            <div className="flex gap-4 text-sm">
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full">
                {activeChats} actifs
              </span>
              {waitingChats > 0 && (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full animate-pulse">
                  {waitingChats} en attente
                </span>
              )}
              {unreadCount > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">
                  {unreadCount} non lus
                </span>
              )}
            </div>
            
            {/* Online Toggle */}
            <button
              onClick={toggleOnlineStatus}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                settings?.isAdminOnline
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              <span className={`w-3 h-3 rounded-full ${settings?.isAdminOnline ? 'bg-white' : 'bg-gray-400'}`}></span>
              {settings?.isAdminOnline ? 'En ligne' : 'Hors ligne'}
            </button>
            
            <Link href="/admin" className="text-gray-600 hover:text-gray-800">
              ← Retour admin
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6 h-[calc(100vh-180px)]">
          {/* Conversations List */}
          <div className="w-80 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">Conversations</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <span className="text-4xl mb-4 block">💬</span>
                  <p>Aucune conversation</p>
                </div>
              ) : (
                conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full p-4 text-left border-b hover:bg-gray-50 transition-colors ${
                      selectedConversation?.id === conv.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${conv.isOnline ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className="font-medium text-gray-900 truncate">
                            {conv.visitorName || conv.visitorEmail || `Visiteur ${conv.visitorId.slice(0, 8)}`}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {conv.messages?.[0]?.content?.slice(0, 50) || 'Nouvelle conversation'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-400">
                            🌐 {conv.visitorLanguage.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTimeAgo(conv.lastMessageAt)}
                          </span>
                        </div>
                      </div>
                      {conv.status === 'WAITING_ADMIN' && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                          ⚠️
                        </span>
                      )}
                      {(conv._count?.messages || 0) > 0 && (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                          {conv._count?.messages}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat Window */}
          <div className="flex-1 bg-white rounded-xl shadow-sm overflow-hidden flex flex-col">
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <span className="text-6xl mb-4 block">👈</span>
                  <p className="text-lg">Sélectionnez une conversation</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {selectedConversation.visitorName || selectedConversation.visitorEmail || `Visiteur`}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>🌐 {getLanguageName(selectedConversation.visitorLanguage)}</span>
                        {selectedConversation.visitorEmail && <span>📧 {selectedConversation.visitorEmail}</span>}
                        {selectedConversation.currentPage && <span>📍 {selectedConversation.currentPage}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        selectedConversation.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {selectedConversation.isOnline ? '🟢 En ligne' : '⚪ Hors ligne'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'ADMIN' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-3 ${
                          message.sender === 'ADMIN'
                            ? 'bg-blue-500 text-white rounded-br-md'
                            : message.sender === 'BOT'
                            ? 'bg-purple-100 text-purple-900 rounded-bl-md border border-purple-200'
                            : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium opacity-70">
                            {message.sender === 'VISITOR' ? '👤 Visiteur' : message.sender === 'BOT' ? '🤖 Bot' : '👨‍💼 Vous'}
                          </span>
                          {message.sender === 'VISITOR' && message.language && (
                            <span className="text-xs opacity-50">[{message.language.toUpperCase()}]</span>
                          )}
                        </div>
                        
                        {/* Message traduit (pour les messages visiteur) */}
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        
                        {/* Message original si différent */}
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
                <div className="p-4 border-t bg-white">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={`Répondre en français (sera traduit en ${getLanguageName(selectedConversation.visitorLanguage)})...`}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={isLoading}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!inputValue.trim() || isLoading}
                      className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? '...' : 'Envoyer'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-2 text-center">
                    💡 Votre message sera automatiquement traduit dans la langue du client
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
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

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}j`;
}

function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    en: 'Anglais',
    fr: 'Français',
    es: 'Espagnol',
    de: 'Allemand',
    it: 'Italien',
    pt: 'Portugais',
    zh: 'Chinois',
    ar: 'Arabe',
    ru: 'Russe',
    ja: 'Japonais',
    ko: 'Coréen',
  };
  return languages[code] || code.toUpperCase();
}
