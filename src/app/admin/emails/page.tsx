'use client';

import { useState, useEffect } from 'react';
import {
  Mail,
  SendHorizontal,
  CheckCircle2,
  XCircle,
  BarChart3,
  LayoutTemplate,
  Save,
  Eye,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  Button,
  Modal,
  EmptyState,
  DataTable,
  FormField,
  Input,
  Textarea,
  type Column,
} from '@/components/admin';
import { useI18n } from '@/i18n/client';

interface EmailTemplate {
  id: string;
  name: string;
  type: 'ORDER_CONFIRMATION' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED' | 'WELCOME' | 'PASSWORD_RESET' | 'BIRTHDAY' | 'ABANDONED_CART' | 'REVIEW_REQUEST';
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

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'primary';

const emailStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  SENT: { label: 'SENT', variant: 'success' },
  FAILED: { label: 'FAILED', variant: 'error' },
  PENDING: { label: 'PENDING', variant: 'warning' },
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

export default function EmailsPage() {
  const { t, locale } = useI18n();
  const [activeTab, setActiveTab] = useState<'templates' | 'logs' | 'settings'>('templates');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchData();
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
            type: (t.name as string || 'WELCOME').toUpperCase().replace(/\s+/g, '_') as EmailTemplate['type'],
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
      console.error('Error fetching email data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTemplate = (id: string) => {
    setTemplates(templates.map(t => t.id === id ? { ...t, isActive: !t.isActive } : t));
  };

  const stats = {
    total: logs.length,
    sent: logs.filter(l => l.status === 'SENT').length,
    failed: logs.filter(l => l.status === 'FAILED').length,
    activeTemplates: templates.filter(t => t.isActive).length,
  };

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'templates', label: t('admin.emailConfig.tabTemplates') },
    { key: 'logs', label: t('admin.emailConfig.tabLogs') },
    { key: 'settings', label: t('admin.emailConfig.tabSettings') },
  ];

  const getTemplateLabel = (type: string): string => {
    return t(`admin.emailConfig.templateTypes.${type}.label`);
  };

  const getTemplateDescription = (type: string): string => {
    return t(`admin.emailConfig.templateTypes.${type}.description`);
  };

  const getTemplateVariant = (type: string): BadgeVariant => {
    return templateVariants[type] || 'neutral';
  };

  const logColumns: Column<EmailLog>[] = [
    {
      key: 'type',
      header: t('admin.emailConfig.type'),
      render: (log) => {
        const variant = getTemplateVariant(log.templateType);
        return (
          <StatusBadge variant={variant}>
            {getTemplateLabel(log.templateType)}
          </StatusBadge>
        );
      },
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
        const cfg = emailStatusMap[log.status] || { label: log.status, variant: 'neutral' as BadgeVariant };
        return <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'date',
      header: t('admin.emailConfig.date'),
      render: (log) => (
        <span className="text-sm text-slate-500">
          {new Date(log.sentAt).toLocaleString(locale)}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.emailConfig.title')}
        subtitle={t('admin.emailConfig.subtitle')}
        actions={
          <Button variant="primary" icon={SendHorizontal}>
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

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        templates.length === 0 ? (
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      {t('admin.emailConfig.edit')}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <DataTable
          columns={logColumns}
          data={logs}
          keyExtractor={(log) => log.id}
          emptyTitle={t('admin.emailConfig.noEmailsSent')}
          emptyDescription={t('admin.emailConfig.noEmailsSentDescription')}
        />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">{t('admin.emailConfig.smtpConfig')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('admin.emailConfig.provider')}>
                <select className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                  <option>Resend</option>
                  <option>SendGrid</option>
                  <option>{t('admin.emailConfig.customSmtp')}</option>
                </select>
              </FormField>
              <FormField label={t('admin.emailConfig.senderEmail')}>
                <Input type="email" defaultValue="noreply@biocycle.ca" />
              </FormField>
              <FormField label={t('admin.emailConfig.senderName')}>
                <Input type="text" defaultValue="BioCycle Peptides" />
              </FormField>
              <FormField label={t('admin.emailConfig.replyEmail')}>
                <Input type="email" defaultValue="support@biocycle.ca" />
              </FormField>
            </div>
          </div>

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
            </div>
          </div>

          <Button variant="primary" icon={Save}>
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
            <Button variant="secondary" icon={Eye}>
              {t('admin.emailConfig.preview')}
            </Button>
            <Button variant="primary" icon={Save}>
              {t('admin.emailConfig.save')}
            </Button>
          </>
        }
      >
        {editingTemplate && (
          <div className="space-y-4">
            <FormField label={t('admin.emailConfig.subject')} hint={t('admin.emailConfig.subjectHint')}>
              <Input type="text" defaultValue={editingTemplate.subject} />
            </FormField>
            <FormField label={t('admin.emailConfig.contentHtml')}>
              <Textarea
                rows={15}
                defaultValue={editingTemplate.content}
                className="font-mono text-sm"
              />
            </FormField>
          </div>
        )}
      </Modal>
    </div>
  );
}
