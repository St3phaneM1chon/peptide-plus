/**
 * PAGE CONTACT - BioCycle Peptides
 * Formulaire de contact fonctionnel
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { contactFormSchema, validateForm } from '@/lib/form-validation';

interface PlatformLink {
  id: 'zoom' | 'whatsapp' | 'teams';
  link: string;
}

export default function ContactPage() {
  const { t } = useI18n();
  const [platforms, setPlatforms] = useState<PlatformLink[]>([]);

  useEffect(() => {
    fetch('/api/contact/platforms')
      .then(res => res.json())
      .then(data => setPlatforms(data.platforms || []))
      .catch(() => {});
  }, []);

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const clearFieldError = (field: string) => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const validation = validateForm(contactFormSchema, {
      name: formData.name,
      email: formData.email,
      subject: formData.subject,
      message: formData.message,
    });

    if (!validation.success) {
      setFieldErrors(validation.errors || {});
      return;
    }

    setFieldErrors({});
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
        setError(data.error || t('contact.error'));
      }
    } catch {
      setError(t('contact.connectionError'));
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
          {t('contact.title')}
        </h1>
        <p style={{ fontSize: '18px', color: '#d1d5db' }}>
          {t('contact.subtitle')}
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
              {t('contact.info')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <ContactCard
                icon="📍"
                title={t('contact.headquarters')}
                lines={[
                  'BioCycle Peptides Inc.',
                  'Montréal, Québec',
                  'Canada',
                ]}
              />
              <ContactCard
                icon="📞"
                title={t('contact.phone')}
                lines={[
                  t('contact.hoursWeekday'),
                  t('contact.bilingual'),
                ]}
              />
              <ContactCard
                icon="✉️"
                title={t('contact.emailAddress')}
                lines={[
                  'support@biocyclepeptides.com',
                  'info@biocyclepeptides.com',
                  t('contact.responseTime'),
                ]}
                isEmail
              />
            </div>

            {/* Communication Platforms - dynamic from admin config */}
            {platforms.length > 0 && (
              <div style={{ marginTop: '32px', padding: '24px', backgroundColor: '#eef2ff', borderRadius: '12px', border: '1px solid #c7d2fe' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
                  {t('contact.meetWithUs')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {platforms.map(p => (
                    <PlatformButton key={p.id} platform={p.id} link={p.link} t={t} />
                  ))}
                </div>
              </div>
            )}

            {/* Quick Links */}
            <div style={{ marginTop: '32px', padding: '24px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
                {t('contact.quickLinks')}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <QuickLink href="/faq" icon="❓" text={t('contact.faqLink')} />
                <QuickLink href="/track-order" icon="📦" text={t('contact.trackOrderLink')} />
                <QuickLink href="/shipping-policy" icon="🚚" text={t('contact.shippingLink')} />
                <QuickLink href="/refund-policy" icon="↩️" text={t('contact.refundLink')} />
                <QuickLink href="/lab-results" icon="🔬" text={t('contact.labLink')} />
              </ul>
            </div>

            {/* Business Hours */}
            <div style={{ marginTop: '24px', padding: '24px', backgroundColor: '#f0fdf4', borderRadius: '12px', border: '1px solid #86efac' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: '#166534' }}>
                🕐 {t('contact.businessHours')}
              </h3>
              <p style={{ fontSize: '14px', color: '#166534', marginBottom: '4px' }}>
                {t('contact.weekdayHours')}
              </p>
              <p style={{ fontSize: '14px', color: '#166534', marginBottom: '4px' }}>
                {t('contact.weekendHours')}
              </p>
              <p style={{ fontSize: '13px', color: '#15803d', marginTop: '12px' }}>
                {t('contact.onlineOrders')}
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
                  {t('contact.messageSent')}
                </h3>
                <p style={{ color: '#6b7280', marginBottom: '8px' }}>
                  {t('contact.thankYou')}
                </p>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                  {t('contact.responseMessage')}
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
                  {t('contact.sendAnother')}
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
                  {t('contact.send')}
                </h2>
                <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>
                  {t('contact.formMessage')}
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
                        {t('contact.fullName')}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clearFieldError('name'); }}
                        placeholder={t('contact.placeholderName')}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: fieldErrors.name ? '1px solid #ef4444' : '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                      {fieldErrors.name && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.name}</p>}
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                        {t('contact.emailAddress')} *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => { setFormData({ ...formData, email: e.target.value }); clearFieldError('email'); }}
                        placeholder={t('contact.placeholderEmail')}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: fieldErrors.email ? '1px solid #ef4444' : '1px solid #d1d5db',
                          borderRadius: '8px',
                          fontSize: '14px'
                        }}
                      />
                      {fieldErrors.email && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.email}</p>}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                        {t('contact.institution')}
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder={t('contact.placeholderOrganization')}
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
                        {t('contact.phone')}
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
                      {t('contact.subject')} *
                    </label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => { setFormData({ ...formData, subject: e.target.value }); clearFieldError('subject'); }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: fieldErrors.subject ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="">{t('contact.selectSubject')}</option>
                      <option value="product">{t('contact.subjectProduct')}</option>
                      <option value="order">{t('contact.subjectOrder')}</option>
                      <option value="shipping">{t('contact.subjectShipping')}</option>
                      <option value="bulk">{t('contact.subjectBulk')}</option>
                      <option value="coa">{t('contact.subjectCoa')}</option>
                      <option value="technical">{t('contact.subjectTechnical')}</option>
                      <option value="partnership">{t('contact.subjectPartnership')}</option>
                      <option value="other">{t('contact.subjectOther')}</option>
                    </select>
                    {fieldErrors.subject && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.subject}</p>}
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '6px', color: '#374151' }}>
                      {t('contact.message')} *
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => { setFormData({ ...formData, message: e.target.value }); clearFieldError('message'); }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: fieldErrors.message ? '1px solid #ef4444' : '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        resize: 'vertical'
                      }}
                    />
                    {fieldErrors.message && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.message}</p>}
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
                    {sending ? t('contact.sending') : t('contact.sendForm')}
                  </button>

                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '16px', textAlign: 'center' }}>
                    {t('contact.privacyNote')}{' '}
                    <Link href="/mentions-legales/confidentialite" style={{ color: '#CC5500' }}>
                      {t('contact.privacyPolicy')}
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

