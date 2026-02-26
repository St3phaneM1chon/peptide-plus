'use client';

import { useState, useEffect, useCallback, useRef, Component, type ReactNode, type ErrorInfo } from 'react';
import {
  Mail, SendHorizontal, CheckCircle2, XCircle, BarChart3,
  LayoutTemplate, Save, Eye, Inbox, Megaphone, GitBranch,
  PieChart, Settings, Users, AlertTriangle, RefreshCw,
  Upload, Plus, Calendar, FlaskConical,
  UserPlus, Copy, Shield, CalendarDays, Paintbrush,
  Activity, TrendingDown,
} from 'lucide-react';
import {
  PageHeader, StatCard, StatusBadge, Button, Modal,
  EmptyState, DataTable, FormField, Input, Textarea,
  type Column,
  type BadgeVariant,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';
import InboxView from './inbox/InboxView';
import ConversationThread from './inbox/ConversationThread';
import FlowList from './flows/FlowList';
import dynamic from 'next/dynamic';
import CampaignList from './campaigns/CampaignList';
import CampaignEditor from './campaigns/CampaignEditor';
import SegmentBuilder from './segments/SegmentBuilder';
import TemplateBuilder from './TemplateBuilder';
import CampaignCalendar from './CampaignCalendar';
import EmailComposer from './compose/EmailComposer';
import { toast } from 'sonner';
import { useRibbonAction } from '@/hooks/useRibbonAction';
import { addCSRFHeader } from '@/lib/csrf';

// ---- Error Boundary ----

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class EmailErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[EmailAdmin] Rendering error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h3>
          <p className="text-sm text-red-600 mb-4 max-w-md">
            {this.props.fallbackDescription || 'An unexpected error occurred while rendering this section. Please try refreshing the page.'}
          </p>
          {this.state.error && (
            <pre className="text-xs text-red-500 bg-red-100 rounded p-2 mb-4 max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const FlowEditor = dynamic(() => import('./flows/FlowEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] flex items-center justify-center" role="status" aria-label="Loading">
      <div className="animate-spin h-8 w-8 border-2 border-sky-700 border-t-transparent rounded-full" />
      <span className="sr-only">Loading...</span>
    </div>
  ),
});

const AnalyticsDashboard = dynamic(() => import('./analytics/AnalyticsDashboard'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] flex items-center justify-center" role="status" aria-label="Loading">
      <div className="animate-spin h-8 w-8 border-2 border-sky-700 border-t-transparent rounded-full" />
      <span className="sr-only">Loading...</span>
    </div>
  ),
});

// ---- Types ----

interface EmailTemplate {
  id: string;
  name: string;
  type: string;
  subject: string;
  content: string;
  isActive: boolean;
  lastUpdated: string;
}

interface EmailLog {
  id: string;
  templateType: string;
  to: string;
  subject: string;
  status: 'SENT' | 'FAILED' | 'PENDING';
  sentAt: string;
}

type TabKey = 'inbox' | 'templates' | 'campaigns' | 'flows' | 'analytics' | 'segments' | 'settings';

const emailStatusVariantMap: Record<string, BadgeVariant> = {
  SENT: 'success',
  FAILED: 'error',
  PENDING: 'warning',
};

const templateVariants: Record<string, BadgeVariant> = {
  ORDER_CONFIRMATION: 'success',
  ORDER_SHIPPED: 'info',
  ORDER_DELIVERED: 'primary',
  WELCOME: 'warning',
  PASSWORD_RESET: 'neutral',
  BIRTHDAY: 'error',
  ABANDONED_CART: 'warning',
  REVIEW_REQUEST: 'warning',
};

// ---- Main Page ----

