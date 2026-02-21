'use client';

import { useState, useEffect } from 'react';
import {
  Mail, SendHorizontal, CheckCircle2, XCircle, BarChart3,
  LayoutTemplate, Save, Eye, Inbox, Megaphone, GitBranch,
  PieChart, Settings, Users,
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
import SegmentBuilder from './segments/SegmentBuilder';
import { toast } from 'sonner';

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

  // Inbox notification count
  const [inboxCount, setInboxCount] = useState(0);

  useEffect(() => {
    fetchData();
    fetchInboxCount();
  }, []);

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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'SENT').length,
    failed: logs.filter(l => l.status === 'FAILED').length,
    activeTemplates: templates.filter(t => t.isActive).length,
  };

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
    <div className="space-y-6">
      <PageHeader
        title={t('admin.emailConfig.hubTitle')}
        subtitle={t('admin.emailConfig.hubSubtitle')}
        actions={
          <Button variant="primary" icon={SendHorizontal} onClick={sendTestEmail}>
            {t('admin.emailConfig.sendTest')}
          </Button>
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
        <CampaignList onEditCampaign={(id) => toast.info(`${t('admin.emailConfig.editCampaign') || 'Edit campaign'} #${id} — ${t('common.comingSoon') || 'Coming soon'}`)} />
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
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6" data-email-settings="">
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.emailConfig.smtpConfig')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('admin.emailConfig.provider')}>
                <select data-field="provider" className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                  <option>Resend</option>
                  <option>SendGrid</option>
                  <option>{t('admin.emailConfig.customSmtp')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.emailConfig.senderEmail')}>
                <Input type="email" defaultValue="noreply@biocycle.ca" data-field="senderEmail" />
              </FormField>
              <FormField label={t('admin.emailConfig.senderName')}>
                <Input type="text" defaultValue="BioCycle Peptides" data-field="senderName" />
              </FormField>
              <FormField label={t('admin.emailConfig.replyEmail')}>
                <Input type="email" defaultValue="support@biocycle.ca" data-field="replyEmail" />
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
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-700">{t('admin.emailConfig.reviewRequest')}</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-700">{t('admin.emailConfig.birthdayEmail')}</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-700">{t('admin.emailConfig.autoResponder')}</span>
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
            </div>
          </div>

          {/* DKIM/SPF/DMARC */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.emailConfig.emailAuthTitle')}</h3>
            <div className="space-y-3">
              {[
                { name: 'SPF', status: 'configured', desc: 'Sender Policy Framework' },
                { name: 'DKIM', status: 'configured', desc: 'DomainKeys Identified Mail' },
                { name: 'DMARC', status: 'warning', desc: 'Domain-based Message Auth' },
                { name: 'BIMI', status: 'missing', desc: 'Brand Indicators for Message Identification' },
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

          <Button variant="primary" icon={Save} onClick={async () => {
            try {
              const form = document.querySelector('[data-email-settings]');
              if (!form) return;
              const provider = form.querySelector<HTMLSelectElement>('[data-field="provider"]')?.value;
              const senderEmail = form.querySelector<HTMLInputElement>('[data-field="senderEmail"]')?.value;
              const senderName = form.querySelector<HTMLInputElement>('[data-field="senderName"]')?.value;
              const replyEmail = form.querySelector<HTMLInputElement>('[data-field="replyEmail"]')?.value;
              const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  'email.provider': provider,
                  'email.senderEmail': senderEmail,
                  'email.senderName': senderName,
                  'email.replyEmail': replyEmail,
                }),
              });
              if (res.ok) toast.success(t('common.saved') || 'Saved');
              else toast.error(t('common.errorOccurred'));
            } catch {
              toast.error(t('common.errorOccurred'));
            }
          }}>
            {t('admin.emailConfig.save')}
          </Button>
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
                const preview = window.open('', '_blank');
                if (preview && contentInput) {
                  preview.document.write(contentInput.value || editingTemplate.content);
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
    </div>
  );
}
