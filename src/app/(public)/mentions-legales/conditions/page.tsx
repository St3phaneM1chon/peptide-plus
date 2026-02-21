'use client';

/**
 * PAGE CONDITIONS D'UTILISATION - BioCycle Peptides
 * Spécifique à la vente de peptides de recherche
 * i18n: All text from legal.terms namespace
 */

import { useI18n } from '@/i18n/client';

export default function TermsPage() {
  const { t } = useI18n();
  const lastUpdated = '2026-01-25';
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BioCycle Peptides';

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: '#1f2937' }}>
          {t('legal.terms.title')}
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '48px' }}>
          {t('legal.lastUpdated', { date: lastUpdated })}
        </p>

        <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
          <Section title={t('legal.terms.s1Title')}>
            <p>{t('legal.terms.s1Text', { siteName })}</p>
          </Section>

          <Section title={t('legal.terms.s2Title')}>
            <p>{t('legal.terms.s2Text', { siteName })}</p>
            <ul>
              <li>{t('legal.terms.s2List1')}</li>
              <li>{t('legal.terms.s2List2')}</li>
              <li>{t('legal.terms.s2List3')}</li>
              <li>{t('legal.terms.s2List4')}</li>
            </ul>
            <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #f59e0b' }}>
              <p style={{ fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>
                {t('legal.terms.s2WarningTitle')}
              </p>
              <p style={{ color: '#92400e', fontSize: '14px' }}>
                {t('legal.terms.s2WarningText')}
              </p>
            </div>
          </Section>

          <Section title={t('legal.terms.s3Title')}>
            <p>{t('legal.terms.s3Text')}</p>
            <ul>
              <li>{t('legal.terms.s3List1')}</li>
              <li>{t('legal.terms.s3List2')}</li>
              <li>{t('legal.terms.s3List3')}</li>
              <li>{t('legal.terms.s3List4')}</li>
              <li>{t('legal.terms.s3List5')}</li>
            </ul>
          </Section>

          <Section title={t('legal.terms.s4Title')}>
            <p>{t('legal.terms.s4Text')}</p>
            <ul>
              <li>{t('legal.terms.s4List1')}</li>
              <li>{t('legal.terms.s4List2')}</li>
              <li>{t('legal.terms.s4List3')}</li>
              <li>{t('legal.terms.s4List4')}</li>
              <li>{t('legal.terms.s4List5')}</li>
            </ul>
          </Section>

          <Section title={t('legal.terms.s5Title')}>
            <p>{t('legal.terms.s5Text')}</p>
            <ul>
              <li>{t('legal.terms.s5List1')}</li>
              <li>{t('legal.terms.s5List2')}</li>
              <li>{t('legal.terms.s5List3')}</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              {t('legal.terms.s5TaxText')}
            </p>
          </Section>

          <Section title={t('legal.terms.s6Title')}>
            <p>{t('legal.terms.s6Text')}</p>
            <ul>
              <li>{t('legal.terms.s6List1')}</li>
              <li>{t('legal.terms.s6List2')}</li>
              <li>{t('legal.terms.s6List3')}</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              {t('legal.terms.s6ShippingNote')}
            </p>
          </Section>

          <Section title={t('legal.terms.s7Title')}>
            <p>{t('legal.terms.s7Text')}</p>
            <ul>
              <li>{t('legal.terms.s7List1')}</li>
              <li>{t('legal.terms.s7List2')}</li>
              <li>{t('legal.terms.s7List3')}</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              {t('legal.terms.s7ReturnNote')}
            </p>
          </Section>

          <Section title={t('legal.terms.s8Title')}>
            <p>{t('legal.terms.s8Text')}</p>
            <ul>
              <li>{t('legal.terms.s8List1')}</li>
              <li>{t('legal.terms.s8List2')}</li>
              <li>{t('legal.terms.s8List3')}</li>
              <li>{t('legal.terms.s8List4')}</li>
            </ul>
          </Section>

          <Section title={t('legal.terms.s9Title')}>
            <p>{t('legal.terms.s9Text', { siteName })}</p>
          </Section>

          <Section title={t('legal.terms.s10Title')}>
            <p>{t('legal.terms.s10Text', { siteName })}</p>
            <ul>
              <li>{t('legal.terms.s10List1')}</li>
              <li>{t('legal.terms.s10List2')}</li>
              <li>{t('legal.terms.s10List3')}</li>
              <li>{t('legal.terms.s10List4')}</li>
              <li>{t('legal.terms.s10List5')}</li>
            </ul>
          </Section>

          <Section title={t('legal.terms.s11Title')}>
            <p>{t('legal.terms.s11Text')}</p>
          </Section>

          <Section title={t('legal.terms.s12Title')}>
            <p>{t('legal.terms.s12Text')}</p>
          </Section>

          <Section title={t('legal.terms.s13Title')}>
            <p>{t('legal.terms.s13Text')}</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>{t('legal.terms.s13Email')}</li>
              <li>{t('legal.terms.s13Address')}</li>
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
