/**
 * PAGE CONTACT
 * Formulaire de contact et informations
 */

'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n/client';

export default function ContactPage() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    
    // Simuler l'envoi
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setSending(false);
    setSent(true);
  };

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
          {t('nav.contact')}
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          Une question? Nous sommes là pour vous aider.
        </p>
      </section>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '64px 24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '48px',
          }}
        >
          {/* Contact Info */}
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
              Nos coordonnées
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <ContactCard
                icon="📍"
                title="Adresse"
                lines={[
                  process.env.NEXT_PUBLIC_ADDRESS || '123 Rue Principale',
                  process.env.NEXT_PUBLIC_CITY || 'Montréal, QC H2X 1Y6',
                  'Canada',
                ]}
              />
              <ContactCard
                icon="📞"
                title="Téléphone"
                lines={[
                  process.env.NEXT_PUBLIC_PHONE || '1-800-XXX-XXXX',
                  'Lun-Ven: 9h-17h EST',
                ]}
              />
              <ContactCard
                icon="✉️"
                title="Courriel"
                lines={[
                  process.env.NEXT_PUBLIC_EMAIL || 'info@example.com',
                  'Réponse sous 24h',
                ]}
              />
            </div>

            {/* Map placeholder */}
            <div
              style={{
                marginTop: '32px',
                backgroundColor: 'var(--gray-200)',
                borderRadius: '12px',
                aspectRatio: '16/9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: 'var(--gray-400)' }}>🗺️ Carte Google Maps</span>
            </div>
          </div>

          {/* Contact Form */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              border: '1px solid var(--gray-200)',
            }}
          >
            {sent ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <span style={{ fontSize: '64px', display: 'block', marginBottom: '24px' }}>✅</span>
                <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px', color: 'var(--gray-500)' }}>
                  Message envoyé!
                </h3>
                <p style={{ color: 'var(--gray-400)' }}>
                  Nous vous répondrons dans les plus brefs délais.
                </p>
                <button
                  onClick={() => { setSent(false); setFormData({ name: '', email: '', company: '', phone: '', subject: '', message: '' }); }}
                  className="btn btn-secondary"
                  style={{ marginTop: '24px' }}
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
                  Envoyez-nous un message
                </h2>

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="form-label">{t('profile.fullName')} *</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="form-input"
                        placeholder="Jean Dupont"
                      />
                    </div>
                    <div>
                      <label className="form-label">{t('auth.email')} *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="form-input"
                        placeholder="jean@example.com"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="form-label">Entreprise</label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="form-input"
                        placeholder="Acme Inc."
                      />
                    </div>
                    <div>
                      <label className="form-label">{t('profile.phone')}</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="form-input"
                        placeholder="(514) 555-0123"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label">Sujet *</label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="form-input form-select"
                    >
                      <option value="">Sélectionnez un sujet</option>
                      <option value="general">Question générale</option>
                      <option value="sales">Demande de devis</option>
                      <option value="support">Support technique</option>
                      <option value="partnership">Partenariat</option>
                      <option value="careers">Carrières</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label className="form-label">Message *</label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="form-input"
                      placeholder="Comment pouvons-nous vous aider?"
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', opacity: sending ? 0.7 : 1 }}
                  >
                    {sending ? t('common.loading') : t('common.submit')}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactCard({ icon, title, lines }: { icon: string; title: string; lines: string[] }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid var(--gray-200)',
      }}
    >
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: 'var(--gray-500)' }}>
          {title}
        </h3>
        {lines.map((line, i) => (
          <p key={i} style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '2px' }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
