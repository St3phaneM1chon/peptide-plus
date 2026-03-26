'use client';

import MoleculeBackground from '@/components/ui/MoleculeBackground';
import { useI18n } from '@/i18n/client';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

const pillars = [
  {
    icon: (
      <svg className="w-10 h-10 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
    titleKey: 'home.pillarPurity',
    descKey: 'home.pillarPurityDesc',
    fallbackTitle: 'Quality',
    fallbackDesc: 'Verified quality through rigorous testing and independent third-party laboratories.',
  },
  {
    icon: (
      <svg className="w-10 h-10 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    titleKey: 'home.pillarInnovation',
    descKey: 'home.pillarInnovationDesc',
    fallbackTitle: 'Innovation',
    fallbackDesc: 'Cutting-edge methods ensuring maximum performance and reliability.',
  },
  {
    icon: (
      <svg className="w-10 h-10 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
    ),
    titleKey: 'home.pillarNature',
    descKey: 'home.pillarNatureDesc',
    fallbackTitle: 'Excellence',
    fallbackDesc: 'Committed to optimal outcomes through continuous improvement and rigorous standards.',
  },
];

export default function ScienceStorySection() {
  const { t } = useI18n();
  const [ref, isVisible] = useIntersectionObserver<HTMLElement>();

  return (
    <section
      ref={ref}
      className="relative py-20 bg-primary-50 overflow-hidden"
    >
      <MoleculeBackground opacity={0.05} count={8} />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className={`font-heading text-3xl md:text-4xl text-neutral-900 mb-4 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {t('home.scienceTitle') || t('home.ourValues') || 'Our Values'}
        </h2>
        <p className={`text-lg text-neutral-500 max-w-2xl mx-auto mb-14 transition-all duration-700 delay-150 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {t('home.scienceDesc') || ''}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          {pillars.map((pillar, i) => (
            <div
              key={i}
              className={`bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-sm border border-neutral-100 hover:shadow-md transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: isVisible ? `${200 + i * 150}ms` : '0ms' }}
            >
              <div className="flex justify-center mb-5">
                <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center">
                  {pillar.icon}
                </div>
              </div>
              <h3 className="font-heading text-xl text-neutral-900 mb-3">
                {t(pillar.titleKey) || pillar.fallbackTitle}
              </h3>
              <p className="text-neutral-500 leading-relaxed">
                {t(pillar.descKey) || pillar.fallbackDesc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
