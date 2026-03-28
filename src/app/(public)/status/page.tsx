'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

/* ───────────────────────────────────────────────────────────
   Types matching /api/health response
   ─────────────────────────────────────────────────────────── */

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  details?: Record<string, unknown>;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  type: string;
  uptime?: number;
  checks: HealthCheck[];
}

/* ───────────────────────────────────────────────────────────
   Service descriptions & display configuration
   ─────────────────────────────────────────────────────────── */

const SERVICE_META: Record<string, { label: string; description: string }> = {
  application: {
    label: 'Application',
    description: 'Serveur Next.js principal',
  },
  environment: {
    label: 'Configuration',
    description: 'Variables d\u2019environnement',
  },
  database: {
    label: 'Base de donn\u00e9es',
    description: 'PostgreSQL \u2014 stockage principal',
  },
  redis: {
    label: 'Redis',
    description: 'Cache et sessions',
  },
  payments: {
    label: 'Paiements',
    description: 'Fournisseur de paiement',
  },
  email: {
    label: 'Courriel',
    description: 'Service d\u2019envoi de courriels',
  },
  memory: {
    label: 'M\u00e9moire',
    description: 'Utilisation m\u00e9moire du serveur',
  },
  sentry: {
    label: 'Suivi d\u2019erreurs',
    description: 'Monitoring et alertes',
  },
  auth: {
    label: 'Authentification',
    description: 'Syst\u00e8me de connexion',
  },
  csrf: {
    label: 'Protection CSRF',
    description: 'S\u00e9curit\u00e9 des formulaires',
  },
};

/* ───────────────────────────────────────────────────────────
   Helpers
   ─────────────────────────────────────────────────────────── */

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}j ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-CA', {
      dateStyle: 'long',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const OVERALL_LABELS: Record<string, { text: string; className: string }> = {
  healthy: {
    text: 'Tous les syst\u00e8mes op\u00e9rationnels',
    className: 'status-banner-healthy',
  },
  degraded: {
    text: 'Performance d\u00e9grad\u00e9e',
    className: 'status-banner-degraded',
  },
  unhealthy: {
    text: 'Panne majeure d\u00e9tect\u00e9e',
    className: 'status-banner-unhealthy',
  },
};

/* ───────────────────────────────────────────────────────────
   Component: StatusIndicator
   ─────────────────────────────────────────────────────────── */

function StatusIndicator({ status }: { status: 'pass' | 'warn' | 'fail' }) {
  const colors: Record<string, string> = {
    pass: 'indicator-pass',
    warn: 'indicator-warn',
    fail: 'indicator-fail',
  };
  return (
    <span
      className={`status-indicator ${colors[status]}`}
      role="img"
      aria-label={
        status === 'pass'
          ? 'Op\u00e9rationnel'
          : status === 'warn'
            ? 'Avertissement'
            : 'En panne'
      }
    />
  );
}

/* ───────────────────────────────────────────────────────────
   Component: ServiceRow
   ─────────────────────────────────────────────────────────── */

