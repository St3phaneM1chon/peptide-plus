'use client';

/**
 * Page d'inscription Koraline — Choisir un plan et creer un compte
 * URL: /signup?plan=essential|pro|enterprise
 *
 * Flow:
 *   - Essai gratuit (defaut): Choisir plan -> Remplir infos + mot de passe -> Onboarding
 *   - Paiement direct: Choisir plan -> Remplir infos -> Stripe Checkout -> Onboarding
 *
 * Supports:
 * - ?plan=essential|pro|enterprise -> pre-select plan, skip to info step
 * - ?cancelled=true -> show cancellation message from Stripe
 */

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KORALINE_PLANS, KORALINE_TRIAL_DAYS, type KoralinePlan } from '@/lib/stripe-attitudes';

function isValidPlan(plan: string | null): plan is KoralinePlan {
  return plan !== null && plan in KORALINE_PLANS;
}

function SignupContent() {
  const searchParams = useSearchParams();
  const planParam = searchParams.get('plan');
  const cancelled = searchParams.get('cancelled') === 'true';

  const initialPlan = isValidPlan(planParam) ? planParam : 'pro';
  // If plan is provided in the URL, skip directly to the info form
  const initialStep = isValidPlan(planParam) ? 'info' : 'plan';

  const [selectedPlan, setSelectedPlan] = useState<KoralinePlan>(initialPlan);
  const [step, setStep] = useState<'plan' | 'info'>(initialStep);
  const [form, setForm] = useState({ slug: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Show cancellation banner if redirected from Stripe
  const [showCancelBanner, setShowCancelBanner] = useState(cancelled);

  // Auto-generate slug from company name
  const generateSlug = useCallback((name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 30);
  }, []);

  // Check slug availability with debounce
  useEffect(() => {
    if (!form.slug || form.slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setCheckingSlug(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/platform/check-slug?slug=${encodeURIComponent(form.slug)}`);
        if (res.ok) {
          const data = await res.json();
          setSlugAvailable(data.available);
        } else {
          setSlugAvailable(null);
        }
      } catch {
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      setCheckingSlug(false);
    };
  }, [form.slug]);

  // Start free trial (default signup flow)
  const handleTrialSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caracteres.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/platform/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          slug: form.slug,
          name: form.name,
          email: form.email,
          password: form.password,
          trial: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Une erreur est survenue');
        return;
      }

      // Redirect to onboarding (trial flow — no Stripe)
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch {
      setError('Erreur de connexion. Veuillez reessayer.');
    } finally {
      setLoading(false);
    }
  };

  const trialDays = KORALINE_TRIAL_DAYS[selectedPlan];

  const plans = Object.entries(KORALINE_PLANS) as [KoralinePlan, typeof KORALINE_PLANS[KoralinePlan]][];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between">
          <Link href="/platform" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">K</div>
            <span className="text-xl font-bold text-gray-900">Kor@line</span>
            <span className="text-sm text-gray-400 ml-2">by Attitudes VIP</span>
          </Link>
          <Link
            href="/auth/signin"
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Vous avez un compte? Connexion
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-16">
        {/* Stripe cancel banner */}
        {showCancelBanner && (
          <div className="max-w-2xl mx-auto mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <span className="text-amber-500 text-lg mt-0.5">&#9888;</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Paiement annule</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Votre paiement a ete annule. Vous pouvez reessayer quand vous le souhaitez.
              </p>
            </div>
            <button
              onClick={() => setShowCancelBanner(false)}
              className="text-amber-400 hover:text-amber-600"
              aria-label="Fermer"
            >
              &#10005;
            </button>
          </div>
        )}

        {step === 'plan' ? (
          <>
            {/* Titre */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                Lancez votre boutique en ligne
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Tout ce dont vous avez besoin pour vendre en ligne. Commerce, CRM, comptabilite, marketing — tout inclus dans une seule plateforme.
              </p>
              <p className="mt-3 text-sm font-medium text-green-600">
                Essai gratuit de 14 jours — aucune carte de credit requise
              </p>
            </div>

            {/* Plans */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              {plans.map(([key, plan]) => {
                const isSelected = selectedPlan === key;
                const isPro = key === 'pro';
                const planTrialDays = KORALINE_TRIAL_DAYS[key];
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedPlan(key)}
                    className={`relative text-left p-6 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    {isPro && (
                      <span className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                        Populaire
                      </span>
                    )}
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        {planTrialDays}j gratuit
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900">
                        {(plan.monthlyPrice / 100).toFixed(0)}$
                      </span>
                      <span className="text-gray-500">/mois</span>
                      <span className="text-xs text-gray-400 ml-2">apres l&apos;essai</span>
                    </div>
                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-green-500 mt-0.5">&#10003;</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {isSelected && (
                      <div className="absolute top-4 right-4 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">&#10003;</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-center">
              <button
                onClick={() => setStep('info')}
                className="px-8 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors text-lg"
              >
                Essayer {KORALINE_PLANS[selectedPlan].name} gratuitement
              </button>
              <p className="text-sm text-gray-400 mt-3">
                Aucune carte de credit requise. Modules optionnels disponibles apres l&apos;inscription.
              </p>
            </div>
          </>
        ) : (
          <>
            {/* Formulaire info */}
            <div className="max-w-md mx-auto">
              <button
                onClick={() => setStep('plan')}
                className="text-sm text-gray-500 hover:text-gray-700 mb-6 flex items-center gap-1"
              >
                &#8592; Changer de plan
              </button>

              <div className="bg-white rounded-2xl border p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Creez votre compte</h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                    {KORALINE_PLANS[selectedPlan].name}
                  </span>
                </div>

                {/* Trial badge */}
                <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-green-800">
                        Essai gratuit {trialDays} jours
                      </span>
                      <span className="text-xs text-green-600 ml-2">
                        Aucune carte de credit requise
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      puis {(KORALINE_PLANS[selectedPlan].monthlyPrice / 100).toFixed(0)}$/mois
                    </span>
                  </div>
                </div>

                <form onSubmit={handleTrialSignup} className="space-y-4">
                  <div>
                    <label htmlFor="signup-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Nom de votre entreprise
                    </label>
                    <input
                      id="signup-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setForm(prev => ({
                          ...prev,
                          name,
                          // Auto-generate slug only if user hasn't manually edited it
                          slug: prev.slug === generateSlug(prev.name) || prev.slug === ''
                            ? generateSlug(name)
                            : prev.slug,
                        }));
                      }}
                      placeholder="Mon Entreprise Inc."
                      className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label htmlFor="signup-slug" className="block text-sm font-medium text-gray-700 mb-1">
                      Identifiant unique (slug)
                    </label>
                    <div className="flex items-center">
                      <input
                        id="signup-slug"
                        type="text"
                        value={form.slug}
                        onChange={(e) => setForm({
                          ...form,
                          slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                        })}
                        placeholder="mon-entreprise"
                        className={`w-full px-4 py-2.5 border rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                          slugAvailable === false ? 'border-red-300' : slugAvailable === true ? 'border-green-300' : ''
                        }`}
                        required
                        minLength={3}
                        maxLength={30}
                      />
                      <span className="px-3 py-2.5 bg-gray-100 border border-l-0 rounded-r-lg text-sm text-gray-500 whitespace-nowrap">
                        .koraline.app
                      </span>
                    </div>
                    {checkingSlug && form.slug.length >= 3 && (
                      <p className="mt-1 text-xs text-gray-400">Verification...</p>
                    )}
                    {!checkingSlug && slugAvailable === true && (
                      <p className="mt-1 text-xs text-green-600">&#10003; Disponible</p>
                    )}
                    {!checkingSlug && slugAvailable === false && (
                      <p className="mt-1 text-xs text-red-500">Ce slug est deja pris</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="signup-email" className="block text-sm font-medium text-gray-700 mb-1">
                      Votre courriel
                    </label>
                    <input
                      id="signup-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="vous@entreprise.com"
                      className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Ce courriel sera le login administrateur de votre boutique.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 mb-1">
                      Mot de passe
                    </label>
                    <input
                      id="signup-password"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Minimum 8 caracteres"
                      className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                      minLength={8}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || slugAvailable === false}
                    className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading
                      ? 'Creation de votre compte...'
                      : `Commencer mon essai gratuit de ${trialDays} jours`
                    }
                  </button>

                  <p className="text-xs text-gray-400 text-center">
                    Aucune carte de credit requise. Annulable a tout moment.
                  </p>
                </form>
              </div>

              {/* Trust signals */}
              <div className="flex items-center justify-center gap-6 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                  </svg>
                  SSL securise
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  {trialDays} jours gratuit
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v9.75" />
                  </svg>
                  Sans engagement
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SignupLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-4 text-gray-500 text-sm">Chargement...</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupLoading />}>
      <SignupContent />
    </Suspense>
  );
}