const PLATFORM_ICONS: Record<string, { svg: JSX.Element; label: (t: (k: string) => string) => string }> = {
  zoom: {
    svg: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#2D8CFF"/>
        <path d="M6.5 8.5C6.5 7.67 7.17 7 8 7h5c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H8c-.83 0-1.5-.67-1.5-1.5v-5z" fill="white"/>
        <path d="M15 10l2.5-1.5v5L15 12v-2z" fill="white"/>
      </svg>
    ),
    label: (t) => t('contact.joinZoom'),
  },
  whatsapp: {
    svg: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#25D366"/>
        <path d="M12 4C7.58 4 4 7.58 4 12c0 1.5.4 2.9 1.13 4.1L4 20l4.02-1.05A7.95 7.95 0 0012 20c4.42 0 8-3.58 8-8s-3.58-8-8-8zm0 14.5c-1.28 0-2.5-.35-3.57-.96l-.25-.15-2.63.69.7-2.56-.17-.27A6.44 6.44 0 015.5 12c0-3.58 2.92-6.5 6.5-6.5s6.5 2.92 6.5 6.5-2.92 6.5-6.5 6.5zm3.56-4.86c-.2-.1-1.16-.57-1.34-.63-.18-.07-.31-.1-.44.1-.13.2-.5.63-.62.76-.11.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.52-.99-1.17-1.1-1.37-.12-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.34h-.38c-.13 0-.34.05-.52.25s-.68.67-.68 1.63.7 1.89.8 2.02c.1.13 1.37 2.09 3.32 2.93.46.2.83.32 1.11.41.47.15.9.13 1.23.08.38-.06 1.16-.47 1.32-.93.16-.46.16-.85.11-.93-.05-.08-.18-.13-.38-.23z" fill="white"/>
      </svg>
    ),
    label: (t) => t('contact.chatWhatsApp'),
  },
  teams: {
    svg: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <rect width="24" height="24" rx="5" fill="#5B5FC7"/>
        <circle cx="14.5" cy="7.5" r="2" fill="white"/>
        <path d="M17 10h-5c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h5c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1z" fill="white"/>
        <circle cx="9" cy="8.5" r="2.5" fill="white"/>
        <path d="M13 12H5c-.55 0-1 .45-1 1v3.5c0 .55.45 1 1 1h8c.55 0 1-.45 1-1V13c0-.55-.45-1-1-1z" fill="white"/>
      </svg>
    ),
    label: (t) => t('contact.joinTeams'),
  },
};

function PlatformButton({ platform, link, t }: { platform: string; link: string; t: (k: string) => string }) {
  const config = PLATFORM_ICONS[platform];
  if (!config) return null;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: 'white',
        borderRadius: '10px',
        border: '1px solid #e5e7eb',
        textDecoration: 'none',
        color: '#374151',
        fontSize: '14px',
        fontWeight: 500,
      }}
    >
      {config.svg}
      {config.label(t)}
    </a>
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
