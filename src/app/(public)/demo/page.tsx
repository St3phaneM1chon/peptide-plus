/**
 * PAGE DEMANDE DE DÉMO
 */

'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';

export default function DemoPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    phone: '',
    employees: '',
    needs: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSending(false);
    setSent(true);
  };

  return (
    <div style={{ backgroundColor: 'var(--gray-100)', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '64px 24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: '64px',
            alignItems: 'start',
          }}
        >
          {/* Left - Info */}
          <div>
            <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '24px', color: 'var(--gray-500)' }}>
              Demander une démonstration
            </h1>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: '40px' }}>
              Découvrez comment notre plateforme peut transformer la formation dans votre entreprise. 
              Un expert vous présentera les fonctionnalités adaptées à vos besoins.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                { icon: '🎯', title: 'Démo personnalisée', desc: 'Adaptée à votre secteur et vos objectifs' },
                { icon: '⏱️', title: '30 minutes', desc: 'Une session concise et efficace' },
                { icon: '💬', title: 'Questions & réponses', desc: 'Échangez directement avec un expert' },
                { icon: '🎁', title: 'Sans engagement', desc: 'Explorez librement nos solutions' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '28px' }}>{item.icon}</span>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--gray-500)', marginBottom: '4px' }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div
              style={{
                marginTop: '48px',
                padding: '24px',
                backgroundColor: 'white',
                borderRadius: '12px',
                borderLeft: '4px solid var(--gray-500)',
              }}
            >
              <p style={{ fontSize: '14px', fontStyle: 'italic', color: 'var(--gray-500)', marginBottom: '12px' }}>
                "La démo m'a permis de comprendre rapidement comment la plateforme pouvait répondre à nos besoins. 
                L'équipe a été très professionnelle."
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                — Sophie Martin, VP Talent, CGI
              </p>
            </div>
          </div>

          {/* Right - Form */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '40px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            }}
          >
            {sent ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <span style={{ fontSize: '64px', display: 'block', marginBottom: '24px' }}>🎉</span>
                <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px', color: 'var(--gray-500)' }}>
                  Demande envoyée!
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '8px' }}>
                  Un membre de notre équipe vous contactera sous 24h pour planifier votre démo.
                </p>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                  Vérifiez votre boîte courriel pour la confirmation.
                </p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
                  Planifiez votre démo
                </h2>

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="form-label">Prénom *</label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Nom *</label>
                      <input
                        type="text"
                        required
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label">Courriel professionnel *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="form-input"
                      placeholder="vous@entreprise.com"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="form-label">Entreprise *</label>
                      <input
                        type="text"
                        required
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">Téléphone</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label">Nombre d'employés *</label>
                    <select
                      required
                      value={formData.employees}
                      onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                      className="form-input form-select"
                    >
                      <option value="">Sélectionnez</option>
                      <option value="1-50">1 - 50</option>
                      <option value="51-200">51 - 200</option>
                      <option value="201-500">201 - 500</option>
                      <option value="501-1000">501 - 1000</option>
                      <option value="1000+">1000+</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label">Vos besoins principaux</label>
                    <select
                      value={formData.needs}
                      onChange={(e) => setFormData({ ...formData, needs: e.target.value })}
                      className="form-input form-select"
                    >
                      <option value="">Sélectionnez</option>
                      <option value="onboarding">Intégration des nouveaux employés</option>
                      <option value="compliance">Conformité réglementaire</option>
                      <option value="skills">Développement des compétences</option>
                      <option value="leadership">Programme de leadership</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label className="form-label">Message (optionnel)</label>
                    <textarea
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="form-input"
                      placeholder="Dites-nous en plus sur vos besoins..."
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', opacity: sending ? 0.7 : 1 }}
                  >
                    {sending ? 'Envoi en cours...' : 'Demander ma démo gratuite'}
                  </button>

                  <p style={{ fontSize: '12px', color: 'var(--gray-400)', textAlign: 'center', marginTop: '16px' }}>
                    En soumettant ce formulaire, vous acceptez notre{' '}
                    <a href="/mentions-legales/confidentialite" style={{ color: 'var(--gray-500)' }}>
                      politique de confidentialité
                    </a>.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
