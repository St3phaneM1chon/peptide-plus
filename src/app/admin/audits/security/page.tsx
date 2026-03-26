'use client';

import { useState, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ExternalLink,
  FileSearch,
} from 'lucide-react';
import { StatCard, Button } from '@/components/admin';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────

interface HeaderCheck {
  header: string;
  status: 'pass' | 'fail' | 'warn';
  value: string | null;
  recommendation: string | null;
}

interface AuditReport {
  timestamp: string;
  url: string;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  grade: string;
  checks: HeaderCheck[];
}

// ── Grade styling ─────────────────────────────────────────────

const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'A': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'B': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  'C': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'D': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'F': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function getGradeIcon(grade: string) {
  if (grade === 'A+' || grade === 'A') return ShieldCheck;
  if (grade === 'B' || grade === 'C') return ShieldAlert;
  return ShieldX;
}

function statusIcon(s: string) {
  switch (s) {
    case 'pass':
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    case 'fail':
      return <XCircle className="w-5 h-5 text-red-500" />;
    case 'warn':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    default:
      return null;
  }
}

function statusBadge(s: string) {
  switch (s) {
    case 'pass':
      return <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">OK</span>;
    case 'fail':
      return <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">Echec</span>;
    case 'warn':
      return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">Attention</span>;
    default:
      return null;
  }
}

// ── Main Component ────────────────────────────────────────────

export default function SecurityAuditPage() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/security/headers-audit');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setReport(json.data);
      toast.success('Audit de securite termine');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setError(msg);
      toast.error(`Echec de l'audit: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const gradeStyle = report ? (gradeColors[report.grade] || gradeColors['F']) : null;
  const GradeIcon = report ? getGradeIcon(report.grade) : Shield;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-600" />
            Audit de securite
          </h1>
          <p className="text-slate-500">
            Analyse les en-tetes HTTP de securite en temps reel via /api/admin/security/headers-audit
          </p>
        </div>
        <Button
          icon={loading ? Loader2 : RefreshCw}
          onClick={runAudit}
          disabled={loading}
          className={loading ? '[&_svg]:animate-spin' : ''}
        >
          {loading ? 'Analyse en cours...' : 'Lancer l\'audit'}
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 flex items-center gap-2">
          <XCircle className="w-5 h-5 flex-shrink-0" />
          <span>Erreur: {error}</span>
        </div>
      )}

      {/* Empty State (before first run) */}
      {!report && !loading && !error && (
        <div className="rounded-xl border-2 border-dashed border-[var(--k-border-subtle)] p-12 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-500">Aucun audit lance</h3>
          <p className="text-sm text-slate-400 mt-2">
            Cliquez sur &quot;Lancer l&apos;audit&quot; pour analyser les en-tetes de securite HTTP.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            L&apos;audit verifie HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy et plus.
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && !report && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-indigo-700 font-medium">Analyse en cours...</p>
          <p className="text-indigo-500 text-sm mt-1">Verification des en-tetes HTTP de securite</p>
        </div>
      )}

      {/* Results */}
      {report && (
        <>
          {/* Grade Card */}
          <div className={`rounded-xl ${gradeStyle?.bg} border ${gradeStyle?.border} p-6 flex items-center justify-between`}>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${gradeStyle?.bg}`}>
                <GradeIcon className={`w-10 h-10 ${gradeStyle?.text}`} />
              </div>
              <div>
                <div className={`text-4xl font-black ${gradeStyle?.text}`}>{report.grade}</div>
                <p className="text-sm text-slate-600 mt-1">
                  Score de securite des en-tetes HTTP
                </p>
              </div>
            </div>
            <div className="text-end">
              <p className="text-xs text-slate-500">
                {new Date(report.timestamp).toLocaleString('fr-CA')}
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 justify-end">
                <ExternalLink className="w-3 h-3" />
                {report.url}
              </p>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Reussis"
              value={report.passed}
              icon={CheckCircle}
              className="bg-green-50 border-green-200"
            />
            <StatCard
              label="Avertissements"
              value={report.warnings}
              icon={AlertTriangle}
              className={report.warnings > 0 ? 'bg-yellow-50 border-yellow-200' : ''}
            />
            <StatCard
              label="Echecs"
              value={report.failed}
              icon={XCircle}
              className={report.failed > 0 ? 'bg-red-50 border-red-200' : ''}
            />
          </div>

          {/* Checks List */}
          <div className="bg-[var(--k-glass-thin)] rounded-xl border border-[var(--k-border-subtle)]">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <FileSearch className="w-5 h-5 text-slate-500" />
                Verifications ({report.totalChecks})
              </h2>
            </div>
            <div className="divide-y divide-slate-50">
              {report.checks.map((check) => (
                <div key={check.header} className="px-6 py-4 hover:bg-white/5">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-0.5">
                      {statusIcon(check.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-slate-800">
                          {check.header}
                        </span>
                        {statusBadge(check.status)}
                      </div>
                      {check.value && (
                        <p className="text-xs text-slate-500 mt-1 font-mono truncate" title={check.value}>
                          {check.value}
                        </p>
                      )}
                      {check.recommendation && (
                        <p className="text-xs text-amber-600 mt-1.5 flex items-start gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          {check.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Re-run button */}
          <div className="flex justify-center">
            <Button variant="secondary" icon={RefreshCw} onClick={runAudit} disabled={loading}>
              Relancer l&apos;audit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
