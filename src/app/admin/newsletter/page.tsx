'use client';

import { useState, useEffect } from 'react';

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
    totalSubscribers: subscribers.filter(s => s.status === 'ACTIVE').length,
    unsubscribed: subscribers.filter(s => s.status === 'UNSUBSCRIBED').length,
    totalCampaigns: campaigns.length,
    avgOpenRate: campaigns.filter(c => c.openRate).reduce((sum, c) => sum + (c.openRate || 0), 0) / 
                 campaigns.filter(c => c.openRate).length || 0,
    fromPopup: subscribers.filter(s => s.source === 'popup' && s.status === 'ACTIVE').length,
    fromFooter: subscribers.filter(s => s.source === 'footer' && s.status === 'ACTIVE').length,
    fromCheckout: subscribers.filter(s => s.source === 'checkout' && s.status === 'ACTIVE').length,
  };

  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    UNSUBSCRIBED: 'bg-gray-100 text-gray-800',
    BOUNCED: 'bg-red-100 text-red-800',
    DRAFT: 'bg-gray-100 text-gray-800',
    SCHEDULED: 'bg-blue-100 text-blue-800',
    SENT: 'bg-green-100 text-green-800',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter</h1>
          <p className="text-gray-500">Gérez vos abonnés et campagnes email</p>
        </div>
        <button
          onClick={() => setShowComposer(true)}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Nouvelle campagne
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Abonnés actifs</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSubscribers}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Désabonnés</p>
          <p className="text-2xl font-bold text-gray-700">{stats.unsubscribed}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Campagnes</p>
          <p className="text-2xl font-bold text-blue-700">{stats.totalCampaigns}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Taux d'ouverture moy.</p>
          <p className="text-2xl font-bold text-green-700">{stats.avgOpenRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Rapport des inscriptions par source */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Rapport des inscriptions par source</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-purple-500">💬</span>
              <p className="text-sm font-medium text-purple-700">Popup d'accueil</p>
            </div>
            <p className="text-3xl font-bold text-purple-900">{stats.fromPopup}</p>
            <p className="text-xs text-purple-600 mt-1">
              {stats.totalSubscribers > 0 ? ((stats.fromPopup / stats.totalSubscribers) * 100).toFixed(1) : 0}% du total
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-500">📧</span>
              <p className="text-sm font-medium text-blue-700">Pied de page</p>
            </div>
            <p className="text-3xl font-bold text-blue-900">{stats.fromFooter}</p>
            <p className="text-xs text-blue-600 mt-1">
              {stats.totalSubscribers > 0 ? ((stats.fromFooter / stats.totalSubscribers) * 100).toFixed(1) : 0}% du total
            </p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-500">🛒</span>
              <p className="text-sm font-medium text-amber-700">Checkout</p>
            </div>
            <p className="text-3xl font-bold text-amber-900">{stats.fromCheckout}</p>
            <p className="text-xs text-amber-600 mt-1">
              {stats.totalSubscribers > 0 ? ((stats.fromCheckout / stats.totalSubscribers) * 100).toFixed(1) : 0}% du total
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'subscribers'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Abonnés ({subscribers.length})
          </button>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`py-3 border-b-2 font-medium text-sm ${
              activeTab === 'campaigns'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Campagnes ({campaigns.length})
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'subscribers' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <input
              type="text"
              placeholder="Rechercher un email..."
              className="px-4 py-2 border border-gray-300 rounded-lg w-64"
            />
            <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              Exporter CSV
            </button>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Langue</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Inscrit le</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{sub.email}</td>
                  <td className="px-4 py-3 text-gray-500">{sub.locale.toUpperCase()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      sub.source === 'popup' ? 'bg-purple-100 text-purple-800' :
                      sub.source === 'footer' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {sub.source || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[sub.status]}`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(sub.subscribedAt).toLocaleDateString('fr-CA')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200">
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-gray-900">{campaign.subject}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[campaign.status]}`}>
                      {campaign.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                    {campaign.sentAt && (
                      <span>Envoyé le {new Date(campaign.sentAt).toLocaleDateString('fr-CA')}</span>
                    )}
                    {campaign.scheduledFor && (
                      <span>Programmé pour {new Date(campaign.scheduledFor).toLocaleDateString('fr-CA')}</span>
                    )}
                    {campaign.recipientCount > 0 && (
                      <span>{campaign.recipientCount} destinataires</span>
                    )}
                    {campaign.openRate && (
                      <span className="text-green-600">{campaign.openRate}% ouverture</span>
                    )}
                    {campaign.clickRate && (
                      <span className="text-blue-600">{campaign.clickRate}% clics</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {campaign.status === 'DRAFT' && (
                    <>
                      <button className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200">
                        Modifier
                      </button>
                      <button className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200">
                        Envoyer
                      </button>
                    </>
                  )}
                  {campaign.status === 'SCHEDULED' && (
                    <button className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200">
                      Annuler
                    </button>
                  )}
                  {campaign.status === 'SENT' && (
                    <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
                      Statistiques
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Nouvelle campagne</h2>
              <button onClick={() => setShowComposer(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet *</label>
                <input
                  type="text"
                  value={newCampaign.subject}
                  onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
                  placeholder="Sujet de l'email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu *</label>
                <textarea
                  rows={10}
                  value={newCampaign.content}
                  onChange={(e) => setNewCampaign({ ...newCampaign, content: e.target.value })}
                  placeholder="Contenu de l'email (HTML supporté)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                  Sauvegarder brouillon
                </button>
                <button className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                  Programmer
                </button>
                <button className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  Envoyer maintenant
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
