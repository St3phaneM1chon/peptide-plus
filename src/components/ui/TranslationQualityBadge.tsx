'use client';

/**
 * TranslationQualityBadge - Inline badge for DB content translation quality
 *
 * Shows a small colored dot + label:
 * - draft (grey): GPT-4o-mini first pass
 * - improved (yellow): Claude Haiku improved
 * - verified (green): GPT-4o verified
 * - human (blue): Human reviewed
 */

type QualityLevel = 'draft' | 'improved' | 'verified' | 'human';

interface TranslationQualityBadgeProps {
  quality: QualityLevel;
  size?: 'sm' | 'md';
}

const QUALITY_CONFIG: Record<QualityLevel, { color: string; bg: string; label: string }> = {
  draft: { color: '#6b7280', bg: '#f3f4f6', label: 'AI' },
  improved: { color: '#d97706', bg: '#fef3c7', label: 'AI+' },
  verified: { color: '#059669', bg: '#d1fae5', label: 'AI+++' },
  human: { color: '#2563eb', bg: '#dbeafe', label: 'PRO' },
};

export function TranslationQualityBadge({ quality, size = 'sm' }: TranslationQualityBadgeProps) {
  const config = QUALITY_CONFIG[quality];
  const fontSize = size === 'sm' ? '10px' : '11px';
  const padding = size === 'sm' ? '1px 5px' : '2px 7px';

  return (
    <span
      title={`Translation quality: ${quality}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        fontSize,
        fontWeight: 600,
        color: config.color,
        backgroundColor: config.bg,
        borderRadius: '9999px',
        padding,
        lineHeight: 1.4,
        verticalAlign: 'middle',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: size === 'sm' ? '5px' : '6px',
          height: size === 'sm' ? '5px' : '6px',
          borderRadius: '50%',
          backgroundColor: config.color,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}
