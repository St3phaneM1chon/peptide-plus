export const dynamic = 'force-dynamic';
/**
 * PAGE TÉMOIGNAGES
 */

export const metadata = {
  title: 'Témoignages | Formations Pro',
  description: 'Découvrez ce que nos clients disent de nos formations.',
};

const testimonials = [
  {
    quote: 'Les formations ont transformé notre façon de travailler. L\'équipe est plus efficace et les résultats sont au rendez-vous.',
    author: 'Marie-Claude Tremblay',
    role: 'Directrice RH',
    company: 'Desjardins',
    image: null,
    rating: 5,
  },
  {
    quote: 'Un excellent rapport qualité-prix. Les contenus sont à jour et les formateurs vraiment compétents.',
    author: 'Jean-François Roy',
    role: 'Responsable Formation',
    company: 'Hydro-Québec',
    image: null,
    rating: 5,
  },
  {
    quote: 'La plateforme est intuitive et le suivi des progrès nous permet de mesurer l\'impact sur nos équipes.',
    author: 'Sophie Martin',
    role: 'VP Talent',
    company: 'CGI',
    image: null,
    rating: 5,
  },
  {
    quote: 'Nous avons formé plus de 500 employés en 6 mois. Le support a été exceptionnel tout au long du projet.',
    author: 'Pierre Lavoie',
    role: 'Directeur des Opérations',
    company: 'Bell Canada',
    image: null,
    rating: 5,
  },
  {
    quote: 'Les certifications obtenues sont reconnues dans l\'industrie. Un vrai plus pour nos équipes.',
    author: 'Caroline Bergeron',
    role: 'Chef de projet',
    company: 'Bombardier',
    image: null,
    rating: 4,
  },
  {
    quote: 'Flexibilité totale: nos employés peuvent se former à leur rythme, selon leur emploi du temps.',
    author: 'Michel Dubois',
    role: 'DRH',
    company: 'National Bank',
    image: null,
    rating: 5,
  },
];

const videoTestimonials = [
  { company: 'Desjardins', title: 'Comment Desjardins a formé 1000 employés en 3 mois', duration: '3:45' },
  { company: 'CGI', title: 'La transformation digitale chez CGI', duration: '4:12' },
  { company: 'Hydro-Québec', title: 'Conformité et formation continue', duration: '2:58' },
];

export default function TestimonialsPage() {
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
            Témoignages
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Découvrez ce que nos clients pensent de nos formations et de notre accompagnement.
          </p>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
              gap: '24px',
            }}
          >
            {testimonials.map((testimonial, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '32px',
                }}
              >
                {/* Rating */}
                <div style={{ marginBottom: '16px' }}>
                  {'⭐'.repeat(testimonial.rating)}
                </div>
                
                {/* Quote */}
                <blockquote
                  style={{
                    fontSize: '16px',
                    color: 'var(--gray-500)',
                    lineHeight: 1.7,
                    marginBottom: '24px',
                    fontStyle: 'italic',
                  }}
                >
                  "{testimonial.quote}"
                </blockquote>

                {/* Author */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--gray-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                    }}
                  >
                    👤
                  </div>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '2px' }}>
                      {testimonial.author}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                      {testimonial.role}, {testimonial.company}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Video Testimonials */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--gray-500)' }}>
            Témoignages vidéo
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {videoTestimonials.map((video, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: 'var(--gray-50)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--gray-200)',
                    aspectRatio: '16/9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '48px' }}>▶️</span>
                </div>
                <div style={{ padding: '20px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                    {video.title}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                    {video.company} • {video.duration}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '48px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '8px' }}>
            4.8/5
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '8px' }}>
            Note moyenne basée sur 2,500+ avis
          </p>
          <div style={{ fontSize: '24px' }}>⭐⭐⭐⭐⭐</div>
        </div>
      </section>
    </div>
  );
}
