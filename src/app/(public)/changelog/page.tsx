export const revalidate = 300;

import { Metadata } from 'next';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Attitudes VIP';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://attitudes.vip';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Journal des mises à jour - ${siteName}`,
    description: `Suivez les dernières améliorations, nouvelles fonctionnalités et corrections de la Suite Koraline par ${siteName}.`,
    alternates: { canonical: `${appUrl}/changelog` },
  };
}

/* ---------------------------------------------------------------------------
   Type definitions
   --------------------------------------------------------------------------- */

type ChangeCategory = 'feature' | 'improvement' | 'fix' | 'security';

interface ChangeEntry {
  category: ChangeCategory;
  text: string;
}

interface Release {
  version: string;
  date: string;
  title: string;
  summary?: string;
  changes: ChangeEntry[];
}

/* ---------------------------------------------------------------------------
   Category config
   --------------------------------------------------------------------------- */

const CATEGORY_META: Record<ChangeCategory, { label: string; emoji: string; color: string; bg: string }> = {
  feature:     { label: 'Nouvelle fonctionnalité', emoji: '🚀', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.15)' },
  improvement: { label: 'Amélioration',            emoji: '🔧', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
  fix:         { label: 'Correction',              emoji: '🐛', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
  security:    { label: 'Sécurité',                emoji: '🔒', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
};

/* ---------------------------------------------------------------------------
   Release data
   --------------------------------------------------------------------------- */

const RELEASES: Release[] = [
  {
    version: 'v2.4.0',
    date: '2026-03-28',
    title: 'Rebrand complet Attitudes VIP',
    summary:
      'Refonte majeure de l\'identité visuelle. La plateforme adopte officiellement la marque Attitudes VIP avec une nouvelle landing page, un design system unifié et 94 fichiers rebrandés.',
    changes: [
      { category: 'feature',     text: 'Nouvelle identité de marque Attitudes VIP appliquée sur l\'ensemble de la plateforme' },
      { category: 'feature',     text: 'Landing page dynamique avec hero animé, sections modules et témoignages' },
      { category: 'improvement', text: '94 fichiers rebrandés pour cohérence visuelle complète' },
      { category: 'improvement', text: 'Design tokens Koraline Dark Glass Premium unifiés' },
      { category: 'improvement', text: 'Nouveau footer et navigation avec branding Attitudes VIP' },
    ],
  },
  {
    version: 'v2.3.0',
    date: '2026-03-27',
    title: 'Plateforme SaaS complète',
    summary:
      'Lancement de la suite SaaS multi-tenant avec gestion complète des clients, inscription self-service, LMS intégré et analytics de revenus.',
    changes: [
      { category: 'feature',     text: 'Gestion des clients : création, facturation Stripe, health score et tableau de bord' },
      { category: 'feature',     text: 'Inscription self-service avec checkout Stripe intégré' },
      { category: 'feature',     text: 'LMS Aptitudes : catalogue de cours, checkout, quiz interactif avec moteur FSRS' },
      { category: 'feature',     text: 'Revenue analytics : MRR, churn rate, répartition par modules' },
      { category: 'feature',     text: 'Seat enforcement : contrôle du nombre de licences par tenant' },
      { category: 'feature',     text: 'Onboarding automatique avec séquence emails J+1, J+3, J+7, J+14' },
      { category: 'improvement', text: 'Checkout hybride : sélection par plan ou à la carte' },
    ],
  },
  {
    version: 'v2.2.0',
    date: '2026-03-27',
    title: 'Sécurité et performance',
    summary:
      'Audit de sécurité complet avec correction de 7 failles critiques, optimisation mémoire et tests E2E exhaustifs sur 37 pages.',
    changes: [
      { category: 'security',    text: '7 failles de sécurité P0 corrigées (XSS, CSRF, injection, auth bypass)' },
      { category: 'security',    text: 'CSP renforcée avec support Cloudflare Turnstile' },
      { category: 'security',    text: 'Validation Zod systématique sur toutes les routes API sensibles' },
      { category: 'improvement', text: 'Optimisation mémoire avec seuil 3 GB et garbage collection proactif' },
      { category: 'improvement', text: '37 pages testées en E2E avec Playwright (navigation, formulaires, responsive)' },
      { category: 'fix',         text: 'Correction des fuites mémoire sur les WebSocket longue durée' },
    ],
  },
  {
    version: 'v2.1.0',
    date: '2026-03-24',
    title: 'LMS Aptitudes et Aurelia pan-canadienne',
    summary:
      'Module de formation complet avec 19 pages admin, 12 habiletés pédagogiques Aurelia et support provincial canadien.',
    changes: [
      { category: 'feature',     text: '19 pages d\'administration Formation (cours, leçons, quiz, étudiants, rapports)' },
      { category: 'feature',     text: '12 habiletés pédagogiques Aurelia : tuteur socratique, anti-hallucination, STT/TTS' },
      { category: 'feature',     text: '13 composants interactifs : QuizPlayer, VideoPlayer, FlashcardDeck, ConceptMap, etc.' },
      { category: 'feature',     text: 'Aurelia pan-canadienne : données provinciales (13 provinces), sélecteur de province, glossaire PQAP' },
      { category: 'feature',     text: 'Pages étudiant : catalogue, leçons enrichies, review queue, mastery, achievements (30 badges)' },
      { category: 'improvement', text: 'Seed data : 1 cours AMF complet + 33 entrées knowledge base' },
    ],
  },
  {
    version: 'v2.0.0',
    date: '2026-03-22',
    title: 'Multi-tenant et autonomie client',
    summary:
      'Architecture multi-tenant complète avec pipeline d\'autonomie client en 6 phases, de l\'inscription au domaine personnalisé.',
    changes: [
      { category: 'feature',     text: 'Architecture multi-tenant complète : 310 tables, auth JWT, super-admin' },
      { category: 'feature',     text: 'Pipeline autonomie client : catalogue Stripe, signup hybride, marketplace modules' },
      { category: 'feature',     text: 'Gestion des licences per-seat avec dashboard abonnement et billing portal' },
      { category: 'feature',     text: 'Domaine custom : vérification DNS CNAME automatique' },
      { category: 'feature',     text: 'Setup assisté vendeur avec impersonation super-admin' },
      { category: 'security',    text: 'Isolation tenant sur toutes les queries Prisma' },
      { category: 'improvement', text: 'Migration Railway : HTTPS natif, Redis add-on, démarrage rapide (~30s)' },
    ],
  },
];

/* ---------------------------------------------------------------------------
   Helpers
   --------------------------------------------------------------------------- */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/* ---------------------------------------------------------------------------
   Component
   --------------------------------------------------------------------------- */

export default function ChangelogPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--k-bg-base, #0a0a0f)' }}>
      {/* ── Hero ── */}
      <section
        className="relative py-20 text-center overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(6,182,212,0.08) 50%, rgba(16,185,129,0.06) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Decorative grid dots */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
          aria-hidden="true"
        />

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Version pill */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-6"
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: '#6366f1' }}
            />
            {RELEASES[0]?.version}
          </div>

          <h1
            className="font-heading text-4xl md:text-5xl font-bold mb-4"
            style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
          >
            Journal des mises à jour
          </h1>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{
              color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
              lineHeight: '1.8',
            }}
          >
            Suivez les dernières améliorations de la Suite Koraline
          </p>
        </div>
      </section>

      {/* ── Legend ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div
          className="flex flex-wrap justify-center gap-4 px-6 py-4 rounded-2xl"
          style={{
            background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {(Object.keys(CATEGORY_META) as ChangeCategory[]).map((key) => {
            const meta = CATEGORY_META[key];
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 text-xs font-medium"
                style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="relative">
          {/* Vertical line */}
          <div
            className="absolute left-[23px] md:left-[27px] top-0 bottom-0 w-px hidden sm:block"
            style={{ background: 'linear-gradient(180deg, rgba(99,102,241,0.4) 0%, rgba(99,102,241,0.05) 100%)' }}
            aria-hidden="true"
          />

          <div className="space-y-12">
            {RELEASES.map((release, idx) => (
              <article key={release.version} className="relative">
                {/* Timeline dot */}
                <div
                  className="absolute left-[16px] md:left-[20px] top-[28px] w-[15px] h-[15px] rounded-full border-2 hidden sm:block"
                  style={{
                    background: idx === 0 ? '#6366f1' : 'var(--k-bg-surface, #111116)',
                    borderColor: idx === 0 ? '#818cf8' : 'rgba(99, 102, 241, 0.3)',
                    boxShadow: idx === 0 ? '0 0 12px rgba(99, 102, 241, 0.5)' : 'none',
                  }}
                  aria-hidden="true"
                />

                {/* Card */}
                <div className="sm:ml-14">
                  <div
                    className="rounded-2xl p-6 md:p-8 transition-all"
                    style={{
                      background: idx === 0
                        ? 'var(--k-glass-regular, rgba(255,255,255,0.08))'
                        : 'var(--k-glass-thin, rgba(255,255,255,0.05))',
                      border: idx === 0
                        ? '1px solid rgba(99, 102, 241, 0.20)'
                        : '1px solid rgba(255,255,255,0.06)',
                      backdropFilter: 'blur(20px)',
                      boxShadow: idx === 0 ? '0 0 40px rgba(99, 102, 241, 0.08)' : 'none',
                    }}
                  >
                    {/* Header row */}
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      {/* Version badge */}
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold tracking-wider"
                        style={{
                          background: idx === 0
                            ? 'linear-gradient(135deg, #6366f1, #06b6d4)'
                            : 'rgba(99, 102, 241, 0.12)',
                          color: idx === 0 ? '#fff' : '#a5b4fc',
                          border: idx === 0
                            ? 'none'
                            : '1px solid rgba(99, 102, 241, 0.20)',
                        }}
                      >
                        {release.version}
                      </span>

                      {/* Date */}
                      <time
                        dateTime={release.date}
                        className="text-xs font-medium"
                        style={{ color: 'var(--k-text-tertiary, rgba(255,255,255,0.40))' }}
                      >
                        {formatDate(release.date)}
                      </time>

                      {/* "Latest" badge for first entry */}
                      {idx === 0 && (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.25)',
                          }}
                        >
                          Dernière version
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h2
                      className="text-xl md:text-2xl font-bold mb-2"
                      style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
                    >
                      {release.title}
                    </h2>

                    {/* Summary */}
                    {release.summary && (
                      <p
                        className="text-sm mb-6"
                        style={{
                          color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
                          lineHeight: '1.7',
                        }}
                      >
                        {release.summary}
                      </p>
                    )}

                    {/* Change list */}
                    <ul className="space-y-3">
                      {release.changes.map((change, ci) => {
                        const meta = CATEGORY_META[change.category];
                        return (
                          <li key={ci} className="flex items-start gap-3">
                            {/* Category badge */}
                            <span
                              className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm mt-0.5"
                              style={{ background: meta.bg }}
                              title={meta.label}
                              aria-label={meta.label}
                            >
                              {meta.emoji}
                            </span>

                            <span
                              className="text-sm"
                              style={{
                                color: 'var(--k-text-primary, rgba(255,255,255,0.90))',
                                lineHeight: '1.6',
                              }}
                            >
                              {change.text}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* ── Footer note ── */}
        <div
          className="mt-16 text-center rounded-2xl p-8"
          style={{
            background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <p
            className="text-sm mb-2"
            style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
          >
            Vous avez une suggestion ou rencontrez un problème ?
          </p>
          <a
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.25)',
            }}
          >
            Contactez-nous
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
      </div>
    </div>
  );
}
