/**
 * PAGE ÉQUIPE
 */

import Link from 'next/link';

export const metadata = {
  title: 'Notre Équipe | Formations Pro',
  description: 'Rencontrez les experts passionnés qui composent notre équipe.',
};

// Mock data - à remplacer par API
const leadership = [
  {
    name: 'Marie Dupont',
    role: 'Présidente-directrice générale',
    bio: '20 ans d\'expérience dans l\'éducation et la formation professionnelle.',
    image: null,
    linkedin: '#',
  },
  {
    name: 'Pierre Martin',
    role: 'Directeur des opérations',
    bio: 'Expert en gestion de projets et optimisation des processus.',
    image: null,
    linkedin: '#',
  },
  {
    name: 'Sophie Tremblay',
    role: 'Directrice pédagogique',
    bio: 'Docteure en sciences de l\'éducation, spécialiste de l\'andragogie.',
    image: null,
    linkedin: '#',
  },
  {
    name: 'Jean-François Roy',
    role: 'Directeur technologique',
    bio: '15 ans d\'expérience en développement de plateformes d\'apprentissage.',
    image: null,
    linkedin: '#',
  },
];

const departments = [
  { name: 'Pédagogie', count: 12, icon: '📚' },
  { name: 'Technologie', count: 8, icon: '💻' },
  { name: 'Support client', count: 6, icon: '🎧' },
  { name: 'Marketing', count: 5, icon: '📣' },
  { name: 'Administration', count: 4, icon: '📋' },
];

export default function TeamPage() {
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
            Notre Équipe
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Des experts passionnés, dédiés à votre réussite professionnelle.
          </p>
        </div>
      </section>

      {/* Leadership */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 700, textAlign: 'center', marginBottom: '48px', color: 'var(--gray-500)' }}>
            Direction
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '32px',
            }}
          >
            {leadership.map((person, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--gray-200)',
                    height: '200px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '64px' }}>👤</span>
                </div>
                <div style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', color: 'var(--gray-500)' }}>
                    {person.name}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '12px' }}>
                    {person.role}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: '16px' }}>
                    {person.bio}
                  </p>
                  <a
                    href={person.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--gray-500)', fontSize: '13px' }}
                  >
                    LinkedIn →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Departments */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--gray-500)' }}>
            Nos départements
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '16px',
            }}
          >
            {departments.map((dept, i) => (
              <div
                key={i}
                style={{
                  padding: '24px',
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>{dept.icon}</span>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                  {dept.name}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>{dept.count} personnes</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px', color: 'var(--gray-400)' }}>
            <strong>35 employés</strong> au total, répartis entre Montréal et le télétravail.
          </p>
        </div>
      </section>

      {/* Join us CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Rejoignez l'équipe
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Nous sommes toujours à la recherche de talents passionnés.
        </p>
        <Link href="/carrieres" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Voir les postes ouverts
        </Link>
      </section>
    </div>
  );
}
