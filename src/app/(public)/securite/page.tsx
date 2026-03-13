'use client';

import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

export default function SecurityPage() {
  const { t } = useTranslations();

  const securityFeatures = [
    { icon: '\uD83D\uDD10', titleKey: 'security.encryption', descKey: 'security.encryptionDesc' },
    { icon: '\uD83D\uDEE1\uFE0F', titleKey: 'security.authStrong', descKey: 'security.authStrongDesc' },
    { icon: '\uD83D\uDD0D', titleKey: 'security.audits', descKey: 'security.auditsDesc' },
    { icon: '\uD83D\uDCCA', titleKey: 'security.monitoring', descKey: 'security.monitoringDesc' },
    { icon: '\uD83D\uDCBE', titleKey: 'security.backups', descKey: 'security.backupsDesc' },
    { icon: '\uD83C\uDF10', titleKey: 'security.cloudInfra', descKey: 'security.cloudInfraDesc' },
  ];

  const certifications = [
    { name: 'SOC 2 Type II', statusKey: 'security.certified' },
    { name: 'ISO 27001', statusKey: 'security.certified' },
    { name: 'PCI DSS', statusKey: 'security.compliant' },
    { name: 'RGPD', statusKey: 'security.compliant' },
    { name: 'PIPEDA', statusKey: 'security.compliant' },
    { name: 'Loi 25', statusKey: 'security.compliant' },
  ];

  const tips = [
    'security.tip1',
    'security.tip2',
    'security.tip3',
    'security.tip4',
    'security.tip5',
    'security.tip6',
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-neutral-900 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="text-5xl block mb-6">{'\uD83D\uDD12'}</span>
          <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6">
            {t('security.title')}
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed max-w-2xl mx-auto">
            {t('security.heroText')}
          </p>
        </div>
      </section>

      {/* Security Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-12">
            {t('security.featuresTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityFeatures.map((feature, i) => (
              <div key={i} className="bg-white rounded-xl p-8 flex gap-4">
                <span className="text-3xl shrink-0">{feature.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {t(feature.titleKey)}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {t(feature.descKey)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="bg-white py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-10">
            {t('security.certificationsTitle')}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {certifications.map((cert, i) => (
              <div key={i} className="p-6 bg-gray-50 rounded-xl text-center">
                <span className="text-2xl block mb-2">{'\u2705'}</span>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{cert.name}</h3>
                <span className="text-xs text-green-500 font-medium">{t(cert.statusKey)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Best Practices */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">
            {t('security.bestPracticesTitle')}
          </h2>
          <div className="bg-white rounded-xl p-8">
            <ul className="divide-y divide-gray-100">
              {tips.map((tipKey, i) => (
                <li key={i} className="py-4 text-base text-gray-700 flex items-start gap-3">
                  <span className="text-green-500 shrink-0 mt-0.5">{'\u2713'}</span>
                  {t(tipKey)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Bug Bounty */}
      <section className="bg-white py-16 px-6 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('security.bugBountyTitle')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('security.bugBountyText')}
          </p>
          <Link
            href="/contact?subject=security"
            className="inline-block px-8 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
          >
            {t('security.reportVulnerability')}
          </Link>
        </div>
      </section>
    </div>
  );
}
