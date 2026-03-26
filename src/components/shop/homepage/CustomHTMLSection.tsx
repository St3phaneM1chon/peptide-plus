'use client';

import { useMemo } from 'react';
import { MotionDiv } from '@/components/koraline';
import type { CustomHTMLSection as CustomHTMLConfig } from '@/lib/homepage-sections';
import DOMPurify from 'isomorphic-dompurify';

interface Props {
  config: CustomHTMLConfig;
}

export default function CustomHTMLSection({ config }: Props) {
  const sanitizedHTML = useMemo(() => {
    if (!config.content) return '';
    return DOMPurify.sanitize(config.content, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'span', 'div',
        'a', 'img',
        'ul', 'ol', 'li',
        'strong', 'em', 'b', 'i', 'u',
        'br', 'hr',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'blockquote', 'code', 'pre',
        'figure', 'figcaption',
        'section', 'article',
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel',
        'src', 'alt', 'width', 'height', 'loading',
        'class', 'style', 'id',
        'colspan', 'rowspan',
      ],
      ALLOW_DATA_ATTR: false,
    });
  }, [config.content]);

  if (!sanitizedHTML) return null;

  return (
    <section className="py-16 md:py-24 bg-[var(--k-bg-base)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <MotionDiv animation="fadeIn">
          <div
            className="prose prose-invert max-w-none prose-headings:text-[var(--k-text-primary)] prose-p:text-[var(--k-text-secondary)] prose-a:text-[var(--k-accent-indigo)] prose-strong:text-[var(--k-text-primary)]"
            dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
          />
        </MotionDiv>
      </div>
    </section>
  );
}
