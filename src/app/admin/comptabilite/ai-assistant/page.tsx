'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Send,
  Loader2,
  Trash2,
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  Wallet,
  PieChart,
  Users,
  AlertTriangle,
  Calculator,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { PageHeader, SectionCard, Button } from '@/components/admin';
import { useTranslations } from '@/hooks/useTranslations';
import { sectionThemes } from '@/lib/admin/section-themes';
import { addCSRFHeader } from '@/lib/csrf';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessageData {
  intent: string;
  answer: string;
  value?: number;
  currency?: string;
  period?: { start: string; end: string };
  table?: {
    headers: string[];
    rows: (string | number)[][];
  };
  chartData?: {
    type: 'bar' | 'line' | 'pie';
    labels: string[];
    values: number[];
    label: string;
  };
  metadata?: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  data?: ChatMessageData;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AIAssistantPage() {
  const { t } = useTranslations();
  const theme = sectionThemes.reports;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate session ID on mount
  useEffect(() => {
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  }, []);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // --------------------------------------------------
  // Send message
  // --------------------------------------------------
  const sendMessage = useCallback(async (text?: string) => {
    const messageText = (text ?? input).trim();
    if (!messageText || isLoading) return;

    setInput('');
    setError(null);

    // Optimistically add user message
    const userMessage: ChatMessage = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/accounting/ai-chat', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: messageText, sessionId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      const data = await res.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
      }

      // Replace optimistic user message and add assistant response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== userMessage.id);
        return [
          ...filtered,
          { ...userMessage, id: `user_${Date.now()}` },
          {
            id: data.message.id,
            role: 'assistant' as const,
            content: data.message.content,
            timestamp: data.message.timestamp,
            data: data.message.data,
          },
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, sessionId]);

  // --------------------------------------------------
  // Clear chat
  // --------------------------------------------------
  const handleClearChat = useCallback(async () => {
    try {
      await fetch('/api/accounting/ai-chat', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ sessionId, action: 'clear' }),
      });
    } catch {
      // Non-critical -- continue clearing locally
    }
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }, [sessionId]);

  // --------------------------------------------------
  // Handle keyboard
  // --------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  // --------------------------------------------------
  // Suggested questions
  // --------------------------------------------------
  const suggestedQuestions = [
    { icon: DollarSign, text: t('admin.aiAssistant.suggestedRevenue'), query: "What's my revenue this month?" },
    { icon: TrendingUp, text: t('admin.aiAssistant.suggestedProfit'), query: "What's my profit this month?" },
    { icon: Wallet, text: t('admin.aiAssistant.suggestedCash'), query: "What's my cash balance?" },
    { icon: AlertTriangle, text: t('admin.aiAssistant.suggestedOverdue'), query: 'Show me overdue invoices' },
    { icon: PieChart, text: t('admin.aiAssistant.suggestedExpenses'), query: "What are my top expenses this month?" },
    { icon: Calculator, text: t('admin.aiAssistant.suggestedBurnRate'), query: "What's my burn rate?" },
    { icon: Clock, text: t('admin.aiAssistant.suggestedRunway'), query: 'How many months of runway do I have?' },
    { icon: Users, text: t('admin.aiAssistant.suggestedCustomers'), query: 'Who are my top customers?' },
    { icon: BarChart3, text: t('admin.aiAssistant.suggestedKpi'), query: 'Show me my KPIs' },
    { icon: ArrowUpDown, text: t('admin.aiAssistant.suggestedComparison'), query: 'Compare this month vs last month' },
  ];

  // --------------------------------------------------
  // Quick action buttons
  // --------------------------------------------------
  const quickActions = [
    { label: t('admin.aiAssistant.quickRevenue'), query: "What's my revenue this month?" },
    { label: t('admin.aiAssistant.quickExpenses'), query: "What are my expenses this month?" },
    { label: t('admin.aiAssistant.quickCash'), query: "What's my cash balance?" },
    { label: t('admin.aiAssistant.quickOverdue'), query: 'Show overdue invoices' },
    { label: t('admin.aiAssistant.quickTax'), query: 'Tax summary this month' },
    { label: t('admin.aiAssistant.quickBudget'), query: 'Budget vs actual' },
  ];

  // --------------------------------------------------
  // Format timestamp
  // --------------------------------------------------
  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // --------------------------------------------------
  // Render data table
  // --------------------------------------------------
  const renderTable = (table: ChatMessageData['table']) => {
    if (!table || !table.rows.length) return null;

    return (
      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {table.headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-medium text-slate-600 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // --------------------------------------------------
  // Render chart data (simple visual bar chart)
  // --------------------------------------------------
  const renderChart = (chartData: ChatMessageData['chartData']) => {
    if (!chartData || !chartData.values.length) return null;

    const maxVal = Math.max(...chartData.values.map(Math.abs), 1);

    return (
      <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <p className="text-xs font-medium text-slate-500 mb-2">{chartData.label}</p>
        <div className="space-y-2">
          {chartData.labels.map((label, i) => {
            const value = chartData.values[i];
            const width = Math.abs(value) / maxVal * 100;
            const isNegative = value < 0;
            const color = isNegative ? 'bg-red-400' : chartData.type === 'pie'
              ? ['bg-violet-500', 'bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500', 'bg-orange-500', 'bg-purple-500', 'bg-cyan-500'][i % 10]
              : i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-amber-500' : 'bg-violet-500';

            return (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-28 truncate flex-shrink-0" title={label}>
                  {label}
                </span>
                <div className="flex-1 h-5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color} transition-all duration-500`}
                    style={{ width: `${Math.max(width, 2)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-slate-700 w-24 text-right flex-shrink-0">
                  {typeof value === 'number'
                    ? new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
                    : value}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[900px]">
      <PageHeader
        title={t('admin.aiAssistant.title')}
        subtitle={t('admin.aiAssistant.subtitle')}
        theme={theme}
        actions={
          messages.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClearChat}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('admin.aiAssistant.clearChat')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          <SectionCard className="flex-1 flex flex-col min-h-0" noPadding theme={theme}>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
                    <Bot className="w-8 h-8 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    {t('admin.aiAssistant.welcomeTitle')}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mb-6">
                    {t('admin.aiAssistant.welcomeDescription')}
                  </p>

                  {/* Suggested questions grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                    {suggestedQuestions.slice(0, 6).map((sq, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(sq.query)}
                        disabled={isLoading}
                        className="flex items-center gap-2 p-2.5 text-left text-sm bg-white rounded-lg border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all group"
                      >
                        <sq.icon className="w-4 h-4 text-slate-400 group-hover:text-violet-500 flex-shrink-0" />
                        <span className="text-slate-600 group-hover:text-slate-800 truncate">
                          {sq.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] ${
                          msg.role === 'user'
                            ? 'bg-violet-600 text-white rounded-2xl rounded-br-md px-4 py-2.5'
                            : 'bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3'
                        }`}
                      >
                        {/* Role indicator */}
                        <div className={`flex items-center gap-1.5 mb-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                          {msg.role === 'assistant' && (
                            <Bot className="w-3.5 h-3.5 text-violet-500" />
                          )}
                          <span className={`text-[10px] font-medium ${msg.role === 'user' ? 'text-violet-200' : 'text-slate-400'}`}>
                            {msg.role === 'user' ? t('admin.aiAssistant.you') : t('admin.aiAssistant.assistant')}
                            {' '}{formatTime(msg.timestamp)}
                          </span>
                        </div>

                        {/* Message content */}
                        <p className={`text-sm leading-relaxed ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                          {msg.content}
                        </p>

                        {/* Data visualization */}
                        {msg.data?.table && renderTable(msg.data.table)}
                        {msg.data?.chartData && renderChart(msg.data.chartData)}

                        {/* Intent badge */}
                        {msg.data?.intent && msg.data.intent !== 'unknown' && (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 font-medium">
                              {msg.data.intent.replace(/_/g, ' ')}
                            </span>
                            {msg.data.period && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                {msg.data.period.start} - {msg.data.period.end}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Loading indicator */}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Bot className="w-3.5 h-3.5 text-violet-500" />
                          <span className="text-[10px] font-medium text-slate-400">
                            {t('admin.aiAssistant.assistant')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                          <span className="text-sm text-slate-500">
                            {t('admin.aiAssistant.thinking')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error banner */}
            {error && (
              <div className="mx-4 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
              </div>
            )}

            {/* Quick actions strip */}
            {messages.length > 0 && (
              <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto">
                {quickActions.map((qa, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(qa.query)}
                    disabled={isLoading}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700 transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-50"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="p-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('admin.aiAssistant.placeholder')}
                    disabled={isLoading}
                    maxLength={1000}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none text-sm text-slate-700 placeholder-slate-400 transition-all disabled:opacity-50 disabled:bg-slate-50"
                  />
                  {input.length > 0 && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-300">
                      {input.length}/1000
                    </span>
                  )}
                </div>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 disabled:opacity-50 disabled:bg-slate-300 transition-all"
                  title={t('admin.aiAssistant.send')}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Sidebar - Suggested Questions */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <SectionCard title={t('admin.aiAssistant.suggestedTitle')} theme={theme}>
            <div className="space-y-1.5">
              {suggestedQuestions.map((sq, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(sq.query)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-2.5 p-2 text-left text-sm rounded-lg hover:bg-violet-50 transition-all group disabled:opacity-50"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-violet-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <sq.icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-violet-600" />
                  </div>
                  <span className="text-slate-600 group-hover:text-slate-800 text-xs leading-tight">
                    {sq.text}
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Capabilities */}
          <div className="mt-4">
            <SectionCard title={t('admin.aiAssistant.capabilitiesTitle')} theme={theme}>
              <div className="space-y-2 text-xs text-slate-500">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>{t('admin.aiAssistant.capabilityRevenue')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>{t('admin.aiAssistant.capabilityInvoices')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>{t('admin.aiAssistant.capabilityKpi')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>{t('admin.aiAssistant.capabilityTax')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>{t('admin.aiAssistant.capabilityBudget')}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
                  <span>{t('admin.aiAssistant.capabilityBilingual')}</span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
