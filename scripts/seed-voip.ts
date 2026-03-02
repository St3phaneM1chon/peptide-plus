/**
 * Seed script to create sample VoIP/Telephony data for demo/testing.
 * Run with: npx tsx scripts/seed-voip.ts
 *
 * Creates:
 *   - 1 VoipConnection (FusionPBX)
 *   - 3 PhoneNumbers (CA, US, EU DIDs)
 *   - 5 SipExtensions linked to existing admin users
 *   - 30 sample CallLogs (mixed directions/statuses)
 *   - 10 CallRecordings (simulated)
 *   - 5 CallTranscriptions with AI analysis
 *   - 8 CallSurveys (1-5 scores)
 *   - 3 Voicemails
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPhone(): string {
  return `+1514${randomInt(1000000, 9999999)}`;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(randomInt(8, 17), randomInt(0, 59), randomInt(0, 59));
  return d;
}

const CALLER_NAMES = [
  'Jean-Pierre Tremblay', 'Marie-Claire Dubois', 'Ahmed Hassan',
  'Sophie Gagnon', 'Robert Lavoie', 'Isabelle Nguyen',
  'François Bergeron', 'Natalie Roy', 'Daniel Côté', 'Julie Martin',
  'Carlos Rodriguez', 'Lin Wei', 'Priya Patel', 'Yuki Tanaka',
];

const DISPOSITIONS = ['resolved', 'callback_needed', 'escalated', 'info_provided', 'order_placed'];
const TAGS_POOL = ['support', 'billing', 'order', 'complaint', 'info', 'urgent', 'follow-up', 'peptide', 'shipping'];
const HANGUP_CAUSES = ['NORMAL_CLEARING', 'USER_BUSY', 'NO_ANSWER', 'CALL_REJECTED'];

const TRANSCRIPTION_SAMPLES = [
  {
    text: "Bonjour, j'appelle pour une question sur ma commande de BPC-157. Je l'ai commandée il y a 3 jours et je n'ai pas encore reçu de numéro de suivi. Pouvez-vous vérifier s'il vous plaît? Mon numéro de commande est le 4523.",
    summary: "Le client appelle pour le suivi de sa commande #4523 de BPC-157 passée il y a 3 jours. Il n'a pas reçu de numéro de suivi.",
    sentiment: 'neutral' as const,
    sentimentScore: 0.45,
    keywords: ['commande', 'BPC-157', 'suivi', 'livraison'],
    actionItems: ['Vérifier statut commande #4523', 'Envoyer numéro de suivi par email'],
  },
  {
    text: "Oui allô, je suis vraiment satisfait du TB-500 que j'ai reçu la semaine dernière. La qualité est excellente. Je voulais savoir si vous aviez un programme de fidélité ou des rabais pour les commandes récurrentes?",
    summary: "Client très satisfait du TB-500 reçu. Demande des informations sur le programme de fidélité et les rabais pour commandes récurrentes.",
    sentiment: 'positive' as const,
    sentimentScore: 0.9,
    keywords: ['TB-500', 'satisfaction', 'fidélité', 'rabais', 'récurrent'],
    actionItems: ['Inscrire au programme de fidélité', 'Envoyer info abonnements'],
  },
  {
    text: "J'ai un problème avec mon dernier achat. Le flacon de PT-141 était endommagé à la réception. L'emballage était correct mais le flacon avait une fissure. J'aimerais un remplacement s'il vous plaît.",
    summary: "Réclamation: flacon de PT-141 endommagé (fissuré) à la réception malgré un emballage correct. Le client demande un remplacement.",
    sentiment: 'negative' as const,
    sentimentScore: 0.2,
    keywords: ['PT-141', 'endommagé', 'fissure', 'remplacement', 'réclamation'],
    actionItems: ['Créer ticket de remplacement', 'Vérifier lot de production', 'Envoyer nouveau flacon en priorité'],
  },
  {
    text: "Bonjour, je suis médecin et j'aimerais en savoir plus sur vos peptides pour la recherche. Est-ce que vous avez des certificats d'analyse? Et quels sont vos volumes disponibles pour les commandes en gros?",
    summary: "Médecin intéressé par les peptides pour la recherche. Demande des certificats d'analyse et des informations sur les commandes en gros.",
    sentiment: 'positive' as const,
    sentimentScore: 0.75,
    keywords: ['recherche', 'médecin', 'certificat analyse', 'gros', 'B2B'],
    actionItems: ['Envoyer certificats analyse par email', 'Transférer au département B2B', 'Préparer devis gros volume'],
  },
  {
    text: "Allô, oui je voudrais annuler ma commande. Je l'ai passée ce matin mais je me suis trompé de produit. Le numéro c'est 4601. Est-ce possible d'annuler avant l'expédition?",
    summary: "Demande d'annulation de la commande #4601 passée ce matin (erreur de produit). Le client souhaite annuler avant expédition.",
    sentiment: 'neutral' as const,
    sentimentScore: 0.4,
    keywords: ['annulation', 'commande', 'erreur', 'expédition'],
    actionItems: ['Vérifier si commande #4601 expédiée', 'Annuler si possible', 'Proposer échange de produit'],
  },
];

async function main() {
  console.log('Seeding VoIP demo data...');

  // Get existing admin/employee users
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ['OWNER', 'EMPLOYEE'] } },
    take: 5,
    select: { id: true, name: true, email: true, phone: true },
  });

  if (adminUsers.length === 0) {
    console.log('No admin/employee users found. Creating with generic user IDs.');
  }

  // Get some customer users for linking calls
  const customers = await prisma.user.findMany({
    where: { role: 'CUSTOMER' },
    take: 10,
    select: { id: true, name: true, phone: true },
  });

  // ── 1. VoipConnection ───────────────────────────────
  console.log('  Creating VoIP connection...');
  const connection = await prisma.voipConnection.upsert({
    where: { provider: 'fusionpbx' },
    create: {
      provider: 'fusionpbx',
      isEnabled: true,
      pbxHost: 'pbx.biocyclepeptides.com',
      pbxPort: 8021,
      syncStatus: 'ok',
      lastSyncAt: new Date(),
      configuredById: adminUsers[0]?.id,
    },
    update: {
      isEnabled: true,
      lastSyncAt: new Date(),
    },
  });
  console.log(`    Connection: ${connection.id} (${connection.provider})`);

  // ── 2. PhoneNumbers (DIDs) ──────────────────────────
  console.log('  Creating phone numbers...');
  const dids = [
    { number: '+15145550100', displayName: 'Support BioCycle', country: 'CA', type: 'LOCAL' as const },
    { number: '+18005550200', displayName: 'Toll-Free BioCycle', country: 'CA', type: 'TOLL_FREE' as const },
    { number: '+12125550300', displayName: 'BioCycle US', country: 'US', type: 'LOCAL' as const },
  ];

  const phoneNumbers = [];
  for (const did of dids) {
    const pn = await prisma.phoneNumber.upsert({
      where: { number: did.number },
      create: {
        connectionId: connection.id,
        number: did.number,
        displayName: did.displayName,
        country: did.country,
        type: did.type,
        isActive: true,
        monthlyCost: did.type === 'TOLL_FREE' ? 5.0 : 1.0,
      },
      update: { isActive: true },
    });
    phoneNumbers.push(pn);
    console.log(`    DID: ${pn.number} (${pn.country})`);
  }

  // ── 3. SipExtensions ────────────────────────────────
  console.log('  Creating SIP extensions...');
  const extensions = [];
  for (let i = 0; i < 5; i++) {
    const ext = `100${i + 1}`;
    const user = adminUsers[i] || adminUsers[0];
    if (!user) continue;

    const sipExt = await prisma.sipExtension.upsert({
      where: { extension: ext },
      create: {
        userId: user.id,
        extension: ext,
        sipUsername: `ext${ext}`,
        sipPassword: 'demo-encrypted-password',
        sipDomain: 'pbx.biocyclepeptides.com',
        isRegistered: i < 3, // first 3 online
        status: i === 0 ? 'ONLINE' : i === 1 ? 'BUSY' : i === 2 ? 'ONLINE' : 'OFFLINE',
        lastSeenAt: i < 3 ? new Date() : daysAgo(1),
      },
      update: {},
    });
    extensions.push(sipExt);
    console.log(`    Extension: ${ext} -> ${user.name || user.email}`);
  }

  // ── 4. CallLogs ─────────────────────────────────────
  console.log('  Creating call logs...');
  const statuses: Array<'COMPLETED' | 'MISSED' | 'VOICEMAIL' | 'FAILED'> = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'MISSED', 'VOICEMAIL', 'FAILED'];
  const directions: Array<'INBOUND' | 'OUTBOUND' | 'INTERNAL'> = ['INBOUND', 'INBOUND', 'INBOUND', 'OUTBOUND', 'INTERNAL'];

  const callLogs = [];
  for (let i = 0; i < 30; i++) {
    const direction = randomItem(directions);
    const status = randomItem(statuses);
    const startedAt = daysAgo(randomInt(0, 14));
    const duration = status === 'COMPLETED' ? randomInt(30, 600) : status === 'MISSED' ? 0 : randomInt(5, 30);
    const answeredAt = status === 'COMPLETED' ? new Date(startedAt.getTime() + randomInt(3, 15) * 1000) : null;
    const endedAt = new Date(startedAt.getTime() + (duration + randomInt(3, 15)) * 1000);
    const customer = customers.length > 0 ? randomItem(customers) : null;

    const callLog = await prisma.callLog.create({
      data: {
        pbxUuid: `fs-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`,
        connectionId: connection.id,
        callerNumber: direction === 'OUTBOUND' ? phoneNumbers[0].number : randomPhone(),
        callerName: direction === 'INBOUND' ? randomItem(CALLER_NAMES) : 'BioCycle Peptides',
        calledNumber: direction === 'INBOUND' ? randomItem(phoneNumbers).number : randomPhone(),
        direction,
        phoneNumberId: randomItem(phoneNumbers).id,
        agentId: extensions.length > 0 ? randomItem(extensions).id : null,
        queue: randomInt(0, 1) ? randomItem(['support', 'ventes']) : null,
        ivr: direction === 'INBOUND' ? 'accueil' : null,
        startedAt,
        answeredAt,
        endedAt,
        duration,
        billableSec: Math.max(0, duration - 6),
        waitTime: direction === 'INBOUND' ? randomInt(0, 60) : 0,
        status,
        hangupCause: randomItem(HANGUP_CAUSES),
        clientId: customer?.id || null,
        agentNotes: status === 'COMPLETED' && randomInt(0, 1) ? randomItem([
          'Client satisfait, problème résolu',
          'Demande de rappel dans 2 jours',
          'Transféré au département comptabilité',
          'Commande vérifiée, envoi suivi par email',
          'Nouveau client potentiel B2B',
        ]) : null,
        disposition: status === 'COMPLETED' ? randomItem(DISPOSITIONS) : null,
        tags: randomInt(0, 1) ? [randomItem(TAGS_POOL), randomItem(TAGS_POOL)].filter((v, idx, arr) => arr.indexOf(v) === idx) : [],
      },
    });
    callLogs.push(callLog);
  }
  console.log(`    ${callLogs.length} call logs created`);

  // ── 5. CallRecordings ───────────────────────────────
  console.log('  Creating call recordings...');
  const completedCalls = callLogs.filter(c => c.status === 'COMPLETED').slice(0, 10);
  const recordings = [];
  for (const call of completedCalls) {
    const rec = await prisma.callRecording.create({
      data: {
        callLogId: call.id,
        localPath: `/var/lib/freeswitch/recordings/archive/${call.id}.wav`,
        fileSize: randomInt(50000, 2000000),
        format: 'wav',
        durationSec: call.duration || 60,
        isUploaded: false, // Will be uploaded by cron
        isTranscribed: false,
        consentObtained: true,
        consentMethod: 'ivr_prompt',
      },
    });
    recordings.push(rec);
  }
  console.log(`    ${recordings.length} recordings created`);

  // ── 6. CallTranscriptions ───────────────────────────
  console.log('  Creating transcriptions...');
  const toTranscribe = recordings.slice(0, 5);
  for (let i = 0; i < toTranscribe.length; i++) {
    const sample = TRANSCRIPTION_SAMPLES[i];
    await prisma.callTranscription.create({
      data: {
        callLogId: toTranscribe[i].callLogId,
        recordingId: toTranscribe[i].id,
        fullText: sample.text,
        summary: sample.summary,
        actionItems: JSON.stringify(sample.actionItems),
        sentiment: sample.sentiment,
        sentimentScore: sample.sentimentScore,
        keywords: sample.keywords,
        language: 'fr',
        engine: 'openai',
        model: 'whisper-1',
        confidence: 0.85 + Math.random() * 0.1,
      },
    });

    // Mark recording as transcribed
    await prisma.callRecording.update({
      where: { id: toTranscribe[i].id },
      data: { isTranscribed: true },
    });
  }
  console.log(`    ${toTranscribe.length} transcriptions created`);

  // ── 7. CallSurveys ─────────────────────────────────
  console.log('  Creating surveys...');
  const surveyCalls = completedCalls.slice(0, 8);
  for (const call of surveyCalls) {
    await prisma.callSurvey.create({
      data: {
        callLogId: call.id,
        overallScore: randomInt(3, 5),
        resolvedScore: randomInt(2, 5),
        method: 'dtmf',
        completedAt: new Date(call.endedAt!.getTime() + 30000),
      },
    });
  }
  console.log(`    ${surveyCalls.length} surveys created`);

  // ── 8. Voicemails ──────────────────────────────────
  console.log('  Creating voicemails...');
  if (extensions.length > 0) {
    for (let i = 0; i < 3; i++) {
      await prisma.voicemail.create({
        data: {
          extensionId: extensions[i % extensions.length].id,
          callerNumber: randomPhone(),
          callerName: randomItem(CALLER_NAMES),
          durationSec: randomInt(10, 120),
          transcription: i === 0
            ? "Bonjour, c'est Jean-Pierre Tremblay. Je vous appelle au sujet de ma commande de la semaine dernière. Pouvez-vous me rappeler au 514-555-1234? Merci."
            : i === 1
              ? "Oui, bonjour. Je voulais savoir si vous aviez du stock de GHK-Cu. Rappelez-moi quand vous pourrez. Merci, bonne journée."
              : null,
          isRead: i === 0, // first one is read
          isArchived: false,
          clientId: customers[i]?.id || null,
          createdAt: daysAgo(randomInt(0, 5)),
        },
      });
    }
    console.log('    3 voicemails created');
  }

  // ── Summary ────────────────────────────────────────
  console.log('');
  console.log('VoIP seed complete:');
  console.log(`  Connections:     1`);
  console.log(`  Phone numbers:   ${phoneNumbers.length}`);
  console.log(`  Extensions:      ${extensions.length}`);
  console.log(`  Call logs:       ${callLogs.length}`);
  console.log(`  Recordings:      ${recordings.length}`);
  console.log(`  Transcriptions:  ${toTranscribe.length}`);
  console.log(`  Surveys:         ${surveyCalls.length}`);
  console.log(`  Voicemails:      3`);
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
