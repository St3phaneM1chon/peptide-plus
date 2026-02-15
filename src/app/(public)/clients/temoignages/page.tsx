'use client';
/**
 * PAGE TEMOIGNAGES
 */

import { useState, useEffect } from 'react';

interface Testimonial {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  content: string;
  rating: number;
  imageUrl: string | null;
  videoUrl: string | null;
  videoDuration: string | null;
  isFeatured: boolean;
  sortOrder: number;
}

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/testimonials')
      .then((res) => res.json())
      .then((data) => {
        setTestimonials(data.testimonials ?? []);
      })
      .catch((err) => {
        console.error('Failed to load testimonials:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const textTestimonials = testimonials.filter((t) => !t.videoUrl);
  const videoTestimonials = testimonials.filter((t) => !!t.videoUrl);

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
            Temoignages
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Decouvrez ce que nos clients pensent de nos formations et de notre accompagnement.
          </p>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: '16px' }}>
              Chargement des temoignages...
            </p>
          ) : textTestimonials.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: '16px' }}>
              Aucun temoignage pour le moment.
            </p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: '24px',
              }}
            >
              {textTestimonials.map((testimonial) => (
                <div
                  key={testimonial.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '32px',
                  }}
                >
                  {/* Rating */}
                  <div style={{ marginBottom: '16px' }}>
                    {Array.from({ length: testimonial.rating }, (_, i) => (
                      <span key={i}>&#11088;</span>
                    ))}
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
                    &ldquo;{testimonial.content}&rdquo;
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
                      {testimonial.imageUrl ? (
                        <img
                          src={testimonial.imageUrl}
                          alt={testimonial.name}
                          style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <span>&#128100;</span>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '2px' }}>
                        {testimonial.name}
                      </p>
                      <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                        {[testimonial.role, testimonial.company].filter(Boolean).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Video Testimonials */}
      {!loading && videoTestimonials.length > 0 && (
        <section style={{ backgroundColor: 'white', padding: '64px 24px' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '40px', color: 'var(--gray-500)' }}>
              Temoignages video
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
              {videoTestimonials.map((video) => (
                <div
                  key={video.id}
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
                    <span style={{ fontSize: '48px' }}>&#9654;&#65039;</span>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                      {video.content}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                      {[video.company, video.videoDuration].filter(Boolean).join(' \u2022 ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '48px', fontWeight: 700, color: 'var(--gray-500)', marginBottom: '8px' }}>
            4.8/5
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '8px' }}>
            Note moyenne basee sur 2,500+ avis
          </p>
          <div style={{ fontSize: '24px' }}>&#11088;&#11088;&#11088;&#11088;&#11088;</div>
        </div>
      </section>
    </div>
  );
}
