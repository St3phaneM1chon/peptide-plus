'use client';
export const dynamic = 'force-dynamic';
/**
 * PAGE RÉFÉRENCES
 */

import Link from 'next/link';
import { useState, useEffect } from 'react';

interface ClientReference {
  id: string;
  name: string;
  logoUrl: string | null;
  industry: string | null;
  website: string | null;
  description: string | null;
  isPublished: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function ReferencesPage() {
  const [byIndustry, setByIndustry] = useState<Record<string, ClientReference[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client-references')
      .then((res) => res.json())
      .then((data) => {
        setByIndustry(data.byIndustry || {});
      })
      .catch((err) => {
        console.error('Failed to fetch client references:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const industries = Object.keys(byIndustry);

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
            Nos références
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Plus de 500 entreprises nous font confiance pour former leurs équipes.
          </p>
        </div>
      </section>

      {/* Clients by industry */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
                Chargement des références...
              </p>
            </div>
          ) : industries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontSize: '16px', color: 'var(--gray-400)' }}>
                Aucune référence disponible pour le moment.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {industries.map((industry, i) => (
                <div
                  key={i}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '32px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--gray-500)' }}>
                      {industry}
                    </h2>
                    <span style={{ fontSize: '13px', color: 'var(--gray-400)', marginLeft: 'auto' }}>
                      {byIndustry[industry].length} clients
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                    {byIndustry[industry].map((client, j) => (
                      <span
                        key={j}
                        style={{
                          padding: '10px 16px',
                          backgroundColor: 'var(--gray-50)',
                          borderRadius: '8px',
                          fontSize: '14px',
                          color: 'var(--gray-500)',
                        }}
                      >
                        {client.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Summary */}
      <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '32px', marginBottom: '40px' }}>
            <div>
              <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--gray-500)' }}>500+</p>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>Entreprises clientes</p>
            </div>
            <div>
              <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--gray-500)' }}>8</p>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>Secteurs d'activité</p>
            </div>
            <div>
              <p style={{ fontSize: '40px', fontWeight: 700, color: 'var(--gray-500)' }}>12</p>
              <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>Pays</p>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
            Cette liste n'est pas exhaustive. Contactez-nous pour des références spécifiques à votre secteur.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          Besoin de références dans votre secteur?
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          Nous pouvons vous mettre en contact avec des clients similaires.
        </p>
        <Link href="/contact" className="btn btn-primary" style={{ padding: '14px 32px' }}>
          Contactez-nous
        </Link>
      </section>
    </div>
  );
}
