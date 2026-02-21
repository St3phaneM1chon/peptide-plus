'use client';

/**
 * PAGE POLITIQUE DE CONFIDENTIALITÉ - BioCycle Peptides
 * Conforme RGPD, PIPEDA, Loi 25 Québec
 * i18n: All text from legal.privacy namespace
 */

import { useI18n } from '@/i18n/client';

export default function PrivacyPage() {
  const { t } = useI18n();
  const lastUpdated = '2026-01-25';
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'BioCycle Peptides';

  return (
    <div style={{ backgroundColor: 'white', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '64px 24px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '16px', color: '#1f2937' }}>
          {t('legal.privacy.title')}
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '48px' }}>
          {t('legal.lastUpdated', { date: lastUpdated })}
        </p>

        <div style={{ fontSize: '15px', color: '#374151', lineHeight: 1.8 }}>
          <Section title={t('legal.privacy.s1Title')}>
            <p>{t('legal.privacy.s1Text', { siteName })}</p>
            <ul>
              <li>{t('legal.privacy.s1List1')}</li>
              <li>{t('legal.privacy.s1List2')}</li>
              <li>{t('legal.privacy.s1List3')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s2Title')}>
            <p><strong>{t('legal.privacy.s2ProvidedTitle')}</strong></p>
            <ul>
              <li>{t('legal.privacy.s2ProvidedList1')}</li>
              <li>{t('legal.privacy.s2ProvidedList2')}</li>
              <li>{t('legal.privacy.s2ProvidedList3')}</li>
              <li>{t('legal.privacy.s2ProvidedList4')}</li>
            </ul>

            <p style={{ marginTop: '16px' }}><strong>{t('legal.privacy.s2AutoTitle')}</strong></p>
            <ul>
              <li>{t('legal.privacy.s2AutoList1')}</li>
              <li>{t('legal.privacy.s2AutoList2')}</li>
              <li>{t('legal.privacy.s2AutoList3')}</li>
              <li>{t('legal.privacy.s2AutoList4')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s3Title')}>
            <p>{t('legal.privacy.s3Text')}</p>
            <ul>
              <li>{t('legal.privacy.s3List1')}</li>
              <li>{t('legal.privacy.s3List2')}</li>
              <li>{t('legal.privacy.s3List3')}</li>
              <li>{t('legal.privacy.s3List4')}</li>
              <li>{t('legal.privacy.s3List5')}</li>
              <li>{t('legal.privacy.s3List6')}</li>
              <li>{t('legal.privacy.s3List7')}</li>
              <li>{t('legal.privacy.s3List8')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s4Title')}>
            <p>{t('legal.privacy.s4Text')}</p>
            <ul>
              <li>{t('legal.privacy.s4List1')}</li>
              <li>{t('legal.privacy.s4List2')}</li>
              <li>{t('legal.privacy.s4List3')}</li>
              <li>{t('legal.privacy.s4List4')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s5Title')}>
            <p>{t('legal.privacy.s5Text')}</p>
            <ul>
              <li>{t('legal.privacy.s5List1')}</li>
              <li>{t('legal.privacy.s5List2')}</li>
              <li>{t('legal.privacy.s5List3')}</li>
              <li>{t('legal.privacy.s5List4')}</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              {t('legal.privacy.s5Note')}
            </p>
          </Section>

          <Section title={t('legal.privacy.s6Title')}>
            <p>{t('legal.privacy.s6Text')}</p>
            <ul>
              <li>{t('legal.privacy.s6List1')}</li>
              <li>{t('legal.privacy.s6List2')}</li>
              <li>{t('legal.privacy.s6List3')}</li>
              <li>{t('legal.privacy.s6List4')}</li>
              <li>{t('legal.privacy.s6List5')}</li>
              <li>{t('legal.privacy.s6List6')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s7Title')}>
            <p>{t('legal.privacy.s7Text')}</p>
            <ul>
              <li>{t('legal.privacy.s7List1')}</li>
              <li>{t('legal.privacy.s7List2')}</li>
              <li>{t('legal.privacy.s7List3')}</li>
              <li>{t('legal.privacy.s7List4')}</li>
              <li>{t('legal.privacy.s7List5')}</li>
              <li>{t('legal.privacy.s7List6')}</li>
              <li>{t('legal.privacy.s7List7')}</li>
            </ul>
            <p style={{ marginTop: '16px' }}>
              {t('legal.privacy.s7ContactNote')}
            </p>
          </Section>

          <Section title={t('legal.privacy.s8Title')}>
            <p>{t('legal.privacy.s8Text')}</p>
            <ul>
              <li>{t('legal.privacy.s8List1')}</li>
              <li>{t('legal.privacy.s8List2')}</li>
              <li>{t('legal.privacy.s8List3')}</li>
              <li>{t('legal.privacy.s8List4')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s9Title')}>
            <p>{t('legal.privacy.s9Text')}</p>
          </Section>

          <Section title={t('legal.privacy.s10Title')}>
            <p>
              {t('legal.privacy.s10Text')}{' '}
              <a href="/mentions-legales/cookies" style={{ color: '#CC5500', fontWeight: 500 }}>
                {t('legal.privacy.s10Link')}
              </a>.
            </p>
          </Section>

          <Section title={t('legal.privacy.s11Title')}>
            <p>{t('legal.privacy.s11Text')}</p>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>{t('legal.privacy.s11Email')}</li>
              <li>{t('legal.privacy.s11Address')}</li>
            </ul>
          </Section>

          <Section title={t('legal.privacy.s12Title')}>
            <p>{t('legal.privacy.s12Text')}</p>
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
