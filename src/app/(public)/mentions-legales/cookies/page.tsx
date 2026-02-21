'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/client';

/**
 * PAGE POLITIQUE DE COOKIES - BioCycle Peptides
 * i18n: All text from legal.cookies namespace
 */

export default function CookiesPage() {
  const { t } = useI18n();
  const lastUpdated = '2026-01-25';
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true,
    analytics: true,
    functional: true,
    marketing: false,
  });

  const savePreferences = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('biocycle-cookie-preferences', JSON.stringify(preferences));
      setShowPreferences(false);
      alert(t('legal.cookies.preferencesSaved'));
    }
  };

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: '#1f2937' }}>
          {t('legal.cookies.title')}
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '48px' }}>
          {t('legal.lastUpdated', { date: lastUpdated })}
        </p>

        <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
          <Section title={t('legal.cookies.s1Title')}>
            <p>{t('legal.cookies.s1Text')}</p>
          </Section>

          <Section title={t('legal.cookies.s2Title')}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#059669' }}>
              {t('legal.cookies.s2EssentialTitle')}
            </h3>
            <p>{t('legal.cookies.s2EssentialText')}</p>
            <ul>
              <li>{t('legal.cookies.s2EssentialList1')}</li>
              <li>{t('legal.cookies.s2EssentialList2')}</li>
              <li>{t('legal.cookies.s2EssentialList3')}</li>
              <li>{t('legal.cookies.s2EssentialList4')}</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
              <strong>{t('legal.cookies.s2EssentialDuration')}</strong>
            </p>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#3b82f6' }}>
              {t('legal.cookies.s2AnalyticsTitle')}
            </h3>
            <p>{t('legal.cookies.s2AnalyticsText')}</p>
            <ul>
              <li>{t('legal.cookies.s2AnalyticsList1')}</li>
              <li>{t('legal.cookies.s2AnalyticsList2')}</li>
              <li>{t('legal.cookies.s2AnalyticsList3')}</li>
              <li>{t('legal.cookies.s2AnalyticsList4')}</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
              <strong>{t('legal.cookies.s2AnalyticsService')}</strong>
            </p>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#8b5cf6' }}>
              {t('legal.cookies.s2FunctionalTitle')}
            </h3>
            <p>{t('legal.cookies.s2FunctionalText')}</p>
            <ul>
              <li>{t('legal.cookies.s2FunctionalList1')}</li>
              <li>{t('legal.cookies.s2FunctionalList2')}</li>
              <li>{t('legal.cookies.s2FunctionalList3')}</li>
            </ul>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px', color: '#CC5500' }}>
              {t('legal.cookies.s2MarketingTitle')}
            </h3>
            <p>{t('legal.cookies.s2MarketingText')}</p>
            <ul>
              <li>{t('legal.cookies.s2MarketingList1')}</li>
              <li>{t('legal.cookies.s2MarketingList2')}</li>
              <li>{t('legal.cookies.s2MarketingList3')}</li>
            </ul>
            <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
              <strong>{t('legal.cookies.s2MarketingService')}</strong>
            </p>
          </Section>

          <Section title={t('legal.cookies.s3Title')}>
            <p>{t('legal.cookies.s3Text')}</p>

            <div style={{ marginTop: '24px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: '#CC5500',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {t('legal.cookies.managePreferences')}
              </button>

              {showPreferences && (
                <div style={{ marginTop: '20px', padding: '16px', backgroundColor: 'white', borderRadius: '8px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'not-allowed' }}>
                      <input type="checkbox" checked disabled style={{ width: '18px', height: '18px' }} />
                      <span><strong>{t('legal.cookies.essential')}</strong> - {t('legal.cookies.essentialNote')}</span>
                    </label>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={preferences.analytics}
                        onChange={(e) => setPreferences({...preferences, analytics: e.target.checked})}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span><strong>{t('legal.cookies.analytics')}</strong> - {t('legal.cookies.analyticsNote')}</span>
                    </label>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={preferences.functional}
                        onChange={(e) => setPreferences({...preferences, functional: e.target.checked})}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span><strong>{t('legal.cookies.functional')}</strong> - {t('legal.cookies.functionalNote')}</span>
                    </label>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={preferences.marketing}
                        onChange={(e) => setPreferences({...preferences, marketing: e.target.checked})}
                        style={{ width: '18px', height: '18px' }}
                      />
                      <span><strong>{t('legal.cookies.marketing')}</strong> - {t('legal.cookies.marketingNote')}</span>
                    </label>
                  </div>
                  <button
                    onClick={savePreferences}
                    style={{
                      marginTop: '12px',
                      padding: '10px 20px',
                      backgroundColor: '#059669',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    {t('legal.cookies.savePreferences')}
                  </button>
                </div>
              )}
            </div>
          </Section>

          <Section title={t('legal.cookies.s4Title')}>
            <p>{t('legal.cookies.s4Text')}</p>
            <ul>
              <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">Chrome</a></li>
              <li><a href="https://support.mozilla.org/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer">Firefox</a></li>
              <li><a href="https://support.apple.com/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">Safari</a></li>
              <li><a href="https://support.microsoft.com/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">Edge</a></li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              <strong>{t('legal.cookies.s4Note')}</strong>
            </p>
          </Section>

          <Section title={t('legal.cookies.s5Title')}>
            <p>{t('legal.cookies.s5Text')}</p>
            <ul>
              <li><a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Analytics</a></li>
              <li><a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">Stripe</a></li>
              <li><a href="https://www.paypal.com/ca/webapps/mpp/ua/privacy-full" target="_blank" rel="noopener noreferrer">PayPal</a></li>
            </ul>
          </Section>

          <Section title={t('legal.cookies.s6Title')}>
            <p>{t('legal.cookies.s6Text')}</p>
            <ul>
              <li>{t('legal.cookies.s6List1')}</li>
              <li>{t('legal.cookies.s6List2')}</li>
              <li>{t('legal.cookies.s6List3')}</li>
            </ul>
          </Section>

          <Section title={t('legal.cookies.s7Title')}>
            <p>{t('legal.cookies.s7Text')}</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>{t('legal.cookies.s7Email')}</li>
            </ul>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }} className="legal-content">
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: '#1f2937' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
