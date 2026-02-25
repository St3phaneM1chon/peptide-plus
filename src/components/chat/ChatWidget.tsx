'use client';

/**
 * Widget Chat Client - BioCycle Peptides
 * Bulle de chat en bas à droite de l'écran
 *
 * IMP-032: Chat widget floats on all pages (except /admin), with open/close animation,
 *          unread badge, emoji picker, image upload support
 * IMP-045: Max character length enforcement on chat input (5000 chars)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/client';

interface Message {
  id: string;
  content: string;
  contentOriginal?: string;
  sender: 'VISITOR' | 'ADMIN' | 'BOT';
  senderName?: string;
  createdAt: string;
  isFromBot: boolean;
  type?: 'TEXT' | 'IMAGE' | 'FILE';
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
}

interface ChatSettings {
  isAdminOnline: boolean;
  chatbotEnabled: boolean;
  widgetColor: string;
  widgetPosition: string;
}

export default function ChatWidget() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // F-009 FIX: Use fully random UUID for visitorId instead of timestamp-based format
  // to prevent brute-force enumeration of conversation ownership.
  // Old format (visitor_{timestamp}_{8chars}) was partially predictable.
  useEffect(() => {
    const stored = localStorage.getItem('biocycle_chat_visitor_id');
    if (stored) {
      setVisitorId(stored);
    } else {
      // F-009 FIX: Cryptographically random UUID - not guessable
      const newId = crypto.randomUUID();
      localStorage.setItem('biocycle_chat_visitor_id', newId);
      setVisitorId(newId);
    }
  }, []);

  // Charger les settings
  useEffect(() => {
    fetch('/api/chat/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(console.error);
  }, []);

  // Initialiser la conversation quand on ouvre le chat
  const initConversation = useCallback(async () => {
    if (!visitorId) return;
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId,
          visitorLanguage: navigator.language?.split('-')[0] || 'en',
          currentPage: pathname,
          userAgent: navigator.userAgent,
        }),
      });
      
      const data = await res.json();
      if (data.conversation) {
        setConversationId(data.conversation.id);
        setMessages(data.conversation.messages || []);
      }
    } catch (error) {
      console.error('Failed to init conversation:', error);
    }
  }, [visitorId, pathname]);

  useEffect(() => {
    if (isOpen && !conversationId) {
      initConversation();
    }
  }, [isOpen, conversationId, initConversation]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset unread count when opening
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Polling for new messages (simple solution without WebSocket)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesLengthRef = useRef(messages.length);

  // Keep the ref in sync with messages length
  useEffect(() => {
    messagesLengthRef.current = messages.length;
  }, [messages.length]);

  useEffect(() => {
    // Clear any existing interval before setting a new one
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!isOpen || !conversationId) return;

    const pollMessages = async () => {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitorId }),
        });
        const data = await res.json();
        if (data.conversation?.messages) {
          const newMessages = data.conversation.messages;
          if (newMessages.length > messagesLengthRef.current) {
            setMessages(newMessages);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    pollingIntervalRef.current = setInterval(pollMessages, 5000); // Poll every 5 seconds

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isOpen, conversationId, visitorId]);

  const sendMessage = async () => {
    if (!inputValue.trim() || !conversationId || isLoading) return;

    const messageContent = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    // Optimistic update
    const tempMessage: Message = {
      id: `temp_${Date.now()}`,
      content: messageContent,
      sender: 'VISITOR',
      createdAt: new Date().toISOString(),
      isFromBot: false,
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          content: messageContent,
          sender: 'VISITOR',
          visitorId,
        }),
      });

      const data = await res.json();
      
      // Replace temp message with real one
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempMessage.id);
        const newMessages = [...filtered, data.message];
        if (data.botMessage) {
          newMessages.push(data.botMessage);
        }
        return newMessages;
      });
    } catch (error) {
      console.error('Send message error:', error);
      // Remove temp message on error and show error in chat
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempMessage.id);
        return [...filtered, {
          id: `error_${Date.now()}`,
          content: t('common.error'),
          sender: 'BOT' as const,
          createdAt: new Date().toISOString(),
          isFromBot: true,
        }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
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
    inputRef.current?.focus();
  };

  // Image upload handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    // Reset file input so the same file can be re-selected
    e.target.value = '';

    setIsUploading(true);

    // Optimistic update with a temporary image message
    const tempMessage: Message = {
      id: `temp_img_${Date.now()}`,
      content: '[Uploading image...]',
      sender: 'VISITOR',
      createdAt: new Date().toISOString(),
      isFromBot: false,
      type: 'IMAGE',
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      // Upload file first
      const formData = new FormData();
      formData.append('image', file);
      formData.append('conversationId', conversationId);

      const uploadRes = await fetch('/api/chat/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error || 'Upload failed');
      }

      // Send as image message
      const msgRes = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          content: uploadData.url,
          sender: 'VISITOR',
          visitorId,
          type: 'IMAGE',
          attachmentUrl: uploadData.url,
          attachmentName: uploadData.name,
          attachmentSize: uploadData.size,
        }),
      });

      const msgData = await msgRes.json();

      // Replace temp message with real one
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempMessage.id);
        const newMessages = [...filtered, msgData.message];
        if (msgData.botMessage) {
          newMessages.push(msgData.botMessage);
        }
        return newMessages;
      });
    } catch (err) {
      console.error('Image upload failed:', err);
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
    } finally {
      setIsUploading(false);
    }
  };

  // F-053 FIX: Align fallback with Prisma schema default (#f97316)
  const widgetColor = settings?.widgetColor || '#f97316';

  // Ne pas afficher sur les pages admin
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 end-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50"
        style={{ backgroundColor: widgetColor }}
        aria-label={t('chat.aria.openChat')}
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -end-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 end-6 w-[min(380px,calc(100vw-2rem))] bg-white rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col" style={{ height: '500px', maxHeight: 'calc(100vh - 140px)' }}>
          {/* Header */}
          <div className="px-4 py-3 text-white flex items-center gap-3" style={{ backgroundColor: widgetColor }}>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-xl">🔬</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold">BioCycle Peptides</h3>
              <p className="text-xs opacity-80">
                {settings?.isAdminOnline ? '🟢 Online' : '🤖 AI Assistant'}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'VISITOR' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.sender === 'VISITOR'
                      ? 'bg-orange-500 text-white rounded-br-md'
                      : message.sender === 'BOT'
                      ? 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                      : 'bg-blue-500 text-white rounded-bl-md'
                  }`}
                >
                  {message.sender !== 'VISITOR' && (
                    <p className="text-xs opacity-70 mb-1">
                      {message.senderName || (message.sender === 'BOT' ? '🤖 Assistant' : '👤 Support')}
                    </p>
                  )}
                  {message.type === 'IMAGE' && message.attachmentUrl ? (
                    <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={message.attachmentUrl}
                        alt={message.attachmentName || 'Image'}
                        className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </a>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <p className={`text-xs mt-1 ${message.sender === 'VISITOR' ? 'text-white/70' : 'text-gray-400'}`}>
                    {new Date(message.createdAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t bg-white">
            <div className="flex items-center gap-1">
              {/* Image upload button */}
              <label className="p-2 hover:bg-slate-100 rounded-full cursor-pointer transition-colors flex-shrink-0" title={t('chat.uploadImage')}>
                <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                  <circle cx="8.5" cy="8.5" r="1.5" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15l-5-5L5 21" />
                </svg>
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
                  title={t('chat.emoji')}
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth={2} />
                    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth={2} />
                  </svg>
                </button>
                {showEmojiPicker && (
                  <div className="absolute bottom-10 right-0 bg-white border border-slate-200 rounded-lg shadow-xl p-2 w-64 z-50">
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

              {/* IMP-045: Max length enforcement on chat input */}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.slice(0, 5000))}
                onKeyDown={handleKeyPress}
                placeholder={t('chat.placeholder.typeMessage')}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-orange-500 text-sm"
                disabled={isLoading || isUploading}
                maxLength={5000}
              />
              <button
                onClick={sendMessage}
                disabled={(!inputValue.trim() || isLoading) && !isUploading}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                style={{ backgroundColor: widgetColor }}
              >
                {isUploading ? (
                  <svg className="w-5 h-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center mt-2">
              Powered by BioCycle Peptides
            </p>
          </div>
        </div>
      )}
    </>
  );
}
