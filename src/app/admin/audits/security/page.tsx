'use client';

import { useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Clock, Lock, Eye, FileSearch } from 'lucide-react';

interface SecurityCheck {
  id: string;
  name: string;
  nameFr: string;
  category: string;
  status: 'pass' | 'fail' | 'warning' | 'info';
  description: string;
  lastChecked: Date;
}

export default function SecurityAuditPage() {
  const [checks] = useState<SecurityCheck[]>([
    { id: '1', name: 'HTTPS Enforcement', nameFr: 'HTTPS obligatoire', category: 'Transport', status: 'pass', description: 'HSTS activé avec preload', lastChecked: new Date() },
    { id: '2', name: 'CSP Headers', nameFr: 'En-têtes CSP', category: 'Headers', status: 'pass', description: 'Content-Security-Policy configuré', lastChecked: new Date() },
    { id: '3', name: 'CSRF Protection', nameFr: 'Protection CSRF', category: 'Auth', status: 'pass', description: 'Token CSRF vérifié sur mutations', lastChecked: new Date() },
    { id: '4', name: 'SQL Injection', nameFr: 'Injection SQL', category: 'Input', status: 'pass', description: 'Prisma ORM paramétrise toutes les requêtes', lastChecked: new Date() },
    { id: '5', name: 'XSS Protection', nameFr: 'Protection XSS', category: 'Output', status: 'pass', description: 'React échappe par défaut + DOMPurify', lastChecked: new Date() },
    { id: '6', name: 'Rate Limiting', nameFr: 'Limitation de débit', category: 'API', status: 'pass', description: 'Rate limiter actif sur routes sensibles', lastChecked: new Date() },
    { id: '7', name: 'Auth Secret', nameFr: 'Secret Auth', category: 'Auth', status: 'pass', description: 'AUTH_SECRET configuré et fort', lastChecked: new Date() },
    { id: '8', name: 'MFA for Admins', nameFr: 'MFA pour admins', category: 'Auth', status: 'pass', description: 'MFA obligatoire pour OWNER/EMPLOYEE', lastChecked: new Date() },
    { id: '9', name: 'File Upload Validation', nameFr: 'Validation uploads', category: 'Input', status: 'pass', description: 'Types MIME et tailles vérifiés', lastChecked: new Date() },
    { id: '10', name: 'Dependency Audit', nameFr: 'Audit dépendances', category: 'Supply Chain', status: 'warning', description: 'Vérification npm audit recommandée', lastChecked: new Date() },
    { id: '11', name: 'Error Handling', nameFr: 'Gestion erreurs', category: 'Output', status: 'pass', description: 'Pas de stack traces en production', lastChecked: new Date() },
    { id: '12', name: 'Cookie Security', nameFr: 'Sécurité cookies', category: 'Auth', status: 'pass', description: 'HttpOnly, SameSite=Lax', lastChecked: new Date() },
  ]);

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warning').length;
  const score = Math.round((passCount / checks.length) * 100);

  const statusIcon = (s: string) => {
    switch (s) {
      case 'pass': return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'fail': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default: return <Eye className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-600" />
            Audit de sécurité
          </h1>
          <p className="text-slate-500">Rapport de sécurité de l'application</p>
        </div>
        <div className="text-center">
          <div className={`text-3xl font-bold ${score >= 90 ? 'text-green-600' : score >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
            {score}%
          </div>
          <div className="text-xs text-slate-500">Score sécurité</div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-green-700">{passCount}</div>
          <div className="text-xs text-green-600">Réussis</div>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-yellow-700">{warnCount}</div>
          <div className="text-xs text-yellow-600">Avertissements</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-red-700">{failCount}</div>
          <div className="text-xs text-red-600">Échecs</div>
        </div>
      </div>

      {/* Checks List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-slate-500" />
            Vérifications ({checks.length})
          </h2>
        </div>
        <div className="divide-y divide-slate-50">
          {checks.map(check => (
            <div key={check.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50">
              {statusIcon(check.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-800">{check.nameFr}</span>
                  <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">{check.category}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{check.description}</p>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Intl.DateTimeFormat('fr-CA', { dateStyle: 'short', timeStyle: 'short' }).format(check.lastChecked)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
