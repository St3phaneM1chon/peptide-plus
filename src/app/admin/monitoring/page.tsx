'use client';

/**
 * MONITORING PAGE - Demo implementation
 *
 * IMPORTANT: The performance metrics (Web Vitals, route latencies) and uptime data
 * on this page are SIMULATED / HARDCODED demonstration data. They do NOT reflect
 * real application performance.
 *
 * The "Health Status" section at the top is connected to the real /api/health endpoint
 * and shows live service status when the API is reachable.
 *
 * TODO: Connect to a real APM provider (e.g., Azure Application Insights, Datadog)
 * for actual performance metrics and uptime tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, Zap, AlertTriangle, Server, Database, Globe, TrendingUp, Info } from 'lucide-react';

interface HealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastCheck: Date;
}

interface PerformanceMetric {
  route: string;
  p50: number;
  p95: number;
  p99: number;
  requests: number;
}

// Map /api/health check names to display labels
function mapHealthCheckToService(check: { name: string; status: string; duration?: number }): HealthStatus {
  const nameMap: Record<string, string> = {
    application: 'Application',
    database: 'Base de donnees',
    redis: 'Redis Cache',
    stripe: 'Stripe API',
    email: 'Email (Resend)',
    memory: 'Memoire',
    auth: 'Authentification',
    csrf: 'Protection CSRF',
    environment: 'Variables env.',
    sentry: 'Sentry',
  };
  return {
    service: nameMap[check.name] || check.name,
    status: check.status === 'pass' ? 'healthy' : check.status === 'warn' ? 'degraded' : 'down',
    responseTime: check.duration,
    lastCheck: new Date(),
  };
}

export default function MonitoringPage() {
  const [health, setHealth] = useState<HealthStatus[]>([]);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const [metrics] = useState<PerformanceMetric[]>([
    { route: '/api/products', p50: 45, p95: 120, p99: 250, requests: 15420 },
    { route: '/api/orders', p50: 78, p95: 200, p99: 450, requests: 3210 },
    { route: '/api/auth', p50: 150, p95: 300, p99: 600, requests: 8900 },
    { route: '/ (homepage)', p50: 120, p95: 350, p99: 800, requests: 25600 },
    { route: '/products/*', p50: 95, p95: 280, p99: 550, requests: 18700 },
  ]);

  const [uptime] = useState(99.97);

  // Fetch real health data from /api/health
  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.checks && Array.isArray(data.checks)) {
        setHealth(data.checks.map(mapHealthCheckToService));
      }
    } catch (err) {
      setHealthError(err instanceof Error ? err.message : 'Erreur de connexion');
      // Fallback to empty state on error
      setHealth([]);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    const interval = setInterval(refreshHealth, 30000);
    return () => clearInterval(interval);
  }, [refreshHealth]);

  const statusColor = (s: string) => s === 'healthy' ? 'text-green-600 bg-green-100' : s === 'degraded' ? 'text-yellow-600 bg-yellow-100' : 'text-red-600 bg-red-100';
  const statusLabel = (s: string) => s === 'healthy' ? 'Opérationnel' : s === 'degraded' ? 'Dégradé' : 'Hors ligne';

  const p99Color = (ms: number) => ms < 200 ? 'text-green-600' : ms < 500 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Monitoring</h1>
          <p className="text-slate-500">Performance et santé des services</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">{uptime}%</div>
            <div className="text-xs text-slate-500">Uptime (30j)</div>
          </div>
          <button onClick={refreshHealth} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 text-sm font-medium">
            Actualiser
          </button>
        </div>
      </div>

      {/* Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {health.map((h) => (
          <div key={h.service} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">{h.service}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(h.status)}`}>
                {statusLabel(h.status)}
              </span>
            </div>
            {h.responseTime && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                {h.responseTime}ms
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Web Vitals Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Web Vitals
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { name: 'LCP', value: '1.8s', rating: 'good' },
            { name: 'FID', value: '45ms', rating: 'good' },
            { name: 'CLS', value: '0.05', rating: 'good' },
            { name: 'TTFB', value: '350ms', rating: 'good' },
            { name: 'INP', value: '120ms', rating: 'good' },
          ].map((vital) => (
            <div key={vital.name} className="text-center p-3 rounded-lg bg-slate-50">
              <div className="text-xs font-semibold text-slate-500 mb-1">{vital.name}</div>
              <div className={`text-lg font-bold ${vital.rating === 'good' ? 'text-green-600' : vital.rating === 'needs-improvement' ? 'text-yellow-600' : 'text-red-600'}`}>
                {vital.value}
              </div>
              <div className={`text-[10px] mt-0.5 ${vital.rating === 'good' ? 'text-green-500' : 'text-yellow-500'}`}>
                {vital.rating === 'good' ? '✓ Bon' : '⚠ À améliorer'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Route Performance */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          Performance par route
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-3 font-medium">Route</th>
                <th className="pb-3 font-medium text-right">P50</th>
                <th className="pb-3 font-medium text-right">P95</th>
                <th className="pb-3 font-medium text-right">P99</th>
                <th className="pb-3 font-medium text-right">Requêtes</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.route} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 font-medium text-slate-700">{m.route}</td>
                  <td className="py-3 text-right text-green-600">{m.p50}ms</td>
                  <td className="py-3 text-right text-yellow-600">{m.p95}ms</td>
                  <td className={`py-3 text-right font-medium ${p99Color(m.p99)}`}>{m.p99}ms</td>
                  <td className="py-3 text-right text-slate-500">{m.requests.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
