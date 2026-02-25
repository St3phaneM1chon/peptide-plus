'use client';

import { useState } from 'react';
import { Webhook, Plus, Play, CheckCircle, XCircle, Clock, ExternalLink, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  lastDelivery?: { status: number; timestamp: Date };
  successRate: number;
  totalDeliveries: number;
}

const AVAILABLE_EVENTS = [
  'order.created', 'order.paid', 'order.shipped', 'order.delivered', 'order.cancelled',
  'product.created', 'product.updated', 'product.deleted',
  'customer.created', 'customer.updated',
  'review.created', 'inventory.low',
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([
    {
      id: '1', name: 'Slack Notifications', url: 'https://hooks.slack.com/services/xxx',
      events: ['order.created', 'order.paid'], active: true,
      lastDelivery: { status: 200, timestamp: new Date() },
      successRate: 98.5, totalDeliveries: 1250,
    },
    {
      id: '2', name: 'Inventory Sync', url: 'https://api.example.com/webhooks/inventory',
      events: ['inventory.low', 'product.updated'], active: true,
      lastDelivery: { status: 200, timestamp: new Date(Date.now() - 3600000) },
      successRate: 100, totalDeliveries: 340,
    },
  ]);

  const [showCreate, setShowCreate] = useState(false);

  const toggleActive = (id: string) => {
    setWebhooks(prev => prev.map(w => w.id === id ? { ...w, active: !w.active } : w));
    toast.success('Webhook mis à jour');
  };

  const testWebhook = (id: string) => {
    toast.info('Test envoyé...');
    setTimeout(() => toast.success('Webhook test: 200 OK'), 1500);
  };

  const deleteWebhook = (id: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== id));
    toast.success('Webhook supprimé');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Webhook className="w-6 h-6 text-sky-600" />
            Webhooks
          </h1>
          <p className="text-slate-500">Gérez les intégrations par événements</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nouveau webhook
        </button>
      </div>

      {/* Event Types Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Événements disponibles</h3>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_EVENTS.map(evt => (
            <span key={evt} className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-mono">{evt}</span>
          ))}
        </div>
      </div>

      {/* Webhook List */}
      <div className="space-y-4">
        {webhooks.map(webhook => (
          <div key={webhook.id} className={`bg-white rounded-xl border ${webhook.active ? 'border-slate-200' : 'border-slate-100 opacity-60'} p-6`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{webhook.name}</h3>
                  {webhook.active ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">Actif</span>
                  ) : (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs font-medium">Inactif</span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1 text-sm text-slate-500">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <code className="text-xs">{webhook.url}</code>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => testWebhook(webhook.id)} className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg" title="Tester">
                  <Play className="w-4 h-4" />
                </button>
                <button onClick={() => toggleActive(webhook.id)} className="p-2 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg" title={webhook.active ? 'Désactiver' : 'Activer'}>
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => deleteWebhook(webhook.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Supprimer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {webhook.events.map(evt => (
                <span key={evt} className="px-2 py-0.5 bg-sky-50 text-sky-700 rounded text-xs font-mono">{evt}</span>
              ))}
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1.5">
                {webhook.lastDelivery?.status === 200 ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                <span className="text-slate-600">Dernier: {webhook.lastDelivery ? `${webhook.lastDelivery.status}` : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-600">{webhook.totalDeliveries} livraisons</span>
              </div>
              <div className={`font-medium ${webhook.successRate >= 95 ? 'text-green-600' : webhook.successRate >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                {webhook.successRate}% succès
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
