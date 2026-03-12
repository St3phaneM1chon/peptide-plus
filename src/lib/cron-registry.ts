/**
 * CRON JOB REGISTRY
 *
 * T4-1: Central registry of all 34 cron jobs with their schedules,
 * descriptions, and categories.
 *
 * Used by the cron monitoring dashboard to display comprehensive status.
 */

export interface CronJobDefinition {
  /** Unique slug matching the API route folder name */
  name: string;
  /** Human-readable label */
  label: string;
  /** Short description of what the cron does */
  description: string;
  /** Cron schedule expression (e.g. "0 9 * * *") */
  schedule: string;
  /** Expected interval in milliseconds (for health checks) */
  expectedIntervalMs: number;
  /** Functional category */
  category: CronCategory;
  /** HTTP method used to trigger this cron */
  method: 'GET' | 'POST';
}

export type CronCategory =
  | 'email'
  | 'ecommerce'
  | 'analytics'
  | 'finance'
  | 'loyalty'
  | 'inventory'
  | 'system'
  | 'crm'
  | 'voip'
  | 'security';

export const CRON_CATEGORY_LABELS: Record<CronCategory, string> = {
  email: 'Email & Notifications',
  ecommerce: 'E-commerce',
  analytics: 'Analytics & Metrics',
  finance: 'Finance & Rates',
  loyalty: 'Loyalty & Rewards',
  inventory: 'Inventory & Stock',
  system: 'System & Maintenance',
  crm: 'CRM & Sales',
  voip: 'VoIP & Telephony',
  security: 'Security',
};

const H = 60 * 60 * 1000;
const D = 24 * H;
const M = 60 * 1000;

/**
 * Complete registry of all 34 cron jobs.
 * Schedules match vercel.json where defined, otherwise based on route comments.
 */
