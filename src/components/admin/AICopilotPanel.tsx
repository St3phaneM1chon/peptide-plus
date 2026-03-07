'use client';

/**
 * AI Copilot Panel
 * Slide-out panel with context-aware AI assistant.
 * Accessible via Sparkles icon in admin topbar or Ctrl+J shortcut.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/i18n/client';
import {
  X,
  Sparkles,
  Send,
  User2,
  Bot,
  Loader2,
  FileText,
  Mail,
  BarChart3,
  Copy,
  Check,
  ChevronDown,
  Target,
  Search,
  ClipboardList,
  Sunrise,
  FileBarChart,
  Boxes,
  Receipt,
  Package,
  UserX,
  SearchCode,
} from 'lucide-react';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: string[];
  timestamp: Date;
}

interface AICopilotPanelProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Quick Actions
// ---------------------------------------------------------------------------

interface QuickAction {
  id: string;
  icon: typeof BarChart3;
  label: string;
  description: string;
  action: string;
  entityType?: string;
}

function useQuickActions(t: (k: string) => string, pathname: string): QuickAction[] {
  const base: QuickAction[] = [
    {
      id: 'morning_briefing',
      icon: Sunrise,
      label: t('admin.copilot.briefingAction') || 'Morning Briefing',
      description: t('admin.copilot.briefingDesc') || 'Your daily priorities & action plan',
      action: 'morning_briefing',
    },
    {
      id: 'dashboard_insights',
      icon: BarChart3,
      label: t('admin.copilot.insightsAction') || 'Dashboard Insights',
      description: t('admin.copilot.insightsDesc') || 'Analyze trends and anomalies',
      action: 'dashboard_insights',
    },
    {
      id: 'generate_report',
      icon: FileBarChart,
      label: t('admin.copilot.reportAction') || 'Generate Report',
      description: t('admin.copilot.reportDesc') || 'Create a report from your data',
      action: 'generate_report',
    },
    {
      id: 'draft_email',
      icon: Mail,
      label: t('admin.copilot.emailAction') || 'Draft Email',
      description: t('admin.copilot.emailDesc') || 'Generate a contextual email',
      action: 'draft_email',
    },
    {
      id: 'summarize',
      icon: FileText,
      label: t('admin.copilot.summarizeAction') || 'Summarize',
      description: t('admin.copilot.summarizeDesc') || 'Summarize current page data',
      action: 'chat',
    },
  ];

  // Context-aware actions based on current page
  const contextual: QuickAction[] = [];

  if (pathname.includes('/crm/') || pathname.includes('/pipeline')) {
    contextual.push({
      id: 'next_best_action',
      icon: Target,
      label: t('admin.copilot.nbaAction') || 'Next Best Action',
      description: t('admin.copilot.nbaDesc') || 'AI-powered action recommendations',
      action: 'next_best_action',
      entityType: pathname.includes('/deals') ? 'deal' : 'lead',
    });
    contextual.push({
      id: 'summarize_notes',
      icon: ClipboardList,
      label: t('admin.copilot.notesAction') || 'Summarize Notes',
      description: t('admin.copilot.notesDesc') || 'Summarize CRM activities & notes',
      action: 'summarize_notes',
      entityType: pathname.includes('/deals') ? 'deal' : 'lead',
    });
  }

  if (pathname.includes('/produits') || pathname.includes('/articles') || pathname.includes('/blog')) {
    contextual.push({
      id: 'seo_suggestions',
      icon: Search,
      label: t('admin.copilot.seoAction') || 'SEO Suggestions',
      description: t('admin.copilot.seoDesc') || 'Optimize for search engines',
      action: 'seo_suggestions',
      entityType: pathname.includes('/articles') || pathname.includes('/blog') ? 'article' : 'product',
    });
    if (pathname.includes('/produits')) {
      contextual.push({
        id: 'generate_variants',
        icon: Boxes,
        label: t('admin.copilot.variantsAction') || 'Generate Variants',
        description: t('admin.copilot.variantsDesc') || 'AI-suggested product formats & dosages',
        action: 'generate_variants',
        entityType: 'product',
      });
    }
  }

  if (pathname.includes('/comptabilite') || pathname.includes('/accounting') || pathname.includes('/journal')) {
    contextual.push({
      id: 'extract_invoice',
      icon: Receipt,
      label: t('admin.copilot.invoiceAction') || 'Extract Invoice',
      description: t('admin.copilot.invoiceDesc') || 'Extract data from invoice text',
      action: 'extract_invoice',
    });
  }

  if (pathname.includes('/inventaire') || pathname.includes('/stock') || pathname.includes('/produits')) {
    contextual.push({
      id: 'predict_stock',
      icon: Package,
      label: t('admin.copilot.stockAction') || 'Stock Prediction',
      description: t('admin.copilot.stockDesc') || 'Predict stockouts & reorder needs',
      action: 'predict_stock',
    });
  }

  if (pathname.includes('/crm/') || pathname.includes('/dashboard')) {
    contextual.push({
      id: 'churn_alerts',
      icon: UserX,
      label: t('admin.copilot.churnAction') || 'Churn Alerts',
      description: t('admin.copilot.churnDesc') || 'Identify at-risk customers',
      action: 'churn_alerts',
    });
  }

  // NLI search always available
  base.unshift({
    id: 'nli_search',
    icon: SearchCode,
    label: t('admin.copilot.nliAction') || 'Smart Search',
    description: t('admin.copilot.nliDesc') || 'Search anything in natural language',
    action: 'nli_search',
  });

  return [...contextual, ...base];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AICopilotPanel({ open, onClose }: AICopilotPanelProps) {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const quickActions = useQuickActions(t, pathname);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const sendMessage = useCallback(async (
    action: string,
    message?: string,
    entityId?: string,
    entityType?: string,
  ) => {
    // Actions that need user input — set a prompt placeholder instead
    if (action === 'generate_report' && !message) {
      setInput('');
      setMessages(prev => [...prev, {
        id: `prompt-${Date.now()}`,
        role: 'assistant',
        content: t('admin.copilot.reportPrompt') || 'What kind of report would you like? For example:\n- "Sales report for this month"\n- "Top products this week"\n- "Customer acquisition trends"\n- "Revenue comparison vs last month"',
        timestamp: new Date(),
      }]);
      // Set the action context for next submit
      setPendingAction('generate_report');
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }
    if (action === 'draft_email' && !message) {
      setMessages(prev => [...prev, {
        id: `prompt-${Date.now()}`,
        role: 'assistant',
        content: t('admin.copilot.emailPrompt') || 'What email would you like to draft? Describe the purpose and recipient.',
        timestamp: new Date(),
      }]);
      setPendingAction('draft_email');
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }
    if (action === 'extract_invoice' && !message) {
      setMessages(prev => [...prev, {
        id: `prompt-${Date.now()}`,
        role: 'assistant',
        content: t('admin.copilot.invoicePrompt') || 'Paste the invoice text below. I\'ll extract supplier info, line items, totals, and suggest journal entries.',
        timestamp: new Date(),
      }]);
      setPendingAction('extract_invoice');
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }
    if (action === 'nli_search' && !message) {
      setMessages(prev => [...prev, {
        id: `prompt-${Date.now()}`,
        role: 'assistant',
        content: t('admin.copilot.nliPrompt') || 'What are you looking for? Try:\n- "Orders over $500 this month"\n- "Customer John Smith"\n- "BPC-157 stock level"\n- "Pending orders from Quebec"',
        timestamp: new Date(),
      }]);
      setPendingAction('nli_search');
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }

    const userMsg = message || '';
    if (action === 'chat' && !userMsg.trim()) return;

    // Add user message
    if (userMsg) {
      setMessages(prev => [...prev, {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMsg,
        timestamp: new Date(),
      }]);
    }

    setLoading(true);
    setInput('');

    try {
      const response = await fetch('/api/admin/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          context: {
            page: pathname,
            entityId,
            entityType,
          },
          message: userMsg || `Provide ${action.replace(/_/g, ' ')} for the current context`,
          locale,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Request failed');
      }

      const { data } = await response.json();

      setMessages(prev => [...prev, {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.content,
        suggestions: data.suggestions,
        timestamp: new Date(),
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ ${error instanceof Error ? error.message : 'An error occurred'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [pathname, locale]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const action = pendingAction || 'chat';
    setPendingAction(null);
    sendMessage(action, input.trim());
  }, [input, loading, sendMessage, pendingAction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  const copyToClipboard = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success(t('common.copied') || 'Copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [t]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
  }, []);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:bg-transparent lg:backdrop-blur-none lg:pointer-events-none"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className="fixed top-0 end-0 bottom-0 w-full sm:w-[420px] bg-white dark:bg-slate-900 border-s border-slate-200 dark:border-slate-700 shadow-2xl z-[61] flex flex-col animate-slide-in-right"
        role="complementary"
        aria-label={t('admin.copilot.title') || 'AI Copilot'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-teal-50 to-white dark:from-teal-950/50 dark:to-slate-900">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t('admin.copilot.title') || 'AI Copilot'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.copilot.subtitle') || 'Your intelligent assistant'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors text-xs"
                title={t('admin.copilot.clearChat') || 'Clear chat'}
              >
                {t('admin.copilot.clear') || 'Clear'}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              aria-label={t('common.close') || 'Close'}
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-4">
              {/* Welcome */}
              <div className="text-center py-6">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-teal-100 to-teal-50 flex items-center justify-center mb-3">
                  <Sparkles className="w-7 h-7 text-teal-600" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {t('admin.copilot.welcome') || 'How can I help?'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t('admin.copilot.welcomeDesc') || 'Ask anything about your business data or use a quick action below.'}
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider px-1">
                  {t('admin.copilot.quickActions') || 'Quick Actions'}
                </p>
                {quickActions.map((qa) => (
                  <button
                    key={qa.id}
                    onClick={() => sendMessage(qa.action)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-teal-200 dark:hover:border-teal-800 hover:bg-teal-50/50 dark:hover:bg-teal-950/30 transition-all text-start group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-teal-100 dark:group-hover:bg-teal-900 flex items-center justify-center transition-colors flex-shrink-0">
                      <qa.icon className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{qa.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{qa.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Context indicator */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('admin.copilot.currentPage') || 'Current page'}: <span className="font-medium text-slate-700 dark:text-slate-300">{pathname}</span>
                </p>
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-teal-600 text-white rounded-br-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                      }`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                          <FormattedContent content={msg.content} />
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Actions for assistant messages */}
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-1 mt-1 ms-1">
                        <button
                          onClick={() => copyToClipboard(msg.id, msg.content)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                          title={t('common.copy') || 'Copy'}
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="text-[10px] text-slate-400">
                          {msg.timestamp.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}

                    {/* Suggestion chips */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {msg.suggestions.map((sug, i) => (
                          <button
                            key={i}
                            onClick={() => sendMessage('chat', sug)}
                            disabled={loading}
                            className="text-xs px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-teal-300 dark:hover:border-teal-700 hover:text-teal-700 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 transition-colors"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User2 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('admin.copilot.thinking') || 'Thinking...'}
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900"
        >
          <div className="flex items-end gap-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:border-teal-300 dark:focus-within:border-teal-700 focus-within:ring-1 focus-within:ring-teal-100 dark:focus-within:ring-teal-900 px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('admin.copilot.placeholder') || 'Ask anything...'}
              className="flex-1 bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none outline-none min-h-[36px] max-h-[120px]"
              rows={1}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5 text-center">
            {t('admin.copilot.disclaimer') || 'AI-generated content. Verify important information.'}
          </p>
        </form>
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Formatted Content (Markdown-like rendering)
// ---------------------------------------------------------------------------

function FormattedContent({ content }: { content: string }) {
  // Simple markdown-like rendering
  const lines = content.split('\n');

  return (
    <>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) return <br key={i} />;

        // Headers
        if (trimmed.startsWith('### ')) return <h4 key={i} className="font-semibold text-slate-900 mt-2 mb-1">{formatInline(trimmed.slice(4))}</h4>;
        if (trimmed.startsWith('## ')) return <h3 key={i} className="font-semibold text-slate-900 mt-3 mb-1">{formatInline(trimmed.slice(3))}</h3>;
        if (trimmed.startsWith('# ')) return <h2 key={i} className="font-bold text-slate-900 mt-3 mb-1">{formatInline(trimmed.slice(2))}</h2>;

        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-1.5 mt-0.5">
              <span className="text-slate-400 mt-0.5 flex-shrink-0">•</span>
              <span>{formatInline(trimmed.slice(2))}</span>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-1.5 mt-0.5">
              <span className="text-slate-500 font-medium flex-shrink-0">{numMatch[1]}.</span>
              <span>{formatInline(trimmed.slice(numMatch[0].length))}</span>
            </div>
          );
        }

        return <p key={i} className="mt-1">{formatInline(trimmed)}</p>;
      })}
    </>
  );
}

function formatInline(text: string): React.ReactNode {
  // Bold **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}
