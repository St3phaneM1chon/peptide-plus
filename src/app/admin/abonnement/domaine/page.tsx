'use client';

/**
 * Custom Domain Configuration -- Tenant owner
 * URL: /admin/abonnement/domaine
 *
 * Flow: Register domain -> Add DNS TXT record -> Verify ownership -> Add CNAME -> Done
 */

import { useState, useEffect } from 'react';

interface DomainConfig {
  domainKoraline: string;
  domainCustom: string | null;
  domainVerified: boolean;
  verificationToken: string | null;
  cnameVerified: boolean;
  cnameTarget: string | null;
  txtVerified: boolean;
}

export default function DomainConfigPage() {
  const [config, setConfig] = useState<DomainConfig | null>(null);
  const [newDomain, setNewDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const showMessage = (text: string, type: 'success' | 'error' | 'info') => {
    setMessage(text);
    setMessageType(type);
  };

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/platform/domain');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
        setNewDomain(data.domainCustom || '');
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadConfig(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/platform/domain', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });
      const data = await res.json();
      if (res.ok) {
        showMessage('Domaine enregistré. Ajoutez les enregistrements DNS ci-dessous puis vérifiez.', 'info');
        await loadConfig();
      } else {
        showMessage(data.error || 'Erreur', 'error');
      }
    } catch {
      showMessage('Erreur de connexion', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setMessage('');
    try {
      const res = await fetch('/api/platform/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.verified) {
        showMessage(data.message || 'Domaine vérifié avec succès !', 'success');
        await loadConfig();
      } else {
        showMessage(data.message || 'Vérification échouée. Vérifiez vos DNS.', 'error');
      }
    } catch {
      showMessage('Erreur de vérification', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Retirer votre domaine personnalisé ?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/platform/domain', { method: 'DELETE' });
      if (res.ok) {
        setConfig(prev => prev ? { ...prev, domainCustom: null, domainVerified: false, verificationToken: null, cnameVerified: false, txtVerified: false } : prev);
        setNewDomain('');
        showMessage('Domaine personnalisé retiré', 'info');
      }
    } catch {
      showMessage('Erreur', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-48 bg-gray-200 rounded-xl" /></div>;
  }

  const domainKoraline = config?.domainKoraline || '';
  const hasCustomDomain = !!config?.domainCustom;
  const isVerified = config?.domainVerified || false;
  const cnameOk = config?.cnameVerified || false;

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <a href="/admin/abonnement" className="text-sm text-gray-500 hover:text-gray-700">
          &#8592; Retour &agrave; l&apos;abonnement
        </a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Domaine personnalis&eacute;</h1>
        <p className="text-gray-500 mt-1">Connectez votre propre nom de domaine &agrave; votre boutique Koraline.</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg mb-6 text-sm ${
          messageType === 'success'
            ? 'bg-green-50 text-green-700 border border-green-200'
            : messageType === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
        }`}>
          {message}
        </div>
      )}

      {/* Koraline subdomain (readonly) */}
      <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5 mb-6">
        <h3 className="font-semibold text-gray-900 mb-2">Sous-domaine Koraline</h3>
        <div className="flex items-center gap-2">
          <span className="font-mono text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg text-sm">
            {domainKoraline}
          </span>
          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Actif</span>
        </div>
        <p className="text-xs text-gray-400 mt-2">Ce sous-domaine est toujours disponible.</p>
      </div>

      {/* Custom domain */}
      <div className="bg-[var(--k-glass-thin)] rounded-xl border p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Domaine personnalis&eacute;</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Votre domaine</label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
              placeholder="boutique.monsite.com"
              className="w-full px-4 py-2.5 border rounded-lg"
              disabled={isVerified}
            />
          </div>

          {/* Status indicator */}
          {hasCustomDomain && (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                isVerified && cnameOk ? 'bg-green-500' :
                isVerified ? 'bg-yellow-500' :
                'bg-red-500'
              }`} />
              <span className="text-sm text-gray-600">
                {isVerified && cnameOk
                  ? 'Domaine vérifié et actif'
                  : isVerified
                    ? 'Propriété vérifiée — CNAME en attente'
                    : 'En attente de vérification DNS'}
              </span>
            </div>
          )}

          {/* DNS instructions — show when domain registered but not yet verified */}
          {hasCustomDomain && !isVerified && config?.verificationToken && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-4">
              <p className="font-medium text-gray-900">
                &Eacute;tape 1 : V&eacute;rifiez la propri&eacute;t&eacute; du domaine
              </p>
              <p className="text-gray-600">
                Ajoutez un enregistrement <strong>TXT</strong> chez votre registraire DNS :
              </p>
              <div className="bg-[var(--k-glass-thin)] border rounded-lg p-3 font-mono text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-gray-400">Type</span>
                    <p className="font-bold">TXT</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Nom</span>
                    <p className="font-bold break-all">_attitudes-verify.{config.domainCustom}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Valeur</span>
                    <p className="font-bold break-all">{config.verificationToken}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {verifying ? 'V\u00e9rification en cours...' : 'V\u00e9rifier la propri\u00e9t\u00e9'}
              </button>
            </div>
          )}

          {/* CNAME instructions — show after ownership verified */}
          {hasCustomDomain && isVerified && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">&#10003;</span>
                <span className="font-medium text-green-700">Propri&eacute;t&eacute; v&eacute;rifi&eacute;e</span>
              </div>
              <p className="font-medium text-gray-900">
                &Eacute;tape 2 : Configurez le CNAME
              </p>
              <p className="text-gray-600">
                Ajoutez un enregistrement <strong>CNAME</strong> pour pointer vers votre boutique :
              </p>
              <div className="bg-[var(--k-glass-thin)] border rounded-lg p-3 font-mono text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-gray-400">Type</span>
                    <p className="font-bold">CNAME</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Nom</span>
                    <p className="font-bold">{config?.domainCustom?.split('.')[0]}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Cible</span>
                    <p className="font-bold text-blue-600">{domainKoraline}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${cnameOk ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-gray-500">
                  {cnameOk ? 'CNAME d\u00e9tect\u00e9 — domaine actif' : 'CNAME non d\u00e9tect\u00e9 — la propagation peut prendre jusqu\u0027\u00e0 48h'}
                </span>
              </div>
              {!cnameOk && (
                <button
                  onClick={loadConfig}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Rafra&icirc;chir le statut DNS
                </button>
              )}
            </div>
          )}

          <p className="text-xs text-gray-400">
            La propagation DNS peut prendre jusqu&apos;&agrave; 48h.
          </p>

          <div className="flex gap-3">
            {!isVerified && (
              <button
                onClick={handleSave}
                disabled={saving || !newDomain}
                className="flex-1 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Sauvegarde...' : hasCustomDomain ? 'Mettre \u00e0 jour' : 'Enregistrer'}
              </button>
            )}
            {hasCustomDomain && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="py-2.5 px-4 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                Retirer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
