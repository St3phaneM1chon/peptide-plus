'use client';

import { useState, useEffect } from 'react';

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

const templateTypes: Record<string, { label: string; description: string; color: string }> = {
  ORDER_CONFIRMATION: { label: 'Confirmation commande', description: 'Envoyé après paiement', color: 'bg-green-100 text-green-800' },
  ORDER_SHIPPED: { label: 'Expédition', description: 'Envoyé avec numéro de suivi', color: 'bg-blue-100 text-blue-800' },
  ORDER_DELIVERED: { label: 'Livraison', description: 'Envoyé à la livraison', color: 'bg-purple-100 text-purple-800' },
  WELCOME: { label: 'Bienvenue', description: 'Nouvel utilisateur', color: 'bg-amber-100 text-amber-800' },
  PASSWORD_RESET: { label: 'Reset mot de passe', description: 'Lien de réinitialisation', color: 'bg-gray-100 text-gray-800' },
  BIRTHDAY: { label: 'Anniversaire', description: 'Email de fête + bonus', color: 'bg-pink-100 text-pink-800' },
  ABANDONED_CART: { label: 'Panier abandonné', description: 'Rappel après 24h', color: 'bg-orange-100 text-orange-800' },
  REVIEW_REQUEST: { label: 'Demande d\'avis', description: 'Après livraison', color: 'bg-yellow-100 text-yellow-800' },
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
          <h1 className="text-2xl font-bold text-gray-900">Emails</h1>
          <p className="text-gray-500">Gérez les templates et les envois d'emails</p>
        </div>
        <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
          Envoyer un test
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Templates actifs</p>
          <p className="text-2xl font-bold text-gray-900">{stats.activeTemplates}/{templates.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Emails envoyés (24h)</p>
          <p className="text-2xl font-bold text-green-700">{stats.sent}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">Échecs</p>
          <p className="text-2xl font-bold text-red-700">{stats.failed}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Taux de succès</p>
          <p className="text-2xl font-bold text-blue-700">
            {((stats.sent / (stats.sent + stats.failed)) * 100 || 0).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {['templates', 'logs', 'settings'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-3 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'templates' ? 'Templates' : tab === 'logs' ? 'Historique' : 'Paramètres'}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div key={template.id} className={`bg-white rounded-xl border border-gray-200 p-4 ${!template.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${templateTypes[template.type].color}`}>
                    {templateTypes[template.type].label}
                  </span>
                  <h3 className="font-semibold text-gray-900 mt-1">{template.name}</h3>
                  <p className="text-xs text-gray-500">{templateTypes[template.type].description}</p>
                </div>
                <button
                  onClick={() => toggleTemplate(template.id)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    template.isActive ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                    template.isActive ? 'right-0.5' : 'left-0.5'
                  }`} />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3 truncate">Sujet: {template.subject}</p>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">
                  MAJ: {new Date(template.lastUpdated).toLocaleDateString('fr-CA')}
                </span>
                <button
                  onClick={() => setEditingTemplate(template)}
                  className="px-3 py-1 bg-amber-100 text-amber-700 rounded text-sm hover:bg-amber-200"
                >
                  Modifier
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Destinataire</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Sujet</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${templateTypes[log.templateType]?.color || 'bg-gray-100'}`}>
                      {templateTypes[log.templateType]?.label || log.templateType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{log.to}</td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{log.subject}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.status === 'SENT' ? 'bg-green-100 text-green-800' :
                      log.status === 'FAILED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(log.sentAt).toLocaleString('fr-CA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Configuration SMTP</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                  <option>Resend</option>
                  <option>SendGrid</option>
                  <option>SMTP personnalisé</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email expéditeur</label>
                <input
                  type="email"
                  defaultValue="noreply@biocycle.ca"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom expéditeur</label>
                <input
                  type="text"
                  defaultValue="BioCycle Peptides"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email réponse</label>
                <input
                  type="email"
                  defaultValue="support@biocycle.ca"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-4">Automatisations</h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Email panier abandonné (après 24h)</span>
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-amber-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Demande d'avis (5 jours après livraison)</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-amber-500" />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-gray-700">Email anniversaire</span>
                <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-amber-500" />
              </label>
            </div>
          </div>
          
          <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
            Sauvegarder
          </button>
        </div>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Modifier le template</h2>
              <button onClick={() => setEditingTemplate(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                <input
                  type="text"
                  defaultValue={editingTemplate.subject}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Variables: {'{orderNumber}'}, {'{customerName}'}, {'{trackingUrl}'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu (HTML)</label>
                <textarea
                  rows={15}
                  defaultValue={editingTemplate.content}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
                />
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                  Prévisualiser
                </button>
                <button className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600">
                  Sauvegarder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
