/**
 * Seed script: Email system data + fix superuser password
 *
 * Usage:
 *   LOCAL:  npx tsx prisma/seed-email-data.ts
 *   PROD:   DATABASE_URL='postgresql://...' npx tsx prisma/seed-email-data.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Seeding email system data + fixing passwords ===\n');

  // ── 1. EmailSettings (8 keys) ────────────────────────────────
  const emailSettings = [
    { key: 'email.provider', value: 'resend' },
    { key: 'email.senderEmail', value: 'noreply@biocyclepeptides.com' },
    { key: 'email.senderName', value: 'BioCycle Peptides' },
    { key: 'email.replyEmail', value: 'support@biocyclepeptides.com' },
    { key: 'email.fromDisplay', value: 'BioCycle Peptides <noreply@biocyclepeptides.com>' },
    { key: 'email.rateLimitPerSecond', value: '10' },
    { key: 'email.trackOpens', value: 'true' },
    { key: 'email.trackClicks', value: 'true' },
  ];

  for (const s of emailSettings) {
    await prisma.emailSettings.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value },
      update: { value: s.value },
    });
  }
  console.log(`✓ EmailSettings: ${emailSettings.length} keys upserted`);

  // ── 2. EmailTemplates (8 templates) ──────────────────────────
  const templates = [
    {
      name: 'ORDER_CONFIRMATION',
      subject: 'Confirmation de commande #{{orderNumber}}',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0369a1;">
          <h1 style="color:#0369a1;margin:0;">BioCycle Peptides</h1>
        </div>
        <h2 style="color:#1e293b;">Merci pour votre commande!</h2>
        <p>Bonjour {{customerName}},</p>
        <p>Votre commande <strong>#{{orderNumber}}</strong> a été confirmée.</p>
        <p><strong>Total:</strong> {{orderTotal}}</p>
        <p>Vous recevrez un email de suivi lorsque votre commande sera expédiée.</p>
        <div style="margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;">
          <p style="margin:0;color:#64748b;font-size:13px;">BioCycle Peptides — Recherche peptidique de qualité</p>
        </div>
      </div>`,
      variables: ['orderNumber', 'customerName', 'orderTotal'],
    },
    {
      name: 'ORDER_SHIPPED',
      subject: 'Votre commande #{{orderNumber}} a été expédiée',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0369a1;">
          <h1 style="color:#0369a1;margin:0;">BioCycle Peptides</h1>
        </div>
        <h2 style="color:#1e293b;">Votre commande est en route!</h2>
        <p>Bonjour {{customerName}},</p>
        <p>Votre commande <strong>#{{orderNumber}}</strong> a été expédiée.</p>
        <p><strong>Transporteur:</strong> {{carrier}}</p>
        <p><strong>Numéro de suivi:</strong> {{trackingNumber}}</p>
        <div style="margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;">
          <p style="margin:0;color:#64748b;font-size:13px;">BioCycle Peptides</p>
        </div>
      </div>`,
      variables: ['orderNumber', 'customerName', 'carrier', 'trackingNumber'],
    },
    {
      name: 'ORDER_DELIVERED',
      subject: 'Votre commande #{{orderNumber}} a été livrée',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0369a1;">
          <h1 style="color:#0369a1;margin:0;">BioCycle Peptides</h1>
        </div>
        <h2 style="color:#1e293b;">Commande livrée!</h2>
        <p>Bonjour {{customerName}},</p>
        <p>Votre commande <strong>#{{orderNumber}}</strong> a été livrée avec succès.</p>
        <p>Nous espérons que vous êtes satisfait. N'hésitez pas à nous laisser un avis!</p>
        <div style="margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;">
          <p style="margin:0;color:#64748b;font-size:13px;">BioCycle Peptides</p>
        </div>
      </div>`,
      variables: ['orderNumber', 'customerName'],
    },
    {
      name: 'WELCOME',
      subject: 'Bienvenue chez BioCycle Peptides, {{customerName}}!',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0369a1;">
          <h1 style="color:#0369a1;margin:0;">BioCycle Peptides</h1>
        </div>
        <h2 style="color:#1e293b;">Bienvenue!</h2>
        <p>Bonjour {{customerName}},</p>
        <p>Merci de vous être inscrit chez BioCycle Peptides. Votre compte est maintenant actif.</p>
        <p>Découvrez notre catalogue de peptides de recherche de la plus haute qualité.</p>
        <a href="https://biocyclepeptides.com/shop" style="display:inline-block;padding:12px 24px;background:#0369a1;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">Voir le catalogue</a>
        <div style="margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;">
          <p style="margin:0;color:#64748b;font-size:13px;">BioCycle Peptides</p>
        </div>
      </div>`,
      variables: ['customerName'],
    },
    {
      name: 'PASSWORD_RESET',
      subject: 'Réinitialisation de votre mot de passe',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0369a1;">
          <h1 style="color:#0369a1;margin:0;">BioCycle Peptides</h1>
        </div>
        <h2 style="color:#1e293b;">Réinitialisation du mot de passe</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
        <p>Cliquez sur le lien ci-dessous pour créer un nouveau mot de passe:</p>
        <a href="{{resetUrl}}" style="display:inline-block;padding:12px 24px;background:#0369a1;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">Réinitialiser mon mot de passe</a>
        <p style="color:#64748b;font-size:13px;margin-top:20px;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
        <div style="margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;">
          <p style="margin:0;color:#64748b;font-size:13px;">BioCycle Peptides</p>
        </div>
      </div>`,
      variables: ['resetUrl'],
    },
    {
      name: 'ABANDONED_CART',
      subject: 'Vous avez oublié quelque chose? Votre panier vous attend',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0369a1;">
          <h1 style="color:#0369a1;margin:0;">BioCycle Peptides</h1>
        </div>
        <h2 style="color:#1e293b;">Votre panier vous attend!</h2>
        <p>Bonjour {{customerName}},</p>
        <p>Vous avez des articles dans votre panier. Ne les laissez pas s'échapper!</p>
        <a href="https://biocyclepeptides.com/cart" style="display:inline-block;padding:12px 24px;background:#0369a1;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">Voir mon panier</a>
        <div style="margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;">
          <p style="margin:0;color:#64748b;font-size:13px;">BioCycle Peptides</p>
        </div>
      </div>`,
      variables: ['customerName'],
    },
    {
      name: 'REVIEW_REQUEST',
      subject: 'Comment avez-vous trouvé {{productName}}?',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0369a1;">
          <h1 style="color:#0369a1;margin:0;">BioCycle Peptides</h1>
        </div>
        <h2 style="color:#1e293b;">Votre avis compte!</h2>
        <p>Bonjour {{customerName}},</p>
        <p>Vous avez récemment acheté <strong>{{productName}}</strong>. Nous aimerions connaître votre avis!</p>
        <a href="{{reviewUrl}}" style="display:inline-block;padding:12px 24px;background:#0369a1;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">Laisser un avis</a>
        <div style="margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;">
          <p style="margin:0;color:#64748b;font-size:13px;">BioCycle Peptides</p>
        </div>
      </div>`,
      variables: ['customerName', 'productName', 'reviewUrl'],
    },
    {
      name: 'BIRTHDAY',
      subject: 'Joyeux anniversaire {{customerName}}! Un cadeau vous attend',
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <div style="text-align:center;padding:20px 0;border-bottom:2px solid #0369a1;">
          <h1 style="color:#0369a1;margin:0;">BioCycle Peptides</h1>
        </div>
        <h2 style="color:#1e293b;">Joyeux anniversaire!</h2>
        <p>Bonjour {{customerName}},</p>
        <p>Toute l'équipe BioCycle Peptides vous souhaite un joyeux anniversaire!</p>
        <p>Pour l'occasion, profitez de <strong>15% de réduction</strong> sur votre prochaine commande avec le code:</p>
        <div style="text-align:center;padding:16px;background:#0369a1;color:white;font-size:24px;font-weight:bold;border-radius:8px;margin:16px 0;">{{discountCode}}</div>
        <a href="https://biocyclepeptides.com/shop" style="display:inline-block;padding:12px 24px;background:#0369a1;color:white;text-decoration:none;border-radius:6px;margin-top:16px;">En profiter</a>
        <div style="margin-top:30px;padding:20px;background:#f1f5f9;border-radius:8px;">
          <p style="margin:0;color:#64748b;font-size:13px;">BioCycle Peptides</p>
        </div>
      </div>`,
      variables: ['customerName', 'discountCode'],
    },
  ];

  for (const tmpl of templates) {
    await prisma.emailTemplate.upsert({
      where: { name: tmpl.name },
      create: {
        name: tmpl.name,
        subject: tmpl.subject,
        htmlContent: tmpl.htmlContent,
        variables: tmpl.variables,
        isActive: true,
        locale: 'fr',
      },
      update: {
        subject: tmpl.subject,
        htmlContent: tmpl.htmlContent,
        variables: tmpl.variables,
      },
    });
  }
  console.log(`✓ EmailTemplates: ${templates.length} templates upserted`);

  // ── 3. CannedResponses (5 responses) ─────────────────────────
  // Find an OWNER user to set as createdBy
  const ownerUser = await prisma.user.findFirst({
    where: { role: 'OWNER' },
    select: { id: true },
  });
  const createdById = ownerUser?.id || 'system';

  const cannedResponses = [
    {
      title: 'Remerciement',
      content: 'Merci pour votre message. Nous sommes heureux de pouvoir vous aider!',
      category: 'general',
    },
    {
      title: 'Suivi de commande',
      content: 'Votre commande est en cours de traitement. Vous recevrez un email avec le numéro de suivi dès qu\'elle sera expédiée. N\'hésitez pas à vérifier la section "Mes commandes" de votre compte.',
      category: 'orders',
    },
    {
      title: 'Problème résolu',
      content: 'Nous sommes heureux de vous confirmer que votre problème a été résolu. Si vous avez d\'autres questions, n\'hésitez pas à nous contacter.',
      category: 'support',
    },
    {
      title: 'Remboursement initié',
      content: 'Votre demande de remboursement a été approuvée. Le montant sera crédité sur votre moyen de paiement original dans un délai de 5 à 10 jours ouvrables.',
      category: 'refunds',
    },
    {
      title: 'FAQ - Délais de livraison',
      content: 'Nos délais de livraison habituels sont de 3 à 5 jours ouvrables au Canada et de 7 à 14 jours ouvrables à l\'international. Les commandes sont traitées dans les 24 heures.',
      category: 'faq',
    },
  ];

  // Delete existing and re-create to avoid duplicates (no unique constraint on title)
  const existingCanned = await prisma.cannedResponse.count();
  if (existingCanned === 0) {
    for (const cr of cannedResponses) {
      await prisma.cannedResponse.create({
        data: {
          title: cr.title,
          content: cr.content,
          category: cr.category,
          locale: 'fr',
          createdBy: createdById,
        },
      });
    }
    console.log(`✓ CannedResponses: ${cannedResponses.length} responses created`);
  } else {
    console.log(`✓ CannedResponses: ${existingCanned} already exist, skipping`);
  }

  // ── 4. ChatSettings default (if not exists) ──────────────────
  const chatSettings = await prisma.chatSettings.findUnique({ where: { id: 'default' } });
  if (!chatSettings) {
    await prisma.chatSettings.create({
      data: {
        id: 'default',
        isAdminOnline: false,
        adminLanguage: 'fr',
        chatbotEnabled: true,
        chatbotGreeting: 'Bonjour! Comment puis-je vous aider aujourd\'hui?',
        notifyEmail: 'support@biocyclepeptides.com',
        widgetColor: '#0369a1',
        widgetPosition: 'bottom-right',
      },
    });
    console.log('✓ ChatSettings: default settings created');
  } else {
    console.log('✓ ChatSettings: already exists, skipping');
  }

  // ── 5. Fix superuser password ────────────────────────────────
  // Use dynamic import for bcrypt to avoid ESM issues
  let bcryptHash: (password: string, rounds: number) => Promise<string>;
  try {
    const bcryptMod = await import('bcryptjs');
    bcryptHash = (bcryptMod.default || bcryptMod).hash;
  } catch {
    try {
      const bcryptMod = await import('bcrypt');
      bcryptHash = (bcryptMod.default || bcryptMod).hash;
    } catch {
      console.error('✗ Neither bcryptjs nor bcrypt found. Install with: npm install bcryptjs');
      return;
    }
  }

  const password = 'St3ph@ne1234';
  const newHash = await bcryptHash(password, 12);

  const owners = await prisma.user.findMany({
    where: { role: 'OWNER' },
    select: { id: true, email: true, name: true },
  });

  if (owners.length === 0) {
    console.log('✗ No OWNER users found to fix password');
  } else {
    for (const owner of owners) {
      await prisma.user.update({
        where: { id: owner.id },
        data: { password: newHash },
      });
      console.log(`✓ Password fixed for OWNER: ${owner.email} (${owner.name})`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  const counts = {
    emailSettings: await prisma.emailSettings.count(),
    emailTemplates: await prisma.emailTemplate.count(),
    cannedResponses: await prisma.cannedResponse.count(),
    chatSettings: await prisma.chatSettings.count(),
    ownerUsers: owners.length,
  };

  console.log('\n=== Seed complete ===');
  console.log(`  EmailSettings:   ${counts.emailSettings} rows`);
  console.log(`  EmailTemplates:  ${counts.emailTemplates} rows`);
  console.log(`  CannedResponses: ${counts.cannedResponses} rows`);
  console.log(`  ChatSettings:    ${counts.chatSettings} rows`);
  console.log(`  OWNER passwords: ${counts.ownerUsers} fixed`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
