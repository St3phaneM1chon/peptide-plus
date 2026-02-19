/**
 * PAGE PLAN DU SITE
 */

import Link from 'next/link';

export const metadata = {
  title: 'Plan du site | Formations Pro',
  description: 'Navigation complète de notre site web.',
};

const siteStructure = [
  {
    section: 'Principal',
    links: [
      { title: 'Accueil', href: '/' },
      { title: 'Catalogue des formations', href: '/catalogue' },
      { title: 'Tarifs', href: '/tarifs' },
      { title: 'Contact', href: '/contact' },
    ],
  },
  {
    section: 'À propos',
    links: [
      { title: 'Qui sommes-nous', href: '/a-propos' },
      { title: 'Notre mission', href: '/a-propos/mission' },
      { title: 'Notre équipe', href: '/a-propos/equipe' },
      { title: 'Notre histoire', href: '/a-propos/histoire' },
      { title: 'Nos valeurs', href: '/a-propos/valeurs' },
      { title: 'Nos engagements', href: '/a-propos/engagements' },
    ],
  },
  {
    section: 'Solutions',
    links: [
      { title: 'Toutes les solutions', href: '/solutions' },
      { title: 'Pour les entreprises', href: '/solutions/entreprises' },
      { title: 'Pour les particuliers', href: '/solutions/particuliers' },
      { title: 'Pour les partenaires', href: '/solutions/partenaires' },
      { title: 'Cas d\'usage', href: '/solutions/cas-usage' },
    ],
  },
  {
    section: 'Clients',
    links: [
      { title: 'Nos clients', href: '/clients' },
      { title: 'Témoignages', href: '/clients/temoignages' },
      { title: 'Études de cas', href: '/clients/etudes-de-cas' },
      { title: 'Références', href: '/clients/references' },
    ],
  },
  {
    section: 'Ressources',
    links: [
      { title: 'Blog', href: '/blog' },
      { title: 'Actualités', href: '/actualites' },
      { title: 'FAQ', href: '/faq' },
      { title: 'Centre d\'aide', href: '/aide' },
    ],
  },
  {
    section: 'Entreprise',
    links: [
      { title: 'Carrières', href: '/carrieres' },
      { title: 'Demander une démo', href: '/demo' },
      { title: 'Sécurité', href: '/securite' },
      { title: 'Accessibilité', href: '/accessibilite' },
    ],
  },
  {
    section: 'Légal',
    links: [
      { title: 'Conditions d\'utilisation', href: '/mentions-legales/conditions' },
      { title: 'Politique de confidentialité', href: '/mentions-legales/confidentialite' },
      { title: 'Politique de cookies', href: '/mentions-legales/cookies' },
    ],
  },
  {
    section: 'Compte',
    links: [
      { title: 'Connexion', href: '/auth/signin' },
      { title: 'Inscription', href: '/auth/signup' },
      { title: 'Mot de passe oublié', href: '/auth/forgot-password' },
    ],
  },
];

export default function SitemapPage() {
  return (
    <div style={{ backgroundColor: 'var(--gray-100)', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>
          Plan du site
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Navigation complète de notre plateforme
        </p>
      </section>

      {/* Content */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '32px',
            }}
          >
            {siteStructure.map((section, i) => (
              <div key={i}>
                <h2
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--gray-500)',
                    marginBottom: '16px',
                    paddingBottom: '8px',
                    borderBottom: '2px solid var(--gray-200)',
                  }}
                >
                  {section.section}
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {section.links.map((link, j) => (
                    <li key={j} style={{ marginBottom: '10px' }}>
                      <Link
                        href={link.href}
                        style={{
                          fontSize: '14px',
                          color: 'var(--gray-400)',
                          textDecoration: 'none',
                          transition: 'color 0.2s ease',
                        }}
                      >
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
