'use client';

import { useState, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Zap, Globe, Server } from 'lucide-react';

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  value?: string;
  details?: string;
  durationMs?: number;
}

interface NetworkDiagnostics {
  timestamp: string;
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  checks: DiagnosticResult[];
  summary: { passed: number; warnings: number; failed: number };
}

const statusConfig = {
  pass: { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: 'OK' },
  warn: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'Lent' },
  fail: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'Erreur' },
};

const overallConfig = {
  healthy: { icon: Wifi, color: 'text-green-600', bg: 'bg-green-100', label: 'Reseau OK', desc: 'Tous les tests passes — deploy/push safe' },
  degraded: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Reseau Lent', desc: 'Certains tests lents — deploiement possible mais risque' },
  unhealthy: { icon: WifiOff, color: 'text-red-600', bg: 'bg-red-100', label: 'Reseau KO', desc: 'Tests echoues — NE PAS deployer' },
};

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'warn' }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return <Icon className={`h-5 w-5 ${config.color}`} />;
}

function getCategoryIcon(name: string) {
  if (name.startsWith('DNS')) return Globe;
  if (name.startsWith('Download')) return Zap;
  if (name.includes('Health') || name.includes('API')) return Server;
  return Globe;
}

export default function NetworkDiagnosticsPage() {
  const [data, setData] = useState<NetworkDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/system/network-diagnostics');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const result: NetworkDiagnostics = await res.json();
      setData(result);
      setLastRun(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  // Group checks by category
  const dnsChecks = data?.checks.filter(c => c.name.startsWith('DNS')) || [];
  const endpointChecks = data?.checks.filter(c => !c.name.startsWith('DNS') && !c.name.startsWith('Download')) || [];
  const speedChecks = data?.checks.filter(c => c.name.startsWith('Download')) || [];

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Wifi className="h-6 w-6" />
            Diagnostics Reseau
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Teste la connectivite, vitesse et acces aux services avant un deploiement
          </p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Test en cours...' : 'Lancer le diagnostic'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5" />
            <span className="font-medium">Erreur: {error}</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-blue-700 font-medium">Test en cours...</p>
          <p className="text-blue-500 text-sm mt-1">DNS, endpoints, vitesse de telechargement (~15-30s)</p>
        </div>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Overall Status Card */}
          {(() => {
            const config = overallConfig[data.overallStatus];
            const OverallIcon = config.icon;
            return (
              <div className={`rounded-xl ${config.bg} p-6 flex items-center justify-between`}>
                <div className="flex items-center gap-4">
                  <OverallIcon className={`h-10 w-10 ${config.color}`} />
                  <div>
                    <h2 className={`text-xl font-bold ${config.color}`}>{config.label}</h2>
                    <p className="text-gray-600 text-sm">{config.desc}</p>
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700 font-medium">{data.summary.passed} OK</span>
                  {data.summary.warnings > 0 && (
                    <span className="text-yellow-700 font-medium">{data.summary.warnings} Lent</span>
                  )}
                  {data.summary.failed > 0 && (
                    <span className="text-red-700 font-medium">{data.summary.failed} Echec</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* DNS Resolution */}
          <Section title="Resolution DNS" icon={Globe} checks={dnsChecks} />

          {/* Endpoint Health */}
          <Section title="Endpoints & Services" icon={Server} checks={endpointChecks} />

          {/* Download Speed */}
          <Section title="Vitesse de telechargement" icon={Zap} checks={speedChecks} />

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-400 pt-2">
            <span>Derniere execution: {lastRun}</span>
            <span>Timestamp serveur: {new Date(data.timestamp).toLocaleString()}</span>
          </div>
        </>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
          <Wifi className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-500">Aucun diagnostic lance</h3>
          <p className="text-sm text-gray-400 mt-2">
            Cliquez sur &quot;Lancer le diagnostic&quot; pour tester la connectivite reseau
          </p>
        </div>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, checks }: { title: string; icon: typeof Globe; checks: DiagnosticResult[] }) {
  if (checks.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
        <Icon className="h-4 w-4 text-gray-500" />
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {checks.map((check) => {
          const config = statusConfig[check.status];
          return (
            <div
              key={check.name}
              className={`px-4 py-3 flex items-center justify-between ${config.bg} bg-opacity-30`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <StatusIcon status={check.status} />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-gray-900 dark:text-white">{check.name}</div>
                  {check.details && (
                    <div className="text-xs text-gray-500 truncate">{check.details}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                {check.value && (
                  <span className={`font-mono text-sm font-medium ${config.color}`}>{check.value}</span>
                )}
                {check.durationMs != null && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {check.durationMs > 1000
                      ? `${(check.durationMs / 1000).toFixed(1)}s`
                      : `${check.durationMs}ms`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
