'use client';

import { useCompare } from '@/hooks/useCompare';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

interface CompareButtonProps {
  productSlug: string;
  productName: string;
  variant?: 'icon' | 'button';
  className?: string;
}

export default function CompareButton({
  productSlug,
  productName,
  variant = 'button',
  className = ''
}: CompareButtonProps) {
  const { isInCompare, addToCompare, removeFromCompare, maxProducts } = useCompare();
  const { t } = useI18n();
  const isAdded = isInCompare(productSlug);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isAdded) {
      removeFromCompare(productSlug);
      toast.success(t('compare.removed'), {
        description: productName,
      });
    } else {
      const result = addToCompare(productSlug);
      if (result.success) {
        toast.success(t('compare.added'), {
          description: productName,
        });
      } else {
        toast.error(t('compare.maxReached'), {
          description: t('compare.maxReachedDesc', { max: maxProducts.toString() }),
        });
      }
    }
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleToggle}
        aria-label={isAdded ? t('compare.removeFromCompare') : t('compare.addToCompare')}
        className={`p-2 rounded-lg transition-all ${
          isAdded
            ? 'bg-orange-500 text-white hover:bg-orange-600'
            : 'bg-white/90 text-neutral-700 hover:bg-white hover:text-orange-500 border border-neutral-200'
        } ${className}`}
        title={isAdded ? t('compare.removeFromCompare') : t('compare.addToCompare')}
      >
        {isAdded ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
        isAdded
          ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
          : 'bg-white text-neutral-700 border border-neutral-300 hover:border-orange-400 hover:text-orange-600'
      } ${className}`}
    >
      {isAdded ? (
        <>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <span>{t('compare.inComparison')}</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span>{t('compare.compare')}</span>
        </>
      )}
    </button>
  );
}
