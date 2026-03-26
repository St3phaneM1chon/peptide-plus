'use client';

/**
 * Assisted Setup Wizard — For Attitudes VIP employees/sellers
 * URL: /admin/platform/assisted-setup
 *
 * Create a tenant on behalf of a client (phone sales, support).
 * Super-admin only.
 */

import { useState } from 'react';
import { KORALINE_PLANS, KORALINE_MODULES, type KoralinePlan, type KoralineModule } from '@/lib/stripe-constants';

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

const MODULE_ICONS: Record<string, string> = {
  crm_advanced: '🎯', marketplace_starter: '🏪', marketplace_pro: '🏬',
  marketplace_enterprise: '🏢', chat: '💬', email_marketing: '📧',
  loyalty: '⭐', subscriptions: '🔄', ambassadors: '🤝',
  monitoring: '📊', accounting_advanced: '📋',
};

export default function AssistedSetupPage() {
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [client, setClient] = useState({ name: '', email: '', phone: '', slug: '' });
  const [plan, setPlan] = useState<string>('pro');
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [branding, setBranding] = useState({ primaryColor: '#0066CC', secondaryColor: '#003366' });
  const [sendEmail, setSendEmail] = useState(true);

  const plans = Object.entries(KORALINE_PLANS) as [KoralinePlan, typeof KORALINE_PLANS[KoralinePlan]][];
  const modules = Object.entries(KORALINE_MODULES) as [KoralineModule, typeof KORALINE_MODULES[KoralineModule]][];

  const toggleModule = (key: string) => {
    setSelectedModules(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    );
  };

  const calculateTotal = () => {
    let total = plan !== 'alacarte' ? KORALINE_PLANS[plan as KoralinePlan]?.monthlyPrice || 0 : 0;
    for (const modKey of selectedModules) {
      total += KORALINE_MODULES[modKey as KoralineModule]?.monthlyPrice || 0;
    }
    return total;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/platform/assisted-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: client.slug,
          name: client.name,
          email: client.email,
          phone: client.phone,
          plan,
          modules: selectedModules,
          branding,
          sendWelcomeEmail: sendEmail,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setStep(6);
      } else {
        setError(data.error || 'Erreur lors de la création');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Setup assisté client</h1>
        <p className="text-gray-500 mt-1">Créez un compte client complet en quelques étapes.</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {[1, 2, 3, 4, 5].map(s => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-blue-600' : 'bg-gray-200'}`}
          />
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">{error}</div>
      )}

      {/* Step 1: Client info */}
      {step === 1 && (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">1. Informations client</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l&apos;entreprise</label>
              <input type="text" value={client.name} onChange={e => setClient({ ...client, name: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Courriel du propriétaire</label>
              <input type="email" value={client.email} onChange={e => setClient({ ...client, email: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone (optionnel)</label>
              <input type="tel" value={client.phone} onChange={e => setClient({ ...client, phone: e.target.value })}
                className="w-full px-4 py-2.5 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug (identifiant unique)</label>
              <div className="flex">
                <input type="text" value={client.slug}
                  onChange={e => setClient({ ...client, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="flex-1 px-4 py-2.5 border rounded-l-lg" required minLength={3} maxLength={30} />
                <span className="px-3 py-2.5 bg-gray-100 border border-l-0 rounded-r-lg text-sm text-gray-500">.koraline.app</span>
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={!client.name || !client.email || !client.slug}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              Continuer
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Plan */}
      {step === 2 && (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">2. Sélection du plan</h2>
          <div className="space-y-3 mb-4">
            {plans.map(([key, p]) => (
              <button key={key} onClick={() => setPlan(key)}
                className={`w-full text-left p-4 rounded-xl border-2 ${
                  plan === key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-gray-500 ml-2">{p.description}</span>
                  </div>
                  <span className="font-bold">{(p.monthlyPrice / 100).toFixed(0)} $/mois</span>
                </div>
              </button>
            ))}
            <button onClick={() => setPlan('alacarte')}
              className={`w-full text-left p-4 rounded-xl border-2 ${
                plan === 'alacarte' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">À la carte</span>
                  <span className="text-sm text-gray-500 ml-2">Socle gratuit + modules individuels</span>
                </div>
                <span className="font-bold">0 $ + modules</span>
              </div>
            </button>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 border rounded-lg hover:bg-gray-50">Retour</button>
            <button onClick={() => setStep(3)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Continuer</button>
          </div>
        </div>
      )}

      {/* Step 3: Modules */}
      {step === 3 && (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">3. Modules optionnels</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {modules.map(([key, mod]) => (
              <button key={key} onClick={() => toggleModule(key)}
                className={`text-left p-3 rounded-lg border-2 text-sm ${
                  selectedModules.includes(key) ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <span className="mr-2">{MODULE_ICONS[key] || '📦'}</span>
                <span className="font-medium">{mod.name}</span>
                <span className="block text-gray-500 mt-1">{(mod.monthlyPrice / 100).toFixed(0)} $/mois</span>
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex-1 py-2.5 border rounded-lg hover:bg-gray-50">Retour</button>
            <button onClick={() => setStep(4)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Continuer</button>
          </div>
        </div>
      )}

      {/* Step 4: Branding */}
      {step === 4 && (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">4. Branding (optionnel)</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Couleur principale</label>
              <div className="flex gap-2">
                <input type="color" value={branding.primaryColor}
                  onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded border" />
                <input type="text" value={branding.primaryColor}
                  onChange={e => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Couleur secondaire</label>
              <div className="flex gap-2">
                <input type="color" value={branding.secondaryColor}
                  onChange={e => setBranding({ ...branding, secondaryColor: e.target.value })}
                  className="w-10 h-10 rounded border" />
                <input type="text" value={branding.secondaryColor}
                  onChange={e => setBranding({ ...branding, secondaryColor: e.target.value })}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm" />
              </div>
            </div>
          </div>
          <label className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
            <span className="text-sm text-gray-700">Envoyer un courriel de bienvenue au client</span>
          </label>
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="flex-1 py-2.5 border rounded-lg hover:bg-gray-50">Retour</button>
            <button onClick={() => setStep(5)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Réviser</button>
          </div>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-6">
          <h2 className="text-lg font-bold mb-4">5. Révision et confirmation</h2>
          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Client</span>
              <span className="font-medium">{client.name} ({client.email})</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Slug</span>
              <span className="font-medium">{client.slug}.koraline.app</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Plan</span>
              <span className="font-medium">
                {plan === 'alacarte' ? 'À la carte' : KORALINE_PLANS[plan as KoralinePlan]?.name}
              </span>
            </div>
            {selectedModules.length > 0 && (
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-500">Modules</span>
                <span className="font-medium">{selectedModules.map(m => KORALINE_MODULES[m as KoralineModule]?.name).join(', ')}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b">
              <span className="text-gray-500">Email bienvenue</span>
              <span className="font-medium">{sendEmail ? 'Oui' : 'Non'}</span>
            </div>
            <div className="flex justify-between py-2 text-lg">
              <span className="font-bold text-gray-900">Total mensuel</span>
              <span className="font-bold text-blue-600">{(calculateTotal() / 100).toFixed(2)} $ CAD/mois</span>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(4)} className="flex-1 py-2.5 border rounded-lg hover:bg-gray-50">Retour</button>
            <button onClick={handleSubmit} disabled={loading}
              className="flex-1 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50">
              {loading ? 'Création en cours...' : 'Confirmer et créer'}
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Success */}
      {step === 6 && result && (
        <div className="bg-[var(--k-glass-thin)] rounded-xl border p-6 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-3xl">&#10003;</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Tenant créé avec succès !</h2>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-sm space-y-2 mb-6">
            <p><strong>URL Admin :</strong> {(result.tenant as Record<string, string>)?.adminUrl}</p>
            <p><strong>Email :</strong> {(result.owner as Record<string, string>)?.email}</p>
            <p><strong>Mot de passe temporaire :</strong> <code className="bg-gray-200 px-2 py-0.5 rounded">{(result.owner as Record<string, string>)?.tempPassword}</code></p>
            <p className="text-amber-600 text-xs mt-2">
              Communiquez le mot de passe temporaire au client. Il pourra le changer dans ses paramètres.
            </p>
          </div>
          <button onClick={() => { setStep(1); setResult(null); setClient({ name: '', email: '', phone: '', slug: '' }); setSelectedModules([]); }}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Créer un autre client
          </button>
        </div>
      )}
    </div>
  );
}
