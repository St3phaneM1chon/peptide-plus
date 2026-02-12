'use client';

/**
 * Widget Chat Client - BioCycle Peptides
 * Bulle de chat en bas à droite de l'écran
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface Message {
  id: string;
  content: string;
  contentOriginal?: string;
  sender: 'VISITOR' | 'ADMIN' | 'BOT';
  senderName?: string;
  createdAt: string;
  isFromBot: boolean;
}

interface ChatSettings {
  isAdminOnline: boolean;
  chatbotEnabled: boolean;
  widgetColor: string;
  widgetPosition: string;
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Obtenir ou créer le visitorId
  useEffect(() => {
    const stored = localStorage.getItem('biocycle_chat_visitor_id');
    if (stored) {
      setVisitorId(stored);
    } else {
      const newId = `visitor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
  useEffect(() => {
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
          if (newMessages.length > messages.length) {
            setMessages(newMessages);
            if (!isOpen) {
              setUnreadCount(prev => prev + (newMessages.length - messages.length));
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    };

    const interval = setInterval(pollMessages, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [isOpen, conversationId, visitorId, messages.length]);

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
      // Remove temp message on error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
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

  const widgetColor = settings?.widgetColor || '#CC5500';

  // Ne pas afficher sur les pages admin
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 z-50"
        style={{ backgroundColor: widgetColor }}
        aria-label="Open chat"
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
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[380px] max-w-[calc(100vw-48px)] bg-white rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col" style={{ height: '500px', maxHeight: 'calc(100vh - 140px)' }}>
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
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className={`text-xs mt-1 ${message.sender === 'VISITOR' ? 'text-white/70' : 'text-gray-400'}`}>
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-orange-500 text-sm"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: widgetColor }}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
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
