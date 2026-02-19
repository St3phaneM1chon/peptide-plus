/**
 * Shared aging helpers for AR and AP aging reports
 */

// #66/#67/#68 Audit: Default aging bucket boundaries (configurable)
export const DEFAULT_AGING_BUCKETS = [30, 60, 90] as const;

export interface AgingBucketConfig {
  /** Sorted array of day boundaries, e.g. [30, 60, 90] produces: current, 1-30, 31-60, 61-90, 90+ */
  boundaries: number[];
}

/**
 * Calculate the number of days past due for an invoice
 */
export function getDaysPastDue(dueDate: Date, asOfDate: Date): number {
  const diffMs = asOfDate.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Generate bucket labels from configurable boundaries
 * e.g. [30, 60, 90] => ['current', '1-30', '31-60', '61-90', '90+']
 */
export function getBucketLabels(boundaries: number[] = [...DEFAULT_AGING_BUCKETS]): string[] {
  const sorted = [...boundaries].sort((a, b) => a - b);
  const labels = ['current'];
  for (let i = 0; i < sorted.length; i++) {
    const lower = i === 0 ? 1 : sorted[i - 1] + 1;
    labels.push(`${lower}-${sorted[i]}`);
  }
  labels.push(`${sorted[sorted.length - 1]}+`);
  return labels;
}

/**
 * Determine the aging bucket for a given number of days past due
 * @param daysPastDue - days past the due date
 * @param boundaries - sorted bucket boundaries (default: [30, 60, 90])
 */
export function getBucket(daysPastDue: number, boundaries: number[] = [...DEFAULT_AGING_BUCKETS]): string {
  if (daysPastDue === 0) return 'current';
  const sorted = [...boundaries].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const lower = i === 0 ? 1 : sorted[i - 1] + 1;
    if (daysPastDue >= lower && daysPastDue <= sorted[i]) {
      return `${lower}-${sorted[i]}`;
    }
  }
  return `${sorted[sorted.length - 1]}+`;
}
