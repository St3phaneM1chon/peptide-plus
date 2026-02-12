/**
 * PAGE CONTACT - BioCycle Peptides
 * Formulaire de contact fonctionnel
 */

'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';

export default function ContactPage() {
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
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        setSent(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Une erreur est survenue');
      }
    } catch {
      setError('Erreur de connexion. Veuillez réessayer.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
          color: 'white',
          padding: '64px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px' }}>
          Contactez-nous
        </h1>
        <p style={{ fontSize: '18px', color: '#d1d5db' }}>
          Une question sur nos produits? Notre équipe est là pour vous aider.
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
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: '#1f2937' }}>
              Nos coordonnées
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ContactCard
                icon="📍"
                title="Siège social"
                lines={[
                  'BioCycle Peptides Inc.',
                  'Montréal, Québec',
                  'Canada',
                ]}
              />
              <ContactCard
                icon="📞"
                title="Téléphone"
                lines={[
                  'Lun-Ven: 9h-17h EST',
                  'Service en français et anglais',
                ]}
              />
              <ContactCard
                icon="✉️"
                title="Courriel"
                lines={[
                  'support@biocyclepeptides.com',
                  'info@biocyclepeptides.com',
                  'Réponse sous 24h',
                ]}
                isEmail
              />
            </div>

            {/* Quick Links */}
            <div style={{ marginTop: '32px', padding: '24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
                Liens rapides
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <QuickLink href="/faq" icon="❓" text="FAQ - Questions fréquentes" />
                <QuickLink href="/track-order" icon="📦" text="Suivre ma commande" />
                <QuickLink href="/shipping-policy" icon="🚚" text="Politique de livraison" />
                <QuickLink href="/refund-policy" icon="↩️" text="Retours et remboursements" />
                <QuickLink href="/lab-results" icon="🔬" text="Résultats de laboratoire" />
              </ul>
            </div>

            {/* Business Hours */}
            <div style={{ marginTop: '24px', padding: '24px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #86efac' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#166534' }}>
                🕐 Heures d&apos;ouverture
              </h3>
              <p style={{ fontSize: '14px', color: '#166534', marginBottom: '4px' }}>
                <strong>Lundi - Vendredi:</strong> 9h00 - 17h00 (EST)
              </p>
              <p style={{ fontSize: '14px', color: '#166534', marginBottom: '4px' }}>
                <strong>Samedi - Dimanche:</strong> Fermé
              </p>
              <p style={{ fontSize: '13px', color: '#15803d', marginTop: '12px' }}>
                Les commandes en ligne sont acceptées 24h/24
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              border: '1px solid #e5e7eb',
            }}
          >
            {sent ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div style={{ 
                  width: '80px', 
                  height: '80px', 
                  backgroundColor: '#d1fae5', 
                  borderRadius: '50%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 24px'
                }}>
                  <span style={{ fontSize: '40px' }}>✅</span>
                </div>
                <h3 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '12px', color: '#1f2937' }}>
                  Message envoyé!
                </h3>
                <p style={{ color: '#6b7280', marginBottom: '8px' }}>
                  Merci de nous avoir contactés.
                </p>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                  Nous vous répondrons dans les plus brefs délais (généralement sous 24h).
                </p>
                <button
                  onClick={() => { setSent(false); setFormData({ name: '', email: '', company: '', phone: '', subject: '', message: '' }); }}
                  style={{ 
                    marginTop: '24px',
                    padding: '12px 24px',
                    backgroundColor: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
                  Envoyez-nous un message
                </h2>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
                  Remplissez le formulaire et notre équipe vous répondra rapidement.
                </p>

                {error && (
                  <div style={{ 
                    padding: '12px 16px', 
                    backgroundColor: '#fef2f2', 
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    color: '#dc2626',
                    fontSize: '14px'
                  }}>
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                        Nom complet *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Jean Dupont"
                        style={{ 
                          width: '100%', 
                          padding: '12px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                        Courriel *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="jean@example.com"
                        style={{ 
                          width: '100%', 
                          padding: '12px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                        Institution / Laboratoire
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="Université McGill"
                        style={{ 
                          width: '100%', 
                          padding: '12px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                        Téléphone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="(514) 555-0123"
                        style={{ 
                          width: '100%', 
                          padding: '12px', 
                          border: '1px solid #d1d5db', 
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                      Sujet *
                    </label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="">Sélectionnez un sujet</option>
                      <option value="product">Question sur un produit</option>
                      <option value="order">Question sur une commande</option>
                      <option value="shipping">Livraison et expédition</option>
                      <option value="bulk">Commande en gros</option>
                      <option value="coa">Certificat d&apos;analyse (COA)</option>
                      <option value="technical">Support technique</option>
                      <option value="partnership">Partenariat</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                      Message *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Décrivez votre question ou demande en détail..."
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        border: '1px solid #d1d5db', 
                        borderRadius: '8px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    style={{ 
                      width: '100%', 
                      padding: '14px', 
                      backgroundColor: '#CC5500',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '16px',
                      cursor: sending ? 'not-allowed' : 'pointer',
                      opacity: sending ? 0.7 : 1
                    }}
                  >
                    {sending ? 'Envoi en cours...' : 'Envoyer le message'}
                  </button>

                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px', textAlign: 'center' }}>
                    En soumettant ce formulaire, vous acceptez notre{' '}
                    <Link href="/mentions-legales/confidentialite" style={{ color: '#CC5500' }}>
                      politique de confidentialité
                    </Link>.
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

function ContactCard({ icon, title, lines, isEmail }: { icon: string; title: string; lines: string[]; isEmail?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        padding: '20px',
        backgroundColor: 'white',
        borderRadius: '12px',
        border: '1px solid #e5e7eb',
      }}
    >
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
          {title}
        </h3>
        {lines.map((line, i) => (
          <p key={i} style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
            {isEmail && line.includes('@') ? (
              <a href={`mailto:${line}`} style={{ color: '#CC5500' }}>{line}</a>
            ) : (
              line
            )}
          </p>
        ))}
      </div>
    </div>
  );
}

function QuickLink({ href, icon, text }: { href: string; icon: string; text: string }) {
  return (
    <li style={{ marginBottom: '8px' }}>
      <Link 
        href={href} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          color: '#4b5563', 
          textDecoration: 'none',
          fontSize: '14px',
          padding: '8px 0',
          borderBottom: '1px solid #f3f4f6'
        }}
      >
        <span>{icon}</span>
        <span>{text}</span>
      </Link>
    </li>
  );
}
