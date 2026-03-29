'use client';

import { useState } from 'react';
import type { FAQAccordionSection as FAQAccordionSectionType } from '@/lib/homepage-sections';

function AccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--k-glass-regular, rgba(255,255,255,0.08))',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left"
        aria-expanded={open}
      >
        <span
          className="font-semibold text-sm pr-4"
          style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
        >
          {question}
        </span>
        <span
          className="text-xl flex-shrink-0 transition-transform duration-200"
          style={{
            color: 'var(--k-accent, #6366f1)',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          +
        </span>
      </button>
      {open && (
        <div
          className="px-6 pb-4 text-sm"
          style={{
            color: 'var(--k-text-secondary, rgba(255,255,255,0.70))',
            lineHeight: '1.7',
          }}
        >
          {answer}
        </div>
      )}
    </div>
  );
}

export function FAQAccordionRenderer({ section }: { section: FAQAccordionSectionType }) {
  const items = section.items || [];

  // Generate FAQ Schema.org structured data for SEO
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <div>
      {/* FAQ Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {section.title && (
        <h2
          className="text-2xl font-bold mb-6 text-center"
          style={{ color: 'var(--k-text-primary, rgba(255,255,255,0.95))' }}
        >
          {section.title}
        </h2>
      )}
      <div className="space-y-3 max-w-3xl mx-auto">
        {items.map((item, i) => (
          <AccordionItem key={i} question={item.question} answer={item.answer} />
        ))}
      </div>
    </div>
  );
}
