'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

// ── Study method data ──
interface StudyMethod {
  id: string;
  iconPath: string;
  color: string;
}

const studyMethods: StudyMethod[] = [
  {
    id: 'pomodoro',
    iconPath: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    color: 'from-red-500 to-orange-500',
  },
  {
    id: 'activeRecall',
    iconPath: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
    color: 'from-yellow-500 to-amber-500',
  },
  {
    id: 'spacedRepetition',
    iconPath: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'feynman',
    iconPath: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'mindMapping',
    iconPath: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    color: 'from-purple-500 to-violet-500',
  },
];

// ── Cheat sheets data ──
interface CheatSheet {
  id: string;
  iconPath: string;
}

const cheatSheets: CheatSheet[] = [
  { id: 'assuranceVie', iconPath: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z' },
  { id: 'produitsFin', iconPath: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'ethiqueConf', iconPath: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
  { id: 'calculs', iconPath: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
];

// ── Official resources ──
interface OfficialResource {
  id: string;
  url: string;
  iconPath: string;
}

const officialResources: OfficialResource[] = [
  { id: 'amf', url: 'https://lautorite.qc.ca', iconPath: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'chad', url: 'https://www.chad.qc.ca', iconPath: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { id: 'csf', url: 'https://www.chambresf.com', iconPath: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
  { id: 'iqpf', url: 'https://www.iqpf.org', iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
];

// ── FAQ items ──
const faqItems = [
  'whatIsAptitudes',
  'howCourseWorks',
  'mobileAccess',
  'ufcCredits',
  'examPrep',
  'aureliaHelp',
  'resetProgress',
  'certificate',
  'teamAccess',
  'offlineAccess',
];

// ── Exam prep steps ──
const examPrepSteps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'];

// ── Time management tips ──
const timeTips = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'];

export default function RessourcesPage() {
  const { t } = useTranslations();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setExpandedFaq((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-[#143C78] text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link
            href="/learn"
            className="inline-flex items-center text-sm text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-1 rtl:mr-0 rtl:ml-1 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('learn.backToLearning')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {t('learn.resources.title')}
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            {t('learn.resources.subtitle')}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* ── Study Methods ── */}
        <section className="mb-12 md:mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('learn.resources.methodsTitle')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('learn.resources.methodsSubtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {studyMethods.map((method) => (
              <div
                key={method.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className={`h-2 bg-gradient-to-r ${method.color}`} />
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${method.color} flex items-center justify-center`}>
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={method.iconPath} />
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900">
                      {t(`learn.resources.method.${method.id}.title`)}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {t(`learn.resources.method.${method.id}.desc`)}
                  </p>
                  <div className="bg-blue-50 rounded-lg p-3 mb-4">
                    <p className="text-xs font-semibold text-blue-800 mb-1">
                      {t('learn.resources.howToUseWithAurelia')}
                    </p>
                    <p className="text-xs text-blue-700">
                      {t(`learn.resources.method.${method.id}.aurelia`)}
                    </p>
                  </div>
                  <Link
                    href="/learn/dashboard"
                    className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${method.color} text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity`}
                  >
                    {t('learn.resources.tryIt')}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Cheat Sheets ── */}
        <section className="mb-12 md:mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('learn.resources.sheetsTitle')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('learn.resources.sheetsSubtitle')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cheatSheets.map((sheet) => (
              <div
                key={sheet.id}
                className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <svg className="w-5 h-5 text-gray-500 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sheet.iconPath} />
                    </svg>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {t(`learn.resources.sheet.${sheet.id}.title`)}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {t(`learn.resources.sheet.${sheet.id}.desc`)}
                </p>
                <button
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  onClick={() => {/* placeholder for download */}}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {t('learn.resources.downloadPdf')}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── AMF Exam Preparation ── */}
        <section className="mb-12 md:mb-16">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 md:p-10 text-white">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-bold mb-2">
                {t('learn.resources.examPrepTitle')}
              </h2>
              <p className="text-blue-200 mb-6">
                {t('learn.resources.examPrepSubtitle')}
              </p>

              <div className="space-y-4">
                {examPrepSteps.map((step, idx) => (
                  <div key={step} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold mb-0.5">
                        {t(`learn.resources.examPrep.${step}.title`)}
                      </h3>
                      <p className="text-sm text-blue-100">
                        {t(`learn.resources.examPrep.${step}.desc`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                href="/learn"
                className="mt-8 inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition-colors"
              >
                {t('learn.resources.browseCoursesBtn')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        {/* ── Time Management Tips ── */}
        <section className="mb-12 md:mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('learn.resources.timeTitle')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('learn.resources.timeSubtitle')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timeTips.map((tip, idx) => (
              <div key={tip} className="bg-white rounded-xl shadow-sm p-5 flex gap-4 hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                  {idx + 1}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">
                    {t(`learn.resources.timeTip.${tip}.title`)}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {t(`learn.resources.timeTip.${tip}.desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Official Resources ── */}
        <section className="mb-12 md:mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('learn.resources.officialTitle')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('learn.resources.officialSubtitle')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {officialResources.map((res) => (
              <a
                key={res.id}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={res.iconPath} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-600 transition-colors">
                      {t(`learn.resources.official.${res.id}.title`)}
                    </h3>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
                <p className="text-xs text-gray-500">
                  {t(`learn.resources.official.${res.id}.desc`)}
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="mb-12 md:mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('learn.resources.faqTitle')}
          </h2>
          <p className="text-gray-600 mb-6">
            {t('learn.resources.faqSubtitle')}
          </p>

          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {faqItems.map((faq) => {
              const isExpanded = expandedFaq === faq;
              return (
                <div key={faq}>
                  <button
                    onClick={() => toggleFaq(faq)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="font-medium text-gray-900 text-sm pr-4">
                      {t(`learn.resources.faq.${faq}.q`)}
                    </span>
                    <svg
                      className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="px-6 pb-4">
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {t(`learn.resources.faq.${faq}.a`)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 md:p-12 text-white text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            {t('learn.resources.ctaTitle')}
          </h2>
          <p className="text-purple-100 mb-6 max-w-xl mx-auto">
            {t('learn.resources.ctaSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/learn"
              className="px-8 py-3 bg-white text-purple-700 font-semibold rounded-lg hover:bg-purple-50 transition-colors"
            >
              {t('learn.resources.ctaBrowse')}
            </Link>
            <Link
              href="/learn/glossaire"
              className="px-8 py-3 border border-white/50 text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
            >
              {t('learn.resources.ctaGlossary')}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
