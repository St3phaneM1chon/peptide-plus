export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/low-stock-alerts
 * Cron job to check for products with stock below threshold and send admin notification.
 *
 * Checks ProductFormat records where stockQuantity <= lowStockThreshold (default: 5).
 * Sends a single digest email to the admin with a table of all low-stock items.
 *
 * Authentication: Requires CRON_SECRET in Authorization header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/email-service';
import { withJobLock } from '@/lib/cron-lock';
import { logger } from '@/lib/logger';
import { getRedisClient } from '@/lib/redis';

const LOW_STOCK_DEFAULT_THRESHOLD = 5;

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return false;

  const providedSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  try {
    const a = Buffer.from(cronSecret, 'utf8');
    const b = Buffer.from(providedSecret, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return withJobLock('low-stock-alerts', async () => {
    try {
      // Fetch all active, inventory-tracked formats.
      // We cannot use a Prisma `where` that compares two columns (stockQuantity <= lowStockThreshold),
      // so we load all tracked formats and filter in application code.
      const trackedFormats = await prisma.productFormat.findMany({
        where: {
          isActive: true,
          trackInventory: true,
        },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQuantity: true,
          lowStockThreshold: true,
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
            },
          },
        },
        orderBy: { stockQuantity: 'asc' },
      });

      // Filter: stockQuantity <= lowStockThreshold (fall back to default if threshold is 0)
      const alertFormats = trackedFormats.filter((f) => {
        const threshold =
          f.lowStockThreshold > 0 ? f.lowStockThreshold : LOW_STOCK_DEFAULT_THRESHOLD;
        return f.stockQuantity <= threshold;
      });

      logger.info(`[low-stock-alerts] Found ${alertFormats.length} low-stock format(s)`);

      if (alertFormats.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No low-stock products found',
          alertCount: 0,
        });
      }

      // FIX A9-P1-005: Dedup — skip if the exact same set of items was already alerted
      const alertHash = createHash('sha256')
        .update(alertFormats.map(f => `${f.id}:${f.stockQuantity}`).sort().join('|'))
        .digest('hex')
        .slice(0, 16);

      try {
        const redis = await getRedisClient();
        if (redis) {
          const lastHash = await redis.get('low-stock-alerts:last-hash');
          if (lastHash === alertHash) {
            logger.info('[low-stock-alerts] Skipped — same items already alerted (dedup)');
            return NextResponse.json({
              success: true,
              message: 'No new low-stock changes since last alert',
              alertCount: alertFormats.length,
              skippedDedup: true,
            });
          }
          // Store hash with 24h TTL — a new alert will be sent if items change OR after 24h
          await redis.set('low-stock-alerts:last-hash', alertHash, 'EX', 86400);
        }
      } catch (redisErr) {
        // Redis down — proceed with sending (prefer alert over silence)
        logger.warn('[low-stock-alerts] Redis dedup check failed, sending anyway', {
          error: redisErr instanceof Error ? redisErr.message : String(redisErr),
        });
      }

      // Separate into out-of-stock (0) and low stock (> 0)
      const outOfStock = alertFormats.filter((f) => f.stockQuantity === 0);
      const lowStock = alertFormats.filter((f) => f.stockQuantity > 0);

      // Resolve admin email: prefer SiteSettings, fall back to env var
      const adminEmail = await resolveAdminEmail();

      if (!adminEmail) {
        logger.error(
          '[low-stock-alerts] No admin email configured (SiteSettings.supportEmail / SiteSettings.email / ADMIN_EMAIL)'
        );
        return NextResponse.json(
          { error: 'No admin email configured' },
          { status: 500 }
        );
      }

      const html = buildDigestEmail(outOfStock, lowStock);

      const emailResult = await sendEmail({
        to: { email: adminEmail },
        subject: `[BioCycle] Low Stock Alert: ${outOfStock.length} out-of-stock, ${lowStock.length} low-stock`,
        html,
        tags: ['low-stock-alert', 'inventory', 'admin'],
      });

      if (!emailResult.success) {
        logger.error('[low-stock-alerts] Failed to send digest email', {
          error: emailResult.error,
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to send notification email',
            alertCount: alertFormats.length,
          },
          { status: 502 }
        );
      }

      logger.info(
        `[low-stock-alerts] Digest sent to ${adminEmail} (${alertFormats.length} item(s))`
      );

      return NextResponse.json({
        success: true,
        message: `Low stock alert sent to ${adminEmail}`,
        alertCount: alertFormats.length,
        outOfStockCount: outOfStock.length,
        lowStockCount: lowStock.length,
      });
    } catch (error) {
      logger.error('[low-stock-alerts] Unexpected error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        {
          error: 'Failed to process low stock alerts',
          ...(process.env.NODE_ENV === 'development'
            ? { details: error instanceof Error ? error.message : 'Unknown error' }
            : {}),
        },
        { status: 500 }
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the admin email address.
 * Priority: SiteSettings.supportEmail → SiteSettings.email → process.env.ADMIN_EMAIL
 */
async function resolveAdminEmail(): Promise<string | undefined> {
  try {
    const settings = await prisma.siteSettings.findUnique({
      where: { id: 'default' },
      select: { supportEmail: true, email: true },
    });
    return (
      settings?.supportEmail ||
      settings?.email ||
      process.env.ADMIN_EMAIL
    );
  } catch (settingsErr) {
    logger.error('[low-stock-alerts] Failed to fetch admin email from settings', { error: settingsErr instanceof Error ? settingsErr.message : String(settingsErr) });
    return process.env.ADMIN_EMAIL;
  }
}

interface AlertFormat {
  id: string;
  name: string;
  sku: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  product: {
    id: string;
    name: string;
    slug: string;
    sku: string | null;
  };
}

/**
 * Build the HTML digest email body.
 */
function buildDigestEmail(
  outOfStock: AlertFormat[],
  lowStock: AlertFormat[]
): string {
  const baseUrl =
    process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || 'https://biocyclepeptides.com';
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2 style="color: #dc2626;">Low Stock Alert &mdash; ${now}</h2>
      <p>The following products require attention:</p>
  `;

  if (outOfStock.length > 0) {
    html += `
      <h3 style="color: #dc2626;">Out of Stock (${outOfStock.length})</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#fef2f2;">
            <th style="text-align:left;padding:8px;border:1px solid #fecaca;">Product</th>
            <th style="text-align:left;padding:8px;border:1px solid #fecaca;">Format</th>
            <th style="text-align:left;padding:8px;border:1px solid #fecaca;">SKU</th>
            <th style="text-align:center;padding:8px;border:1px solid #fecaca;">Stock</th>
            <th style="text-align:center;padding:8px;border:1px solid #fecaca;">Threshold</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const f of outOfStock) {
      html += `
          <tr>
            <td style="padding:8px;border:1px solid #fecaca;">${f.product.name}</td>
            <td style="padding:8px;border:1px solid #fecaca;">${f.name}</td>
            <td style="padding:8px;border:1px solid #fecaca;">${f.sku ?? f.product.sku ?? '&mdash;'}</td>
            <td style="padding:8px;border:1px solid #fecaca;text-align:center;color:#dc2626;font-weight:bold;">0</td>
            <td style="padding:8px;border:1px solid #fecaca;text-align:center;">${f.lowStockThreshold}</td>
          </tr>
      `;
    }
    html += '</tbody></table>';
  }

  if (lowStock.length > 0) {
    html += `
      <h3 style="color: #f59e0b;">Low Stock (${lowStock.length})</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <thead>
          <tr style="background:#fffbeb;">
            <th style="text-align:left;padding:8px;border:1px solid #fde68a;">Product</th>
            <th style="text-align:left;padding:8px;border:1px solid #fde68a;">Format</th>
            <th style="text-align:left;padding:8px;border:1px solid #fde68a;">SKU</th>
            <th style="text-align:center;padding:8px;border:1px solid #fde68a;">Stock</th>
            <th style="text-align:center;padding:8px;border:1px solid #fde68a;">Threshold</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const f of lowStock) {
      html += `
          <tr>
            <td style="padding:8px;border:1px solid #fde68a;">${f.product.name}</td>
            <td style="padding:8px;border:1px solid #fde68a;">${f.name}</td>
            <td style="padding:8px;border:1px solid #fde68a;">${f.sku ?? f.product.sku ?? '&mdash;'}</td>
            <td style="padding:8px;border:1px solid #fde68a;text-align:center;color:#f59e0b;font-weight:bold;">${f.stockQuantity}</td>
            <td style="padding:8px;border:1px solid #fde68a;text-align:center;">${f.lowStockThreshold}</td>
          </tr>
      `;
    }
    html += '</tbody></table>';
  }

  html += `
      <p style="margin-top:20px;">
        <a href="${baseUrl}/admin/inventory"
           style="display:inline-block;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">
          Manage Inventory
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:20px;">
        This is an automated alert from BioCycle Peptides inventory monitoring.
      </p>
    </div>
  `;

  return html;
}
