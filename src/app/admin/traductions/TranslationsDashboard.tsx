'use client';
/**
 * Dashboard de traduction automatique
 * Affiche la couverture de traduction par modèle et permet de déclencher des traductions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Languages,
  Loader2,
  Play,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ModelCoverage {
  totalEntities: number;
  fullyTranslated: number;
  partiallyTranslated: number;
  untranslated: number;
  coveragePercent: number;
}

interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

interface QueueJob {
  id: string;
  model: string;
  entityId: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  error?: string;
  createdAt: string;
}

const MODEL_LABELS: Record<string, string> = {
  Product: 'Produits',
  ProductFormat: 'Formats produit',
  Category: 'Catégories',
  Article: 'Articles',
  BlogPost: 'Articles de blog',
  Video: 'Vidéos',
  Webinar: 'Webinaires',
  QuickReply: 'Réponses rapides',
};

const MODEL_ICONS: Record<string, string> = {
  Product: '🧪',
  ProductFormat: '📦',
  Category: '📂',
  Article: '📄',
  BlogPost: '✍️',
  Video: '🎬',
  Webinar: '🎙️',
  QuickReply: '💬',
};

export default function TranslationsDashboard() {
  const [overview, setOverview] = useState<Record<string, ModelCoverage>>({});
  const [queue, setQueue] = useState<QueueStats | null>(null);
  const [recentJobs, setRecentJobs] = useState<QueueJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const [showQueue, setShowQueue] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/translations/status');
      const data = await res.json();
      if (data.overview) setOverview(data.overview);
      if (data.queue) setQueue(data.queue);
    } catch (error) {
      console.error('Error fetching translation status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/translations/status?queue=true');
      const data = await res.json();
      if (data.queue) setQueue(data.queue);
      if (data.recentJobs) setRecentJobs(data.recentJobs);
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (showQueue) fetchQueue();
  }, [showQueue, fetchQueue]);

  const triggerTranslation = async (model: string) => {
    setTranslating(prev => ({ ...prev, [model]: true }));
    setMessage(null);

    try {
      const res = await fetch('/api/admin/translations/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, all: true, force: false }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: data.message || `Traduction lancée pour ${MODEL_LABELS[model]}` });
        // Refresh after delay
        setTimeout(fetchStatus, 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erreur lors du déclenchement' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erreur réseau' });
    } finally {
      setTranslating(prev => ({ ...prev, [model]: false }));
    }
  };

  const totalEntities = Object.values(overview).reduce((sum, m) => sum + (m.totalEntities || 0), 0);
  const totalFullyTranslated = Object.values(overview).reduce((sum, m) => sum + (m.fullyTranslated || 0), 0);
  const globalCoverage = totalEntities > 0 ? Math.round((totalFullyTranslated / totalEntities) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-500">Chargement des statistiques...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Languages className="w-7 h-7 text-blue-600" />
            Traductions automatiques
          </h1>
          <p className="text-gray-500 mt-1">
            Gestion des traductions de contenu en 22 langues via GPT-4o-mini
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchStatus(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Couverture globale</p>
              <p className="text-2xl font-bold text-gray-900">{globalCoverage}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Enti. traduits</p>
              <p className="text-2xl font-bold text-gray-900">{totalFullyTranslated}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total contenus</p>
              <p className="text-2xl font-bold text-gray-900">{totalEntities}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">File d&apos;attente</p>
              <p className="text-2xl font-bold text-gray-900">
                {queue ? queue.pending + queue.processing : 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Model Coverage Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Couverture par type de contenu</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Traduits</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Partiels</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Non traduits</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Couverture</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Object.entries(overview).map(([model, coverage]) => (
                <tr key={model} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="mr-2">{MODEL_ICONS[model] || '📋'}</span>
                    <span className="font-medium text-gray-900">{MODEL_LABELS[model] || model}</span>
                  </td>
                  <td className="px-6 py-4 text-center text-gray-600">
                    {coverage.totalEntities}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-green-600 font-medium">{coverage.fullyTranslated}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-yellow-600 font-medium">{coverage.partiallyTranslated}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-red-600 font-medium">{coverage.untranslated}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            coverage.coveragePercent === 100
                              ? 'bg-green-500'
                              : coverage.coveragePercent > 50
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${coverage.coveragePercent}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-600">
                        {coverage.coveragePercent}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => triggerTranslation(model)}
                      disabled={translating[model] || coverage.totalEntities === 0}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      {translating[model] ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      Traduire tout
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Queue Section */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <button
          onClick={() => setShowQueue(!showQueue)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition"
        >
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            File d&apos;attente de traduction
            {queue && (queue.pending + queue.processing > 0) && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                {queue.pending + queue.processing} en cours
              </span>
            )}
          </h2>
          {showQueue ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {showQueue && (
          <div className="px-6 pb-4">
            {queue && (
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-3 bg-yellow-50 rounded-lg">
                  <p className="text-lg font-bold text-yellow-700">{queue.pending}</p>
                  <p className="text-xs text-yellow-600">En attente</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-lg font-bold text-blue-700">{queue.processing}</p>
                  <p className="text-xs text-blue-600">En cours</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-lg font-bold text-green-700">{queue.completed}</p>
                  <p className="text-xs text-green-600">Terminés</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-700">{queue.failed}</p>
                  <p className="text-xs text-red-600">Échoués</p>
                </div>
              </div>
            )}

            {recentJobs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Job ID</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Modèle</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Priorité</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Statut</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Erreur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentJobs.slice(0, 20).map(job => (
                      <tr key={job.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs text-gray-500">{job.id.slice(0, 12)}</td>
                        <td className="px-3 py-2">
                          {MODEL_ICONS[job.model] || ''} {job.model}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            job.priority <= 2 ? 'bg-red-100 text-red-700' :
                            job.priority <= 3 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            P{job.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                            job.status === 'completed' ? 'bg-green-100 text-green-700' :
                            job.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                            job.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {job.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin" />}
                            {job.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-red-500 truncate max-w-[200px]">
                          {job.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {recentJobs.length === 0 && (
              <p className="text-center text-gray-400 py-4">Aucun job récent</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
