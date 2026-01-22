/**
 * PAGE D'ACCUEIL - Style Shopify Ton sur Ton
 * Hero + Section Produits + Catégories
 */

import Link from 'next/link';
import { ProductCardShopify } from '@/components/products/ProductCardShopify';

// Données mockées (à remplacer par appels API/DB)
const featuredProducts = [
  {
    id: '1',
    name: 'Formation Sécurité Routière Complète',
    slug: 'securite-routiere-complete',
    price: 149.99,
    compareAtPrice: 199.99,
    imageUrl: null,
    vendor: 'Certification Pro',
    badge: 'Populaire',
  },
  {
    id: '2',
    name: 'Gestion des Risques en Entreprise',
    slug: 'gestion-risques-entreprise',
    price: 299.99,
    imageUrl: null,
    vendor: 'Formation Expert',
  },
  {
    id: '3',
    name: 'Santé et Sécurité au Travail',
    slug: 'sante-securite-travail',
    price: 179.99,
    compareAtPrice: 229.99,
    imageUrl: null,
    vendor: 'SST Québec',
  },
  {
    id: '4',
    name: 'Leadership et Gestion d\'équipe',
    slug: 'leadership-gestion-equipe',
    price: 249.99,
    imageUrl: null,
    vendor: 'Management Plus',
    badge: 'Nouveau',
  },
  {
    id: '5',
    name: 'Communication Professionnelle',
    slug: 'communication-professionnelle',
    price: 129.99,
    imageUrl: null,
    vendor: 'Soft Skills Academy',
  },
  {
    id: '6',
    name: 'Premiers Soins et RCR',
    slug: 'premiers-soins-rcr',
    price: 89.99,
    compareAtPrice: 119.99,
    imageUrl: null,
    vendor: 'Croix-Rouge',
  },
  {
    id: '7',
    name: 'Excel Avancé pour Professionnels',
    slug: 'excel-avance',
    price: 99.99,
    imageUrl: null,
    vendor: 'Tech Academy',
  },
  {
    id: '8',
    name: 'Gestion du Temps et Productivité',
    slug: 'gestion-temps-productivite',
    price: 79.99,
    imageUrl: null,
    vendor: 'Efficiency Pro',
  },
];

const categories = [
  { name: 'Sécurité', slug: 'securite', count: 12 },
  { name: 'Management', slug: 'management', count: 8 },
  { name: 'Bureautique', slug: 'bureautique', count: 15 },
  { name: 'Santé', slug: 'sante', count: 6 },
];

export default function HomePage() {
  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero Section */}
      <section
        style={{
          backgroundColor: 'var(--gray-200)',
          padding: '100px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <p
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--gray-400)',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              marginBottom: '16px',
            }}
          >
            Formations Professionnelles
          </p>
          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 56px)',
              fontWeight: 600,
              color: 'var(--gray-500)',
              lineHeight: 1.1,
              marginBottom: '24px',
              letterSpacing: '-0.02em',
            }}
          >
            Développez vos compétences
            <br />
            <span style={{ color: 'var(--gray-400)' }}>avec nos experts</span>
          </h1>
          <p
            style={{
              fontSize: '18px',
              color: 'var(--gray-400)',
              marginBottom: '40px',
              lineHeight: 1.6,
            }}
          >
            Certifications reconnues par les employeurs et les assureurs.
            <br />
            Plus de 10 000 professionnels formés.
          </p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <Link href="/catalogue" className="btn btn-primary btn-lg">
              Voir les formations
            </Link>
            <Link href="/contact" className="btn btn-outline btn-lg">
              Nous contacter
            </Link>
          </div>
        </div>
      </section>

      {/* Categories Bar */}
      <section
        style={{
          backgroundColor: 'white',
          borderBottom: '1px solid var(--gray-200)',
          padding: '20px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            gap: '40px',
            flexWrap: 'wrap',
          }}
        >
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/catalogue/${category.slug}`}
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--gray-400)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'color 0.2s ease',
              }}
            >
              {category.name}
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--gray-300)',
                }}
              >
                ({category.count})
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="section" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Section Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginBottom: '40px',
            }}
          >
            <div>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--gray-400)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: '8px',
                }}
              >
                Formations
              </p>
              <h2
                style={{
                  fontSize: '32px',
                  fontWeight: 600,
                  color: 'var(--gray-500)',
                }}
              >
                Les Plus Populaires
              </h2>
            </div>
            <Link
              href="/catalogue"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--gray-400)',
                textDecoration: 'underline',
              }}
            >
              Voir tout
            </Link>
          </div>

          {/* Product Grid */}
          <div className="product-grid">
            {featuredProducts.map((product) => (
              <ProductCardShopify key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Banner Section */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          padding: '80px 24px',
        }}
      >
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '60px',
            alignItems: 'center',
          }}
        >
          <div>
            <h2
              style={{
                fontSize: '36px',
                fontWeight: 600,
                color: 'white',
                lineHeight: 1.2,
                marginBottom: '20px',
              }}
            >
              Formation sur mesure
              <br />
              pour votre entreprise
            </h2>
            <p
              style={{
                fontSize: '16px',
                color: 'var(--gray-300)',
                marginBottom: '32px',
                lineHeight: 1.6,
              }}
            >
              Nous créons des programmes personnalisés adaptés aux besoins
              spécifiques de votre équipe. Contactez-nous pour une consultation
              gratuite.
            </p>
            <Link
              href="/entreprise"
              className="btn"
              style={{
                backgroundColor: 'white',
                color: 'var(--gray-500)',
                padding: '14px 28px',
              }}
            >
              En savoir plus
            </Link>
          </div>

          {/* Stats */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px',
            }}
          >
            {[
              { value: '10K+', label: 'Professionnels formés' },
              { value: '98%', label: 'Taux de satisfaction' },
              { value: '50+', label: 'Formations disponibles' },
              { value: '24/7', label: 'Support disponible' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  textAlign: 'center',
                  padding: '24px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderRadius: '8px',
                }}
              >
                <p
                  style={{
                    fontSize: '36px',
                    fontWeight: 700,
                    color: 'white',
                    marginBottom: '4px',
                  }}
                >
                  {stat.value}
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: 'var(--gray-300)',
                  }}
                >
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section
        style={{
          backgroundColor: 'white',
          padding: '60px 24px',
          borderTop: '1px solid var(--gray-200)',
        }}
      >
        <div
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '60px',
            flexWrap: 'wrap',
          }}
        >
          {[
            { icon: '✓', text: 'Certifications reconnues' },
            { icon: '↻', text: 'Garantie 30 jours' },
            { icon: '♡', text: 'Support dédié' },
            { icon: '⚡', text: 'Accès immédiat' },
          ].map((item) => (
            <div
              key={item.text}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--gray-100)',
                  borderRadius: '50%',
                  fontSize: '18px',
                  color: 'var(--gray-500)',
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--gray-500)',
                }}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
