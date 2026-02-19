'use client';
/**
 * PAGE TARIFS
 */

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function PricingPage() {
  const { t } = useI18n();

  const individualPlans = [
    {
      name: t('pricing.free'),
      price: t('pricing.freePrice'),
      period: '',
      description: t('pricing.freeDesc'),
      features: [t('pricing.freeFeature1'), t('pricing.freeFeature2'), t('pricing.freeFeature3'), t('pricing.freeFeature4')],
      cta: t('pricing.freeCta'),
      href: '/auth/signup',
      popular: false,
    },
    {
      name: t('pricing.pro'),
      price: t('pricing.proPrice'),
      period: t('pricing.proPeriod'),
      description: t('pricing.proDesc'),
      features: [t('pricing.proFeature1'), t('pricing.proFeature2'), t('pricing.proFeature3'), t('pricing.proFeature4'), t('pricing.proFeature5')],
      cta: t('pricing.proCta'),
      href: '/auth/signup?plan=pro',
      popular: true,
    },
    {
      name: t('pricing.annual'),
      price: t('pricing.annualPrice'),
      period: t('pricing.annualPeriod'),
      description: t('pricing.annualDesc'),
      features: [t('pricing.annualFeature1'), t('pricing.annualFeature2'), t('pricing.annualFeature3'), t('pricing.annualFeature4'), t('pricing.annualFeature5')],
      cta: t('pricing.annualCta'),
      href: '/auth/signup?plan=annual',
      popular: false,
    },
  ];

  const enterprisePlans = [
    {
      name: t('pricing.starter'),
      price: t('pricing.starterPrice'),
      period: t('pricing.starterPeriod'),
      description: t('pricing.starterDesc'),
      employees: t('pricing.starterEmployees'),
      features: [t('pricing.starterFeature1'), t('pricing.starterFeature2'), t('pricing.starterFeature3'), t('pricing.starterFeature4')],
      popular: false,
      isCustomPrice: false,
    },
    {
      name: t('pricing.business'),
      price: t('pricing.businessPrice'),
      period: t('pricing.businessPeriod'),
      description: t('pricing.businessPlanDesc'),
      employees: t('pricing.businessEmployees'),
      features: [t('pricing.businessFeature1'), t('pricing.businessFeature2'), t('pricing.businessFeature3'), t('pricing.businessFeature4'), t('pricing.businessFeature5')],
      popular: true,
      isCustomPrice: false,
    },
    {
      name: t('pricing.enterprise'),
      price: t('pricing.enterprisePrice'),
      period: '',
      description: t('pricing.enterpriseDesc'),
      employees: t('pricing.enterpriseEmployees'),
      features: [t('pricing.enterpriseFeature1'), t('pricing.enterpriseFeature2'), t('pricing.enterpriseFeature3'), t('pricing.enterpriseFeature4'), t('pricing.enterpriseFeature5')],
      popular: false,
      isCustomPrice: true,
    },
  ];

  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '16px' }}>
          {t('pricing.title')}
        </h1>
        <p style={{ fontSize: '18px', opacity: 0.9 }}>
          {t('pricing.subtitle')}
        </p>
      </section>

      {/* Individual Plans */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: 'var(--gray-500)' }}>
            {t('pricing.forIndividuals')}
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', textAlign: 'center', marginBottom: '48px' }}>
            {t('pricing.individualDesc')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {individualPlans.map((plan, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: plan.popular ? 'var(--gray-500)' : 'white',
                  color: plan.popular ? 'white' : 'inherit',
                  borderRadius: '16px',
                  padding: '40px',
                  position: 'relative',
                }}
              >
                {plan.popular && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      padding: '4px 16px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {t('pricing.popular')}
                  </span>
                )}
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{plan.name}</h3>
                <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '16px' }}>{plan.description}</p>
                <p style={{ fontSize: '48px', fontWeight: 700, marginBottom: '24px' }}>
                  ${plan.price}
                  <span style={{ fontSize: '16px', fontWeight: 400, opacity: 0.7 }}>{plan.period}</span>
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {plan.features.map((feature, j) => (
                    <li
                      key={j}
                      style={{
                        padding: '10px 0',
                        borderTop: j === 0 ? 'none' : `1px solid ${plan.popular ? 'rgba(255,255,255,0.1)' : 'var(--gray-100)'}`,
                        fontSize: '14px',
                      }}
                    >
                      ✓ {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className="btn"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px',
                    backgroundColor: plan.popular ? 'white' : 'var(--gray-500)',
                    color: plan.popular ? 'var(--gray-500)' : 'white',
                  }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Plans */}
      <section style={{ backgroundColor: 'white', padding: '80px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 700, textAlign: 'center', marginBottom: '16px', color: 'var(--gray-500)' }}>
            {t('pricing.forBusiness')}
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--gray-400)', textAlign: 'center', marginBottom: '48px' }}>
            {t('pricing.businessDesc')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {enterprisePlans.map((plan, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: plan.popular ? 'var(--gray-500)' : 'var(--gray-50)',
                  color: plan.popular ? 'white' : 'inherit',
                  borderRadius: '16px',
                  padding: '40px',
                  position: 'relative',
                }}
              >
                {plan.popular && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#22c55e',
                      color: 'white',
                      padding: '4px 16px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  >
                    {t('pricing.recommended')}
                  </span>
                )}
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>{plan.name}</h3>
                <p style={{ fontSize: '14px', opacity: 0.8, marginBottom: '8px' }}>{plan.description}</p>
                <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '16px' }}>{plan.employees}</p>
                <p style={{ fontSize: '40px', fontWeight: 700, marginBottom: '24px' }}>
                  {plan.isCustomPrice ? plan.price : `$${plan.price}`}
                  <span style={{ fontSize: '16px', fontWeight: 400, opacity: 0.7 }}>{plan.period}</span>
                </p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px' }}>
                  {plan.features.map((feature, j) => (
                    <li
                      key={j}
                      style={{
                        padding: '8px 0',
                        fontSize: '14px',
                      }}
                    >
                      ✓ {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.isCustomPrice ? '/contact' : '/demo'}
                  className="btn"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    padding: '14px',
                    backgroundColor: plan.popular ? 'white' : 'var(--gray-500)',
                    color: plan.popular ? 'var(--gray-500)' : 'white',
                  }}
                >
                  {plan.isCustomPrice ? t('pricing.contactUs') : t('pricing.requestDemo')}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '64px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', color: 'var(--gray-500)' }}>
          {t('pricing.faqTitle')}
        </h2>
        <p style={{ fontSize: '16px', color: 'var(--gray-400)', marginBottom: '24px' }}>
          {t('pricing.faqDesc')}
        </p>
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
          <Link href="/faq" className="btn btn-secondary">
            {t('pricing.viewFaq')}
          </Link>
          <Link href="/contact" className="btn btn-primary">
            {t('pricing.contactUs')}
          </Link>
        </div>
      </section>
    </div>
  );
}
