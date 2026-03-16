'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/client';

export default function BlogPostNotFound() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <h2 className="text-2xl font-bold mb-4">
        {t('learn.articleNotFound') || 'Article non trouvé'}
      </h2>
      <p className="text-gray-600 mb-6">
        {t('common.notFoundDescription') || 'La page que vous cherchez n\u2019existe pas ou a été déplacée.'}
      </p>
      <Link
        href="/blog"
        className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
      >
        {t('blog.backToBlog') || 'Retour au blog'}
      </Link>
    </div>
  );
}
