'use client';

/**
 * Onboarding Wizard — Post-payment tenant configuration
 * URL: /onboarding?session_id=xxx&slug=xxx
 *
 * 5 steps:
 * 1. Password for the owner account (+ tenant provisioning)
 * 2. Branding (shop name, colors) -> persisted via /api/platform/onboarding
 * 3. Industry (template categories) -> persisted via /api/platform/onboarding
 * 4. First product (placeholder for now)
 * 5. Summary + redirect to admin
 */

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

type OnboardingStep = 1 | 2 | 3 | 4 | 5;

const INDUSTRIES = [
  { id: 'ecommerce', label: 'E-commerce generique', icon: '\uD83D\uDED2' },
  { id: 'health', label: 'Sante / Supplements', icon: '\uD83D\uDC8A' },
  { id: 'fashion', label: 'Mode / Vetements', icon: '\uD83D\uDC57' },
  { id: 'food', label: 'Alimentation / Restaurant', icon: '\uD83C\uDF7D\uFE0F' },
  { id: 'services', label: 'Services professionnels', icon: '\uD83D\uDCBC' },
  { id: 'beauty', label: 'Beaute / Cosmetiques', icon: '\u2728' },
  { id: 'education', label: 'Formation / Cours', icon: '\uD83D\uDCDA' },
  { id: 'telecom', label: 'Telecom / Services recurrents', icon: '\uD83D\uDCF1' },
  { id: 'custom', label: 'Personnalise (vierge)', icon: '\u2699\uFE0F' },
];

function OnboardingContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const slug = searchParams.get('slug');

  const [step, setStep] = useState<OnboardingStep>(1);
  const [provisioning, setProvisioning] = useState(false);
  const [provisioned, setProvisioned] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantInfo, setTenantInfo] = useState<{ domainKoraline: string; name: string } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [branding, setBranding] = useState({
    shopName: '',
    primaryColor: '#0066CC',
    secondaryColor: '#003366',
  });
  const [industry, setIndustry] = useState('ecommerce');

  // Noop effect to satisfy linter: don't auto-provision
  useEffect(() => {
    if (!sessionId || !slug || provisioned) return;
  }, [sessionId, slug, provisioned]);

  // Save a step to the onboarding API
  const saveStep = async (stepNum: number, data: Record<string, unknown>) => {
    if (!tenantId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/platform/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, step: stepNum, data }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Onboarding save failed:', errData);
      }
    } catch (err) {
      console.error('Onboarding save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleProvision = async () => {
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres');
      return;
    }

    setProvisioning(true);
    setError('');

    try {
      const res = await fetch('/api/platform/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, slug, password }),
      });

      const data = await res.json();

      if (!res.ok && !data.alreadyExists) {
        setError(data.error || 'Erreur lors de la creation du compte');
        return;
      }

      setProvisioned(true);
      setTenantId(data.tenant?.id || null);
      setTenantInfo({
        domainKoraline: data.tenant?.domainKoraline || `${slug}.koraline.app`,
        name: data.tenant?.name || slug || '',
      });
      setBranding(prev => ({ ...prev, shopName: data.tenant?.name || '' }));
      setStep(2);
    } catch {
      setError('Erreur de connexion');
    } finally {
      setProvisioning(false);
    }
  };

  const handleBrandingContinue = async () => {
    await saveStep(2, {
      shopName: branding.shopName,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
    });
    // Update local info with new name
    if (branding.shopName && tenantInfo) {
      setTenantInfo({ ...tenantInfo, name: branding.shopName });
    }
    setStep(3);
  };

  const handleIndustryContinue = async () => {
    await saveStep(3, { industry });
    setStep(4);
  };

  const handleFinish = async () => {
    await saveStep(5, {});
  };

  const stepTitles: Record<OnboardingStep, string> = {
    1: 'Creez votre mot de passe',
    2: 'Personnalisez votre boutique',
    3: 'Choisissez votre industrie',
    4: 'Ajoutez votre premier produit',
    5: 'Votre boutique est prete !',
  };

  if (!sessionId || !slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Session invalide</h1>
          <p className="text-gray-500 mb-4">Le lien d&apos;onboarding est expire ou invalide.</p>
          <a href="/signup" className="text-blue-600 hover:underline">Retour a l&apos;inscription</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Progress bar */}
      <div className="bg-white border-b">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-900">
              Etape {step} sur 5 — {stepTitles[step]}
            </span>
            <span className="text-sm text-gray-400">{Math.round((step / 5) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-12">
        {/* Step 1: Password */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{stepTitles[1]}</h2>
            <p className="text-gray-500 mb-6">Ce mot de passe protegera votre acces administrateur.</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="ob-password" className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input
                  id="ob-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 caracteres"
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  minLength={8}
                  autoFocus
                />
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <p className={password.length >= 8 ? 'text-green-600' : ''}>
                    {password.length >= 8 ? '\u2713' : '\u25CB'} 8 caracteres minimum
                  </p>
                  <p className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
                    {/[A-Z]/.test(password) ? '\u2713' : '\u25CB'} Une majuscule
                  </p>
                  <p className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
                    {/[a-z]/.test(password) ? '\u2713' : '\u25CB'} Une minuscule
                  </p>
                  <p className={/[0-9]/.test(password) ? 'text-green-600' : ''}>
                    {/[0-9]/.test(password) ? '\u2713' : '\u25CB'} Un chiffre
                  </p>
                </div>
              </div>
              <div>
                <label htmlFor="ob-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                <input
                  id="ob-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">Les mots de passe ne correspondent pas</p>
                )}
                {confirmPassword && password === confirmPassword && password.length >= 8 && (
                  <p className="mt-1 text-xs text-green-600">{'\u2713'} Mots de passe identiques</p>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
              )}

              <button
                onClick={handleProvision}
                disabled={provisioning || !password || !confirmPassword || password !== confirmPassword}
                className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {provisioning ? 'Creation de votre boutique...' : 'Creer mon compte'}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Branding */}
        {step === 2 && (
          <div className="bg-white rounded-2xl border p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{stepTitles[2]}</h2>
            <p className="text-gray-500 mb-6">Ces parametres seront visibles par vos clients.</p>

            <div className="space-y-4">
              <div>
                <label htmlFor="ob-shop" className="block text-sm font-medium text-gray-700 mb-1">Nom de la boutique</label>
                <input
                  id="ob-shop"
                  type="text"
                  value={branding.shopName}
                  onChange={(e) => setBranding({ ...branding, shopName: e.target.value })}
                  className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur principale</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={branding.primaryColor}
                      onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Couleur secondaire</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={branding.secondaryColor}
                      onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="mt-6 p-4 rounded-xl border" style={{ borderColor: branding.primaryColor }}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: branding.primaryColor }}
                  >
                    {branding.shopName?.charAt(0) || 'K'}
                  </div>
                  <span className="font-bold" style={{ color: branding.primaryColor }}>
                    {branding.shopName || 'Votre Boutique'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Apercu de votre branding</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleBrandingContinue}
                  disabled={saving}
                  className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Sauvegarde...' : 'Continuer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Industry */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{stepTitles[3]}</h2>
            <p className="text-gray-500 mb-6">
              On va pre-remplir vos categories et parametres selon votre industrie.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind.id}
                  onClick={() => setIndustry(ind.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    industry === ind.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{ind.icon}</span>
                  <span className="text-sm font-medium text-gray-900">{ind.label}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
              >
                Retour
              </button>
              <button
                onClick={handleIndustryContinue}
                disabled={saving}
                className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Sauvegarde...' : 'Continuer'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: First product (simplified) */}
        {step === 4 && (
          <div className="bg-white rounded-2xl border p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{stepTitles[4]}</h2>
            <p className="text-gray-500 mb-6">
              Vous pourrez ajouter tous vos produits plus tard dans l&apos;admin.
            </p>

            <div className="p-6 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center mb-6">
              <p className="text-gray-500 mb-2">Vous pourrez ajouter vos produits dans le tableau de bord</p>
              <p className="text-sm text-gray-400">Passez a la derniere etape pour terminer la configuration</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-3 border rounded-lg hover:bg-gray-50"
              >
                Retour
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
              >
                Passer cette etape
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Done */}
        {step === 5 && (
          <div className="bg-white rounded-2xl border p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-3xl">&#10003;</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{stepTitles[5]}</h2>
            <p className="text-gray-500 mb-6">
              Votre boutique <strong>{tenantInfo?.name}</strong> est configuree et prete a utiliser.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-gray-500 mb-2">Votre adresse :</p>
              <p className="font-mono text-blue-600 font-medium">
                {tenantInfo?.domainKoraline || `${slug}.koraline.app`}
              </p>
            </div>

            <div className="space-y-3">
              <a
                href="/auth/signin"
                onClick={() => { handleFinish(); }}
                className="block w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Se connecter a mon admin
              </a>
              <p className="text-xs text-gray-400">
                Connectez-vous avec votre courriel et mot de passe pour commencer.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-gray-400">
          Powered by Kor@line — Attitudes VIP
        </p>
      </footer>
    </div>
  );
}

function OnboardingLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-500 text-sm">Chargement...</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<OnboardingLoading />}>
      <OnboardingContent />
    </Suspense>
  );
}
