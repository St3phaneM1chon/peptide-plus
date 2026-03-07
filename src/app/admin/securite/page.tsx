'use client';

import { useState, useCallback } from 'react';
import {
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/admin/Button';
import { StatCard } from '@/components/admin/StatCard';
import { useI18n } from '@/i18n/client';
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

// ── Grade colors ──────────────────────────────────────────────

const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  'A+': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'A':  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'B':  { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  'C':  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  'D':  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  'F':  { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

// ── Main Component ────────────────────────────────────────────

export default function SecurityAuditPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security/headers-audit');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to run security audit');
        return;
      }
      const json = await res.json();
      setReport(json.data);
    } catch {
      toast.error(t('common.networkError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const formatTimestamp = (ts: string) =>
    new Date(ts).toLocaleString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
      case 'warn':
        return <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />;
      default:
        return <Info className="w-5 h-5 text-slate-400 flex-shrink-0" />;
    }
  };

  const statusBg = (status: string) => {
    switch (status) {
      case 'pass': return 'bg-emerald-50 border-emerald-100';
      case 'fail': return 'bg-red-50 border-red-100';
      case 'warn': return 'bg-amber-50 border-amber-100';
      default: return 'bg-slate-50 border-slate-100';
    }
  };

  const g = report ? (gradeColors[report.grade] || gradeColors['F']) : gradeColors['F'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Security Headers Audit</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Check HTTP security headers configuration against best practices
          </p>
        </div>
        <Button
          variant="primary"
          icon={RefreshCw}
          size="sm"
          onClick={fetchAudit}
          loading={loading}
        >
          Run Audit
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48" role="status">
          <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        </div>
      )}

      {/* No report yet */}
      {!loading && !report && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No audit run yet</h3>
          <p className="text-sm text-slate-500 mb-4">
            Click &quot;Run Audit&quot; to check your security headers configuration.
          </p>
        </div>
      )}

      {/* Report */}
      {!loading && report && (
        <>
          {/* Grade + Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Grade card */}
            <div className={`${g.bg} border ${g.border} rounded-lg p-5 flex flex-col items-center justify-center`}>
              <p className={`text-4xl font-bold ${g.text}`}>{report.grade}</p>
              <p className="text-sm font-medium text-slate-500 mt-1">Grade</p>
            </div>
            <StatCard label="Total Checks" value={report.totalChecks} icon={Shield} />
            <StatCard label="Passed" value={report.passed} icon={ShieldCheck} />
            <StatCard label="Warnings" value={report.warnings} icon={ShieldAlert} />
            <StatCard label="Failed" value={report.failed} icon={ShieldX} />
          </div>

          {/* Meta info */}
          <div className="text-sm text-slate-500 flex flex-wrap gap-4">
            <span>Audited: <span className="font-medium text-slate-700">{formatTimestamp(report.timestamp)}</span></span>
            <span>URL: <span className="font-medium text-slate-700">{report.url}</span></span>
          </div>

          {/* Score bar */}
          {report.totalChecks > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-900 mb-3">Overall Score</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.round((report.passed / report.totalChecks) * 100)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold text-slate-700 w-16 text-right">
                  {Math.round((report.passed / report.totalChecks) * 100)}%
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {report.passed} of {report.totalChecks} headers passed validation
              </p>
            </div>
          )}

          {/* Checks list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900">Header Checks</h3>
              <p className="text-sm text-slate-500">Detailed results for each security header</p>
            </div>
            <div className="divide-y divide-slate-100">
              {report.checks.map((check, idx) => (
                <div key={idx} className={`px-6 py-4 ${statusBg(check.status)} border-l-4`}>
                  <div className="flex items-start gap-3">
                    {statusIcon(check.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-slate-900">
                          {check.header}
                        </p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase ${
                          check.status === 'pass'
                            ? 'bg-emerald-100 text-emerald-700'
                            : check.status === 'fail'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}>
                          {check.status}
                        </span>
                      </div>
                      {check.value && (
                        <p className="text-xs text-slate-600 mt-1 font-mono break-all">
                          {check.value}
                        </p>
                      )}
                      {check.recommendation && (
                        <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                          {check.recommendation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
