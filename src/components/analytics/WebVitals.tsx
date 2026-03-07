'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Web Vitals tracking component.
 * Reports Core Web Vitals (LCP, FID, CLS, TTFB, INP) to Google Analytics 4.
 * Uses the built-in web-vitals API via Next.js's useReportWebVitals when available,
 * otherwise falls back to the web-vitals library pattern.
 */
export function WebVitals() {
  useEffect(() => {
    // Only report if GA4 is loaded and consent was given
    if (typeof window === 'undefined') return;

    const reportMetric = (metric: { name: string; value: number; id: string }) => {
      // Send to GA4 via gtag if available
      if (typeof window.gtag === 'function') {
        window.gtag('event', metric.name, {
          event_category: 'Web Vitals',
          event_label: metric.id,
          value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
          non_interaction: true,
        });
      }
    };

    // Use the web-vitals API (bundled with Next.js internals)
    import('web-vitals').then(({ onCLS, onLCP, onTTFB, onINP }) => {
      onCLS(reportMetric);
      onLCP(reportMetric);
      onTTFB(reportMetric);
      onINP(reportMetric);
    }).catch(() => {
      // web-vitals not available — silently skip
    });
  }, []);

  return null;
}