export const CRON_REGISTRY: CronJobDefinition[] = [
  // ── Email & Notifications ─────────────────────────────────
  {
    name: 'abandoned-cart',
    label: 'Abandoned Cart Emails',
    description: 'Send reminder emails for abandoned carts (1-48h old)',
    schedule: '0 */2 * * *',
    expectedIntervalMs: 2 * H,
    category: 'email',
    method: 'POST',
  },
  {
    name: 'birthday-emails',
    label: 'Birthday Emails',
    description: 'Send birthday greeting emails to customers',
    schedule: '0 9 * * *',
    expectedIntervalMs: D,
    category: 'email',
    method: 'POST',
  },
  {
    name: 'birthday-bonus',
    label: 'Birthday Bonus',
    description: 'Apply birthday loyalty bonuses to qualifying customers',
    schedule: '0 8 * * *',
    expectedIntervalMs: D,
    category: 'loyalty',
    method: 'POST',
  },
  {
    name: 'browse-abandonment',
    label: 'Browse Abandonment',
    description: 'Send emails to users who browsed but did not add to cart',
    schedule: '0 */4 * * *',
    expectedIntervalMs: 4 * H,
    category: 'email',
    method: 'POST',
  },
  {
    name: 'email-flows',
    label: 'Email Flow Processing',
    description: 'Process delayed email flow executions',
    schedule: '* * * * *',
    expectedIntervalMs: M,
    category: 'email',
    method: 'GET',
  },
  {
    name: 'satisfaction-survey',
    label: 'Satisfaction Surveys',
    description: 'Send post-purchase satisfaction surveys',
    schedule: '0 10 * * *',
    expectedIntervalMs: D,
    category: 'email',
    method: 'POST',
  },
  {
    name: 'scheduled-campaigns',
    label: 'Scheduled Campaigns',
    description: 'Process and send scheduled marketing campaigns',
    schedule: '*/5 * * * *',
    expectedIntervalMs: 5 * M,
    category: 'email',
    method: 'POST',
  },
  {
    name: 'sync-email-tracking',
    label: 'Email Tracking Sync',
    description: 'Sync email open/click tracking data from providers',
    schedule: '*/15 * * * *',
    expectedIntervalMs: 15 * M,
    category: 'email',
    method: 'POST',
  },
  {
    name: 'welcome-series',
    label: 'Welcome Email Series',
    description: 'Send welcome email sequence to new customers',
    schedule: '0 10 * * *',
    expectedIntervalMs: D,
    category: 'email',
    method: 'POST',
  },

  // ── E-commerce ────────────────────────────────────────────
  {
    name: 'release-reservations',
    label: 'Release Stock Reservations',
    description: 'Release expired inventory reservations',
    schedule: '*/5 * * * *',
    expectedIntervalMs: 5 * M,
    category: 'ecommerce',
    method: 'POST',
  },
  {
    name: 'replenishment-reminder',
    label: 'Replenishment Reminders',
    description: 'Send product replenishment reminder emails',
    schedule: '0 9 * * *',
    expectedIntervalMs: D,
    category: 'ecommerce',
    method: 'POST',
  },
  {
    name: 'retry-webhooks',
    label: 'Retry Failed Webhooks',
    description: 'Retry delivery of failed webhook events',
    schedule: '*/10 * * * *',
    expectedIntervalMs: 10 * M,
    category: 'ecommerce',
    method: 'POST',
  },

  // ── Analytics & Metrics ───────────────────────────────────
  {
    name: 'ab-test-check',
    label: 'A/B Test Evaluation',
    description: 'Evaluate running A/B tests for statistical significance',
    schedule: '0 */6 * * *',
    expectedIntervalMs: 6 * H,
    category: 'analytics',
    method: 'POST',
  },
  {
    name: 'calculate-agent-stats',
    label: 'Agent Stats Calculation',
    description: 'Calculate performance metrics for support agents',
    schedule: '0 */4 * * *',
    expectedIntervalMs: 4 * H,
    category: 'analytics',
    method: 'POST',
  },
  {
    name: 'calculate-metrics',
    label: 'Customer Metrics (RFM/CLV)',
    description: 'Calculate RFM scores, CLV, and churn risk for all customers',
    schedule: '0 3 * * *',
    expectedIntervalMs: D,
    category: 'analytics',
    method: 'POST',
  },
  {
    name: 'scheduled-reports',
    label: 'Scheduled Reports',
    description: 'Generate and send scheduled business reports',
    schedule: '0 7 * * 1',
    expectedIntervalMs: 7 * D,
    category: 'analytics',
    method: 'POST',
  },

  // ── Finance & Rates ───────────────────────────────────────
  {
    name: 'fx-rate-sync',
    label: 'FX Rate Sync',
    description: 'Sync foreign exchange rates from external API',
    schedule: '0 */6 * * *',
    expectedIntervalMs: 6 * H,
    category: 'finance',
    method: 'POST',
  },
  {
    name: 'revenue-recognition',
    label: 'Revenue Recognition',
    description: 'Process deferred revenue recognition entries',
    schedule: '0 2 * * *',
    expectedIntervalMs: D,
    category: 'finance',
    method: 'POST',
  },
  {
    name: 'update-exchange-rates',
    label: 'Update Exchange Rates',
    description: 'Fetch and update currency exchange rates',
    schedule: '0 */6 * * *',
    expectedIntervalMs: 6 * H,
    category: 'finance',
    method: 'GET',
  },

  // ── Loyalty & Rewards ─────────────────────────────────────
  {
    name: 'points-expiring',
    label: 'Points Expiring Reminder',
    description: 'Notify customers about expiring loyalty points',
    schedule: '0 11 * * 1',
    expectedIntervalMs: 7 * D,
    category: 'loyalty',
    method: 'POST',
  },

  // ── Inventory & Stock ─────────────────────────────────────
  {
    name: 'low-stock-alerts',
    label: 'Low Stock Alerts',
    description: 'Send alerts when product inventory is below threshold',
    schedule: '0 */2 * * *',
    expectedIntervalMs: 2 * H,
    category: 'inventory',
    method: 'POST',
  },
  {
    name: 'price-drop-alerts',
    label: 'Price Drop Alerts',
    description: 'Notify customers who wishlisted products with price drops',
    schedule: '0 14 * * *',
    expectedIntervalMs: D,
    category: 'inventory',
    method: 'POST',
  },
  {
    name: 'stock-alerts',
    label: 'Back-in-Stock Alerts',
    description: 'Notify customers when wishlisted items are back in stock',
    schedule: '0 * * * *',
    expectedIntervalMs: H,
    category: 'inventory',
    method: 'POST',
  },

  // ── System & Maintenance ──────────────────────────────────
  {
    name: 'data-retention',
    label: 'Data Retention Cleanup',
    description: 'Purge expired data per GDPR/retention policies',
    schedule: '0 4 * * *',
    expectedIntervalMs: D,
    category: 'system',
    method: 'POST',
  },
  {
    name: 'dependency-check',
    label: 'Dependency Check',
    description: 'Check for outdated or vulnerable npm dependencies',
    schedule: '0 5 * * 1',
    expectedIntervalMs: 7 * D,
    category: 'security',
    method: 'POST',
  },
  {
    name: 'media-cleanup',
    label: 'Media Cleanup',
    description: 'Remove orphaned media files and optimize storage',
    schedule: '0 3 * * 0',
    expectedIntervalMs: 7 * D,
    category: 'system',
    method: 'POST',
  },
  {
    name: 'process-callbacks',
    label: 'Process Callbacks',
    description: 'Process queued callback requests from customers',
    schedule: '*/5 * * * *',
    expectedIntervalMs: 5 * M,
    category: 'system',
    method: 'POST',
  },

  // ── CRM & Sales ───────────────────────────────────────────
  {
    name: 'aging-reminders',
    label: 'Aging Invoice Reminders',
    description: 'Send reminders for aging unpaid invoices',
    schedule: '0 8 * * *',
    expectedIntervalMs: D,
    category: 'crm',
    method: 'POST',
  },
  {
    name: 'churn-alerts',
    label: 'Churn Risk Alerts',
    description: 'Alert on customers with high churn risk scores',
    schedule: '0 7 * * *',
    expectedIntervalMs: D,
    category: 'crm',
    method: 'POST',
  },
  {
    name: 'deal-rotting',
    label: 'Deal Rotting Check',
    description: 'Flag CRM deals that have been stale too long',
    schedule: '0 9 * * *',
    expectedIntervalMs: D,
    category: 'crm',
    method: 'POST',
  },
  {
    name: 'lead-scoring',
    label: 'Lead Scoring',
    description: 'Recalculate lead scores based on activity and engagement',
    schedule: '0 */4 * * *',
    expectedIntervalMs: 4 * H,
    category: 'crm',
    method: 'POST',
  },

  // ── VoIP & Telephony ─────────────────────────────────────
  {
    name: 'voip-notifications',
    label: 'VoIP Notifications',
    description: 'Send notifications for missed calls and voicemails',
    schedule: '*/10 * * * *',
    expectedIntervalMs: 10 * M,
    category: 'voip',
    method: 'POST',
  },
  {
    name: 'voip-recordings',
    label: 'VoIP Recording Processing',
    description: 'Process and store VoIP call recordings',
    schedule: '*/15 * * * *',
    expectedIntervalMs: 15 * M,
    category: 'voip',
    method: 'POST',
  },
  {
    name: 'voip-transcriptions',
    label: 'VoIP Transcriptions',
    description: 'Transcribe VoIP call recordings using speech-to-text',
    schedule: '*/30 * * * *',
    expectedIntervalMs: 30 * M,
    category: 'voip',
    method: 'POST',
  },
];

/**
 * Map of cron name -> definition for fast lookup.
 */
export const CRON_BY_NAME = new Map(CRON_REGISTRY.map(c => [c.name, c]));

/**
 * Human-readable schedule description from a cron expression.
 */
export function describeSchedule(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;

  // Every minute
  if (minute === '*' && hour === '*') return 'Every minute';

  // Every N minutes
  const everyNMin = minute.match(/^\*\/(\d+)$/);
  if (everyNMin && hour === '*') return `Every ${everyNMin[1]} min`;

  // Every N hours
  const everyNHour = hour.match(/^\*\/(\d+)$/);
  if (everyNHour && minute === '0') return `Every ${everyNHour[1]}h`;

  // Daily at specific time
  if (dayOfMonth === '*' && dayOfWeek === '*' && !hour.includes('/') && !hour.includes('*')) {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  // Weekly
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (dayOfWeek !== '*' && dayOfMonth === '*') {
    const day = dayNames[parseInt(dayOfWeek, 10)] || dayOfWeek;
    return `${day} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return cron;
}
