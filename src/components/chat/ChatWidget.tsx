/**
 * CHAT WIDGET
 * Widget de chat flottant pour les clients/customers
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslation } from '@/i18n/client';

interface Message {
  id: string;
  content: string;
  senderId: string;
  isSystem: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
  };
}

interface Conversation {
  id: string;
  subject: string | null;
  status: string;
  messages: Message[];
}

export function ChatWidget() {
  const { data: session, status } = useSession();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const isAuthenticated = status === 'authenticated';

  // Charger la conversation existante ou en créer une
  const loadConversation = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      // Récupérer les conversations existantes
      const res = await fetch('/api/chat/conversations?status=OPEN&limit=1');
      const data = await res.json();

      if (data.conversations?.length > 0) {
        const conv = data.conversations[0];
        setConversation(conv);
        
        // Charger les messages
        const messagesRes = await fetch(`/api/chat/conversations/${conv.id}/messages`);
        const messagesData = await messagesRes.json();
        setMessages(messagesData.messages || []);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Polling pour les nouveaux messages
  const pollMessages = useCallback(async () => {
    if (!conversation?.id || !isOpen) return;

    try {
      const lastMessageId = messages[messages.length - 1]?.id;
      const url = lastMessageId
        ? `/api/chat/conversations/${conversation.id}/messages?after=${lastMessageId}`
        : `/api/chat/conversations/${conversation.id}/messages`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.messages?.length > 0) {
        setMessages(prev => [...prev, ...data.messages]);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error polling messages:', error);
    }
  }, [conversation?.id, messages, isOpen]);

  // Setup polling
  useEffect(() => {
    if (isOpen && conversation?.id) {
      pollingRef.current = setInterval(pollMessages, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [isOpen, conversation?.id, pollMessages]);

  // Charger au premier ouverture
  useEffect(() => {
    if (isOpen && !conversation && isAuthenticated) {
      loadConversation();
    }
  }, [isOpen, conversation, isAuthenticated, loadConversation]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Envoyer un message
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      let convId = conversation?.id;

      // Créer une nouvelle conversation si nécessaire
      if (!convId) {
        const res = await fetch('/api/chat/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: 'Support',
            message: messageContent,
          }),
        });
        const data = await res.json();
        
        if (data.conversation) {
          setConversation(data.conversation);
          setMessages(data.conversation.messages || []);
          convId = data.conversation.id;
        }
      } else {
        // Envoyer dans la conversation existante
        const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: messageContent }),
        });
        const data = await res.json();
        
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent); // Restaurer le message
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Ne pas afficher pour les admins
  if (session?.user?.role === 'EMPLOYEE' || session?.user?.role === 'OWNER') {
    return null;
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setIsOpen(true)}
        className="chat-widget-button"
        aria-label="Ouvrir le chat"
        style={{
          display: isOpen ? 'none' : 'flex',
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 9999,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          width="28"
          height="28"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
          />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: '#f44336',
              color: 'white',
              fontSize: '12px',
              fontWeight: 600,
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Fenêtre de chat */}
      {isOpen && (
        <div
          className="chat-widget-window"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '380px',
            maxWidth: 'calc(100vw - 48px)',
            height: isMinimized ? 'auto' : '500px',
            maxHeight: 'calc(100vh - 100px)',
            backgroundColor: 'white',
            borderRadius: '16px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10000,
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--gray-500)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  backgroundColor: '#4CAF50',
                  borderRadius: '50%',
                }}
              />
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px' }}>
                  Support
                </h3>
                <p style={{ fontSize: '12px', opacity: 0.8 }}>
                  {t('footer.help')}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '4px',
                  opacity: 0.8,
                }}
                aria-label={isMinimized ? 'Agrandir' : 'Réduire'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  width="18"
                  height="18"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={isMinimized ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'}
                  />
                </svg>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '4px',
                  opacity: 0.8,
                }}
                aria-label="Fermer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  width="18"
                  height="18"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <>
              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: '#f9f9f9',
                }}
              >
                {!isAuthenticated ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ color: 'var(--gray-400)', marginBottom: '16px' }}>
                      {t('auth.signIn')} pour commencer une conversation
                    </p>
                    <a
                      href="/auth/signin"
                      className="btn btn-primary"
                      style={{ display: 'inline-block', padding: '10px 24px' }}
                    >
                      {t('auth.signIn')}
                    </a>
                  </div>
                ) : loading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ color: 'var(--gray-400)' }}>{t('common.loading')}</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p
                      style={{
                        fontSize: '32px',
                        marginBottom: '12px',
                      }}
                    >
                      👋
                    </p>
                    <p style={{ color: 'var(--gray-500)', fontWeight: 500, marginBottom: '8px' }}>
                      Comment pouvons-nous vous aider?
                    </p>
                    <p style={{ color: 'var(--gray-400)', fontSize: '13px' }}>
                      Envoyez-nous un message et nous vous répondrons rapidement.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.senderId === session?.user?.id}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              {isAuthenticated && (
                <form
                  onSubmit={sendMessage}
                  style={{
                    padding: '12px 16px',
                    borderTop: '1px solid var(--gray-200)',
                    backgroundColor: 'white',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Écrivez votre message..."
                      rows={1}
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        border: '1px solid var(--gray-200)',
                        borderRadius: '20px',
                        resize: 'none',
                        fontSize: '14px',
                        outline: 'none',
                        maxHeight: '100px',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || sending}
                      style={{
                        padding: '10px',
                        backgroundColor: 'var(--gray-500)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        cursor: newMessage.trim() && !sending ? 'pointer' : 'not-allowed',
                        opacity: newMessage.trim() && !sending ? 1 : 0.5,
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        width="18"
                        height="18"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                        />
                      </svg>
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  if (message.isSystem) {
    return (
      <div
        style={{
          textAlign: 'center',
          fontSize: '12px',
          color: 'var(--gray-400)',
          padding: '8px',
        }}
      >
        {message.content}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isOwn ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '10px 14px',
          borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          backgroundColor: isOwn ? 'var(--gray-500)' : 'white',
          color: isOwn ? 'white' : 'var(--gray-500)',
          fontSize: '14px',
          lineHeight: 1.4,
          boxShadow: isOwn ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
        }}
      >
        {!isOwn && message.sender?.name && (
          <p
            style={{
              fontSize: '11px',
              fontWeight: 600,
              marginBottom: '4px',
              color: 'var(--gray-400)',
            }}
          >
            {message.sender.name}
          </p>
        )}
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{message.content}</p>
        <p
          style={{
            fontSize: '10px',
            marginTop: '4px',
            opacity: 0.7,
            textAlign: 'right',
          }}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}

export default ChatWidget;
