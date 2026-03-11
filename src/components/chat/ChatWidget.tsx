'use client';

/**
 * ChatWidget - Floating chat bubble for BioCycle Peptides
 *
 * Features:
 * - Floating button (bottom-right) with MessageCircle icon
 * - Name/email collection before first message
 * - Sends messages to /api/public/chat
 * - Polls for new messages every 5 seconds
 * - Dismissible / minimizable chat window
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import {
  MessageCircle,
  X,
  Send,
  Minimize2,
  User,
  Mail,
  Loader2,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'admin' | 'bot';
  senderName?: string;
  createdAt: string;
}

type WidgetView = 'closed' | 'open' | 'minimized';

export default function ChatWidget() {
  const { t, locale } = useI18n();

  const [view, setView] = useState<WidgetView>('closed');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Pre-chat form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [hasIdentified, setHasIdentified] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageCountRef = useRef(0);

  // Restore identity from localStorage on mount
  useEffect(() => {
    const storedName = localStorage.getItem('biocycle_chat_name');
    const storedEmail = localStorage.getItem('biocycle_chat_email');
    const storedConvId = localStorage.getItem('biocycle_chat_conversation_id');

    if (storedName && storedEmail) {
      setName(storedName);
      setEmail(storedEmail);
      setHasIdentified(true);
    }
    if (storedConvId) {
      setConversationId(storedConvId);
    }
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (view === 'open') {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [view, hasIdentified]);

  // Clear unread count when chat is opened
  useEffect(() => {
    if (view === 'open') {
      setUnreadCount(0);
    }
  }, [view]);

  // Poll for new messages every 5 seconds when chat is open and we have a conversation
  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (view !== 'open' || !conversationId) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/public/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            conversationId,
          }),
        });

        if (!res.ok) return;

        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
          const incoming = data.messages as ChatMessage[];
          if (incoming.length > lastMessageCountRef.current) {
            setMessages(incoming);
            lastMessageCountRef.current = incoming.length;
          }
        }
      } catch {
        // Silently ignore polling errors to avoid toast spam
      }
    };

    pollingRef.current = setInterval(poll, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [view, conversationId, name, email]);

  // Fetch existing messages when conversation is restored from localStorage
  useEffect(() => {
    if (hasIdentified && conversationId && view === 'open' && messages.length === 0) {
      const fetchExisting = async () => {
        try {
          const res = await fetch('/api/public/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              email,
              conversationId,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.messages && Array.isArray(data.messages)) {
              setMessages(data.messages);
              lastMessageCountRef.current = data.messages.length;
            }
            if (data.conversationId) {
              setConversationId(data.conversationId);
              localStorage.setItem('biocycle_chat_conversation_id', data.conversationId);
            }
          }
        } catch {
          // Ignore - will get messages on next poll
        }
      };
      fetchExisting();
    }
  }, [hasIdentified, conversationId, view, messages.length, name, email]);

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      toast.error(t('chat.errors.nameRequired') || 'Please enter your name');
      return;
    }

    if (!trimmedEmail) {
      toast.error(t('chat.errors.emailRequired') || 'Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error(t('chat.errors.emailInvalid') || 'Please enter a valid email address');
      return;
    }

    localStorage.setItem('biocycle_chat_name', trimmedName);
    localStorage.setItem('biocycle_chat_email', trimmedEmail);
    setName(trimmedName);
    setEmail(trimmedEmail);
    setHasIdentified(true);
  };

  const sendMessage = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || isLoading || !hasIdentified) return;

    setInputValue('');
    setIsLoading(true);

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      content,
      role: 'user',
      senderName: name,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const res = await fetch('/api/public/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message: content,
          conversationId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const data = await res.json();

      // Store the conversation ID from the server response
      if (data.conversationId) {
        setConversationId(data.conversationId);
        localStorage.setItem('biocycle_chat_conversation_id', data.conversationId);
      }

      // Replace temp message with server response messages
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(data.messages);
        lastMessageCountRef.current = data.messages.length;
      } else if (data.message) {
        // Single message response - replace temp with real message
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempId);
          const serverMsg: ChatMessage = {
            id: data.message.id || `msg_${Date.now()}`,
            content: data.message.content || content,
            role: 'user',
            senderName: name,
            createdAt: data.message.createdAt || new Date().toISOString(),
          };
          const result = [...filtered, serverMsg];
          if (data.botMessage) {
            result.push({
              id: data.botMessage.id || `bot_${Date.now()}`,
              content: data.botMessage.content,
              role: 'bot',
              senderName: data.botMessage.senderName || 'Assistant',
              createdAt: data.botMessage.createdAt || new Date().toISOString(),
            });
          }
          lastMessageCountRef.current = result.length;
          return result;
        });
      }
    } catch (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const errMsg = error instanceof Error ? error.message : 'Failed to send message';
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, hasIdentified, name, email, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleChat = () => {
    setView((prev) => (prev === 'closed' || prev === 'minimized' ? 'open' : 'closed'));
  };

  const minimizeChat = () => {
    setView('minimized');
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const getRoleBubbleClasses = (role: ChatMessage['role']) => {
    switch (role) {
      case 'user':
        return 'bg-purple-600 text-white rounded-br-sm';
      case 'admin':
        return 'bg-blue-600 text-white rounded-bl-sm';
      case 'bot':
        return 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm';
      default:
        return 'bg-gray-100 text-gray-800 rounded-bl-sm';
    }
  };

  const getTimeClasses = (role: ChatMessage['role']) => {
    return role === 'user' || role === 'admin' ? 'text-white/70' : 'text-gray-400';
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 end-6 z-50 w-14 h-14 bg-purple-600 hover:bg-purple-700 text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
        aria-label={t('chat.aria.openChat') || 'Open chat'}
      >
        {view === 'open' ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -end-2 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Chat Window */}
      {view === 'open' && (
        <div className="fixed bottom-24 end-6 z-50 w-[min(380px,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ height: '500px', maxHeight: 'calc(100vh - 140px)' }}>
          {/* Header */}
          <div className="bg-purple-600 text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">
                {t('chat.header.title') || 'BioCycle Peptides'}
              </h3>
              <p className="text-xs text-purple-200 truncate">
                {t('chat.header.subtitle') || 'We typically reply within minutes'}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={minimizeChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                aria-label={t('chat.aria.minimize') || 'Minimize chat'}
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('closed')}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                aria-label={t('chat.aria.close') || 'Close chat'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!hasIdentified ? (
            /* Pre-chat: Name & Email form */
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-purple-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800 mb-1 text-center">
                {t('chat.prechat.title') || 'Welcome!'}
              </h4>
              <p className="text-sm text-gray-500 mb-6 text-center">
                {t('chat.prechat.subtitle') || 'Please introduce yourself to start chatting.'}
              </p>

              <form onSubmit={handleIdentify} className="w-full space-y-3">
                <div className="relative">
                  <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('chat.prechat.namePlaceholder') || 'Your name'}
                    className="w-full ps-10 pe-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    autoFocus
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('chat.prechat.emailPlaceholder') || 'Your email'}
                    className="w-full ps-10 pe-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  {t('chat.prechat.startButton') || 'Start Chat'}
                </button>
              </form>

              <p className="text-xs text-gray-400 mt-4 text-center">
                {t('chat.prechat.privacy') || 'Your information is kept private and secure.'}
              </p>
            </div>
          ) : (
            /* Chat messages area */
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center px-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                      <MessageCircle className="w-6 h-6 text-purple-600" />
                    </div>
                    <p className="text-sm text-gray-500">
                      {t('chat.empty.message') || 'Send a message to start the conversation!'}
                    </p>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${getRoleBubbleClasses(msg.role)}`}>
                      {msg.role !== 'user' && msg.senderName && (
                        <p className="text-xs opacity-70 mb-0.5 font-medium">
                          {msg.senderName}
                        </p>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${getTimeClasses(msg.role)}`}>
                        {formatTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value.slice(0, 5000))}
                    onKeyDown={handleKeyDown}
                    placeholder={t('chat.placeholder.typeMessage') || 'Type a message...'}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    disabled={isLoading}
                    maxLength={5000}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    className="w-10 h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label={t('chat.aria.send') || 'Send message'}
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">
                  Powered by BioCycle Peptides
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
