/**
 * PAGE BLOG
 */

import Link from 'next/link';

export const metadata = {
  title: 'Blog | Formations Pro',
  description: 'Articles, conseils et tendances sur la formation professionnelle.',
};

const featuredPost = {
  slug: 'tendances-formation-2026',
  title: 'Les 10 tendances de la formation professionnelle en 2026',
  excerpt: 'Découvrez les innovations qui transforment l\'apprentissage en entreprise: IA, microlearning, réalité virtuelle et bien plus.',
  author: 'Marie Dupont',
  date: '15 janvier 2026',
  readTime: '8 min',
  category: 'Tendances',
  image: null,
};

const posts = [
  {
    slug: 'mesurer-roi-formation',
    title: 'Comment mesurer le ROI de vos formations?',
    excerpt: 'Les méthodes et KPIs essentiels pour évaluer l\'impact réel de vos programmes de formation.',
    author: 'Pierre Martin',
    date: '12 janvier 2026',
    readTime: '6 min',
    category: 'Stratégie',
  },
  {
    slug: 'microlearning-guide',
    title: 'Le guide complet du microlearning',
    excerpt: 'Pourquoi et comment intégrer le microlearning dans votre stratégie de formation.',
    author: 'Sophie Tremblay',
    date: '8 janvier 2026',
    readTime: '7 min',
    category: 'Pédagogie',
  },
  {
    slug: 'ia-formation-entreprise',
    title: 'L\'IA au service de la formation en entreprise',
    excerpt: 'Comment l\'intelligence artificielle personnalise et optimise l\'apprentissage.',
    author: 'Jean-François Roy',
    date: '5 janvier 2026',
    readTime: '5 min',
    category: 'Technologie',
  },
  {
    slug: 'engagement-apprenants',
    title: '7 techniques pour engager vos apprenants',
    excerpt: 'Stratégies éprouvées pour améliorer l\'engagement et la complétion des formations.',
    author: 'Marie Dupont',
    date: '2 janvier 2026',
    readTime: '6 min',
    category: 'Pédagogie',
  },
  {
    slug: 'onboarding-efficace',
    title: 'Construire un onboarding efficace',
    excerpt: 'Les étapes clés pour intégrer rapidement vos nouveaux employés.',
    author: 'Pierre Martin',
    date: '28 décembre 2025',
    readTime: '8 min',
    category: 'RH',
  },
];

const categories = ['Tous', 'Tendances', 'Stratégie', 'Pédagogie', 'Technologie', 'RH'];

export default function BlogPage() {
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
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>Blog</h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Conseils, tendances et bonnes pratiques en formation professionnelle
        </p>
      </section>

      {/* Featured Post */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Link
            href={`/blog/${featuredPost.slug}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr',
              gap: '48px',
              backgroundColor: 'white',
              borderRadius: '16px',
              overflow: 'hidden',
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--gray-200)',
                minHeight: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '80px' }}>📚</span>
            </div>
            <div style={{ padding: '40px 40px 40px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '6px 12px',
                  backgroundColor: 'var(--gray-100)',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--gray-500)',
                  marginBottom: '16px',
                  alignSelf: 'flex-start',
                }}
              >
                {featuredPost.category}
              </span>
              <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
                {featuredPost.title}
              </h2>
              <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: '24px' }}>
                {featuredPost.excerpt}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                {featuredPost.author} • {featuredPost.date} • {featuredPost.readTime} de lecture
              </p>
            </div>
          </Link>
        </div>
      </section>

      {/* Categories */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {categories.map((cat, i) => (
            <button
              key={cat}
              style={{
                padding: '8px 16px',
                backgroundColor: i === 0 ? 'var(--gray-500)' : 'white',
                color: i === 0 ? 'white' : 'var(--gray-500)',
                border: 'none',
                borderRadius: '20px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Posts Grid */}
      <section style={{ padding: '48px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '24px',
            }}
          >
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    backgroundColor: 'var(--gray-200)',
                    height: '180px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '48px' }}>📝</span>
                </div>
                <div style={{ padding: '24px' }}>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      backgroundColor: 'var(--gray-100)',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--gray-500)',
                      marginBottom: '12px',
                    }}
                  >
                    {post.category}
                  </span>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
                    {post.title}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--gray-400)', lineHeight: 1.6, marginBottom: '16px' }}>
                    {post.excerpt}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                    {post.date} • {post.readTime}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Load more */}
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <button className="btn btn-secondary" style={{ padding: '12px 32px' }}>
              Voir plus d'articles
            </button>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
            Restez informé
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '24px' }}>
            Recevez nos derniers articles directement dans votre boîte courriel.
          </p>
          <form style={{ display: 'flex', gap: '12px' }} onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Votre courriel"
              className="form-input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">
              S'abonner
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
