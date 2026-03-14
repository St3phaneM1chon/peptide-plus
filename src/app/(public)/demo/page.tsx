/**
 * PAGE DEMANDE DE DÉMO
 */

'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/client';

export default function DemoPage() {
  const { t } = useI18n();
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
  const [error, setError] = useState('');

  // FIX A10-P0-001: Wire form to CRM lead creation API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/demo-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t('demo.errorGeneric'));
        return;
      }
      setSent(true);
    } catch {
      setError(t('demo.errorNetwork'));
    } finally {
      setSending(false);
    }
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
            <h1 className="font-heading" style={{ fontSize: '36px', fontWeight: 700, marginBottom: '24px', color: 'var(--gray-500)' }}>
              {t('demo.title')}
            </h1>
            <p style={{ fontSize: '16px', color: 'var(--gray-400)', lineHeight: 1.7, marginBottom: '40px' }}>
              {t('demo.heroText')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {[
                { icon: '🎯', title: t('demo.feature1Title'), desc: t('demo.feature1Desc') },
                { icon: '⏱️', title: t('demo.feature2Title'), desc: t('demo.feature2Desc') },
                { icon: '💬', title: t('demo.feature3Title'), desc: t('demo.feature3Desc') },
                { icon: '🎁', title: t('demo.feature4Title'), desc: t('demo.feature4Desc') },
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
                &ldquo;{t('demo.testimonialQuote')}&rdquo;
              </p>
              <p style={{ fontSize: '13px', color: 'var(--gray-400)' }}>
                {t('demo.testimonialAuthor')}
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
                  {t('demo.successTitle')}
                </h2>
                <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '8px' }}>
                  {t('demo.successText')}
                </p>
                <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>
                  {t('demo.successEmail')}
                </p>
              </div>
            ) : (
              <>
                <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px', color: 'var(--gray-500)' }}>
                  {t('demo.formTitle')}
                </h2>

                <form onSubmit={handleSubmit}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="form-label">{t('demo.firstName')} *</label>
                      <input
                        type="text"
                        required
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">{t('demo.lastName')} *</label>
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
                    <label className="form-label">{t('demo.email')} *</label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="form-input"
                      placeholder={t('demo.emailPlaceholder')}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="form-label">{t('demo.company')} *</label>
                      <input
                        type="text"
                        required
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        className="form-input"
                      />
                    </div>
                    <div>
                      <label className="form-label">{t('demo.phone')}</label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label">{t('demo.employees')} *</label>
                    <select
                      required
                      value={formData.employees}
                      onChange={(e) => setFormData({ ...formData, employees: e.target.value })}
                      className="form-input form-select"
                    >
                      <option value="">{t('demo.select')}</option>
                      <option value="1-50">1 - 50</option>
                      <option value="51-200">51 - 200</option>
                      <option value="201-500">201 - 500</option>
                      <option value="501-1000">501 - 1000</option>
                      <option value="1000+">1000+</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label className="form-label">{t('demo.needs')}</label>
                    <select
                      value={formData.needs}
                      onChange={(e) => setFormData({ ...formData, needs: e.target.value })}
                      className="form-input form-select"
                    >
                      <option value="">{t('demo.select')}</option>
                      <option value="onboarding">{t('demo.needOnboarding')}</option>
                      <option value="compliance">{t('demo.needCompliance')}</option>
                      <option value="skills">{t('demo.needSkills')}</option>
                      <option value="leadership">{t('demo.needLeadership')}</option>
                      <option value="other">{t('demo.needOther')}</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: '24px' }}>
                    <label className="form-label">{t('demo.message')}</label>
                    <textarea
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      className="form-input"
                      placeholder={t('demo.messagePlaceholder')}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  {error && (
                    <p style={{ color: '#dc2626', fontSize: '14px', marginBottom: '12px', textAlign: 'center' }}>
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '14px', opacity: sending ? 0.7 : 1 }}
                  >
                    {sending ? t('demo.sending') : t('demo.submit')}
                  </button>

                  <p style={{ fontSize: '12px', color: 'var(--gray-400)', textAlign: 'center', marginTop: '16px' }}>
                    {t('demo.privacyText')}{' '}
                    <a href="/mentions-legales/confidentialite" style={{ color: 'var(--gray-500)' }}>
                      {t('demo.privacyLink')}
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
