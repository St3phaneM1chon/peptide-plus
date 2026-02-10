/**
 * CHAT DASHBOARD CLIENT
 * Interface de gestion des conversations
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n/client';

interface Stats {
  open: number;
  pending: number;
  resolved: number;
  total: number;
  unread: number;
}

interface Agent {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  _count: { assignedChats: number };
}

interface QuickReply {
  id: string;
  title: string;
  content: string;
  category: string | null;
}

interface Conversation {
  id: string;
  subject: string | null;
  status: string;
  priority: number;
  unreadCount: number;
  lastMessageAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
  assignedTo?: { id: string; name: string | null } | null;
  messages?: Array<{
    id: string;
    content: string;
    createdAt: string;
    senderId: string;
  }>;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  type: string;
  isSystem: boolean;
  createdAt: string;
  sender?: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
  };
}

interface ChatDashboardProps {
  initialStats: Stats;
  agents: Agent[];
  quickReplies: QuickReply[];
  currentUserId: string;
}

export function ChatDashboard({ initialStats, agents, quickReplies, currentUserId: _currentUserId }: ChatDashboardProps) {
  const { t } = useTranslation();
  const [stats] = useState(initialStats);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [filter, setFilter] = useState<string>('OPEN');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/conversations?status=${filter}&limit=50`);
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  }, [filter]);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}`);
      const data = await res.json();
      
      if (data.conversation) {
        setSelectedConversation(data.conversation);
        setMessages(data.conversation.messages || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Polling pour les nouveaux messages
  const pollMessages = useCallback(async () => {
    if (!selectedConversation?.id) return;

    try {
      const lastMessageId = messages[messages.length - 1]?.id;
      if (!lastMessageId) return;

      const res = await fetch(
        `/api/chat/conversations/${selectedConversation.id}/messages?after=${lastMessageId}`
      );
      const data = await res.json();

      if (data.messages?.length > 0) {
        setMessages(prev => [...prev, ...data.messages]);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error polling:', error);
    }
  }, [selectedConversation?.id, messages]);

  // Setup polling
  useEffect(() => {
    if (selectedConversation?.id) {
      pollingRef.current = setInterval(pollMessages, 3000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [selectedConversation?.id, pollMessages]);

  // Charger les conversations au changement de filtre
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Envoyer un message
  const sendMessage = async (content?: string) => {
    const messageContent = content || newMessage.trim();
    if (!messageContent || !selectedConversation || sending) return;

    setNewMessage('');
    setSending(true);

    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      });
      const data = await res.json();

      if (data.message) {
        setMessages(prev => [...prev, data.message]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      if (!content) setNewMessage(messageContent);
    } finally {
      setSending(false);
    }
  };

  // Changer le statut
  const updateConversation = async (updates: Record<string, any>) => {
    if (!selectedConversation) return;

    try {
      const res = await fetch(`/api/chat/conversations/${selectedConversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();

      if (data.conversation) {
        setSelectedConversation(prev => ({ ...prev!, ...data.conversation }));
        loadConversations();
      }
    } catch (error) {
      console.error('Error updating conversation:', error);
    }
  };

  const statusColors: Record<string, string> = {
    OPEN: '#4CAF50',
    PENDING: '#FF9800',
    RESOLVED: '#2196F3',
    CLOSED: '#9E9E9E',
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', backgroundColor: 'var(--gray-100)' }}>
      {/* Sidebar - Liste des conversations */}
      <div
        style={{
          width: '350px',
          backgroundColor: 'white',
          borderRight: '1px solid var(--gray-200)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Stats */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--gray-200)' }}>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
            <StatBadge label="Ouvertes" value={stats.open} color="#4CAF50" />
            <StatBadge label="En attente" value={stats.pending} color="#FF9800" />
            <StatBadge label="Non lus" value={stats.unread} color="#f44336" />
          </div>
        </div>

        {/* Filtres */}
        <div style={{ padding: '12px', borderBottom: '1px solid var(--gray-200)' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '12px',
                  fontWeight: filter === status ? 600 : 400,
                  backgroundColor: filter === status ? 'var(--gray-100)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  color: 'var(--gray-500)',
                }}
              >
                {status === 'OPEN' ? 'Ouvertes' : status === 'PENDING' ? 'En attente' : status === 'RESOLVED' ? 'Résolues' : 'Fermées'}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--gray-400)', fontSize: '14px' }}>
                Aucune conversation
              </p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadMessages(conv.id)}
                style={{
                  width: '100%',
                  padding: '16px',
                  borderBottom: '1px solid var(--gray-100)',
                  backgroundColor: selectedConversation?.id === conv.id ? 'var(--gray-50)' : 'white',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 500, fontSize: '14px', color: 'var(--gray-500)' }}>
                      {conv.user.name || conv.user.email.split('@')[0]}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          backgroundColor: '#f44336',
                          borderRadius: '50%',
                        }}
                      />
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>
                    {formatTime(conv.lastMessageAt)}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--gray-400)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {conv.messages?.[0]?.content || conv.subject || 'Nouvelle conversation'}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Zone de chat */}
      {selectedConversation ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header conversation */}
          <div
            style={{
              padding: '16px 24px',
              backgroundColor: 'white',
              borderBottom: '1px solid var(--gray-200)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gray-500)' }}>
                  {selectedConversation.user.name || selectedConversation.user.email}
                </h2>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: `${statusColors[selectedConversation.status]}15`,
                    color: statusColors[selectedConversation.status],
                  }}
                >
                  {selectedConversation.status}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                {selectedConversation.user.email}
              </p>
            </div>
            
            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={selectedConversation.status}
                onChange={(e) => updateConversation({ status: e.target.value })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gray-200)',
                  fontSize: '13px',
                }}
              >
                <option value="OPEN">Ouverte</option>
                <option value="PENDING">En attente</option>
                <option value="RESOLVED">Résolue</option>
                <option value="CLOSED">Fermée</option>
              </select>
              
              <select
                value={selectedConversation.assignedTo?.id || ''}
                onChange={(e) => updateConversation({ assignedToId: e.target.value || null })}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gray-200)',
                  fontSize: '13px',
                }}
              >
                <option value="">Non assigné</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name || agent.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ color: 'var(--gray-400)' }}>{t('common.loading')}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <AdminMessageBubble
                  key={msg.id}
                  message={msg}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick replies */}
          {quickReplies.length > 0 && (
            <div
              style={{
                padding: '8px 24px',
                borderTop: '1px solid var(--gray-200)',
                backgroundColor: 'white',
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
              }}
            >
              {quickReplies.map((qr) => (
                <button
                  key={qr.id}
                  onClick={() => sendMessage(qr.content)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    backgroundColor: 'var(--gray-100)',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    color: 'var(--gray-500)',
                  }}
                >
                  {qr.title}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--gray-200)',
              backgroundColor: 'white',
            }}
          >
            <div style={{ display: 'flex', gap: '12px' }}>
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Écrire une réponse..."
                rows={2}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  border: '1px solid var(--gray-200)',
                  borderRadius: '8px',
                  resize: 'none',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="btn btn-primary"
                style={{
                  padding: '12px 24px',
                  alignSelf: 'flex-end',
                  opacity: newMessage.trim() && !sending ? 1 : 0.5,
                }}
              >
                Envoyer
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>💬</p>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
            Sélectionnez une conversation
          </p>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '20px', fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{label}</p>
    </div>
  );
}

function AdminMessageBubble({ message }: { message: Message }) {
  if (message.isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--gray-400)', padding: '8px' }}>
        {message.content}
      </div>
    );
  }

  const isStaff = message.sender?.role === 'EMPLOYEE' || message.sender?.role === 'OWNER';

  return (
    <div style={{ display: 'flex', justifyContent: isStaff ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '70%',
          padding: '12px 16px',
          borderRadius: isStaff ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          backgroundColor: isStaff ? 'var(--gray-500)' : 'white',
          color: isStaff ? 'white' : 'var(--gray-500)',
          boxShadow: isStaff ? 'none' : '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        {!isStaff && message.sender?.name && (
          <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-400)' }}>
            {message.sender.name}
          </p>
        )}
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{message.content}</p>
        <p style={{ fontSize: '10px', marginTop: '6px', opacity: 0.7, textAlign: 'right' }}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}j`;
  return date.toLocaleDateString();
}

export default ChatDashboard;
