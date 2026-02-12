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

const templateTypes: Record<string, { label: string; description: string; variant: BadgeVariant }> = {
  ORDER_CONFIRMATION: { label: 'Confirmation commande', description: 'Envoy\u00e9 apr\u00e8s paiement', variant: 'success' },
  ORDER_SHIPPED: { label: 'Exp\u00e9dition', description: 'Envoy\u00e9 avec num\u00e9ro de suivi', variant: 'info' },
  ORDER_DELIVERED: { label: 'Livraison', description: 'Envoy\u00e9 \u00e0 la livraison', variant: 'primary' },
  WELCOME: { label: 'Bienvenue', description: 'Nouvel utilisateur', variant: 'warning' },
  PASSWORD_RESET: { label: 'Reset mot de passe', description: 'Lien de r\u00e9initialisation', variant: 'neutral' },
  BIRTHDAY: { label: 'Anniversaire', description: 'Email de f\u00eate + bonus', variant: 'error' },
  ABANDONED_CART: { label: 'Panier abandonn\u00e9', description: 'Rappel apr\u00e8s 24h', variant: 'warning' },
  REVIEW_REQUEST: { label: 'Demande d\'avis', description: 'Apr\u00e8s livraison', variant: 'warning' },
};

const emailStatusMap: Record<string, { label: string; variant: BadgeVariant }> = {
  SENT: { label: 'SENT', variant: 'success' },
  FAILED: { label: 'FAILED', variant: 'error' },
  PENDING: { label: 'PENDING', variant: 'warning' },
};

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<'templates' | 'logs' | 'settings'>('templates');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setTemplates([]);
    setLogs([]);
    setLoading(false);
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
    { key: 'templates', label: 'Templates' },
    { key: 'logs', label: 'Historique' },
    { key: 'settings', label: 'Param\u00e8tres' },
  ];

  const logColumns: Column<EmailLog>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (log) => {
        const tpl = templateTypes[log.templateType];
        return (
          <StatusBadge variant={tpl?.variant || 'neutral'}>
            {tpl?.label || log.templateType}
          </StatusBadge>
        );
      },
    },
    {
      key: 'to',
      header: 'Destinataire',
      render: (log) => <span className="text-slate-900">{log.to}</span>,
    },
    {
      key: 'subject',
      header: 'Sujet',
      render: (log) => <span className="text-slate-600 truncate max-w-xs block">{log.subject}</span>,
    },
    {
      key: 'status',
      header: 'Statut',
      align: 'center',
      render: (log) => {
        const cfg = emailStatusMap[log.status] || { label: log.status, variant: 'neutral' as BadgeVariant };
        return <StatusBadge variant={cfg.variant}>{cfg.label}</StatusBadge>;
      },
    },
    {
      key: 'date',
      header: 'Date',
      render: (log) => (
        <span className="text-sm text-slate-500">
          {new Date(log.sentAt).toLocaleString('fr-CA')}
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
        title="Emails"
        subtitle="G\u00e9rez les templates et les envois d'emails"
        actions={
          <Button variant="primary" icon={SendHorizontal}>
            Envoyer un test
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Templates actifs"
          value={`${stats.activeTemplates}/${templates.length}`}
          icon={LayoutTemplate}
        />
        <StatCard
          label="Emails envoy\u00e9s (24h)"
          value={stats.sent}
          icon={CheckCircle2}
          className="!border-green-200 !bg-green-50"
        />
        <StatCard
          label="\u00c9checs"
          value={stats.failed}
          icon={XCircle}
          className="!border-red-200 !bg-red-50"
        />
        <StatCard
          label="Taux de succ\u00e8s"
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
            title="Aucun template"
            description="Les templates d'emails appara\u00eetront ici une fois configur\u00e9s."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template) => {
              const tpl = templateTypes[template.type];
              return (
                <div
                  key={template.id}
                  className={`bg-white rounded-xl border border-slate-200 p-4 ${!template.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <StatusBadge variant={tpl.variant}>{tpl.label}</StatusBadge>
                      <h3 className="font-semibold text-slate-900 mt-1">{template.name}</h3>
                      <p className="text-xs text-slate-500">{tpl.description}</p>
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
                  <p className="text-sm text-slate-600 mb-3 truncate">Sujet: {template.subject}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">
                      MAJ: {new Date(template.lastUpdated).toLocaleDateString('fr-CA')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTemplate(template)}
                    >
                      Modifier
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
          emptyTitle="Aucun email envoy\u00e9"
          emptyDescription="L'historique des emails envoy\u00e9s appara\u00eetra ici."
        />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-4">Configuration SMTP</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Provider">
                <select className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500">
                  <option>Resend</option>
                  <option>SendGrid</option>
                  <option>SMTP personnalis\u00e9</option>
                </select>
              </FormField>
              <FormField label="Email exp\u00e9diteur">
                <Input type="email" defaultValue="noreply@biocycle.ca" />
              </FormField>
              <FormField label="Nom exp\u00e9diteur">
                <Input type="text" defaultValue="BioCycle Peptides" />
              </FormField>
              <FormField label="Email r\u00e9ponse">
                <Input type="email" defaultValue="support@biocycle.ca" />
              </FormField>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-4">Automatisations</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-slate-700">Email panier abandonn\u00e9 (apr\u00e8s 24h)</span>
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-700">Demande d'avis (5 jours apr\u00e8s livraison)</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-slate-700">Email anniversaire</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-500" />
              </label>
            </div>
          </div>

          <Button variant="primary" icon={Save}>
            Sauvegarder
          </Button>
        </div>
      )}

      {/* Edit Template Modal */}
      <Modal
        isOpen={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title="Modifier le template"
        size="lg"
        footer={
          <>
            <Button variant="secondary" icon={Eye}>
              Pr\u00e9visualiser
            </Button>
            <Button variant="primary" icon={Save}>
              Sauvegarder
            </Button>
          </>
        }
      >
        {editingTemplate && (
          <div className="space-y-4">
            <FormField label="Sujet" hint={`Variables: {orderNumber}, {customerName}, {trackingUrl}`}>
              <Input type="text" defaultValue={editingTemplate.subject} />
            </FormField>
            <FormField label="Contenu (HTML)">
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
