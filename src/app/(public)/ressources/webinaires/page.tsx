export const dynamic = 'force-dynamic';
/**
 * PAGE WEBINAIRES
 */

import Link from 'next/link';

export const metadata = {
  title: 'Webinaires | Formations Pro',
  description: 'Webinaires live et replays sur la formation professionnelle.',
};

const upcomingWebinars = [
  {
    id: '1',
    title: 'L\'IA au service de la formation: opportunités et défis',
    date: '28 janvier 2026',
    time: '14h00 EST',
    speaker: 'Dr. Sophie Martin',
    speakerRole: 'Directrice Pédagogique',
    spots: 150,
    registered: 98,
  },
  {
    id: '2',
    title: 'Comment construire un programme de leadership efficace',
    date: '4 février 2026',
    time: '11h00 EST',
    speaker: 'Pierre Lavoie',
    speakerRole: 'Consultant en développement',
    spots: 100,
    registered: 45,
  },
];

const pastWebinars = [
  {
    id: 'w1',
    title: 'Les tendances de la formation en 2026',
    date: '14 janvier 2026',
    duration: '45 min',
    views: 1250,
    category: 'Tendances',
  },
  {
    id: 'w2',
    title: 'Mesurer le ROI de vos formations: méthodes et outils',
    date: '7 janvier 2026',
    duration: '52 min',
    views: 890,
    category: 'Stratégie',
  },
  {
    id: 'w3',
    title: 'Microlearning: guide de mise en œuvre',
    date: '17 décembre 2025',
    duration: '38 min',
    views: 720,
    category: 'Pédagogie',
  },
  {
    id: 'w4',
    title: 'Onboarding digital: bonnes pratiques',
    date: '3 décembre 2025',
    duration: '41 min',
    views: 650,
    category: 'RH',
  },
];

export default function WebinarsPage() {
  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>
          Webinaires
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Participez à nos webinaires live ou visionnez les replays.
        </p>
      </section>

      {/* Upcoming */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            Prochains webinaires
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {upcomingWebinars.map((webinar) => (
              <div
                key={webinar.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '32px',
                  display: 'flex',
                  gap: '32px',
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: '120px',
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: 'var(--gray-500)',
                    color: 'white',
                    borderRadius: '12px',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '14px', opacity: 0.8 }}>LIVE</span>
                  <p style={{ fontSize: '18px', fontWeight: 700, marginTop: '8px' }}>{webinar.date.split(' ')[0]}</p>
                  <p style={{ fontSize: '14px' }}>{webinar.date.split(' ').slice(1).join(' ')}</p>
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                    {webinar.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '12px' }}>
                    {webinar.time} • Présenté par {webinar.speaker}, {webinar.speakerRole}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        height: '6px',
                        flex: 1,
                        maxWidth: '200px',
                        backgroundColor: 'var(--gray-100)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${(webinar.registered / webinar.spots) * 100}%`,
                          height: '100%',
                          backgroundColor: '#22c55e',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                      {webinar.registered}/{webinar.spots} inscrits
                    </span>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ padding: '12px 24px' }}>
                  S'inscrire gratuitement
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Past webinars */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '32px', color: 'var(--gray-500)' }}>
            Replays disponibles
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '24px',
            }}
          >
            {pastWebinars.map((webinar) => (
              <Link
                key={webinar.id}
                href="#"
                style={{
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--gray-200)',
                    height: '160px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}
                >
                  <span style={{ fontSize: '48px' }}>▶️</span>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      padding: '4px 8px',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      color: 'white',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  >
                    {webinar.duration}
                  </span>
                </div>
                <div style={{ padding: '20px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      backgroundColor: 'var(--gray-200)',
                      borderRadius: '8px',
                      color: 'var(--gray-500)',
                    }}
                  >
                    {webinar.category}
                  </span>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '8px 0', color: 'var(--gray-500)' }}>
                    {webinar.title}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                    {webinar.date} • {webinar.views.toLocaleString()} vues
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Ne manquez aucun webinaire
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            Inscrivez-vous pour être notifié de nos prochains événements.
          </p>
          <form style={{ display: 'flex', gap: '12px' }}>
            <input type="email" placeholder="Votre courriel" className="form-input" style={{ flex: 1 }} />
            <button type="submit" className="btn btn-primary">S'inscrire</button>
          </form>
        </div>
      </section>
    </div>
  );
}
