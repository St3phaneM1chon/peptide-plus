'use client';

import { BookOpen, FileDown } from 'lucide-react';
import Link from 'next/link';

interface TutorialLinkProps {
  /** The guide slug, e.g. "02-commerce/01-commandes" */
  guideSlug: string;
  /** The section slug for magazine PDF, e.g. "Section_02_Commerce" */
  magazineSlug?: string;
  /** Label text override */
  label?: string;
  /** Show as compact icon-only button */
  compact?: boolean;
}

export function TutorialLink({ guideSlug, magazineSlug, label, compact = false }: TutorialLinkProps) {
  if (compact) {
    return (
      <Link
        href={`/admin/tutoriels?page=${guideSlug}`}
        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
        title={label || 'Voir le tutoriel'}
      >
        <BookOpen className="w-4 h-4" />
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/tutoriels?page=${guideSlug}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
      >
        <BookOpen className="w-3.5 h-3.5" />
        {label || 'Tutoriel'}
      </Link>
      {magazineSlug && (
        <a
          href={`/api/admin/tutoriels/magazine/${magazineSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <FileDown className="w-3.5 h-3.5" />
          Magazine PDF
        </a>
      )}
    </div>
  );
}
