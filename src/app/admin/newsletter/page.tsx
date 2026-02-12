'use client';

import { useState, useEffect } from 'react';
import {
  Send,
  Users,
  UserMinus,
  Mail,
  BarChart3,
  Download,
  Pencil,
  Clock,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  EmptyState,
  StatusBadge,
  FormField,
  Input,
  Textarea,
} from '@/components/admin';

interface Subscriber {
  id: string;
  email: string;
  locale: string;
  source: string;
  status: 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED';
  subscribedAt: string;
  unsubscribedAt?: string;
}

interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENT';
  scheduledFor?: string;
  sentAt?: string;
  recipientCount: number;
  openRate?: number;
  clickRate?: number;
}

const statusVariant: Record<string, 'success' | 'neutral' | 'error' | 'info' | 'warning'> = {
  ACTIVE: 'success',
  UNSUBSCRIBED: 'neutral',
  BOUNCED: 'error',
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  SENT: 'success',
};

export default function NewsletterPage() {
  const [activeTab, setActiveTab] = useState<'subscribers' | 'campaigns'>('subscribers');
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComposer, setShowComposer] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ subject: '', content: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [subsRes, campRes] = await Promise.all([
        fetch('/api/admin/newsletter/subscribers'),
        fetch('/api/admin/newsletter/campaigns'),
      ]);
      const subsData = await subsRes.json();
      const campData = await campRes.json();
      setSubscribers(subsData.subscribers || []);
      setCampaigns(campData.campaigns || []);
    } catch (err) {
      console.error('Error fetching newsletter data:', err);
      setSubscribers([]);
      setCampaigns([]);
    }
    setLoading(false);
  };

  const stats = {
    totalSubscribers: subscribers.filter((s) => s.status === 'ACTIVE').length,
    unsubscribed: subscribers.filter((s) => s.status === 'UNSUBSCRIBED').length,
    totalCampaigns: campaigns.length,
    avgOpenRate:
      campaigns.filter((c) => c.openRate).reduce((sum, c) => sum + (c.openRate || 0), 0) /
        campaigns.filter((c) => c.openRate).length || 0,
    fromPopup: subscribers.filter((s) => s.source === 'popup' && s.status === 'ACTIVE').length,
    fromFooter: subscribers.filter((s) => s.source === 'footer' && s.status === 'ACTIVE').length,
    fromCheckout: subscribers.filter((s) => s.source === 'checkout' && s.status === 'ACTIVE').length,
  };

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
        title="Newsletter"
        subtitle="Gerez vos abonnes et campagnes email"
        actions={
          <Button variant="primary" icon={Send} onClick={() => setShowComposer(true)}>
            Nouvelle campagne
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatMini icon={Users} label="Abonnes actifs" value={stats.totalSubscribers} bg="bg-sky-50 text-sky-600" />
        <StatMini icon={UserMinus} label="Desabonnes" value={stats.unsubscribed} bg="bg-slate-50 text-slate-500" />
        <StatMini icon={Mail} label="Campagnes" value={stats.totalCampaigns} bg="bg-indigo-50 text-indigo-600" />
        <StatMini
          icon={BarChart3}
          label="Taux d'ouverture moy."
          value={`${stats.avgOpenRate.toFixed(1)}%`}
          bg="bg-emerald-50 text-emerald-600"
        />
      </div>

      {/* Source breakdown */}
      <div className="bg-white rounded-xl p-6 border border-slate-200">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Inscriptions par source</h3>
        <div className="grid grid-cols-3 gap-4">
          <SourceCard label="Popup d'accueil" value={stats.fromPopup} total={stats.totalSubscribers} color="violet" />
          <SourceCard label="Pied de page" value={stats.fromFooter} total={stats.totalSubscribers} color="sky" />
          <SourceCard label="Checkout" value={stats.fromCheckout} total={stats.totalSubscribers} color="amber" />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8">
          {(['subscribers', 'campaigns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'subscribers' ? `Abonnes (${subscribers.length})` : `Campagnes (${campaigns.length})`}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'subscribers' ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <input
              type="text"
              placeholder="Rechercher un email..."
              className="px-4 py-2 border border-slate-300 rounded-lg w-64 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
            <Button variant="secondary" icon={Download}>
              Exporter CSV
            </Button>
          </div>
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Langue</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Inscrit le</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">{sub.email}</td>
                  <td className="px-4 py-3 text-slate-500">{sub.locale.toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      variant={sub.source === 'popup' ? 'primary' : sub.source === 'footer' ? 'info' : 'neutral'}
                    >
                      {sub.source || 'N/A'}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={statusVariant[sub.status]}>{sub.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(sub.subscribedAt).toLocaleDateString('fr-CA')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" icon={Trash2} className="text-slate-400 hover:text-red-600" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-slate-900">{campaign.subject}</h3>
                    <StatusBadge variant={statusVariant[campaign.status]}>{campaign.status}</StatusBadge>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                    {campaign.sentAt && (
                      <span>Envoye le {new Date(campaign.sentAt).toLocaleDateString('fr-CA')}</span>
                    )}
                    {campaign.scheduledFor && (
                      <span>Programme pour {new Date(campaign.scheduledFor).toLocaleDateString('fr-CA')}</span>
                    )}
                    {campaign.recipientCount > 0 && <span>{campaign.recipientCount} destinataires</span>}
                    {campaign.openRate && <span className="text-emerald-600">{campaign.openRate}% ouverture</span>}
                    {campaign.clickRate && <span className="text-sky-600">{campaign.clickRate}% clics</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {campaign.status === 'DRAFT' && (
                    <>
                      <Button variant="ghost" size="sm" icon={Pencil}>
                        Modifier
                      </Button>
                      <Button variant="primary" size="sm" icon={Send}>
                        Envoyer
                      </Button>
                    </>
                  )}
                  {campaign.status === 'SCHEDULED' && (
                    <Button variant="ghost" size="sm" icon={XCircle} className="text-red-600">
                      Annuler
                    </Button>
                  )}
                  {campaign.status === 'SENT' && (
                    <Button variant="ghost" size="sm" icon={BarChart3}>
                      Statistiques
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Composer Modal */}
      <Modal isOpen={showComposer} onClose={() => setShowComposer(false)} title="Nouvelle campagne" size="lg">
        <div className="space-y-4">
          <FormField label="Sujet" required>
            <Input
              type="text"
              value={newCampaign.subject}
              onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
              placeholder="Sujet de l'email"
            />
          </FormField>
          <FormField label="Contenu" required>
            <Textarea
              rows={10}
              value={newCampaign.content}
              onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
              placeholder="Contenu de l'email (HTML supporte)"
              className="font-mono text-sm"
            />
          </FormField>
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" className="flex-1">
              Sauvegarder brouillon
            </Button>
            <Button variant="outline" icon={Clock} className="flex-1">
              Programmer
            </Button>
            <Button variant="primary" icon={Send} className="flex-1">
              Envoyer maintenant
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function StatMini({
  icon: Icon,
  label,
  value,
  bg,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  bg: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SourceCard({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: 'violet' | 'sky' | 'amber';
}) {
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
  const colors = {
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    sky: 'bg-sky-50 border-sky-200 text-sky-700',
    amber: 'bg-teal-50 border-teal-200 text-teal-700',
  };
  return (
    <div className={`rounded-lg p-4 border ${colors[color]}`}>
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs mt-1 opacity-75">{pct}% du total</p>
    </div>
  );
}
