/**
 * SOCIAL PROOF NOTIFICATION
 * Shows "X from City just purchased Product Y" popup
 * Pulls from recent real orders, rotates every 30s
 * Dismissible, 24h cooldown
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

interface RecentPurchase {
  firstName: string;
  city: string;
  productName: string;
  productSlug: string;
  minutesAgo: number;
}

export function SocialProofNotification() {
  const { t } = useTranslations();
  const [purchase, setPurchase] = useState<RecentPurchase | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchRecentPurchases = useCallback(async () => {
    try {
      const res = await fetch('/api/social-proof');
      if (!res.ok) return;
      const data: RecentPurchase[] = await res.json();
      if (data.length > 0) {
        // Pick a random recent purchase
        const idx = Math.floor(Math.random() * data.length);
        setPurchase(data[idx]);
      }
    } catch {
      // Silent fail - social proof is non-critical
    }
  }, []);

  useEffect(() => {
    // Check cooldown
    const dismissedUntil = localStorage.getItem('social-proof-dismissed-until');
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
      return;
    }

    // Initial delay: 15 seconds after page load
    const initialTimer = setTimeout(() => {
      fetchRecentPurchases();
    }, 15000);

    // Rotate every 45 seconds
    const rotateTimer = setInterval(() => {
      if (!dismissed) {
        fetchRecentPurchases();
      }
    }, 45000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(rotateTimer);
    };
  }, [dismissed, fetchRecentPurchases]);

  // Show notification when purchase data arrives
  useEffect(() => {
    if (purchase && !dismissed) {
      setVisible(true);

      // Auto-hide after 8 seconds
      const hideTimer = setTimeout(() => {
        setVisible(false);
      }, 8000);

      return () => clearTimeout(hideTimer);
    }
  }, [purchase, dismissed]);

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    // Don't show again for 24 hours
    const oneDayFromNow = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem('social-proof-dismissed-until', oneDayFromNow.toString());
  };

  if (!visible || !purchase) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        zIndex: 40,
        maxWidth: '340px',
        animation: 'slideInLeft 0.4s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
          border: '1px solid #e5e7eb',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: '#FFF7ED',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="#F97316"
            width="18"
            height="18"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
            />
          </svg>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827', marginBottom: '2px' }}>
            {purchase.firstName} {t('socialProof.from')} {purchase.city}
          </p>
          <p
            style={{
              fontSize: '12px',
              color: '#6B7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t('socialProof.justPurchased')}{' '}
            <span style={{ fontWeight: 500, color: '#F97316' }}>{purchase.productName}</span>
          </p>
          <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
            {purchase.minutesAgo <= 1
              ? t('socialProof.justNow')
              : t('socialProof.minutesAgo').replace('{minutes}', String(purchase.minutesAgo))}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px',
            color: '#9CA3AF',
            flexShrink: 0,
          }}
          aria-label="Dismiss"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default SocialProofNotification;
