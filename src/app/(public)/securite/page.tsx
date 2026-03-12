/**
 * PAGE SÉCURITÉ
 */

import Link from 'next/link';

export const metadata = {
  title: 'Sécurité',
  description: 'Découvrez comment BioCycle Peptides protège vos données et assure la sécurité de sa plateforme. Chiffrement, authentification et conformité.',
  openGraph: {
    title: 'Sécurité | BioCycle Peptides',
    description: 'Comment BioCycle Peptides protège vos données et assure la sécurité de sa plateforme.',
    url: 'https://biocyclepeptides.com/securite',
    siteName: 'BioCycle Peptides',
    type: 'website',
  },
};

const securityFeatures = [
  {
    icon: '🔐',
    title: 'Chiffrement de bout en bout',
    description: 'Toutes les données sont chiffrées en transit (TLS 1.3) et au repos (AES-256).',
  },
  {
    icon: '🛡️',
    title: 'Authentification forte',
    description: 'Authentification à deux facteurs (2FA) obligatoire et support des clés de sécurité.',
  },
  {
    icon: '🔍',
    title: 'Audits réguliers',
    description: 'Tests de pénétration annuels par des firmes indépendantes certifiées.',
  },
  {
    icon: '📊',
    title: 'Surveillance continue',
    description: 'Monitoring 24/7 des systèmes et détection des intrusions en temps réel.',
  },
  {
    icon: '💾',
    title: 'Sauvegardes sécurisées',
    description: 'Sauvegardes chiffrées quotidiennes avec rétention de 30 jours.',
  },
  {
    icon: '🌐',
    title: 'Infrastructure cloud',
    description: 'Hébergement sur Microsoft Azure avec conformité SOC 2 et ISO 27001.',
  },
];

const certifications = [
  { name: 'SOC 2 Type II', status: 'Certifié', icon: '✅' },
  { name: 'ISO 27001', status: 'Certifié', icon: '✅' },
  { name: 'PCI DSS', status: 'Conforme', icon: '✅' },
  { name: 'RGPD', status: 'Conforme', icon: '✅' },
  { name: 'PIPEDA', status: 'Conforme', icon: '✅' },
  { name: 'Loi 25', status: 'Conforme', icon: '✅' },
];

export default function SecurityPage() {
  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px' }}>🔒</span>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Sécurité et conformité
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            La protection de vos données est notre priorité absolue. Découvrez les mesures 
            que nous mettons en place pour garantir la sécurité de notre plateforme.
          </p>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--gray-500)' }}>
            Nos mesures de sécurité
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px',
            }}
          >
            {securityFeatures.map((feature, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  padding: '32px',
                  display: 'flex',
                  gap: '16px',
                }}
              >
                <span style={{ fontSize: '32px' }}>{feature.icon}</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                    {feature.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6 }}>
                    {feature.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--gray-500)' }}>
            Certifications et conformité
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
            }}
          >
            {certifications.map((cert, i) => (
              <div
                key={i}
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>{cert.icon}</span>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                  {cert.name}
                </h3>
                <span style={{ fontSize: '12px', color: '#22c55e' }}>{cert.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Best practices */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            Bonnes pratiques recommandées
          </h2>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[
                'Activez l\'authentification à deux facteurs sur votre compte',
                'Utilisez un mot de passe unique et complexe',
                'Ne partagez jamais vos identifiants de connexion',
                'Déconnectez-vous des appareils publics après utilisation',
                'Signalez immédiatement toute activité suspecte',
                'Gardez votre navigateur et vos appareils à jour',
              ].map((tip, i) => (
                <li
                  key={i}
                  style={{
                    padding: '16px 0',
                    borderBottom: i < 5 ? '1px solid var(--gray-100)' : 'none',
                    fontSize: '15px',
                    color: 'var(--gray-500)',
                  }}
                >
                  ✓ {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Bug bounty */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Programme de Bug Bounty
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            Vous avez découvert une faille de sécurité? Nous récompensons les chercheurs 
            qui nous aident à améliorer notre sécurité de manière responsable.
          </p>
          <Link href="/contact?subject=security" className="btn btn-primary" style={{ padding: '14px 32px' }}>
            Signaler une vulnérabilité
          </Link>
        </div>
      </section>
    </div>
  );
}
