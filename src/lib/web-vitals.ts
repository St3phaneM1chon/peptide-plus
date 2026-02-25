/**
 * Web Vitals Tracking
 * LCP/FID/CLS/TTFB trends with budget alerts
 */

export interface WebVitalMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: Date;
  pathname: string;
}

export const VITAL_BUDGETS: Record<string, { good: number; poor: number; unit: string }> = {
  LCP: { good: 2500, poor: 4000, unit: 'ms' },
  FID: { good: 100, poor: 300, unit: 'ms' },
  CLS: { good: 0.1, poor: 0.25, unit: '' },
  TTFB: { good: 800, poor: 1800, unit: 'ms' },
  INP: { good: 200, poor: 500, unit: 'ms' },
};

export function rateVital(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const budget = VITAL_BUDGETS[name];
  if (!budget) return 'good';
  if (value <= budget.good) return 'good';
  if (value <= budget.poor) return 'needs-improvement';
  return 'poor';
}

export function formatVitalValue(name: string, value: number): string {
  const budget = VITAL_BUDGETS[name];
  if (!budget) return String(value);
  if (name === 'CLS') return value.toFixed(3);
  return `${Math.round(value)}${budget.unit}`;
}

export function calculateP50P95P99(values: number[]): { p50: number; p95: number; p99: number } {
  if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

export function getVitalColor(rating: string): string {
  switch (rating) {
    case 'good': return '#059669';
    case 'needs-improvement': return '#f59e0b';
    case 'poor': return '#ef4444';
    default: return '#94a3b8';
  }
}
