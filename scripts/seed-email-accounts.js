#!/usr/bin/env node
/**
 * Seed Email Accounts for Attitudes VIP tenant
 *
 * Creates EmailAccount entries and EmailSettings for the Attitudes VIP tenant
 * with @attitudes.vip addresses instead of legacy @biocyclepeptides.com.
 *
 * Also updates SiteSettings with proper email fields.
 *
 * Usage: node scripts/seed-email-accounts.js
 */

const { PrismaClient } = require('../node_modules/.prisma/client');
const prisma = new PrismaClient();

const TENANT_ID = 'cmn06w0m80001uz9wugnd7a0n'; // Attitudes VIP

async function main() {
  console.log('=== Seed Email Accounts for Attitudes VIP ===\n');

  // -----------------------------------------------------------------------
  // 1. Upsert EmailAccount entries
  // -----------------------------------------------------------------------
  const emailAccounts = [
    {
      id: 'ea-attitudes-primary',
      tenantId: TENANT_ID,
      name: 'Principal',
      email: 'stephane.michon@attitudes.vip',
      displayName: 'Stéphane Michon — Attitudes VIP',
      replyTo: 'stephane.michon@attitudes.vip',
      provider: 'resend',
      credentials: JSON.stringify({}),
      isDefault: true,
      isActive: true,
      color: '#1E40AF',
      signature: `<p>Cordialement,</p><p><strong>Stéphane Michon</strong><br>Attitudes VIP inc.<br><a href="mailto:stephane.michon@attitudes.vip">stephane.michon@attitudes.vip</a><br><a href="https://attitudes.vip">attitudes.vip</a></p>`,
    },
    {
      id: 'ea-attitudes-info',
      tenantId: TENANT_ID,
      name: 'Info / Support',
      email: 'info@attitudes.vip',
      displayName: 'Attitudes VIP — Support',
      replyTo: 'info@attitudes.vip',
      provider: 'resend',
      credentials: JSON.stringify({}),
      isDefault: false,
      isActive: true,
      color: '#059669',
      signature: `<p>Merci de nous avoir contacté.</p><p><strong>Équipe Attitudes VIP</strong><br><a href="mailto:info@attitudes.vip">info@attitudes.vip</a><br><a href="https://attitudes.vip">attitudes.vip</a></p>`,
    },
    {
      id: 'ea-attitudes-support',
      tenantId: TENANT_ID,
      name: 'Support',
      email: 'support@attitudes.vip',
      displayName: 'Attitudes VIP — Support technique',
      replyTo: 'support@attitudes.vip',
      provider: 'resend',
      credentials: JSON.stringify({}),
      isDefault: false,
      isActive: true,
      color: '#D97706',
      signature: `<p>L'équipe support Attitudes VIP</p><p><a href="mailto:support@attitudes.vip">support@attitudes.vip</a><br><a href="https://attitudes.vip">attitudes.vip</a></p>`,
    },
    {
      id: 'ea-attitudes-noreply',
      tenantId: TENANT_ID,
      name: 'No-Reply (transactionnel)',
      email: 'noreply@attitudes.vip',
      displayName: 'Attitudes VIP',
      replyTo: 'info@attitudes.vip',
      provider: 'resend',
      credentials: JSON.stringify({}),
      isDefault: false,
      isActive: true,
      color: '#6B7280',
      signature: null,
    },
    {
      id: 'ea-attitudes-billing',
      tenantId: TENANT_ID,
      name: 'Facturation',
      email: 'billing@attitudes.vip',
      displayName: 'Attitudes VIP — Facturation',
      replyTo: 'billing@attitudes.vip',
      provider: 'resend',
      credentials: JSON.stringify({}),
      isDefault: false,
      isActive: true,
      color: '#7C3AED',
      signature: `<p>Service de facturation<br><strong>Attitudes VIP inc.</strong><br><a href="mailto:billing@attitudes.vip">billing@attitudes.vip</a></p>`,
    },
    {
      id: 'ea-attitudes-privacy',
      tenantId: TENANT_ID,
      name: 'Vie privée / DPO',
      email: 'privacy@attitudes.vip',
      displayName: 'Attitudes VIP — Protection des données',
      replyTo: 'privacy@attitudes.vip',
      provider: 'resend',
      credentials: JSON.stringify({}),
      isDefault: false,
      isActive: true,
      color: '#DC2626',
      signature: `<p>Responsable de la protection des données<br><strong>Attitudes VIP inc.</strong><br><a href="mailto:privacy@attitudes.vip">privacy@attitudes.vip</a></p>`,
    },
    {
      id: 'ea-attitudes-sales',
      tenantId: TENANT_ID,
      name: 'Ventes',
      email: 'sales@attitudes.vip',
      displayName: 'Attitudes VIP — Ventes',
      replyTo: 'sales@attitudes.vip',
      provider: 'resend',
      credentials: JSON.stringify({}),
      isDefault: false,
      isActive: true,
      color: '#0891B2',
      signature: `<p>Équipe commerciale<br><strong>Attitudes VIP inc.</strong><br><a href="mailto:sales@attitudes.vip">sales@attitudes.vip</a><br><a href="https://attitudes.vip">attitudes.vip</a></p>`,
    },
  ];

  for (const account of emailAccounts) {
    const result = await prisma.emailAccount.upsert({
      where: { id: account.id },
      create: account,
      update: {
        name: account.name,
        email: account.email,
        displayName: account.displayName,
        replyTo: account.replyTo,
        isDefault: account.isDefault,
        isActive: account.isActive,
        color: account.color,
        signature: account.signature,
        tenantId: account.tenantId,
      },
    });
    console.log(`  [EmailAccount] ${result.isDefault ? '★' : '○'} ${result.name}: ${result.email}`);
  }

  // -----------------------------------------------------------------------
  // 2. Upsert EmailSettings key-value pairs
  // -----------------------------------------------------------------------
  const emailSettings = [
    { key: 'email.senderName', value: 'Attitudes VIP' },
    { key: 'email.senderEmail', value: 'noreply@attitudes.vip' },
    { key: 'email.replyEmail', value: 'info@attitudes.vip' },
    { key: 'email.supportEmail', value: 'support@attitudes.vip' },
    { key: 'email.billingEmail', value: 'billing@attitudes.vip' },
    { key: 'email.privacyEmail', value: 'privacy@attitudes.vip' },
    { key: 'email.domain', value: 'attitudes.vip' },
    { key: 'email.defaultFromAccount', value: 'ea-attitudes-noreply' },
  ];

  for (const setting of emailSettings) {
    await prisma.emailSettings.upsert({
      where: { key: setting.key },
      create: { key: setting.key, value: setting.value, tenantId: TENANT_ID },
      update: { value: setting.value, tenantId: TENANT_ID },
    });
    console.log(`  [EmailSettings] ${setting.key} = ${setting.value}`);
  }

  // -----------------------------------------------------------------------
  // 3. Update SiteSettings with email fields
  // -----------------------------------------------------------------------
  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      tenantId: TENANT_ID,
      companyName: 'Attitudes VIP',
      companyLegalName: 'Attitudes VIP inc.',
      email: 'info@attitudes.vip',
      supportEmail: 'support@attitudes.vip',
      legalEmail: 'privacy@attitudes.vip',
      privacyEmail: 'privacy@attitudes.vip',
    },
    update: {
      email: 'info@attitudes.vip',
      supportEmail: 'support@attitudes.vip',
      legalEmail: 'privacy@attitudes.vip',
      privacyEmail: 'privacy@attitudes.vip',
    },
  });
  console.log(`  [SiteSettings] email=info@attitudes.vip, supportEmail=support@attitudes.vip, legalEmail=privacy@attitudes.vip, privacyEmail=privacy@attitudes.vip`);

  // -----------------------------------------------------------------------
  // 4. Summary
  // -----------------------------------------------------------------------
  console.log('\n=== Summary ===');
  console.log(`  EmailAccount entries: ${emailAccounts.length}`);
  console.log(`  EmailSettings entries: ${emailSettings.length}`);
  console.log(`  SiteSettings updated: yes`);

  console.log('\n=== Hardcoded @biocyclepeptides.com addresses that need dynamic resolution ===');
  console.log('  These files contain hardcoded @biocyclepeptides.com fallbacks.');
  console.log('  They should read from EmailSettings/EmailAccount/SiteSettings at runtime.');
  console.log('  Listed by priority:\n');

  const hardcodedFiles = [
    { file: 'src/lib/crm/shared-inbox.ts', emails: ['support@', 'sales@', 'info@'], note: 'Default mailboxes fallback' },
    { file: 'src/lib/breach-notification.ts', emails: ['privacy@'], note: 'Data breach notification templates' },
    { file: 'src/lib/consent-email.ts', emails: ['support@'], note: 'GDPR/Loi 25 consent emails' },
    { file: 'src/lib/chat/openai-chat.ts', emails: ['support@'], note: 'AI chat system prompt' },
    { file: 'src/lib/accounting/invoice-pdf.service.ts', emails: ['info@'], note: 'Invoice PDF generation' },
    { file: 'src/lib/accounting/pdf-reports.service.ts', emails: ['info@'], note: 'Financial report PDFs' },
    { file: 'src/lib/accounting/integrations.service.ts', emails: ['noreply@'], note: 'Accounting integrations' },
    { file: 'src/lib/media/weekly-report.ts', emails: ['admin@'], note: 'Weekly media report' },
    { file: 'src/lib/crm/push-notifications.ts', emails: ['admin@'], note: 'VAPID subject' },
    { file: 'src/app/api/contact/route.ts', emails: ['support@'], note: 'Contact form handler' },
    { file: 'src/app/api/email/send/route.ts', emails: ['info@'], note: 'Email send API' },
    { file: 'src/app/api/email/messages/route.ts', emails: ['info@'], note: 'Email messages API' },
    { file: 'src/app/api/orders/[id]/invoice/route.ts', emails: ['billing@'], note: 'Invoice route' },
    { file: 'src/app/api/account/delete-request/route.ts', emails: ['support@', 'deleted_xxx@deleted.'], note: 'Account deletion' },
    { file: 'src/app/api/account/invoices/[id]/pdf/route.ts', emails: ['support@'], note: 'Invoice PDF download' },
    { file: 'src/app/api/admin/emails/inbox/[id]/reply/route.ts', emails: ['support@'], note: 'Admin inbox reply' },
    { file: 'src/app/api/chat/settings/route.ts', emails: ['support@'], note: 'Chat settings' },
    { file: 'src/app/api/cron/aging-reminders/route.ts', emails: ['support@'], note: 'Cron aging reminders' },
    { file: 'src/app/api/mailing-list/subscribe/route.ts', emails: ['support@'], note: 'Mailing list subscribe' },
    { file: 'src/app/(auth)/auth/forgot-password/page.tsx', emails: ['support@'], note: 'Forgot password page' },
    { file: 'src/app/admin/emails/page.tsx', emails: ['noreply@', 'support@'], note: 'Admin email config page placeholders' },
  ];

  for (const f of hardcodedFiles) {
    console.log(`  - ${f.file}`);
    console.log(`    Emails: ${f.emails.map(e => e + 'biocyclepeptides.com').join(', ')}`);
    console.log(`    Context: ${f.note}`);
  }

  console.log('\n=== Recommended approach for production ===');
  console.log('  1. Run this script against the Railway production DB:');
  console.log('     DATABASE_URL="postgresql://..." node scripts/seed-email-accounts.js');
  console.log('  2. Set environment variables as fallbacks:');
  console.log('     NEXT_PUBLIC_SUPPORT_EMAIL=support@attitudes.vip');
  console.log('     NEXT_PUBLIC_INFO_EMAIL=info@attitudes.vip');
  console.log('     SMTP_FROM=noreply@attitudes.vip');
  console.log('     ADMIN_EMAIL=stephane.michon@attitudes.vip');
  console.log('  3. Progressively replace hardcoded biocyclepeptides.com with');
  console.log('     dynamic lookups from EmailSettings/SiteSettings/env vars.');
  console.log('  4. Configure Resend or your email provider with @attitudes.vip domain');
  console.log('     (SPF/DKIM/DMARC DNS records required for deliverability).\n');

  await prisma.$disconnect();
  console.log('Done.');
}

main().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