function ServiceRow({ check }: { check: HealthCheck }) {
  const meta = SERVICE_META[check.name] ?? {
    label: check.name,
    description: '',
  };

  return (
    <div className="service-row">
      <div className="service-row-left">
        <StatusIndicator status={check.status} />
        <div>
          <p className="service-label">{meta.label}</p>
          <p className="service-description">{meta.description}</p>
        </div>
      </div>
      <div className="service-row-right">
        {check.duration !== undefined && (
          <span className="service-duration">{check.duration}ms</span>
        )}
        <span
          className={`service-badge ${
            check.status === 'pass'
              ? 'badge-pass'
              : check.status === 'warn'
                ? 'badge-warn'
                : 'badge-fail'
          }`}
        >
          {check.status === 'pass'
            ? 'Op\u00e9rationnel'
            : check.status === 'warn'
              ? 'Avertissement'
              : 'En panne'}
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────
   Page Component
   ─────────────────────────────────────────────────────────── */

export default function StatusPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HealthStatus = await res.json();
      setHealth(data);
      setError(null);
      setLastChecked(new Date().toISOString());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Impossible de joindre le serveur',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  /* Overall status label */
  const overall = health
    ? OVERALL_LABELS[health.status] ?? OVERALL_LABELS.unhealthy
    : null;

  return (
    <div className="status-page">
      {/* ── Styles (scoped, uses Koraline tokens) ── */}
      <style>{`
        .status-page {
          min-height: 100vh;
          background: var(--k-bg-base, #0A0A0F);
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          font-family: var(--k-font-sans, 'Inter', -apple-system, sans-serif);
          padding: 0;
          margin: -1px 0 0 0;
        }

        .status-container {
          max-width: 720px;
          margin: 0 auto;
          padding: 48px 24px 64px;
        }

        /* ── Header ── */
        .status-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .status-header h1 {
          font-size: 28px;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0 0 8px;
        }
        .status-header p {
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          font-size: 14px;
          margin: 0;
        }

        /* ── Overall banner ── */
        .status-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 20px 24px;
          border-radius: var(--k-radius-xl, 20px);
          margin-bottom: 32px;
          font-weight: 600;
          font-size: 16px;
          border: 1px solid;
        }
        .status-banner-healthy {
          background: rgba(16, 185, 129, 0.10);
          border-color: rgba(16, 185, 129, 0.25);
          color: #34d399;
        }
        .status-banner-degraded {
          background: rgba(245, 158, 11, 0.10);
          border-color: rgba(245, 158, 11, 0.25);
          color: #fbbf24;
        }
        .status-banner-unhealthy {
          background: rgba(244, 63, 94, 0.10);
          border-color: rgba(244, 63, 94, 0.25);
          color: #fb7185;
        }

        .banner-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .status-banner-healthy .banner-dot { background: #34d399; box-shadow: 0 0 8px rgba(52,211,153,0.5); }
        .status-banner-degraded .banner-dot { background: #fbbf24; box-shadow: 0 0 8px rgba(251,191,36,0.5); }
        .status-banner-unhealthy .banner-dot { background: #fb7185; box-shadow: 0 0 8px rgba(251,113,133,0.5); }

        /* ── Services card ── */
        .services-card {
          background: var(--k-glass-regular, rgba(255,255,255,0.08));
          backdrop-filter: blur(var(--k-blur-lg, 24px));
          -webkit-backdrop-filter: blur(var(--k-blur-lg, 24px));
          border: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-radius: var(--k-radius-xl, 20px);
          overflow: hidden;
          margin-bottom: 24px;
        }
        .services-card-header {
          padding: 16px 24px;
          border-bottom: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
        }

        /* ── Service row ── */
        .service-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          transition: background var(--k-transition-fast, 150ms);
        }
        .service-row:last-child {
          border-bottom: none;
        }
        .service-row:hover {
          background: var(--k-glass-ultra-thin, rgba(255,255,255,0.03));
        }
        .service-row-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .service-row-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .service-label {
          font-size: 14px;
          font-weight: 500;
          margin: 0;
        }
        .service-description {
          font-size: 12px;
          color: var(--k-text-tertiary, rgba(255,255,255,0.4));
          margin: 2px 0 0;
        }
        .service-duration {
          font-size: 12px;
          color: var(--k-text-tertiary, rgba(255,255,255,0.4));
          font-family: var(--k-font-mono, monospace);
        }

        /* ── Status indicator (dot) ── */
        .status-indicator {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .indicator-pass {
          background: #34d399;
          box-shadow: 0 0 6px rgba(52, 211, 153, 0.4);
        }
        .indicator-warn {
          background: #fbbf24;
          box-shadow: 0 0 6px rgba(251, 191, 36, 0.4);
        }
        .indicator-fail {
          background: #fb7185;
          box-shadow: 0 0 6px rgba(251, 113, 133, 0.4);
        }

        /* ── Badge ── */
        .service-badge {
          font-size: 12px;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: var(--k-radius-pill, 9999px);
          white-space: nowrap;
        }
        .badge-pass {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
        }
        .badge-warn {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
        }
        .badge-fail {
          background: rgba(244, 63, 94, 0.12);
          color: #fb7185;
        }

        /* ── Info cards ── */
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }
        .info-card {
          background: var(--k-glass-thin, rgba(255,255,255,0.05));
          border: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-radius: var(--k-radius-lg, 14px);
          padding: 16px 20px;
        }
        .info-card-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--k-text-tertiary, rgba(255,255,255,0.4));
          margin: 0 0 6px;
        }
        .info-card-value {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        /* ── Footer ── */
        .status-footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid var(--k-border-subtle, rgba(255,255,255,0.06));
        }
        .status-footer p {
          font-size: 13px;
          color: var(--k-text-tertiary, rgba(255,255,255,0.4));
          margin: 0 0 16px;
        }
        .status-footer a {
          color: var(--k-accent-indigo, #6366f1);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color var(--k-transition-fast, 150ms);
        }
        .status-footer a:hover {
          color: var(--k-accent-cyan, #06b6d4);
        }

        /* ── Loading / Error states ── */
        .status-loading,
        .status-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          gap: 16px;
        }
        .status-loading p,
        .status-error p {
          color: var(--k-text-secondary, rgba(255,255,255,0.6));
          font-size: 14px;
          margin: 0;
        }
        .status-error p {
          color: #fb7185;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--k-border-subtle, rgba(255,255,255,0.06));
          border-top-color: var(--k-accent-indigo, #6366f1);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .retry-btn {
          background: var(--k-glass-regular, rgba(255,255,255,0.08));
          border: 1px solid var(--k-border-default, rgba(255,255,255,0.10));
          border-radius: var(--k-radius-md, 10px);
          color: var(--k-text-primary, rgba(255,255,255,0.95));
          padding: 8px 20px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background var(--k-transition-fast, 150ms);
        }
        .retry-btn:hover {
          background: var(--k-glass-thick, rgba(255,255,255,0.12));
        }

        .refresh-note {
          font-size: 12px;
          color: var(--k-text-muted, rgba(255,255,255,0.25));
          text-align: center;
          margin-top: 8px;
        }

        @media (max-width: 640px) {
          .status-container { padding: 32px 16px 48px; }
          .service-row { flex-direction: column; align-items: flex-start; gap: 8px; }
          .service-row-right { align-self: flex-end; }
          .info-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="status-container">
        {/* Header */}
        <header className="status-header">
          <h1>Statut de la plateforme</h1>
          <p>Surveillance en temps r&eacute;el des services Attitudes.vip</p>
        </header>

        {/* Loading state */}
        {loading && (
          <div className="status-loading" role="status" aria-label="Chargement">
            <div className="spinner" />
            <p>V&eacute;rification des services&hellip;</p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="status-error" role="alert">
            <p>Erreur : {error}</p>
            <button
              className="retry-btn"
              onClick={() => {
                setLoading(true);
                fetchHealth();
              }}
            >
              R&eacute;essayer
            </button>
          </div>
        )}

        {/* Success state */}
        {!loading && health && (
          <>
            {/* Overall banner */}
            {overall && (
              <div
                className={`status-banner ${overall.className}`}
                role="status"
                aria-live="polite"
              >
                <span className="banner-dot" />
                {overall.text}
              </div>
            )}

            {/* Info grid */}
            <div className="info-grid">
              {health.uptime !== undefined && (
                <div className="info-card">
                  <p className="info-card-label">Uptime</p>
                  <p className="info-card-value">{formatUptime(health.uptime)}</p>
                </div>
              )}
              <div className="info-card">
                <p className="info-card-label">Version</p>
                <p className="info-card-value">{health.version}</p>
              </div>
              <div className="info-card">
                <p className="info-card-label">Services</p>
                <p className="info-card-value">
                  {health.checks.filter((c) => c.status === 'pass').length}/
                  {health.checks.length}
                </p>
              </div>
            </div>

            {/* Services list */}
            <div className="services-card">
              <div className="services-card-header">Services</div>
              {health.checks.map((check) => (
                <ServiceRow key={check.name} check={check} />
              ))}
            </div>

            {/* Last checked note + auto-refresh */}
            {lastChecked && (
              <p className="refresh-note">
                Derni&egrave;re v&eacute;rification : {formatTimestamp(lastChecked)}{' '}
                &middot; Actualisation automatique toutes les 60 secondes
              </p>
            )}
          </>
        )}

        {/* Footer */}
        <footer className="status-footer">
          <p>&copy; {new Date().getFullYear()} Attitudes VIP. Tous droits r&eacute;serv&eacute;s.</p>
          <Link href="/">Retour au site</Link>
        </footer>
      </div>
    </div>
  );
}
