export const dynamic = 'force-dynamic';
/**
 * PAGE CLIENTS - Principale
 */

import Link from 'next/link';

export const metadata = {
  title: 'Nos Clients | Formations Pro',
  description: 'Découvrez les entreprises qui nous font confiance et leurs témoignages.',
};

const clients = [
  { name: 'Desjardins', industry: 'Finance', logo: '🏦' },
  { name: 'Hydro-Québec', industry: 'Énergie', logo: '⚡' },
  { name: 'Bell Canada', industry: 'Télécommunications', logo: '📱' },
  { name: 'Bombardier', industry: 'Aérospatiale', logo: '✈️' },
  { name: 'CGI', industry: 'Technologie', logo: '💻' },
  { name: 'Couche-Tard', industry: 'Commerce de détail', logo: '🏪' },
  { name: 'Saputo', industry: 'Agroalimentaire', logo: '🥛' },
  { name: 'National Bank', industry: 'Finance', logo: '🏛️' },
  { name: 'Loto-Québec', industry: 'Divertissement', logo: '🎰' },
  { name: 'SAQ', industry: 'Commerce de détail', logo: '🍷' },
  { name: 'Metro', industry: 'Alimentation', logo: '🛒' },
  { name: 'Vidéotron', industry: 'Télécommunications', logo: '📺' },
];

const stats = [
  { value: '500+', label: 'Entreprises clientes' },
  { value: '50K+', label: 'Apprenants formés' },
  { value: '98%', label: 'Taux de satisfaction' },
  { value: '92%', label: 'Taux de recommandation' },
];

export default function ClientsPage() {
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
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Ils nous font confiance
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Des centaines d'entreprises au Canada et à l'international ont choisi 
            nos formations pour développer les compétences de leurs équipes.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section style={{ backgroundColor: 'white', padding: '48px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '32px', textAlign: 'center' }}>
            {stats.map((stat, i) => (
              <div key={i}>
                <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '4px' }}>{stat.value}</p>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client logos */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--gray-500)' }}>
            Quelques-uns de nos clients
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
            }}
          >
            {clients.map((client, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  padding: '24px',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>{client.logo}</span>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '2px' }}>
                  {client.name}
                </h3>
                <span style={{ fontSize: '11px', color: 'var(--gray-400)' }}>{client.industry}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Links */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            <Link
              href="/clients/temoignages"
              style={{
                padding: '32px',
                backgroundColor: 'var(--gray-50)',
                borderRadius: '12px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <span style={{ fontSize: '40px' }}>💬</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                  Témoignages
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                  Ce que nos clients disent de nous
                </p>
              </div>
            </Link>
            <Link
              href="/clients/etudes-de-cas"
              style={{
                padding: '32px',
                backgroundColor: 'var(--gray-50)',
                borderRadius: '12px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <span style={{ fontSize: '40px' }}>📊</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                  Études de cas
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                  Projets détaillés avec résultats
                </p>
              </div>
            </Link>
            <Link
              href="/clients/references"
              style={{
                padding: '32px',
                backgroundColor: 'var(--gray-50)',
                borderRadius: '12px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <span style={{ fontSize: '40px' }}>🏆</span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                  Références
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                  Liste complète de nos clients
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Rejoignez nos clients satisfaits
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Découvrez comment nous pouvons vous aider.
        </p>
        <Link href="/demo" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Demander une démo
        </Link>
      </section>
    </div>
  );
}
