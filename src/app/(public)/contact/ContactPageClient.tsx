/**
 * CONTACT PAGE — Client Component
 *
 * Receives company info from the server component (loaded from SiteSettings)
 * and renders the contact form + info cards. No hardcoded addresses or emails.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/client';
import { addCSRFHeader } from '@/lib/csrf';
import { contactFormSchema, validateForm } from '@/lib/form-validation';

interface BusinessHoursEntry {
  day: string;
  hours: string;
}

interface PlatformLink {
  id: 'zoom' | 'whatsapp' | 'teams';
  link: string;
}

interface ContactPageClientProps {
  companyName: string;
  addressParts: string[];
  emails: string[];
  phone: string | null;
  businessHours: BusinessHoursEntry[];
}

export default function ContactPageClient({
  companyName,
  addressParts,
  emails,
  phone,
  businessHours,
}: ContactPageClientProps) {
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
        headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
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
    <div style={{ minHeight: '100vh', background: 'var(--k-bg, #0a0a0f)' }}>
      {/* Hero */}
      <section
        className="py-12 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(59,130,246,0.10) 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <h1
          className="font-heading text-3xl md:text-4xl font-bold mb-2"
          style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
        >
          {t('contact.title')}
        </h1>
        <p style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}>
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
            <h2
              style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}
              className="text-white/90"
            >
              {t('contact.info')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Address */}
              {addressParts.length > 0 && (
                <InfoCard
                  icon="📍"
                  title={t('contact.headquarters')}
                  lines={[companyName, ...addressParts]}
                />
              )}

              {/* Phone */}
              {phone && (
                <InfoCard
                  icon="📞"
                  title={t('contact.phone')}
                  lines={[
                    phone,
                    t('contact.hoursWeekday'),
                    t('contact.bilingual'),
                  ]}
                />
              )}

              {/* Emails */}
              {emails.length > 0 && (
                <InfoCard
                  icon="✉️"
                  title={t('contact.emailAddress')}
                  lines={[...emails, t('contact.responseTime')]}
                  isEmail
                />
              )}
            </div>

            {/* Communication Platforms */}
            {platforms.length > 0 && (
              <div
                className="mt-8 rounded-xl p-6"
                style={{
                  background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <h3
                  style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}
                  className="text-white/90"
                >
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
            <div
              className="mt-6 rounded-xl p-6"
              style={{
                background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h3
                style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}
                className="text-white/90"
              >
                {t('contact.quickLinks')}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                <QuickLink href="/faq" icon="❓" text={t('contact.faqLink')} />
                <QuickLink href="/track-order" icon="📦" text={t('contact.trackOrderLink')} />
                <QuickLink href="/shipping-policy" icon="🚚" text={t('contact.shippingLink')} />
                <QuickLink href="/refund-policy" icon="↩️" text={t('contact.refundLink')} />
              </ul>
            </div>

            {/* Business Hours */}
            {businessHours.length > 0 && (
              <div
                className="mt-6 rounded-xl p-6"
                style={{
                  background: 'var(--k-glass-chromatic, rgba(99,102,241,0.08))',
                  border: '1px solid rgba(99,102,241,0.15)',
                }}
              >
                <h3
                  style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}
                  className="text-white/90"
                >
                  🕐 {t('contact.businessHours')}
                </h3>
                {businessHours.map((entry, i) => (
                  <p
                    key={i}
                    style={{ fontSize: '14px', marginBottom: '4px' }}
                    className="text-white/60"
                  >
                    <span className="text-white/80 font-medium">{entry.day}:</span> {entry.hours}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Contact Form */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {sent ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    background: 'rgba(34,197,94,0.15)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                  }}
                >
                  <span style={{ fontSize: '40px' }}>✅</span>
                </div>
                <h3
                  className="text-2xl font-semibold mb-3"
                  style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
                >
                  {t('contact.messageSent')}
                </h3>
                <p className="text-white/60 mb-2">{t('contact.thankYou')}</p>
                <p className="text-white/50 text-sm">{t('contact.responseMessage')}</p>
                <button
                  onClick={() => {
                    setSent(false);
                    setFormData({ name: '', email: '', company: '', phone: '', subject: '', message: '' });
                  }}
                  className="mt-6 px-6 py-2.5 rounded-lg font-medium text-white/80 transition-colors"
                  style={{
                    background: 'var(--k-glass-thick, rgba(255,255,255,0.12))',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  {t('contact.sendAnother')}
                </button>
              </div>
            ) : (
              <>
                <h2
                  className="text-2xl font-semibold mb-2"
                  style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
                >
                  {t('contact.send')}
                </h2>
                <p className="text-white/50 text-sm mb-6">{t('contact.formMessage')}</p>

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg px-4 py-3 mb-5 text-sm"
                    style={{
                      background: 'rgba(239,68,68,0.12)',
                      border: '1px solid rgba(239,68,68,0.25)',
                      color: '#f87171',
                    }}
                  >
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <fieldset disabled={sending} style={{ border: 'none', padding: 0, margin: 0 }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <FormInput
                        id="contact-name"
                        label={t('contact.fullName')}
                        type="text"
                        required
                        value={formData.name}
                        onChange={(v) => { setFormData({ ...formData, name: v }); clearFieldError('name'); }}
                        placeholder={t('contact.placeholderName')}
                        error={fieldErrors.name}
                      />
                      <FormInput
                        id="contact-email"
                        label={`${t('contact.emailAddress')} *`}
                        type="email"
                        required
                        value={formData.email}
                        onChange={(v) => { setFormData({ ...formData, email: v }); clearFieldError('email'); }}
                        placeholder={t('contact.placeholderEmail')}
                        error={fieldErrors.email}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <FormInput
                        id="contact-company"
                        label={t('contact.institution')}
                        type="text"
                        value={formData.company}
                        onChange={(v) => setFormData({ ...formData, company: v })}
                        placeholder={t('contact.placeholderOrganization')}
                      />
                      <FormInput
                        id="contact-phone"
                        label={t('contact.phone')}
                        type="tel"
                        value={formData.phone}
                        onChange={(v) => setFormData({ ...formData, phone: v })}
                        placeholder="(514) 555-0123"
                      />
                    </div>

                    <div className="mb-4">
                      <label
                        htmlFor="contact-subject"
                        className="block text-sm font-medium mb-1.5"
                        style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
                      >
                        {t('contact.subject')} *
                      </label>
                      <select
                        id="contact-subject"
                        required
                        value={formData.subject}
                        onChange={(e) => { setFormData({ ...formData, subject: e.target.value }); clearFieldError('subject'); }}
                        className="w-full px-3 py-2.5 rounded-lg text-sm"
                        style={{
                          background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
                          border: fieldErrors.subject ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.10)',
                          color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                        }}
                      >
                        <option value="">{t('contact.selectSubject')}</option>
                        <option value="product">{t('contact.subjectProduct')}</option>
                        <option value="order">{t('contact.subjectOrder')}</option>
                        <option value="shipping">{t('contact.subjectShipping')}</option>
                        <option value="bulk">{t('contact.subjectBulk')}</option>
                        <option value="technical">{t('contact.subjectTechnical')}</option>
                        <option value="partnership">{t('contact.subjectPartnership')}</option>
                        <option value="other">{t('contact.subjectOther')}</option>
                      </select>
                      {fieldErrors.subject && (
                        <p className="text-red-400 text-xs mt-1">{fieldErrors.subject}</p>
                      )}
                    </div>

                    <div className="mb-6">
                      <label
                        htmlFor="contact-message"
                        className="block text-sm font-medium mb-1.5"
                        style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
                      >
                        {t('contact.message')} *
                      </label>
                      <textarea
                        id="contact-message"
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => { setFormData({ ...formData, message: e.target.value }); clearFieldError('message'); }}
                        className="w-full px-3 py-2.5 rounded-lg text-sm resize-y"
                        style={{
                          background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
                          border: fieldErrors.message ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.10)',
                          color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
                        }}
                      />
                      {fieldErrors.message && (
                        <p className="text-red-400 text-xs mt-1">{fieldErrors.message}</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={sending}
                      className="w-full py-3.5 rounded-xl font-semibold text-base transition-opacity"
                      style={{
                        background: 'var(--k-accent, #6366f1)',
                        color: '#fff',
                        opacity: sending ? 0.6 : 1,
                        cursor: sending ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {sending ? t('contact.sending') : t('contact.sendForm')}
                    </button>
                  </fieldset>

                  <p className="text-xs text-center mt-4" style={{ color: 'var(--k-text-muted, rgba(255,255,255,0.25))' }}>
                    {t('contact.privacyNote')}{' '}
                    <Link href="/privacy" style={{ color: 'var(--k-accent, #6366f1)' }}>
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

// ── Sub-components ────────────────────────────────────────────────────

function InfoCard({
  icon,
  title,
  lines,
  isEmail,
}: {
  icon: string;
  title: string;
  lines: string[];
  isEmail?: boolean;
}) {
  return (
    <div
      className="flex gap-4 rounded-xl p-5"
      style={{
        background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <div>
        <h3 className="text-sm font-semibold mb-2 text-white/90">{title}</h3>
        {lines.map((line, i) => (
          <p key={i} className="text-sm text-white/60 mb-1">
            {isEmail && line.includes('@') ? (
              <a href={`mailto:${line}`} style={{ color: 'var(--k-accent, #6366f1)' }}>
                {line}
              </a>
            ) : (
              line
            )}
          </p>
        ))}
      </div>
    </div>
  );
}

function FormInput({
  id,
  label,
  type,
  required,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium mb-1.5"
        style={{ color: 'var(--k-text-secondary, rgba(255,255,255,0.60))' }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg text-sm"
        style={{
          background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
          border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.10)',
          color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
        }}
      />
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  );
}

function QuickLink({ href, icon, text }: { href: string; icon: string; text: string }) {
  return (
    <li style={{ marginBottom: '8px' }}>
      <Link
        href={href}
        className="flex items-center gap-2 text-sm py-2"
        style={{
          color: 'var(--k-text-secondary, rgba(255,255,255,0.60))',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <span>{icon}</span>
        <span>{text}</span>
      </Link>
    </li>
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
      className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors"
      style={{
        background: 'var(--k-glass-thin, rgba(255,255,255,0.05))',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'var(--k-text-primary, rgba(255,255,255,0.95))',
      }}
    >
      {config.svg}
      {config.label(t)}
    </a>
  );
}
