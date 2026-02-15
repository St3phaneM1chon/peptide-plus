'use client';

/**
 * TranslationFeedback - Random popup asking users about translation quality
 *
 * Shows on ~5% of page loads for non-reference languages (not en/fr).
 * Collects thumbs up/down + optional comment.
 * Stores feedback via API and remembers dismissal for 30 days.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

const STORAGE_KEY = 'translation-feedback-last';
const COOLDOWN_DAYS = 30;
const SHOW_PROBABILITY = 0.05; // 5% chance per page load

export function TranslationFeedback() {
  const { locale, t } = useTranslations();
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState<'good' | 'bad' | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    // Only show for non-reference languages
    if (locale === 'en' || locale === 'fr') return;

    // Check cooldown
    const last = localStorage.getItem(STORAGE_KEY);
    if (last) {
      const lastTime = parseInt(last, 10);
      if (Date.now() - lastTime < COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
    }

    // Random chance
    if (Math.random() > SHOW_PROBABILITY) return;

    // Show after delay
    const timer = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(timer);
  }, [locale]);

  const handleSubmit = useCallback(async () => {
    if (!rating) return;

    try {
      await fetch('/api/feedback/translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          rating,
          comment: comment.trim() || undefined,
          page: window.location.pathname,
        }),
      });
    } catch {
      // Silently fail - feedback is non-critical
    }

    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setSubmitted(true);
    setTimeout(() => setVisible(false), 2000);
  }, [locale, rating, comment]);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 50,
        width: '300px',
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        animation: 'fadeSlideUp 0.4s ease-out',
      }}
    >
      {submitted ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <p style={{ fontSize: '24px', marginBottom: '4px' }}>&#x2764;&#xFE0F;</p>
          <p style={{ fontSize: '14px', color: '#374151' }}>
            {t('translation.feedbackThanks')}
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#111827', margin: 0 }}>
              {t('translation.feedbackTitle')}
            </h4>
            <button
              onClick={handleDismiss}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#9ca3af',
                fontSize: '18px',
                lineHeight: 1,
                padding: '0',
              }}
            >
              &times;
            </button>
          </div>

          {/* Question */}
          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 12px' }}>
            {t('translation.feedbackQuestion')}
          </p>

          {/* Rating buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => setRating('good')}
              style={{
                flex: 1,
                padding: '8px',
                border: `2px solid ${rating === 'good' ? '#059669' : '#e5e7eb'}`,
                borderRadius: '8px',
                backgroundColor: rating === 'good' ? '#ecfdf5' : 'white',
                cursor: 'pointer',
                fontSize: '20px',
                transition: 'all 0.15s ease',
              }}
              aria-label="Good translation"
            >
              &#x1F44D;
            </button>
            <button
              onClick={() => setRating('bad')}
              style={{
                flex: 1,
                padding: '8px',
                border: `2px solid ${rating === 'bad' ? '#dc2626' : '#e5e7eb'}`,
                borderRadius: '8px',
                backgroundColor: rating === 'bad' ? '#fef2f2' : 'white',
                cursor: 'pointer',
                fontSize: '20px',
                transition: 'all 0.15s ease',
              }}
              aria-label="Bad translation"
            >
              &#x1F44E;
            </button>
          </div>

          {/* Optional comment (shown after rating) */}
          {rating && (
            <>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('translation.feedbackPlaceholder')}
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  fontSize: '13px',
                  resize: 'none',
                  marginBottom: '10px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                onClick={handleSubmit}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#f97316',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('translation.feedbackSubmit')}
              </button>
            </>
          )}
        </>
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