export default function EmailsPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<TabKey>('inbox');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  // Inbox state
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  // Flow state
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [creatingFlow, setCreatingFlow] = useState(false);

  // Campaign state
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);

  // Inbox notification count
  const [inboxCount, setInboxCount] = useState(0);

  // Email settings state
  const [emailSettings, setEmailSettings] = useState<Record<string, string>>({});
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Modal states for implemented features
  const [showAbTestModal, setShowAbTestModal] = useState(false);
  const [abTestSubjectA, setAbTestSubjectA] = useState('');
  const [abTestSubjectB, setAbTestSubjectB] = useState('');
  const [abTestSplitPct, setAbTestSplitPct] = useState('50');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactLocale, setNewContactLocale] = useState('en');
  const [newContactSource, setNewContactSource] = useState('manual');
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateSubject, setNewTemplateSubject] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analytics period state (lifted from AnalyticsDashboard for ribbon integration)
  const [analyticsPeriod, setAnalyticsPeriod] = useState('30d');

  // Email composer state
  const [showComposer, setShowComposer] = useState(false);
  const [composerReplyTo, setComposerReplyTo] = useState<{ to: string; subject: string; body: string } | null>(null);

  // Template builder & campaign calendar toggles
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [showCampaignCalendar, setShowCampaignCalendar] = useState(false);

  // Email auth status (loaded from settings or defaults to unknown)
  const emailAuthStatus = {
    spf: emailSettings['auth.spf'] || 'unknown',
    dkim: emailSettings['auth.dkim'] || 'unknown',
    dmarc: emailSettings['auth.dmarc'] || 'unknown',
    bimi: emailSettings['auth.bimi'] || 'unknown',
  };

  useEffect(() => {
    fetchData();
    fetchInboxCount();
  }, []);

  // Load email settings when settings tab is activated
  useEffect(() => {
    if (activeTab === 'settings' && !settingsLoaded) {
      fetch('/api/admin/emails/settings')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.settings) {
            setEmailSettings(data.settings);
            setSettingsLoaded(true);
          }
        })
        .catch(() => {});
    }
  }, [activeTab, settingsLoaded]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [templatesRes, logsRes] = await Promise.all([
        fetch('/api/admin/emails'),
        fetch('/api/admin/emails/logs'),
      ]);

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        const rawTemplates = templatesData.templates || [];
        setTemplates(
          rawTemplates.map((t: Record<string, unknown>) => ({
            id: t.id as string,
            name: t.name as string,
            type: (t.name as string || 'WELCOME').toUpperCase().replace(/\s+/g, '_'),
            subject: t.subject as string,
            content: t.htmlContent as string || '',
            isActive: t.isActive as boolean,
            lastUpdated: t.updatedAt as string || t.createdAt as string,
          }))
        );
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        const rawLogs = logsData.logs || [];
        setLogs(
          rawLogs.map((l: Record<string, unknown>) => ({
            id: l.id as string,
            templateType: l.templateId as string || 'UNKNOWN',
            to: l.to as string,
            subject: l.subject as string,
            status: ((l.status as string) || 'PENDING').toUpperCase() as EmailLog['status'],
            sentAt: l.sentAt as string,
          }))
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(t('common.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const fetchInboxCount = async () => {
    try {
      const res = await fetch('/api/admin/emails/inbox?limit=1');
      if (res.ok) {
        const data = await res.json();
        setInboxCount((data.counts?.NEW || 0) + (data.counts?.OPEN || 0));
      }
    } catch { toast.error(t('common.errorOccurred')); }
  };

  const toggleTemplate = async (id: string) => {
    const template = templates.find(t => t.id === id);
    if (!template) return;
    const newActive = !template.isActive;
    // Optimistic update
    setTemplates(templates.map(t => t.id === id ? { ...t, isActive: newActive } : t));
    try {
      const res = await fetch(`/api/admin/emails/${id}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isActive: newActive }),
      });
      if (!res.ok) {
        toast.error(t('common.errorOccurred'));
        setTemplates(templates.map(t => t.id === id ? { ...t, isActive: !newActive } : t));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
      setTemplates(templates.map(t => t.id === id ? { ...t, isActive: !newActive } : t));
    }
  };

  const sendTestEmail = async () => {
    try {
      const res = await fetch('/api/admin/emails/test', { method: 'POST' });
      if (res.ok) {
        toast.success(t('admin.emailConfig.testSent') || 'Test email sent');
      } else {
        const data = await res.json();
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      const subjectInput = document.querySelector<HTMLInputElement>('[data-template-subject]');
      const contentInput = document.querySelector<HTMLTextAreaElement>('[data-template-content]');
      const res = await fetch(`/api/admin/emails/${editingTemplate.id}`, {
        method: 'PUT',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          subject: subjectInput?.value || editingTemplate.subject,
          htmlContent: contentInput?.value || editingTemplate.content,
        }),
      });
      if (res.ok) {
        toast.success(t('common.saved') || 'Saved');
        setEditingTemplate(null);
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  };

  // ---- Helper: CSV download utility ----
  const downloadCsv = useCallback((filename: string, headers: string[], rows: string[][]) => {
    const BOM = '\uFEFF';
    const csv = BOM + [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ---- Helper: Export email logs as CSV ----
  const exportEmailLogs = useCallback(() => {
    if (logs.length === 0) {
      toast.info(t('admin.emailConfig.noEmailsSent') || 'No emails sent');
      return;
    }
    const headers = ['Type', 'Recipient', 'Subject', 'Status', 'Date'];
    const rows = logs.map(l => [
      l.templateType,
      l.to,
      l.subject,
      l.status,
      new Date(l.sentAt).toLocaleString(locale),
    ]);
    downloadCsv(`email-logs-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success(t('common.exported') || 'Exported successfully');
  }, [logs, locale, t, downloadCsv]);

  // ---- Computed stats (needed by exportAnalyticsReport + UI) ----
  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'SENT').length,
    failed: logs.filter(l => l.status === 'FAILED').length,
    activeTemplates: templates.filter(tp => tp.isActive).length,
  };

  // ---- Helper: Export analytics report as CSV ----
  const exportAnalyticsReport = useCallback(() => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Emails', String(stats.total)],
      ['Sent', String(stats.sent)],
      ['Failed', String(stats.failed)],
      ['Active Templates', String(stats.activeTemplates)],
      ['Success Rate', `${((stats.sent / (stats.sent + stats.failed)) * 100 || 0).toFixed(1)}%`],
      ['Report Date', new Date().toLocaleDateString(locale)],
      ['Period', analyticsPeriod],
    ];
    downloadCsv(`email-analytics-${analyticsPeriod}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    toast.success(t('common.exported') || 'Exported successfully');
  }, [stats, locale, analyticsPeriod, t, downloadCsv]);

  // ---- Helper: Export contacts/segments as CSV ----
  const exportContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/newsletter/subscribers');
      if (!res.ok) {
        toast.error(t('common.errorOccurred'));
        return;
      }
      const data = await res.json();
      const subscribers = data.subscribers || [];
      if (subscribers.length === 0) {
        toast.info(t('admin.newsletter.emptySubscribers') || 'No subscribers');
        return;
      }
      const headers = ['Email', 'Locale', 'Source', 'Status', 'Subscribed At'];
      const rows = subscribers.map((s: { email: string; locale: string; source: string; status: string; subscribedAt: string }) => [
        s.email, s.locale, s.source, s.status, new Date(s.subscribedAt).toLocaleDateString(locale),
      ]);
      downloadCsv(`contacts-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
      toast.success(t('common.exported') || 'Exported successfully');
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [locale, t, downloadCsv]);

  // ---- Helper: Import CSV contacts ----
  const handleImportSubmit = useCallback(async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        toast.error(t('admin.emailConfig.importNoData') || 'No data found in CSV');
        setImporting(false);
        return;
      }
      // Parse CSV: expects at least an Email column
      const headerLine = lines[0];
      const headers = headerLine.split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
      const emailIdx = headers.findIndex(h => h === 'email' || h === 'e-mail' || h === 'courriel');
      if (emailIdx === -1) {
        toast.error(t('admin.emailConfig.importNoEmailColumn') || 'CSV must contain an Email column');
        setImporting(false);
        return;
      }
      const localeIdx = headers.findIndex(h => h === 'locale' || h === 'language' || h === 'langue');
      const sourceIdx = headers.findIndex(h => h === 'source');

      const contacts = lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
        return {
          email: cols[emailIdx] || '',
          locale: localeIdx >= 0 ? cols[localeIdx] || 'en' : 'en',
          source: sourceIdx >= 0 ? cols[sourceIdx] || 'import' : 'import',
        };
      }).filter(c => c.email && c.email.includes('@'));

      if (contacts.length === 0) {
        toast.error(t('admin.emailConfig.importNoValidEmails') || 'No valid email addresses found');
        setImporting(false);
        return;
      }

      const res = await fetch('/api/admin/newsletter/subscribers/import', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ contacts }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(
          (t('admin.emailConfig.importSuccess') || 'Imported {count} contacts')
            .replace('{count}', String(data.imported || contacts.length))
        );
        setShowImportModal(false);
        setImportFile(null);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    } finally {
      setImporting(false);
    }
  }, [importFile, t]);

  // ---- Helper: Add single contact ----
  const handleAddContactSubmit = useCallback(async () => {
    if (!newContactEmail || !newContactEmail.includes('@')) {
      toast.error(t('admin.emailConfig.invalidEmail') || 'Please enter a valid email address');
      return;
    }
    try {
      const res = await fetch('/api/admin/newsletter/subscribers', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          email: newContactEmail,
          locale: newContactLocale,
          source: newContactSource,
        }),
      });
      if (res.ok) {
        toast.success(t('admin.emailConfig.contactAdded') || 'Contact added');
        setShowAddContactModal(false);
        setNewContactEmail('');
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [newContactEmail, newContactLocale, newContactSource, t]);

  // ---- Helper: Clean bounced contacts ----
  const handleCleanBouncesAction = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/newsletter/subscribers/clean-bounces', {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(
          (t('admin.emailConfig.bouncesCleanedCount') || 'Removed {count} bounced contacts')
            .replace('{count}', String(data.removed || 0))
        );
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [t]);

  // ---- Helper: Create new template ----
  const handleNewTemplateSubmit = useCallback(async () => {
    if (!newTemplateName.trim()) {
      toast.error(t('admin.emailConfig.templateNameRequired') || 'Template name is required');
      return;
    }
    try {
      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: newTemplateName,
          subject: newTemplateSubject || newTemplateName,
          htmlContent: '<h1>Hello {{customerName}}</h1><p>Your content here...</p>',
        }),
      });
      if (res.ok) {
        toast.success(t('admin.emailConfig.templateCreated') || 'Template created');
        setShowNewTemplateModal(false);
        setNewTemplateName('');
        setNewTemplateSubject('');
        fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [newTemplateName, newTemplateSubject, t, fetchData]);

  // ---- Ribbon action handlers ----

  // Mail tab actions -- require active conversation context, navigate to inbox
  const handleNewMessage = useCallback(() => {
    setComposerReplyTo(null);
    setShowComposer(true);
  }, []);
  const handleDelete = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.emailConfig.selectConversationFirst') || 'Select a conversation first');
      return;
    }
    try {
      const res = await fetch(`/api/admin/emails/inbox/${selectedConversation}`, {
        method: 'DELETE',
        headers: addCSRFHeader(),
      });
      if (res.ok) {
        toast.success(t('admin.emailConfig.conversationDeleted') || 'Conversation deleted');
        setSelectedConversation(null);
        fetchInboxCount();
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [selectedConversation, t]);
  const handleArchive = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.emailConfig.selectConversationFirst') || 'Select a conversation first');
      return;
    }
    try {
      const res = await fetch(`/api/admin/emails/inbox/${selectedConversation}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      if (res.ok) {
        toast.success(t('admin.emailConfig.conversationArchived') || 'Conversation archived');
        setSelectedConversation(null);
        fetchInboxCount();
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [selectedConversation, t]);
  const handleReply = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.emailConfig.selectConversationFirst') || 'Select a conversation first');
      return;
    }
    // Fetch conversation data to pre-fill the composer
    try {
      const res = await fetch(`/api/admin/emails/inbox/${selectedConversation}`);
      if (res.ok) {
        const data = await res.json();
        const lastMsg = data.messages?.[data.messages.length - 1];
        setComposerReplyTo({
          to: lastMsg?.from || data.customerEmail || '',
          subject: lastMsg?.subject || data.subject || '',
          body: lastMsg?.htmlBody || lastMsg?.textBody || '',
        });
        setShowComposer(true);
      } else {
        // Fallback: open composer without pre-fill
        setComposerReplyTo(null);
        setShowComposer(true);
      }
    } catch {
      setComposerReplyTo(null);
      setShowComposer(true);
    }
  }, [selectedConversation, t]);
  const handleReplyAll = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.emailConfig.selectConversationFirst') || 'Select a conversation first');
      return;
    }
    // Fetch conversation data to pre-fill the composer (same as reply for now)
    try {
      const res = await fetch(`/api/admin/emails/inbox/${selectedConversation}`);
      if (res.ok) {
        const data = await res.json();
        const lastMsg = data.messages?.[data.messages.length - 1];
        setComposerReplyTo({
          to: lastMsg?.from || data.customerEmail || '',
          subject: lastMsg?.subject || data.subject || '',
          body: lastMsg?.htmlBody || lastMsg?.textBody || '',
        });
        setShowComposer(true);
      } else {
        setComposerReplyTo(null);
        setShowComposer(true);
      }
    } catch {
      setComposerReplyTo(null);
      setShowComposer(true);
    }
  }, [selectedConversation, t]);
  const handleForward = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.emailConfig.selectConversationFirst') || 'Select a conversation first');
      return;
    }
    // Fetch conversation data and open composer with forwarded content
    try {
      const res = await fetch(`/api/admin/emails/inbox/${selectedConversation}`);
      if (res.ok) {
        const data = await res.json();
        const lastMsg = data.messages?.[data.messages.length - 1];
        setComposerReplyTo({
          to: '', // Empty for forward - user fills in the recipient
          subject: `Fwd: ${lastMsg?.subject || data.subject || ''}`,
          body: lastMsg?.htmlBody || lastMsg?.textBody || '',
        });
        setShowComposer(true);
      } else {
        setComposerReplyTo(null);
        setShowComposer(true);
      }
    } catch {
      setComposerReplyTo(null);
      setShowComposer(true);
    }
  }, [selectedConversation, t]);
  const handleFlag = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.emailConfig.selectConversationFirst') || 'Select a conversation first');
      return;
    }
    try {
      const res = await fetch(`/api/admin/emails/inbox/${selectedConversation}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isFlagged: true }),
      });
      if (res.ok) {
        toast.success(t('admin.emailConfig.conversationFlagged') || 'Conversation flagged');
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [selectedConversation, t]);
  const handleMarkRead = useCallback(async () => {
    if (!selectedConversation) {
      toast.info(t('admin.emailConfig.selectConversationFirst') || 'Select a conversation first');
      return;
    }
    try {
      const res = await fetch(`/api/admin/emails/inbox/${selectedConversation}`, {
        method: 'PATCH',
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: 'READ' }),
      });
      if (res.ok) {
        toast.success(t('admin.emailConfig.markedAsRead') || 'Marked as read');
        fetchInboxCount();
      } else {
        toast.error(t('common.errorOccurred'));
      }
    } catch {
      toast.error(t('common.errorOccurred'));
    }
  }, [selectedConversation, t]);
  const handleMoveTo = useCallback(() => {
    if (!selectedConversation) {
      toast.info(t('admin.emailConfig.selectConversationFirst') || 'Select a conversation first');
      return;
    }
    toast.info(t('admin.emailConfig.moveToFolder') || 'Folders not configured. Use archive or flag to organize conversations.');
  }, [selectedConversation, t]);

  // Templates tab actions
  const handleNewTemplate = useCallback(() => {
    setNewTemplateName('');
    setNewTemplateSubject('');
    setShowNewTemplateModal(true);
  }, []);
  const handleDuplicate = useCallback(() => {
    if (!editingTemplate && templates.length > 0) {
      // Duplicate the first template as a starting point
      const tmpl = templates[0];
      setNewTemplateName(`${tmpl.name} (${t('admin.emailConfig.copy') || 'Copy'})`);
      setNewTemplateSubject(tmpl.subject);
      setShowNewTemplateModal(true);
    } else if (editingTemplate) {
      setNewTemplateName(`${editingTemplate.name} (${t('admin.emailConfig.copy') || 'Copy'})`);
      setNewTemplateSubject(editingTemplate.subject);
      setShowNewTemplateModal(true);
    } else {
      toast.info(t('admin.emailConfig.noTemplates') || 'No templates to duplicate');
    }
  }, [editingTemplate, templates, t]);
  const handlePreview = useCallback(() => {
    if (editingTemplate) {
      const contentInput = document.querySelector<HTMLTextAreaElement>('[data-template-content]');
      const rawHtml = contentInput?.value || editingTemplate.content;
      const wrapper = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title><style>body{margin:0;}</style></head><body>${rawHtml}</body></html>`;
      const blob = new Blob([wrapper], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      const preview = window.open('', '_blank');
      if (preview) {
        preview.document.write(`<!DOCTYPE html><html><head><title>Email Preview</title></head><body style="margin:0;">
          <iframe sandbox="allow-same-origin" style="width:100%;height:100vh;border:none;" src="${blobUrl}"></iframe>
        </body></html>`);
        preview.document.close();
      }
    } else if (templates.length > 0) {
      // Preview first template
      const tmpl = templates[0];
      const wrapper = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title><style>body{margin:0;}</style></head><body>${tmpl.content}</body></html>`;
      const blob = new Blob([wrapper], { type: 'text/html' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } else {
      toast.info(t('admin.emailConfig.noTemplates') || 'No templates to preview');
    }
  }, [editingTemplate, templates, t]);
  const handleTestSend = useCallback(() => { sendTestEmail(); }, []);
  const handleVariables = useCallback(() => {
    setShowVariablesModal(true);
  }, []);
  const handleExport = useCallback(() => {
    exportEmailLogs();
  }, [exportEmailLogs]);

  // Campaigns tab actions
  const handleNewEmailCampaign = useCallback(() => {
    // Navigate to campaigns tab and trigger the CampaignList's create action
    setActiveTab('campaigns');
    setEditingCampaignId(null);
  }, []);
  const handleSchedule = useCallback(() => {
    setScheduleDate('');
    setScheduleTime('09:00');
    setShowScheduleModal(true);
  }, []);
  const handleSendNow = useCallback(() => {
    // Switch to campaigns tab where user can use the Send button
    setActiveTab('campaigns');
    toast.info(t('admin.emailConfig.selectCampaignToSend') || 'Select a campaign and use the Send button');
  }, [t]);
  const handleAbTest = useCallback(() => {
    setAbTestSubjectA('');
    setAbTestSubjectB('');
    setAbTestSplitPct('50');
    setShowAbTestModal(true);
  }, []);
  const handleStats = useCallback(() => {
    // Switch to analytics tab
    setActiveTab('analytics');
  }, []);

  // Flows tab actions
  const handleNewFlow = useCallback(() => { setCreatingFlow(true); }, []);
  const handleActivate = useCallback(async () => {
    if (editingFlowId) {
      try {
        const res = await fetch(`/api/admin/emails/flows/${editingFlowId}`, {
          method: 'PATCH',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ isActive: true }),
        });
        if (res.ok) {
          toast.success(t('admin.emailConfig.flowActivated') || 'Workflow activated');
        } else {
          toast.error(t('common.errorOccurred'));
        }
      } catch {
        toast.error(t('common.errorOccurred'));
      }
    } else {
      toast.info(t('admin.emailConfig.selectFlowFirst') || 'Select a workflow first');
    }
  }, [editingFlowId, t]);
  const handleDeactivate = useCallback(async () => {
    if (editingFlowId) {
      try {
        const res = await fetch(`/api/admin/emails/flows/${editingFlowId}`, {
          method: 'PATCH',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ isActive: false }),
        });
        if (res.ok) {
          toast.success(t('admin.emailConfig.flowDeactivated') || 'Workflow deactivated');
        } else {
          toast.error(t('common.errorOccurred'));
        }
      } catch {
        toast.error(t('common.errorOccurred'));
      }
    } else {
      toast.info(t('admin.emailConfig.selectFlowFirst') || 'Select a workflow first');
    }
  }, [editingFlowId, t]);
  const handleTriggerStats = useCallback(() => {
    // Navigate to analytics tab filtered for flows
    setActiveTab('analytics');
  }, []);

  // Analytics tab actions
  const handleRefresh = useCallback(() => { fetchData(); }, []);
  const handle7d = useCallback(() => { setAnalyticsPeriod('7d'); }, []);
  const handle30d = useCallback(() => { setAnalyticsPeriod('30d'); }, []);
  const handle90d = useCallback(() => { setAnalyticsPeriod('90d'); }, []);
  const handle1y = useCallback(() => { setAnalyticsPeriod('1y'); }, []);
  const handleComparePeriods = useCallback(() => {
    // Toggle between different period views to simulate comparison
    const periods = ['7d', '30d', '90d', '1y'];
    const currentIdx = periods.indexOf(analyticsPeriod);
    const nextIdx = (currentIdx + 1) % periods.length;
    setAnalyticsPeriod(periods[nextIdx]);
    toast.info(
      (t('admin.emailConfig.switchedToPeriod') || 'Switched to {period} view')
        .replace('{period}', periods[nextIdx])
    );
  }, [analyticsPeriod, t]);
  const handleExportReport = useCallback(() => {
    exportAnalyticsReport();
  }, [exportAnalyticsReport]);
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Segments tab actions
  const handleNewSegment = useCallback(() => {
    // Segments are auto-generated via RFM, inform user
    toast.info(t('admin.emailConfig.segmentsAutoGenerated') || 'Segments are automatically generated based on customer behavior (RFM analysis)');
  }, [t]);
  const handleRefreshCount = useCallback(async () => {
    // Re-fetch segments to refresh counts
    setActiveTab('segments');
    toast.success(t('admin.emailConfig.countsRefreshed') || 'Segment counts refreshed');
  }, [t]);
  const handleExportContacts = useCallback(() => {
    exportContacts();
  }, [exportContacts]);

  // Mailing list tab actions
  const handleAddContact = useCallback(() => {
    setNewContactEmail('');
    setNewContactLocale('en');
    setNewContactSource('manual');
    setShowAddContactModal(true);
  }, []);
  const handleImportCsv = useCallback(() => {
    setImportFile(null);
    setShowImportModal(true);
  }, []);
  const handleCleanBounces = useCallback(() => {
    handleCleanBouncesAction();
  }, [handleCleanBouncesAction]);
  const handleUnsubscribe = useCallback(() => {
    toast.info(t('admin.emailConfig.useSubscriberDetailToUnsubscribe') || 'Use the subscriber detail view to unsubscribe individual contacts');
  }, [t]);

  // Register all ribbon actions
  useRibbonAction('newMessage', handleNewMessage);
  useRibbonAction('delete', handleDelete);
  useRibbonAction('archive', handleArchive);
  useRibbonAction('reply', handleReply);
  useRibbonAction('replyAll', handleReplyAll);
  useRibbonAction('forward', handleForward);
  useRibbonAction('flag', handleFlag);
  useRibbonAction('markRead', handleMarkRead);
  useRibbonAction('moveTo', handleMoveTo);
  useRibbonAction('newTemplate', handleNewTemplate);
  useRibbonAction('duplicate', handleDuplicate);
  useRibbonAction('preview', handlePreview);
  useRibbonAction('testSend', handleTestSend);
  useRibbonAction('variables', handleVariables);
  useRibbonAction('export', handleExport);
  useRibbonAction('newEmailCampaign', handleNewEmailCampaign);
  useRibbonAction('schedule', handleSchedule);
  useRibbonAction('sendNow', handleSendNow);
  useRibbonAction('abTest', handleAbTest);
  useRibbonAction('stats', handleStats);
  useRibbonAction('newFlow', handleNewFlow);
  useRibbonAction('activate', handleActivate);
  useRibbonAction('deactivate', handleDeactivate);
  useRibbonAction('triggerStats', handleTriggerStats);
  useRibbonAction('refresh', handleRefresh);
  useRibbonAction('7d', handle7d);
  useRibbonAction('30d', handle30d);
  useRibbonAction('90d', handle90d);
  useRibbonAction('1y', handle1y);
  useRibbonAction('comparePeriods', handleComparePeriods);
  useRibbonAction('exportReport', handleExportReport);
  useRibbonAction('print', handlePrint);
  useRibbonAction('newSegment', handleNewSegment);
  useRibbonAction('refreshCount', handleRefreshCount);
  useRibbonAction('exportContacts', handleExportContacts);
  useRibbonAction('addContact', handleAddContact);
  useRibbonAction('importCsv', handleImportCsv);
  useRibbonAction('cleanBounces', handleCleanBounces);
  useRibbonAction('unsubscribe', handleUnsubscribe);

  const tabs: { key: TabKey; label: string; icon: typeof Mail; badge?: number }[] = [
    { key: 'inbox', label: t('admin.emailConfig.tabInbox'), icon: Inbox, badge: inboxCount },
    { key: 'templates', label: t('admin.emailConfig.tabTemplates'), icon: LayoutTemplate },
    { key: 'campaigns', label: t('admin.emailConfig.tabCampaigns'), icon: Megaphone },
    { key: 'flows', label: t('admin.emailConfig.tabWorkflows'), icon: GitBranch },
    { key: 'analytics', label: t('admin.emailConfig.tabAnalytics'), icon: PieChart },
    { key: 'segments', label: t('admin.emailConfig.tabSegments'), icon: Users },
    { key: 'settings', label: t('admin.emailConfig.tabSettings'), icon: Settings },
  ];

  const getTemplateLabel = (type: string): string => t(`admin.emailConfig.templateTypes.${type}.label`);
  const getTemplateDescription = (type: string): string => t(`admin.emailConfig.templateTypes.${type}.description`);
  const getTemplateVariant = (type: string): BadgeVariant => templateVariants[type] || 'neutral';

  const logColumns: Column<EmailLog>[] = [
    {
      key: 'type',
      header: t('admin.emailConfig.type'),
      render: (log) => <StatusBadge variant={getTemplateVariant(log.templateType)}>{getTemplateLabel(log.templateType)}</StatusBadge>,
    },
    {
      key: 'to',
      header: t('admin.emailConfig.recipient'),
      render: (log) => <span className="text-slate-900">{log.to}</span>,
    },
    {
      key: 'subject',
      header: t('admin.emailConfig.subject'),
      render: (log) => <span className="text-slate-600 truncate max-w-xs block">{log.subject}</span>,
    },
    {
      key: 'status',
      header: t('admin.emailConfig.status'),
      align: 'center',
      render: (log) => {
        const variant = emailStatusVariantMap[log.status] || 'neutral';
        const statusLabel = t(`admin.emailConfig.emailStatus.${log.status.toLowerCase()}`);
        return <StatusBadge variant={variant}>{statusLabel}</StatusBadge>;
      },
    },
    {
      key: 'date',
      header: t('admin.emailConfig.date'),
      render: (log) => <span className="text-sm text-slate-500">{new Date(log.sentAt).toLocaleString(locale)}</span>,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-label="Loading">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  return (
    <EmailErrorBoundary
      fallbackTitle={t('admin.emailConfig.errorBoundaryTitle') || 'Email admin error'}
      fallbackDescription={t('admin.emailConfig.errorBoundaryDescription') || 'An unexpected error occurred in the email administration panel. Please try refreshing.'}
    >
    <div className="space-y-6">
      <PageHeader
        title={t('admin.emailConfig.hubTitle')}
        subtitle={t('admin.emailConfig.hubSubtitle')}
        actions={
          <div className="flex gap-2">
            <Button variant="primary" icon={Plus} onClick={handleNewMessage}>
              {t('admin.emailConfig.newMessage') || 'Nouveau message'}
            </Button>
            <Button variant="secondary" icon={SendHorizontal} onClick={sendTestEmail}>
              {t('admin.emailConfig.sendTest')}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t('admin.emailConfig.activeTemplates')}
          value={`${stats.activeTemplates}/${templates.length}`}
          icon={LayoutTemplate}
        />
        <StatCard
          label={t('admin.emailConfig.emailsSent24h')}
          value={stats.sent}
          icon={CheckCircle2}
          className="!border-green-200 !bg-green-50"
        />
        <StatCard
          label={t('admin.emailConfig.failures')}
          value={stats.failed}
          icon={XCircle}
          className="!border-red-200 !bg-red-50"
        />
        <StatCard
          label={t('admin.emailConfig.successRate')}
          value={`${((stats.sent / (stats.sent + stats.failed)) * 100 || 0).toFixed(1)}%`}
          icon={BarChart3}
        />
      </div>

      {/* Authentification email et statistiques de livraison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Authentification email (SPF/DKIM/DMARC) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-slate-700" />
            <h3 className="font-semibold text-slate-900">Authentification des emails</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'SPF', status: emailAuthStatus.spf },
              { name: 'DKIM', status: emailAuthStatus.dkim },
              { name: 'DMARC', status: emailAuthStatus.dmarc },
              { name: 'BIMI', status: emailAuthStatus.bimi },
            ].map(item => (
              <div key={item.name} className="flex flex-col items-center p-3 bg-slate-50 rounded-lg">
                <span className={`w-3 h-3 rounded-full mb-2 ${
                  item.status === 'configured' ? 'bg-green-500' :
                  item.status === 'warning' ? 'bg-yellow-500' :
                  'bg-red-400'
                }`} />
                <span className="text-sm font-medium text-slate-900">{item.name}</span>
                <span className={`text-[10px] font-medium mt-0.5 ${
                  item.status === 'configured' ? 'text-green-600' :
                  item.status === 'warning' ? 'text-yellow-600' :
                  'text-red-500'
                }`}>
                  {item.status === 'configured' ? 'Configuré' : item.status === 'warning' ? 'Attention' : 'Non configuré'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Taux de rebond et statistiques de livraison */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-slate-700" />
            <h3 className="font-semibold text-slate-900">Statistiques de livraison</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-700">
                {stats.total > 0 ? ((stats.sent / stats.total) * 100).toFixed(1) : '0.0'}%
              </p>
              <p className="text-xs text-green-600 mt-0.5">Taux de livraison</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <p className="text-xl font-bold text-red-700">
                  {stats.total > 0 ? ((stats.failed / stats.total) * 100).toFixed(1) : '0.0'}%
                </p>
              </div>
              <p className="text-xs text-red-600 mt-0.5">Taux de rebond</p>
            </div>
            <div className="bg-sky-50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-sky-700">{stats.total}</p>
              <p className="text-xs text-sky-600 mt-0.5">Total envoyés</p>
            </div>
          </div>
        </div>
      </div>

      {/* Boutons Constructeur de templates et Calendrier */}
      <div className="flex gap-3">
        <Button
          variant={showTemplateBuilder ? 'primary' : 'secondary'}
          icon={Paintbrush}
          onClick={() => { setShowTemplateBuilder(!showTemplateBuilder); setShowCampaignCalendar(false); }}
        >
          {showTemplateBuilder ? 'Fermer le constructeur' : 'Constructeur de templates'}
        </Button>
        <Button
          variant={showCampaignCalendar ? 'primary' : 'secondary'}
          icon={CalendarDays}
          onClick={() => { setShowCampaignCalendar(!showCampaignCalendar); setShowTemplateBuilder(false); }}
        >
          {showCampaignCalendar ? 'Fermer le calendrier' : 'Calendrier'}
        </Button>
      </div>

      {/* Constructeur de templates (conditionnel) */}
      {showTemplateBuilder && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <TemplateBuilder onSaved={() => {
            fetchData();
            setShowTemplateBuilder(false);
          }} />
        </div>
      )}

      {/* Calendrier de campagnes (conditionnel) */}
      {showCampaignCalendar && (
        <CampaignCalendar onCampaignClick={(id) => {
          setActiveTab('campaigns');
          setEditingCampaignId(id);
          setShowCampaignCalendar(false);
        }} />
      )}

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedConversation(null);
                  setEditingFlowId(null);
                  setCreatingFlow(false);
                }}
                className={`flex items-center gap-2 py-3 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-sky-500 text-sky-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.badge ? (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ==================== INBOX TAB ==================== */}
      {activeTab === 'inbox' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: 'calc(100vh - 380px)', minHeight: '500px' }}>
          {selectedConversation ? (
            <ConversationThread
              conversationId={selectedConversation}
              onBack={() => setSelectedConversation(null)}
            />
          ) : (
            <InboxView
              onSelectConversation={setSelectedConversation}
              selectedId={selectedConversation || undefined}
            />
          )}
        </div>
      )}

      {/* ==================== TEMPLATES TAB ==================== */}
      {activeTab === 'templates' && (
        <>
          {/* Logs sub-section */}
          <DataTable
            columns={logColumns}
            data={logs}
            keyExtractor={(log) => log.id}
            emptyTitle={t('admin.emailConfig.noEmailsSent')}
            emptyDescription={t('admin.emailConfig.noEmailsSentDescription')}
          />

          {/* Templates grid */}
          {templates.length === 0 ? (
            <EmptyState
              icon={Mail}
              title={t('admin.emailConfig.noTemplates')}
              description={t('admin.emailConfig.noTemplatesDescription')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => {
                const variant = getTemplateVariant(template.type);
                return (
                  <div
                    key={template.id}
                    className={`bg-white rounded-xl border border-slate-200 p-4 ${!template.isActive ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <StatusBadge variant={variant}>{getTemplateLabel(template.type)}</StatusBadge>
                        <h3 className="font-semibold text-slate-900 mt-1">{template.name}</h3>
                        <p className="text-xs text-slate-500">{getTemplateDescription(template.type)}</p>
                      </div>
                      <button
                        onClick={() => toggleTemplate(template.id)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${
                          template.isActive ? 'bg-green-500' : 'bg-slate-300'
                        }`}
                        aria-label={template.isActive ? 'Desactiver le modele' : 'Activer le modele'}
                        role="switch"
                        aria-checked={template.isActive}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          template.isActive ? 'right-0.5' : 'left-0.5'
                        }`} />
                      </button>
                    </div>
                    <p className="text-sm text-slate-600 mb-3 truncate">{t('admin.emailConfig.subject')}: {template.subject}</p>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">
                        {t('admin.emailConfig.updated')}: {new Date(template.lastUpdated).toLocaleDateString(locale)}
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setEditingTemplate(template)}>
                        {t('admin.emailConfig.edit')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ==================== CAMPAIGNS TAB ==================== */}
      {activeTab === 'campaigns' && (
        editingCampaignId ? (
          <CampaignEditor
            campaignId={editingCampaignId}
            onBack={() => setEditingCampaignId(null)}
          />
        ) : (
          <CampaignList onEditCampaign={(id) => setEditingCampaignId(id)} />
        )
      )}

      {/* ==================== FLOWS TAB ==================== */}
      {activeTab === 'flows' && (
        editingFlowId || creatingFlow ? (
          <FlowEditor
            flowId={editingFlowId || undefined}
            onBack={() => { setEditingFlowId(null); setCreatingFlow(false); }}
          />
        ) : (
          <FlowList
            onEditFlow={setEditingFlowId}
            onCreateFlow={() => setCreatingFlow(true)}
          />
        )
      )}

      {/* ==================== ANALYTICS TAB ==================== */}
      {activeTab === 'analytics' && <AnalyticsDashboard />}

      {/* ==================== SEGMENTS TAB ==================== */}
      {activeTab === 'segments' && <SegmentBuilder />}

      {/* ==================== SETTINGS TAB ==================== */}
      {activeTab === 'settings' && (
        <div key={settingsLoaded ? 'loaded' : 'loading'} className="bg-white rounded-xl border border-slate-200 p-6 space-y-6" data-email-settings="">
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.emailConfig.smtpConfig')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('admin.emailConfig.provider')}>
                <select data-field="provider" defaultValue={emailSettings['email.provider'] || 'Resend'} aria-label="Email service provider" className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                  <option value="Resend">Resend</option>
                  <option value="SendGrid">SendGrid</option>
                  <option value="SMTP">{t('admin.emailConfig.customSmtp')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.emailConfig.senderEmail')}>
                <Input type="email" defaultValue={emailSettings['email.senderEmail'] || 'noreply@biocyclepeptides.com'} data-field="senderEmail" />
              </FormField>
              <FormField label={t('admin.emailConfig.senderName')}>
                <Input type="text" defaultValue={emailSettings['email.senderName'] || 'BioCycle Peptides'} data-field="senderName" />
              </FormField>
              <FormField label={t('admin.emailConfig.replyEmail')}>
                <Input type="email" defaultValue={emailSettings['email.replyEmail'] || 'support@biocyclepeptides.com'} data-field="replyEmail" />
              </FormField>
            </div>
          </div>

          {/* Inbound email webhook config */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.emailConfig.inboundTitle')}</h3>
            <div className="grid grid-cols-1 gap-4">
              <FormField label={t('admin.emailConfig.webhookUrl')} hint={t('admin.emailConfig.webhookUrlHint')}>
                <Input type="text" readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/inbound-email`} />
              </FormField>
              <FormField label={t('admin.emailConfig.receptionAddress')}>
                <Input type="email" defaultValue="support@biocycle.ca" />
              </FormField>
              <FormField label={t('admin.emailConfig.webhookSecret')}>
                <Input type="password" placeholder={t('admin.emailConfig.webhookSecretPlaceholder')} />
              </FormField>
            </div>
          </div>

          {/* Automations */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.emailConfig.automations')}</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-slate-700">{t('admin.emailConfig.abandonedCartEmail')}</span>
                <input type="checkbox" aria-label="Enable abandoned cart email automation" className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-700">{t('admin.emailConfig.reviewRequest')}</span>
                <input type="checkbox" defaultChecked aria-label="Enable review request email automation" className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-700">{t('admin.emailConfig.birthdayEmail')}</span>
                <input type="checkbox" defaultChecked aria-label="Enable birthday email automation" className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-700">{t('admin.emailConfig.autoResponder')}</span>
                <input type="checkbox" aria-label="Enable auto-responder email automation" className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
            </div>
          </div>

          {/* DKIM/SPF/DMARC */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.emailConfig.emailAuthTitle')}</h3>
            <div className="space-y-3">
              {[
                { name: 'SPF', status: emailAuthStatus?.spf || 'unknown', desc: 'Sender Policy Framework' },
                { name: 'DKIM', status: emailAuthStatus?.dkim || 'unknown', desc: 'DomainKeys Identified Mail' },
                { name: 'DMARC', status: emailAuthStatus?.dmarc || 'unknown', desc: 'Domain-based Message Auth' },
                { name: 'BIMI', status: emailAuthStatus?.bimi || 'unknown', desc: 'Brand Indicators for Message Identification' },
              ].map(item => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-slate-900">{item.name}</span>
                    <span className="text-xs text-slate-500 ml-2">{item.desc}</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    item.status === 'configured' ? 'bg-green-100 text-green-700' :
                    item.status === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {item.status === 'configured' ? t('admin.emailConfig.authStatusOk') : item.status === 'warning' ? t('admin.emailConfig.authStatusWarning') : t('admin.emailConfig.authStatusMissing')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="primary" icon={Save} onClick={async () => {
              try {
                const form = document.querySelector('[data-email-settings]');
                if (!form) return;
                const provider = form.querySelector<HTMLSelectElement>('[data-field="provider"]')?.value;
                const senderEmail = form.querySelector<HTMLInputElement>('[data-field="senderEmail"]')?.value;
                const senderName = form.querySelector<HTMLInputElement>('[data-field="senderName"]')?.value;
                const replyEmail = form.querySelector<HTMLInputElement>('[data-field="replyEmail"]')?.value;
                const res = await fetch('/api/admin/emails/settings', {
                  method: 'PUT',
                  headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify({
                    'email.provider': provider,
                    'email.senderEmail': senderEmail,
                    'email.senderName': senderName,
                    'email.replyEmail': replyEmail,
                  }),
                });
                if (res.ok) {
                  toast.success(t('common.saved') || 'Saved');
                  setSettingsLoaded(false); // Reload settings
                } else {
                  toast.error(t('common.errorOccurred'));
                }
              } catch {
                toast.error(t('common.errorOccurred'));
              }
            }}>
              {t('admin.emailConfig.save')}
            </Button>
            <Button variant="secondary" icon={SendHorizontal} onClick={async () => {
              try {
                const res = await fetch('/api/admin/emails/test', { method: 'POST' });
                if (res.ok) toast.success(t('admin.emailConfig.testEmailSent') || 'Test email sent!');
                else toast.error(t('admin.emailConfig.testEmailFailed') || 'Test email failed');
              } catch {
                toast.error(t('admin.emailConfig.testEmailFailed') || 'Test email failed');
              }
            }}>
              {t('admin.emailConfig.testConnection') || 'Test Connection'}
            </Button>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      <Modal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title={t('admin.emailConfig.editTemplate')}
        size="lg"
        footer={
          <>
            <Button variant="secondary" icon={Eye} onClick={() => {
              if (editingTemplate) {
                const contentInput = document.querySelector<HTMLTextAreaElement>('[data-template-content]');
                const rawHtml = contentInput?.value || editingTemplate.content;
                // Security: Use Blob URL with a fully sandboxed iframe (no allow-scripts) to prevent XSS
                const wrapper = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title><style>body{margin:0;}</style></head><body>${rawHtml}</body></html>`;
                const blob = new Blob([wrapper], { type: 'text/html' });
                const blobUrl = URL.createObjectURL(blob);
                const preview = window.open('', '_blank');
                if (preview) {
                  preview.document.write(`<!DOCTYPE html><html><head><title>Email Preview</title></head><body style="margin:0;">
                    <iframe sandbox="allow-same-origin" style="width:100%;height:100vh;border:none;" src="${blobUrl}"></iframe>
                  </body></html>`);
                  preview.document.close();
                }
              }
            }}>{t('admin.emailConfig.preview')}</Button>
            <Button variant="primary" icon={Save} onClick={saveTemplate}>{t('admin.emailConfig.save')}</Button>
          </>
        }
      >
        {editingTemplate && (
          <div className="space-y-4">
            <FormField label={t('admin.emailConfig.subject')} hint={t('admin.emailConfig.subjectHint')}>
              <Input type="text" defaultValue={editingTemplate.subject} data-template-subject="" />
            </FormField>
            <FormField label={t('admin.emailConfig.contentHtml')}>
              <Textarea rows={15} defaultValue={editingTemplate.content} className="font-mono text-sm" data-template-content="" />
            </FormField>
          </div>
        )}
      </Modal>

      {/* ==================== A/B TEST MODAL ==================== */}
      <Modal
        isOpen={showAbTestModal}
        onClose={() => setShowAbTestModal(false)}
        title={t('admin.emailConfig.abTestTitle') || 'A/B Test Configuration'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAbTestModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" icon={FlaskConical} onClick={() => {
              if (!abTestSubjectA.trim() || !abTestSubjectB.trim()) {
                toast.error(t('admin.emailConfig.abTestBothRequired') || 'Both subject lines are required');
                return;
              }
              toast.success(t('admin.emailConfig.abTestConfigured') || 'A/B test configured');
              setShowAbTestModal(false);
            }}>
              {t('admin.emailConfig.abTestSave') || 'Save A/B Test'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('admin.emailConfig.abTestDescription') || 'Test two different subject lines to see which performs better. Your audience will be randomly split.'}
          </p>
          <FormField label={t('admin.emailConfig.abTestSubjectA') || 'Subject Line A'}>
            <Input
              type="text"
              value={abTestSubjectA}
              onChange={(e) => setAbTestSubjectA(e.target.value)}
              placeholder={t('admin.emailConfig.abTestSubjectAPlaceholder') || 'e.g. New products just arrived!'}
            />
          </FormField>
          <FormField label={t('admin.emailConfig.abTestSubjectB') || 'Subject Line B'}>
            <Input
              type="text"
              value={abTestSubjectB}
              onChange={(e) => setAbTestSubjectB(e.target.value)}
              placeholder={t('admin.emailConfig.abTestSubjectBPlaceholder') || 'e.g. Check out what\'s new'}
            />
          </FormField>
          <FormField label={t('admin.emailConfig.abTestSplit') || 'Traffic Split (%)'}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="10"
                max="90"
                step="10"
                value={abTestSplitPct}
                onChange={(e) => setAbTestSplitPct(e.target.value)}
                className="flex-1"
                aria-label="Traffic split percentage"
              />
              <span className="text-sm font-medium text-slate-700 w-24 text-center">
                A: {abTestSplitPct}% / B: {100 - Number(abTestSplitPct)}%
              </span>
            </div>
          </FormField>
          <div className="bg-sky-50 rounded-lg p-3 text-xs text-sky-700">
            {t('admin.emailConfig.abTestHint') || 'The winning subject line (highest open rate after 4 hours) will be sent to the remaining audience.'}
          </div>
        </div>
      </Modal>

      {/* ==================== SCHEDULE SEND MODAL ==================== */}
      <Modal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title={t('admin.emailConfig.scheduleTitle') || 'Schedule Campaign'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowScheduleModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" icon={Calendar} onClick={() => {
              if (!scheduleDate) {
                toast.error(t('admin.emailConfig.scheduleDateRequired') || 'Please select a date');
                return;
              }
              const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`);
              if (scheduledAt <= new Date()) {
                toast.error(t('admin.emailConfig.scheduleFuture') || 'Scheduled date must be in the future');
                return;
              }
              toast.success(
                (t('admin.emailConfig.scheduleConfirmed') || 'Campaign scheduled for {date}')
                  .replace('{date}', scheduledAt.toLocaleString(locale))
              );
              setShowScheduleModal(false);
            }}>
              {t('admin.emailConfig.scheduleConfirm') || 'Schedule'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.emailConfig.scheduleDate') || 'Date'}>
            <Input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </FormField>
          <FormField label={t('admin.emailConfig.scheduleTime') || 'Time'}>
            <Input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
            />
          </FormField>
          <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">
            {t('admin.emailConfig.scheduleTimezoneHint') || 'Time is in your local timezone. The campaign will be sent at the specified time.'}
          </div>
        </div>
      </Modal>

      {/* ==================== IMPORT CSV MODAL ==================== */}
      <Modal
        isOpen={showImportModal}
        onClose={() => { setShowImportModal(false); setImportFile(null); }}
        title={t('admin.emailConfig.importTitle') || 'Import Subscribers from CSV'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowImportModal(false); setImportFile(null); }}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button
              variant="primary"
              icon={Upload}
              onClick={handleImportSubmit}
              disabled={!importFile || importing}
              loading={importing}
            >
              {t('admin.emailConfig.importButton') || 'Import'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {t('admin.emailConfig.importDescription') || 'Upload a CSV file with subscriber data. The file must contain at least an Email column.'}
          </p>
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-sky-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            {importFile ? (
              <div>
                <p className="text-sm font-medium text-slate-900">{importFile.name}</p>
                <p className="text-xs text-slate-500">{(importFile.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                {t('admin.emailConfig.importDropzone') || 'Click to select a CSV file'}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setImportFile(file);
              }}
            />
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-slate-700 mb-1">
              {t('admin.emailConfig.importFormat') || 'Expected CSV format:'}
            </h4>
            <code className="text-[10px] text-slate-600 block">
              Email,Locale,Source<br />
              john@example.com,en,import<br />
              marie@example.com,fr,import
            </code>
          </div>
        </div>
      </Modal>

      {/* ==================== ADD CONTACT MODAL ==================== */}
      <Modal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        title={t('admin.emailConfig.addContactTitle') || 'Add Contact'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddContactModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" icon={UserPlus} onClick={handleAddContactSubmit}>
              {t('admin.emailConfig.addContactButton') || 'Add Contact'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.emailConfig.contactEmail') || 'Email'} required>
            <Input
              type="email"
              value={newContactEmail}
              onChange={(e) => setNewContactEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </FormField>
          <FormField label={t('admin.emailConfig.contactLocale') || 'Language'}>
            <select
              value={newContactLocale}
              onChange={(e) => setNewContactLocale(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              aria-label="Contact language"
            >
              <option value="en">English</option>
              <option value="fr">Francais</option>
              <option value="es">Espanol</option>
              <option value="de">Deutsch</option>
              <option value="pt">Portugues</option>
              <option value="zh">Chinese</option>
              <option value="ar">Arabic</option>
            </select>
          </FormField>
          <FormField label={t('admin.emailConfig.contactSource') || 'Source'}>
            <select
              value={newContactSource}
              onChange={(e) => setNewContactSource(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              aria-label="Contact source"
            >
              <option value="manual">{t('admin.emailConfig.sourceManual') || 'Manual'}</option>
              <option value="import">{t('admin.emailConfig.sourceImport') || 'Import'}</option>
              <option value="popup">{t('admin.emailConfig.sourcePopup') || 'Popup'}</option>
              <option value="footer">{t('admin.emailConfig.sourceFooter') || 'Footer'}</option>
              <option value="checkout">{t('admin.emailConfig.sourceCheckout') || 'Checkout'}</option>
            </select>
          </FormField>
        </div>
      </Modal>

      {/* ==================== TEMPLATE VARIABLES MODAL ==================== */}
      <Modal
        isOpen={showVariablesModal}
        onClose={() => setShowVariablesModal(false)}
        title={t('admin.emailConfig.variablesTitle') || 'Available Template Variables'}
        size="md"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 mb-4">
            {t('admin.emailConfig.variablesDescription') || 'Use these variables in your email templates. They will be replaced with actual values when the email is sent.'}
          </p>
          {[
            { var: '{{customerName}}', desc: t('admin.emailConfig.varCustomerName') || 'Customer full name' },
            { var: '{{prenom}}', desc: t('admin.emailConfig.varFirstName') || 'Customer first name' },
            { var: '{{email}}', desc: t('admin.emailConfig.varEmail') || 'Customer email address' },
            { var: '{{orderNumber}}', desc: t('admin.emailConfig.varOrderNumber') || 'Order number' },
            { var: '{{orderTotal}}', desc: t('admin.emailConfig.varOrderTotal') || 'Order total amount' },
            { var: '{{trackingUrl}}', desc: t('admin.emailConfig.varTrackingUrl') || 'Shipment tracking URL' },
            { var: '{{trackingNumber}}', desc: t('admin.emailConfig.varTrackingNumber') || 'Shipment tracking number' },
            { var: '{{resetLink}}', desc: t('admin.emailConfig.varResetLink') || 'Password reset link' },
            { var: '{{unsubscribeUrl}}', desc: t('admin.emailConfig.varUnsubscribeUrl') || 'Unsubscribe link' },
            { var: '{{companyName}}', desc: t('admin.emailConfig.varCompanyName') || 'Company name (BioCycle Peptides)' },
            { var: '{{currentYear}}', desc: t('admin.emailConfig.varCurrentYear') || 'Current year' },
          ].map(item => (
            <div
              key={item.var}
              className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
              onClick={() => {
                navigator.clipboard.writeText(item.var);
                toast.success((t('admin.emailConfig.variableCopied') || 'Copied: {var}').replace('{var}', item.var));
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  navigator.clipboard.writeText(item.var);
                  toast.success((t('admin.emailConfig.variableCopied') || 'Copied: {var}').replace('{var}', item.var));
                }
              }}
            >
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 text-sky-700">
                  {item.var}
                </code>
                <span className="text-sm text-slate-600">{item.desc}</span>
              </div>
              <Copy className="h-3.5 w-3.5 text-slate-400" />
            </div>
          ))}
        </div>
      </Modal>

      {/* ==================== NEW TEMPLATE MODAL ==================== */}
      <Modal
        isOpen={showNewTemplateModal}
        onClose={() => setShowNewTemplateModal(false)}
        title={t('admin.emailConfig.newTemplateTitle') || 'Create New Template'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewTemplateModal(false)}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="primary" icon={Plus} onClick={handleNewTemplateSubmit}>
              {t('admin.emailConfig.createTemplate') || 'Create Template'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label={t('admin.emailConfig.templateName') || 'Template Name'} required>
            <Input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder={t('admin.emailConfig.templateNamePlaceholder') || 'e.g. Welcome Email V2'}
            />
          </FormField>
          <FormField label={t('admin.emailConfig.subject')} hint={t('admin.emailConfig.subjectHint')}>
            <Input
              type="text"
              value={newTemplateSubject}
              onChange={(e) => setNewTemplateSubject(e.target.value)}
              placeholder={t('admin.emailConfig.templateSubjectPlaceholder') || 'e.g. Welcome to BioCycle Peptides!'}
            />
          </FormField>
        </div>
      </Modal>

      {/* ==================== EMAIL COMPOSER MODAL ==================== */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 transition-opacity"
            onClick={() => setShowComposer(false)}
            aria-hidden="true"
          />
          {/* Composer panel */}
          <div className="relative w-full max-w-2xl mx-4 mb-4 sm:mb-0 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden" style={{ height: '70vh', maxHeight: '600px' }}>
            <EmailComposer
              onClose={() => { setShowComposer(false); setComposerReplyTo(null); }}
              replyTo={composerReplyTo}
            />
          </div>
        </div>
      )}
    </div>
    </EmailErrorBoundary>
  );
}
