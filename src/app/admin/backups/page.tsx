'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/i18n/client';
import { PageHeader } from '@/components/admin/PageHeader';
import {
  Database,
  HardDrive,
  Cloud,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Server,
  FileArchive,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface ProjectStatus {
  health: string;
  latest: string | null;
  age_hours: number | null;
  count: number;
  schedule: string;
}

interface BackupVersion {
  name: string;
  date: string;
  size_mb: number;
  path?: string;
  type: string;
  location?: string;
}

interface VerifyResult {
  file?: string;
  sha256?: string;
  size_mb?: number;
  valid?: boolean;
  valid_sql?: boolean;
  error?: string;
  sample_files?: string[];
}

interface BackupData {
  status: {
    timestamp?: string;
    projects?: Record<string, ProjectStatus>;
    storage?: { total_backups_gb: number; disk_free_gb: number };
    error?: string;
  };
  verify: Record<string, VerifyResult>;
  versions: Record<string, BackupVersion[]>;
  safety: Record<string, string>;
  generatedAt: string;
}

function HealthBadge({ health }: { health: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
    OK: { icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    WARNING: { icon: AlertTriangle, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    CRITICAL: { icon: XCircle, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  };
  const c = config[health] || config.CRITICAL;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${c.bg} ${c.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {health}
    </span>
  );
}

function formatAge(hours: number | null): string {
  if (hours === null) return 'Jamais';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${Math.floor(hours / 24)}j ${Math.round(hours % 24)}h`;
}

const PROJECT_LABELS: Record<string, { label: string; icon: typeof Database; desc: string }> = {
  'aurelia': {
    label: 'Aurelia (Memoire IA)',
    icon: Activity,
    desc: 'Scripts, Knowledge Graph, vecteurs, sessions, hooks',
  },
  'peptide-db': {
    label: 'Peptide-Plus (Base de donnees)',
    icon: Database,
    desc: 'Commandes, clients, produits, comptabilite, factures',
  },
  'peptide-code': {
    label: 'Peptide-Plus (Code source)',
    icon: FileArchive,
    desc: 'src/, prisma/, config, public/',
  },
  'attitudes-framework': {
    label: 'AttitudesFramework (DB staging)',
    icon: Server,
    desc: 'Base PostgreSQL staging (Docker)',
  },
};

export default function BackupsPage() {
  const { t } = useI18n();
  const [data, setData] = useState<BackupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backups');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      toast.error('Erreur chargement des backups');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleProject = (key: string) => {
    setExpandedProject(prev => prev === key ? null : key);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title={t('admin.backups.title') || 'Sauvegardes Multi-Projets'}
        subtitle={t('admin.backups.subtitle') || 'Etat des sauvegardes automatiques de tous les projets'}
        actions={
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Chargement...' : 'Actualiser'}
          </button>
        }
      />

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {data && (
        <>
          {/* ─── Safety Gate Status ─── */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { key: 'ram', icon: HardDrive, label: 'RAM' },
              { key: 'swap', icon: Activity, label: 'Swap' },
              { key: 'disk', icon: HardDrive, label: 'Disque' },
              { key: 'agents', icon: Server, label: 'Agents' },
              { key: 'backup', icon: Clock, label: 'Backup' },
              { key: 'overall', icon: Shield, label: 'Global' },
            ].map(({ key, icon: Icon, label }) => {
              const val = data.safety[key] || '?';
              const isOk = val.includes('OK') || val === 'OK';
              const isWarn = val.includes('WARNING') || val.includes('STALE') || val.includes('HIGH');
              return (
                <div
                  key={key}
                  className={`rounded-lg border p-3 text-center ${
                    isOk ? 'bg-emerald-50 border-emerald-200' :
                    isWarn ? 'bg-amber-50 border-amber-200' :
                    'bg-slate-50 border-slate-200'
                  }`}
                >
                  <Icon className={`w-5 h-5 mx-auto mb-1 ${isOk ? 'text-emerald-600' : isWarn ? 'text-amber-600' : 'text-slate-500'}`} />
                  <div className="text-xs font-medium text-slate-600">{label}</div>
                  <div className={`text-xs mt-0.5 font-mono ${isOk ? 'text-emerald-700' : isWarn ? 'text-amber-700' : 'text-slate-700'}`}>
                    {val}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── Storage Summary ─── */}
          {data.status.storage && (
            <div className="mb-6 flex items-center gap-4 text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <HardDrive className="w-4 h-4 text-slate-400" />
              <span>Backups: <strong>{data.status.storage.total_backups_gb} GB</strong> utilises</span>
              <span className="text-slate-300">|</span>
              <span>Disque libre: <strong>{data.status.storage.disk_free_gb} GB</strong></span>
              <span className="text-slate-300">|</span>
              <span>Genere: {new Date(data.generatedAt).toLocaleString('fr-FR')}</span>
            </div>
          )}

          {/* ─── Project Cards ─── */}
          <div className="space-y-4">
            {data.status.projects && Object.entries(data.status.projects).map(([key, project]) => {
              const meta = PROJECT_LABELS[key] || { label: key, icon: Database, desc: '' };
              const Icon = meta.icon;
              const verification = data.verify[key];
              const versions = data.versions[key] || [];
              const isExpanded = expandedProject === key;

              return (
                <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Header */}
                  <button
                    onClick={() => toggleProject(key)}
                    className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={`p-2.5 rounded-lg ${
                      project.health === 'OK' ? 'bg-emerald-100' :
                      project.health === 'WARNING' ? 'bg-amber-100' : 'bg-red-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        project.health === 'OK' ? 'text-emerald-600' :
                        project.health === 'WARNING' ? 'text-amber-600' : 'text-red-600'
                      }`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{meta.label}</h3>
                        <HealthBadge health={project.health} />
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{meta.desc}</p>
                    </div>

                    <div className="text-right text-sm space-y-0.5 flex-shrink-0">
                      <div className="text-slate-700 font-medium">
                        <Clock className="w-3.5 h-3.5 inline mr-1" />
                        {formatAge(project.age_hours)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {project.count} backups · {project.schedule}
                      </div>
                    </div>

                    <div className="text-slate-400 ml-2">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/50">
                      {/* Verification */}
                      {verification && (
                        <div className="mb-4">
                          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Verification d&apos;integrite
                          </h4>
                          <div className="bg-white rounded-lg border border-slate-200 p-3 text-sm">
                            {verification.valid ? (
                              <div className="flex items-center gap-2 text-emerald-700">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Integrite verifiee</span>
                                {verification.sha256 && (
                                  <span className="text-xs font-mono text-slate-400 ml-2">SHA256: {verification.sha256}</span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-red-700">
                                <XCircle className="w-4 h-4" />
                                <span>{verification.error || 'Verification echouee'}</span>
                              </div>
                            )}
                            {verification.file && (
                              <div className="text-xs text-slate-500 mt-1">
                                Fichier: {verification.file} ({verification.size_mb} MB)
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Versions List */}
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        Versions disponibles ({versions.length})
                      </h4>
                      {versions.length === 0 ? (
                        <div className="text-sm text-slate-400 italic py-2">Aucune sauvegarde disponible</div>
                      ) : (
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wider">
                                <th className="px-3 py-2">Date</th>
                                <th className="px-3 py-2">Fichier</th>
                                <th className="px-3 py-2 text-right">Taille</th>
                                <th className="px-3 py-2">Type</th>
                                <th className="px-3 py-2">Emplacement</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {versions.slice(0, 20).map((v, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2 text-slate-700 whitespace-nowrap">{v.date}</td>
                                  <td className="px-3 py-2 font-mono text-xs text-slate-600 truncate max-w-[250px]">{v.name}</td>
                                  <td className="px-3 py-2 text-right text-slate-600 whitespace-nowrap">{v.size_mb} MB</td>
                                  <td className="px-3 py-2">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                      v.type === 'full' ? 'bg-indigo-100 text-indigo-700' :
                                      v.type === 'production' ? 'bg-purple-100 text-purple-700' :
                                      v.type === 'azure' ? 'bg-sky-100 text-sky-700' :
                                      'bg-slate-100 text-slate-600'
                                    }`}>
                                      {v.type === 'azure' && <Cloud className="w-3 h-3 mr-1" />}
                                      {v.type}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 text-xs text-slate-500">
                                    {v.location === 'cloud' ? (
                                      <span className="inline-flex items-center gap-1 text-sky-600">
                                        <Cloud className="w-3 h-3" /> Azure
                                      </span>
                                    ) : 'Local'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {versions.length > 20 && (
                            <div className="px-3 py-2 text-xs text-slate-400 bg-slate-50 border-t">
                              ... et {versions.length - 20} autres versions
                            </div>
                          )}
                        </div>
                      )}

                      {/* CLI Commands */}
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                          Commandes CLI
                        </h4>
                        <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-300 space-y-1">
                          <div><span className="text-emerald-400"># Sauvegarder</span></div>
                          <div>python3 aurelia_multi_backup.py --project {key}</div>
                          <div className="mt-2"><span className="text-emerald-400"># Restaurer (derniere version)</span></div>
                          <div>python3 aurelia_multi_backup.py --restore {key} --latest</div>
                          <div className="mt-2"><span className="text-emerald-400"># Lister toutes les versions</span></div>
                          <div>python3 aurelia_multi_backup.py --list-versions {key}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ─── Schedule Info ─── */}
          <div className="mt-6 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              Planning des sauvegardes automatiques
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {[
                { time: '03:00', label: 'Aurelia - Backup incremental (full le dimanche)', color: 'bg-violet-100 text-violet-700' },
                { time: '04:15', label: 'Peptide-Plus - Snapshot code source', color: 'bg-blue-100 text-blue-700' },
                { time: '08:00', label: 'Peptide-Plus - Backup DB (matin)', color: 'bg-emerald-100 text-emerald-700' },
                { time: '20:00', label: 'Peptide-Plus - Backup DB (soir)', color: 'bg-emerald-100 text-emerald-700' },
                { time: '21:00', label: 'Rapport quotidien unifie', color: 'bg-amber-100 text-amber-700' },
              ].map(({ time, label, color }) => (
                <div key={time + label} className="flex items-center gap-3 py-1.5">
                  <span className={`px-2 py-0.5 rounded font-mono text-xs font-medium ${color}`}>
                    {time}
                  </span>
                  <span className="text-slate-700">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
