/**
 * LMS Seed Script — Populates demo data for LMS Aptitudes
 * =============================================================================
 * Run with: npx tsx scripts/seed-lms.ts [--tenant-id <id>]
 *
 * Seeds:
 * - 1 Instructor (Marie-Claire Dubois)
 * - 3 Course Categories
 * - 1 Complete Course with 3 chapters, 10 lessons
 * - 3 Quizzes (1 per chapter, 5 questions each)
 * - 10 Concepts with prerequisites
 * - 5 Badges
 * - 1 Certificate Template
 * - 1 Regulatory Body (AMF) + accreditation
 *
 * Idempotent: checks if data exists before creating.
 */

import { PrismaClient, Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma client (direct, no multi-tenant context needed for seeding)
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): { tenantId?: string } {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--tenant-id');
  if (idx !== -1 && args[idx + 1]) {
    return { tenantId: args[idx + 1] };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Helper: log with prefix
// ---------------------------------------------------------------------------

function log(emoji: string, msg: string) {
  console.log(`  ${emoji} ${msg}`);
}

// ---------------------------------------------------------------------------
// Seed data definitions
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    slug: 'conformite-amf',
    name: 'Conformité AMF',
    description: 'Formations sur la conformité réglementaire de l\'Autorité des marchés financiers du Québec.',
    sortOrder: 1,
  },
  {
    slug: 'produits-assurance',
    name: 'Produits d\'assurance',
    description: 'Formations sur les différents produits d\'assurance de personnes et de dommages.',
    sortOrder: 2,
  },
  {
    slug: 'ethique-professionnelle',
    name: 'Éthique professionnelle',
    description: 'Formations sur la déontologie et l\'éthique dans le domaine de l\'assurance.',
    sortOrder: 3,
  },
];

const COURSE = {
  slug: 'intro-conformite-amf-representants',
  title: 'Introduction à la conformité AMF pour représentants',
  subtitle: 'Les fondamentaux réglementaires pour exercer en toute conformité',
  description: 'Ce cours couvre les bases de la conformité réglementaire pour les représentants en assurance au Québec. De la LDPSF aux obligations déontologiques, en passant par les pratiques conformes au quotidien.',
  longDescription: `Ce programme de formation complète est conçu pour les représentants en assurance qui souhaitent maîtriser les fondamentaux de la conformité réglementaire au Québec.\n\nVous y apprendrez le cadre législatif (LDPSF), le rôle de l'AMF, les obligations déontologiques, et les meilleures pratiques pour exercer votre métier en toute conformité.\n\nCette formation est accréditée par l'AMF et donne droit à 5 UFC (unités de formation continue).`,
  level: 'BEGINNER' as const,
  status: 'PUBLISHED' as const,
  isFree: false,
  price: new Prisma.Decimal(149.99),
  currency: 'CAD',
  estimatedHours: new Prisma.Decimal(8.0),
  tags: ['AMF', 'conformité', 'UFC', 'représentant'],
  passingScore: 70,
  isCompliance: true,
  complianceDeadlineDays: 90,
};

const CHAPTERS = [
  {
    title: 'Cadre réglementaire',
    description: 'Comprendre la législation et les organismes qui régissent le secteur de l\'assurance au Québec.',
    sortOrder: 0,
    lessons: [
      {
        title: 'La Loi sur la distribution de produits et services financiers (LDPSF)',
        description: 'Fondements législatifs de l\'encadrement des représentants.',
        sortOrder: 0,
        estimatedMinutes: 25,
        textContent: `## La LDPSF : Pierre angulaire de l'encadrement

La **Loi sur la distribution de produits et services financiers (LDPSF)** constitue le cadre législatif fondamental qui régit l'exercice de la profession de représentant en assurance au Québec. Adoptée en 1998, cette loi a profondément transformé le paysage réglementaire du secteur financier québécois.

### Objectifs de la loi

La LDPSF vise principalement à **protéger le consommateur** de produits et services financiers. Elle établit les règles que doivent suivre tous les intermédiaires — courtiers, agents, planificateurs financiers — dans leurs relations avec le public. Le législateur a voulu s'assurer que chaque citoyen qui achète un produit d'assurance ou d'investissement bénéficie d'un service compétent, honnête et transparent.

### Champ d'application

La loi s'applique à toute personne qui agit comme intermédiaire entre un consommateur et un assureur ou un émetteur de produits financiers. Cela inclut les représentants en assurance de personnes, les représentants en assurance de dommages, les experts en sinistre, les planificateurs financiers et les représentants en épargne collective.

### Obligations fondamentales

Parmi les obligations imposées par la LDPSF, on retrouve la nécessité d'être titulaire d'un **certificat de représentant** délivré par l'AMF, l'obligation de recueillir les renseignements nécessaires pour évaluer les besoins du client (l'analyse de besoins financiers), et le devoir d'agir avec compétence, intégrité et loyauté.`,
      },
      {
        title: 'Le rôle de l\'AMF',
        description: 'Mission, pouvoirs et mécanismes de surveillance de l\'Autorité des marchés financiers.',
        sortOrder: 1,
        estimatedMinutes: 20,
        textContent: `## L'Autorité des marchés financiers (AMF)

L'**AMF** est l'organisme de réglementation et d'encadrement du secteur financier au Québec. Créée en 2004, elle résulte de la fusion de plusieurs organismes qui assuraient auparavant la surveillance de différents segments du marché financier.

### Mission principale

L'AMF a pour mission de **protéger les consommateurs** de produits et services financiers tout en assurant le bon fonctionnement des marchés financiers. Elle administre la LDPSF et veille au respect de l'ensemble de la législation encadrant le secteur financier québécois.

### Pouvoirs de l'AMF

L'AMF dispose de pouvoirs étendus qui lui permettent de remplir efficacement sa mission :

- **Pouvoir d'inspection** : L'AMF peut inspecter les activités de tout cabinet, représentant ou société autonome pour vérifier le respect de la législation.
- **Pouvoir disciplinaire** : En cas de manquement, l'AMF peut imposer des sanctions allant de l'amende à la révocation du certificat.
- **Pouvoir normatif** : L'AMF édicte des règlements et des instructions générales qui précisent les obligations des acteurs du marché.

### Le Registre des entreprises et des individus

Tout représentant autorisé à exercer est inscrit au **Registre de l'AMF**, consultable par le public. Le consommateur peut ainsi vérifier qu'un représentant est bel et bien autorisé à offrir ses services.`,
      },
      {
        title: 'Obligations du représentant',
        description: 'Devoirs et responsabilités imposés par la loi aux représentants.',
        sortOrder: 2,
        estimatedMinutes: 30,
        textContent: `## Obligations légales du représentant

Tout représentant en assurance est soumis à un ensemble d'**obligations légales** strictes, dont le non-respect peut entraîner des sanctions disciplinaires, civiles ou même pénales. Ces obligations visent à garantir la protection du consommateur à chaque étape de la relation professionnelle.

### L'analyse des besoins financiers (ABF)

Avant de recommander un produit d'assurance, le représentant **doit** procéder à une analyse complète des besoins financiers du client. Cette analyse doit être documentée et conservée au dossier. L'ABF doit couvrir la situation financière actuelle du client, ses objectifs à court et long terme, sa tolérance au risque, et ses couvertures d'assurance existantes.

### Le devoir de conseil

Le représentant a l'obligation de **conseiller adéquatement** son client. Ce devoir va au-delà de la simple vente : il implique de recommander le produit le plus approprié aux besoins identifiés, même si ce produit génère une commission moindre pour le représentant. Le conseil doit être documenté et le client doit comprendre ce qu'il achète.

### La divulgation et la transparence

Le représentant doit divulguer tout **conflit d'intérêts** potentiel, notamment sa rémunération, ses liens avec les assureurs, et toute situation qui pourrait influencer ses recommandations. La transparence est la pierre angulaire de la relation de confiance entre le représentant et son client.`,
      },
      {
        title: 'Le certificat de représentant et les UFC',
        description: 'Processus d\'obtention du permis et exigences de formation continue.',
        sortOrder: 3,
        estimatedMinutes: 20,
        textContent: `## Le certificat de représentant

Pour exercer comme représentant en assurance au Québec, il faut être titulaire d'un **certificat de représentant** délivré par l'AMF. Ce certificat atteste que son titulaire possède les compétences et les qualifications nécessaires pour offrir des services financiers au public.

### Conditions d'obtention

L'obtention du certificat exige de satisfaire à plusieurs conditions : la réussite des examens de certification administrés par l'AMF, la réussite du stage de formation pratique dans certaines disciplines, et la vérification des antécédents (casier judiciaire, historique disciplinaire).

### Les unités de formation continue (UFC)

Une fois le certificat obtenu, le représentant doit maintenir ses compétences à jour par la **formation continue obligatoire**. L'AMF exige un minimum d'UFC par cycle de deux ans. Le nombre exact varie selon la discipline, mais inclut typiquement des heures en conformité, en déontologie et en formation générale.

### Renouvellement et obligations continues

Le certificat n'est pas permanent. Le représentant doit s'assurer de compléter ses UFC dans les délais prescrits. Le non-respect de cette obligation peut entraîner la **suspension ou la révocation** du certificat. Le représentant doit également informer l'AMF de tout changement dans sa situation (changement de cabinet, plaintes, poursuites, etc.).`,
      },
    ],
  },
  {
    title: 'Déontologie et éthique',
    description: 'Principes déontologiques et gestion des situations éthiques dans la pratique quotidienne.',
    sortOrder: 1,
    lessons: [
      {
        title: 'Le code de déontologie',
        description: 'Principes fondamentaux du code de déontologie des représentants.',
        sortOrder: 0,
        estimatedMinutes: 25,
        textContent: `## Le code de déontologie

Le **Code de déontologie des représentants en assurance de personnes** et celui des représentants en assurance de dommages établissent les normes de conduite professionnelle que tout représentant doit respecter dans l'exercice de ses fonctions.

### Les principes fondamentaux

Le code repose sur plusieurs principes fondamentaux qui guident l'ensemble de la conduite professionnelle :

1. **Intégrité** : Le représentant doit agir avec honnêteté et probité en tout temps. Il ne doit pas induire le client en erreur ni faire de fausses déclarations.
2. **Compétence** : Le représentant doit maintenir un niveau de compétence suffisant et ne pas exercer dans des domaines qui dépassent ses qualifications.
3. **Loyauté** : Le représentant doit agir dans le meilleur intérêt de son client, en faisant prévaloir cet intérêt sur le sien propre ou celui de tiers.
4. **Diligence** : Le représentant doit apporter un soin attentif à ses dossiers et assurer un suivi adéquat auprès de ses clients.

### Application pratique

Au quotidien, le code de déontologie impose des comportements concrets : obtenir le consentement éclairé du client avant toute transaction, expliquer clairement les produits recommandés dans un langage accessible, et documenter chaque interaction significative au dossier du client.`,
      },
      {
        title: 'Les conflits d\'intérêts',
        description: 'Identifier, gérer et divulguer les situations de conflit d\'intérêts.',
        sortOrder: 1,
        estimatedMinutes: 25,
        textContent: `## Conflits d'intérêts

Un **conflit d'intérêts** survient lorsque les intérêts personnels ou professionnels du représentant risquent d'influencer le conseil qu'il donne à son client. La gestion adéquate des conflits d'intérêts est une responsabilité fondamentale de tout représentant.

### Types de conflits d'intérêts

Les conflits d'intérêts peuvent prendre plusieurs formes :

- **Conflits financiers** : Lorsque la rémunération du représentant (commissions, bonis) pourrait influencer sa recommandation. Par exemple, recommander un produit qui offre une commission plus élevée plutôt que celui qui répond le mieux aux besoins du client.
- **Conflits relationnels** : Lorsque le représentant a des liens personnels ou familiaux avec un assureur ou un client, pouvant compromettre son objectivité.
- **Conflits de rôles** : Lorsque le représentant agit dans un double rôle qui pourrait être incompatible (par exemple, expert en sinistre pour l'assureur et conseiller du client).

### Obligation de divulgation

Lorsqu'un conflit d'intérêts est identifié, le représentant a l'obligation de le **divulguer immédiatement** au client, de manière claire et complète. Cette divulgation doit permettre au client de prendre une décision éclairée. Si le conflit est trop important, le représentant doit se retirer du dossier.

### Mécanismes de prévention

Les cabinets sont tenus de mettre en place des **politiques de gestion des conflits d'intérêts** incluant des procédures de déclaration, un registre des conflits, et une formation régulière du personnel.`,
      },
      {
        title: 'L\'obligation de loyauté',
        description: 'Comprendre et appliquer le devoir de loyauté envers le client.',
        sortOrder: 2,
        estimatedMinutes: 20,
        textContent: `## L'obligation de loyauté

L'**obligation de loyauté** est l'un des piliers de la relation entre le représentant et son client. Elle impose au représentant de toujours agir dans le meilleur intérêt du client, même lorsque cela va à l'encontre de ses propres intérêts financiers.

### Portée de l'obligation

L'obligation de loyauté est vaste et couvre tous les aspects de la relation professionnelle :

- **Priorité au client** : Le représentant doit recommander les produits et services qui correspondent le mieux aux besoins identifiés du client, sans égard à sa propre rémunération.
- **Information complète** : Le représentant doit fournir toute l'information pertinente pour permettre au client de prendre une décision éclairée, y compris les inconvénients ou les risques associés à un produit.
- **Confidentialité** : Les renseignements personnels du client doivent être traités avec la plus grande confidentialité. Le représentant ne peut les utiliser qu'aux fins pour lesquelles ils ont été recueillis.

### Limites et zones grises

Certaines situations créent des zones grises où l'obligation de loyauté peut être difficile à appliquer. Par exemple, lorsqu'un client insiste pour acheter un produit inadéquat, le représentant doit documenter ses recommandations et les raisons pour lesquelles il déconseille le produit, tout en respectant le libre choix du client.

### Sanctions en cas de manquement

Le non-respect de l'obligation de loyauté peut entraîner des sanctions disciplinaires (réprimande, amende, suspension), des poursuites civiles en responsabilité, et dans les cas graves, des accusations criminelles de fraude.`,
      },
    ],
  },
  {
    title: 'Pratiques conformes',
    description: 'Application concrète des principes de conformité dans le travail quotidien.',
    sortOrder: 2,
    lessons: [
      {
        title: 'Documentation et tenue de dossiers',
        description: 'Exigences de documentation et bonnes pratiques de tenue de dossiers clients.',
        sortOrder: 0,
        estimatedMinutes: 25,
        textContent: `## Documentation et tenue de dossiers

La **tenue de dossiers** rigoureuse est une obligation légale et une pratique essentielle pour tout représentant en assurance. Un dossier bien tenu protège le client, le représentant et le cabinet en cas de litige ou d'inspection.

### Contenu obligatoire du dossier client

Chaque dossier client doit contenir au minimum :

- **L'analyse des besoins financiers (ABF)** complète et à jour, signée par le client.
- **Les propositions d'assurance** présentées, acceptées ou refusées.
- **Les notes de rencontre** documentant les échanges significatifs avec le client.
- **Les consentements** obtenus (traitement des renseignements personnels, divulgation d'information).
- **La correspondance** pertinente (courriels, lettres).

### Durée de conservation

Les dossiers doivent être conservés pour une durée minimale prescrite par la réglementation (typiquement 5 à 7 ans après la fin de la relation d'affaires). Certains documents, comme les polices d'assurance-vie, doivent être conservés plus longtemps.

### Bonnes pratiques

- Documenter **au moment de l'événement**, pas des jours ou semaines plus tard.
- Utiliser un langage **factuel et objectif**, éviter les opinions non fondées.
- Identifier clairement la **date, l'heure, et les personnes** impliquées dans chaque note.
- S'assurer que les documents numériques sont **sauvegardés de manière sécurisée** et accessibles en cas d'audit.`,
      },
      {
        title: 'Divulgation et transparence',
        description: 'Obligations de divulgation envers le client et le cabinet.',
        sortOrder: 1,
        estimatedMinutes: 20,
        textContent: `## Divulgation et transparence

La **divulgation** est une obligation fondamentale du représentant envers son client. Elle vise à assurer que le client dispose de toute l'information nécessaire pour prendre des décisions éclairées.

### Ce qui doit être divulgué

Le représentant doit divulguer de manière proactive :

- **Sa rémunération** : Le mode de rémunération (commissions, honoraires), les incitatifs financiers reçus des assureurs, et tout avantage non monétaire significatif (voyages, cadeaux).
- **Ses liens d'affaires** : Les liens avec les assureurs ou d'autres intervenants qui pourraient influencer ses recommandations.
- **Les caractéristiques du produit** : Les avantages ET les limitations du produit recommandé, les exclusions de couverture, les frais associés.
- **Les alternatives** : L'existence d'autres produits ou solutions qui pourraient mieux convenir aux besoins du client.

### Moment de la divulgation

La divulgation doit être faite **avant** la conclusion de la transaction. Le client doit avoir le temps de lire, comprendre et poser des questions. Remettre un document de divulgation au moment de la signature, sans l'expliquer, ne satisfait pas à l'obligation.

### Protection du consommateur

La Loi sur la protection du consommateur et la LDPSF se complètent pour assurer une divulgation complète. Le représentant qui omet de divulguer une information pertinente s'expose à des sanctions et peut engager sa responsabilité civile.`,
      },
      {
        title: 'Gestion des réclamations',
        description: 'Processus de traitement des plaintes et réclamations clients.',
        sortOrder: 2,
        estimatedMinutes: 20,
        textContent: `## Gestion des réclamations

La **gestion des réclamations** est un aspect important de la pratique professionnelle en assurance. Un processus de traitement des plaintes efficace et conforme est non seulement une obligation réglementaire, mais aussi un outil de fidélisation et d'amélioration continue.

### Obligation réglementaire

Tout cabinet doit maintenir un **processus de traitement des plaintes** conforme aux exigences de l'AMF. Ce processus doit être documenté, accessible aux clients, et prévoir des délais de réponse raisonnables. Le cabinet doit désigner un responsable du traitement des plaintes.

### Étapes du processus

1. **Réception** : Accuser réception de la plainte rapidement (dans les 48 heures). Documenter la plainte de manière factuelle.
2. **Évaluation** : Analyser la plainte objectivement. Recueillir les faits auprès de toutes les parties concernées.
3. **Traitement** : Proposer une résolution dans les délais prévus par la politique du cabinet (typiquement 20 jours ouvrables).
4. **Communication** : Informer le client de la décision et des motifs. Si la plainte est fondée, offrir un recours adéquat.
5. **Suivi** : Documenter la résolution et identifier les leçons apprises.

### Recours du consommateur

Si le client n'est pas satisfait de la réponse du cabinet, il peut s'adresser à l'**AMF** qui dispose d'un service d'assistance aux consommateurs. L'AMF peut intervenir comme médiateur, ouvrir une enquête, ou diriger le consommateur vers les tribunaux compétents.

### Registre des plaintes

Le cabinet doit maintenir un registre de toutes les plaintes reçues. Ce registre doit être disponible pour inspection par l'AMF. Il sert aussi d'outil d'amélioration continue pour identifier les tendances et les domaines nécessitant des ajustements.`,
      },
    ],
  },
];

const QUIZZES = [
  {
    chapterIndex: 0,
    title: 'Quiz — Cadre réglementaire',
    description: 'Évaluez votre compréhension du cadre législatif et réglementaire.',
    passingScore: 70,
    maxAttempts: 3,
    timeLimit: 15,
    questions: [
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Quel est l\'objectif principal de la LDPSF?',
        sortOrder: 0,
        points: 1,
        explanation: 'La LDPSF a été adoptée principalement pour protéger les consommateurs de produits et services financiers, en établissant des règles claires pour les intermédiaires.',
        options: [
          { id: 'a', text: 'Maximiser les revenus des assureurs', isCorrect: false },
          { id: 'b', text: 'Protéger le consommateur de produits et services financiers', isCorrect: true },
          { id: 'c', text: 'Réduire le nombre de représentants en assurance', isCorrect: false },
          { id: 'd', text: 'Uniformiser les tarifs d\'assurance au Québec', isCorrect: false },
        ],
      },
      {
        type: 'TRUE_FALSE' as const,
        question: 'L\'AMF a été créée en 2004 par la fusion de plusieurs organismes de surveillance du secteur financier.',
        sortOrder: 1,
        points: 1,
        explanation: 'L\'AMF a effectivement été créée en 2004, regroupant les mandats de la Commission des valeurs mobilières du Québec, de l\'Inspecteur général des institutions financières, et du Bureau des services financiers.',
        options: [
          { id: 'vrai', text: 'Vrai', isCorrect: true },
          { id: 'faux', text: 'Faux', isCorrect: false },
        ],
      },
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Lequel de ces pouvoirs N\'est PAS attribué à l\'AMF?',
        sortOrder: 2,
        points: 1,
        explanation: 'L\'AMF dispose de pouvoirs d\'inspection, disciplinaires et normatifs. Cependant, elle ne possède pas de pouvoir législatif — seule l\'Assemblée nationale du Québec peut adopter des lois.',
        options: [
          { id: 'a', text: 'Pouvoir d\'inspection', isCorrect: false },
          { id: 'b', text: 'Pouvoir disciplinaire', isCorrect: false },
          { id: 'c', text: 'Pouvoir législatif (adopter des lois)', isCorrect: true },
          { id: 'd', text: 'Pouvoir normatif (édicter des règlements)', isCorrect: false },
        ],
      },
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Quelle est la première étape obligatoire avant de recommander un produit d\'assurance?',
        sortOrder: 3,
        points: 1,
        explanation: 'L\'analyse des besoins financiers (ABF) est la première étape obligatoire. Elle permet d\'évaluer la situation du client et de recommander un produit adapté à ses besoins réels.',
        options: [
          { id: 'a', text: 'Vérifier la solvabilité du client', isCorrect: false },
          { id: 'b', text: 'Procéder à l\'analyse des besoins financiers (ABF)', isCorrect: true },
          { id: 'c', text: 'Obtenir la signature du client sur la proposition', isCorrect: false },
          { id: 'd', text: 'Consulter le catalogue des produits disponibles', isCorrect: false },
        ],
      },
      {
        type: 'TRUE_FALSE' as const,
        question: 'Un représentant peut exercer sans certificat AMF s\'il est supervisé par un courtier certifié.',
        sortOrder: 4,
        points: 1,
        explanation: 'Faux. Tout représentant doit détenir son propre certificat AMF pour exercer. La supervision par un courtier ne remplace pas l\'obligation d\'être personnellement certifié.',
        options: [
          { id: 'vrai', text: 'Vrai', isCorrect: false },
          { id: 'faux', text: 'Faux', isCorrect: true },
        ],
      },
    ],
  },
  {
    chapterIndex: 1,
    title: 'Quiz — Déontologie et éthique',
    description: 'Testez vos connaissances sur les principes déontologiques et éthiques.',
    passingScore: 70,
    maxAttempts: 3,
    timeLimit: 15,
    questions: [
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Lequel de ces principes N\'est PAS un pilier du code de déontologie?',
        sortOrder: 0,
        points: 1,
        explanation: 'Les quatre piliers sont l\'intégrité, la compétence, la loyauté et la diligence. La rentabilité n\'est pas un principe déontologique.',
        options: [
          { id: 'a', text: 'Intégrité', isCorrect: false },
          { id: 'b', text: 'Rentabilité', isCorrect: true },
          { id: 'c', text: 'Loyauté', isCorrect: false },
          { id: 'd', text: 'Diligence', isCorrect: false },
        ],
      },
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Quelle action constitue un conflit d\'intérêts financier?',
        sortOrder: 1,
        points: 1,
        explanation: 'Recommander un produit en raison de sa commission plus élevée plutôt que de sa pertinence pour le client est un conflit d\'intérêts financier typique.',
        options: [
          { id: 'a', text: 'Recommander un produit avec une commission plus élevée malgré un meilleur produit disponible', isCorrect: true },
          { id: 'b', text: 'Recommander le produit le moins cher au client', isCorrect: false },
          { id: 'c', text: 'Consulter un collègue pour un avis complémentaire', isCorrect: false },
          { id: 'd', text: 'Documenter les raisons de sa recommandation au dossier', isCorrect: false },
        ],
      },
      {
        type: 'TRUE_FALSE' as const,
        question: 'Un représentant peut garder un conflit d\'intérêts confidentiel si cela ne change rien à sa recommandation finale.',
        sortOrder: 2,
        points: 1,
        explanation: 'Faux. Tout conflit d\'intérêts doit être divulgué au client, indépendamment de son impact perçu sur la recommandation. La divulgation est une obligation absolue.',
        options: [
          { id: 'vrai', text: 'Vrai', isCorrect: false },
          { id: 'faux', text: 'Faux', isCorrect: true },
        ],
      },
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Que doit faire un représentant si un client insiste pour acheter un produit inadéquat?',
        sortOrder: 3,
        points: 1,
        explanation: 'Le représentant doit documenter ses recommandations et les raisons pour lesquelles il déconseille le produit, tout en respectant le libre choix du client.',
        options: [
          { id: 'a', text: 'Refuser catégoriquement de traiter la demande', isCorrect: false },
          { id: 'b', text: 'Accepter sans discuter car le client a toujours raison', isCorrect: false },
          { id: 'c', text: 'Documenter ses recommandations et les raisons de ses réserves, puis respecter le choix du client', isCorrect: true },
          { id: 'd', text: 'Signaler immédiatement le client à l\'AMF', isCorrect: false },
        ],
      },
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Quelle sanction peut être imposée en cas de manquement à l\'obligation de loyauté?',
        sortOrder: 4,
        points: 1,
        explanation: 'Les sanctions peuvent aller de la réprimande à la révocation du certificat, et inclure des poursuites civiles. Toutes les options listées (sauf l\'emprisonnement automatique) sont possibles.',
        options: [
          { id: 'a', text: 'Uniquement une amende monétaire', isCorrect: false },
          { id: 'b', text: 'Emprisonnement automatique', isCorrect: false },
          { id: 'c', text: 'Sanctions disciplinaires (réprimande, amende, suspension) et poursuites civiles possibles', isCorrect: true },
          { id: 'd', text: 'Aucune sanction, c\'est simplement un principe moral', isCorrect: false },
        ],
      },
    ],
  },
  {
    chapterIndex: 2,
    title: 'Quiz — Pratiques conformes',
    description: 'Vérifiez votre maîtrise des pratiques conformes au quotidien.',
    passingScore: 70,
    maxAttempts: 3,
    timeLimit: 15,
    questions: [
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Quelle est la durée minimale typique de conservation d\'un dossier client?',
        sortOrder: 0,
        points: 1,
        explanation: 'La réglementation prescrit typiquement une conservation de 5 à 7 ans après la fin de la relation d\'affaires. Certains documents, comme les polices d\'assurance-vie, doivent être conservés plus longtemps.',
        options: [
          { id: 'a', text: '1 an après la dernière transaction', isCorrect: false },
          { id: 'b', text: '5 à 7 ans après la fin de la relation d\'affaires', isCorrect: true },
          { id: 'c', text: '10 ans indépendamment des circonstances', isCorrect: false },
          { id: 'd', text: 'Aucune obligation de conservation', isCorrect: false },
        ],
      },
      {
        type: 'TRUE_FALSE' as const,
        question: 'Il suffit de remettre un document de divulgation au client au moment de la signature pour satisfaire l\'obligation de divulgation.',
        sortOrder: 1,
        points: 1,
        explanation: 'Faux. La divulgation doit être faite AVANT la conclusion de la transaction, et le client doit avoir le temps de lire, comprendre et poser des questions.',
        options: [
          { id: 'vrai', text: 'Vrai', isCorrect: false },
          { id: 'faux', text: 'Faux', isCorrect: true },
        ],
      },
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Quel est le délai typique pour accuser réception d\'une plainte client?',
        sortOrder: 2,
        points: 1,
        explanation: 'Un accusé de réception doit être envoyé dans les 48 heures suivant la réception de la plainte.',
        options: [
          { id: 'a', text: '24 heures', isCorrect: false },
          { id: 'b', text: '48 heures', isCorrect: true },
          { id: 'c', text: '5 jours ouvrables', isCorrect: false },
          { id: 'd', text: '10 jours ouvrables', isCorrect: false },
        ],
      },
      {
        type: 'MULTIPLE_CHOICE' as const,
        question: 'Parmi les éléments suivants, lequel N\'est PAS obligatoire dans un dossier client?',
        sortOrder: 3,
        points: 1,
        explanation: 'L\'opinion personnelle sur le client n\'a pas sa place dans le dossier. Celui-ci doit contenir des faits objectifs : ABF, propositions, notes de rencontre et consentements.',
        options: [
          { id: 'a', text: 'L\'analyse des besoins financiers', isCorrect: false },
          { id: 'b', text: 'Les propositions d\'assurance présentées', isCorrect: false },
          { id: 'c', text: 'L\'opinion personnelle du représentant sur la personnalité du client', isCorrect: true },
          { id: 'd', text: 'Les consentements obtenus', isCorrect: false },
        ],
      },
      {
        type: 'TRUE_FALSE' as const,
        question: 'Si un client n\'est pas satisfait de la réponse du cabinet à sa plainte, il peut s\'adresser directement à l\'AMF.',
        sortOrder: 4,
        points: 1,
        explanation: 'Vrai. L\'AMF dispose d\'un service d\'assistance aux consommateurs. Elle peut intervenir comme médiateur, ouvrir une enquête, ou diriger le consommateur vers les tribunaux.',
        options: [
          { id: 'vrai', text: 'Vrai', isCorrect: true },
          { id: 'faux', text: 'Faux', isCorrect: false },
        ],
      },
    ],
  },
];

const CONCEPTS = [
  { slug: 'ldpsf', name: 'LDPSF', domain: 'conformite-amf', description: 'Loi sur la distribution de produits et services financiers — cadre législatif fondamental.', difficulty: 0.4, estimatedMinutes: 30, bloomLevel: 3 },
  { slug: 'amf', name: 'AMF', domain: 'conformite-amf', description: 'Autorité des marchés financiers du Québec — organisme de réglementation et d\'encadrement.', difficulty: 0.3, estimatedMinutes: 25, bloomLevel: 2 },
  { slug: 'code-ethique', name: 'Code d\'éthique', domain: 'ethique', description: 'Principes déontologiques fondamentaux : intégrité, compétence, loyauté, diligence.', difficulty: 0.5, estimatedMinutes: 35, bloomLevel: 3 },
  { slug: 'conflits-interets', name: 'Conflits d\'intérêts', domain: 'ethique', description: 'Identification, gestion et divulgation des situations de conflit d\'intérêts.', difficulty: 0.6, estimatedMinutes: 40, bloomLevel: 4 },
  { slug: 'obligation-loyaute', name: 'Obligation de loyauté', domain: 'ethique', description: 'Devoir d\'agir dans le meilleur intérêt du client en tout temps.', difficulty: 0.5, estimatedMinutes: 30, bloomLevel: 3 },
  { slug: 'divulgation', name: 'Divulgation', domain: 'conformite-amf', description: 'Obligations de transparence et de divulgation envers le client.', difficulty: 0.5, estimatedMinutes: 25, bloomLevel: 3 },
  { slug: 'documentation', name: 'Documentation', domain: 'conformite-amf', description: 'Tenue de dossiers et exigences de documentation réglementaire.', difficulty: 0.4, estimatedMinutes: 30, bloomLevel: 2 },
  { slug: 'reclamations', name: 'Réclamations', domain: 'conformite-amf', description: 'Processus de traitement des plaintes et réclamations clients.', difficulty: 0.4, estimatedMinutes: 25, bloomLevel: 2 },
  { slug: 'ufc', name: 'UFC', domain: 'conformite-amf', description: 'Unités de formation continue — exigences de maintien des compétences.', difficulty: 0.3, estimatedMinutes: 20, bloomLevel: 2 },
  { slug: 'permis', name: 'Permis', domain: 'conformite-amf', description: 'Certificat de représentant AMF — conditions d\'obtention et de renouvellement.', difficulty: 0.3, estimatedMinutes: 20, bloomLevel: 2 },
];

// Prerequisites: prerequisite -> concept (prerequisite is required before concept)
const CONCEPT_PREREQUISITES: Array<{ conceptSlug: string; prerequisiteSlug: string; strength: number }> = [
  { conceptSlug: 'amf', prerequisiteSlug: 'ldpsf', strength: 0.9 },
  { conceptSlug: 'conflits-interets', prerequisiteSlug: 'code-ethique', strength: 0.8 },
  { conceptSlug: 'obligation-loyaute', prerequisiteSlug: 'code-ethique', strength: 0.7 },
  { conceptSlug: 'divulgation', prerequisiteSlug: 'obligation-loyaute', strength: 0.7 },
  { conceptSlug: 'divulgation', prerequisiteSlug: 'conflits-interets', strength: 0.6 },
  { conceptSlug: 'reclamations', prerequisiteSlug: 'documentation', strength: 0.6 },
  { conceptSlug: 'ufc', prerequisiteSlug: 'amf', strength: 0.8 },
  { conceptSlug: 'permis', prerequisiteSlug: 'amf', strength: 0.9 },
  { conceptSlug: 'permis', prerequisiteSlug: 'ufc', strength: 0.7 },
];

const BADGES = [
  {
    name: 'Premier cours',
    description: 'Attribué lors de la complétion du premier cours.',
    criteria: { type: 'courses_completed', count: 1 },
  },
  {
    name: 'Quiz parfait',
    description: 'Obtenir 100% à un quiz sans utiliser de tentative supplémentaire.',
    criteria: { type: 'quiz_perfect_score', count: 1 },
  },
  {
    name: 'Semaine d\'affilée',
    description: 'Étudier au moins 7 jours consécutifs.',
    criteria: { type: 'streak_days', count: 7 },
  },
  {
    name: '10 concepts maîtrisés',
    description: 'Maîtriser 10 concepts à un niveau Bloom de 3 ou plus.',
    criteria: { type: 'concepts_mastered', count: 10, minBloomLevel: 3 },
  },
  {
    name: 'Certification obtenue',
    description: 'Obtenir un certificat de complétion pour un cours accrédité.',
    criteria: { type: 'certificate_earned', count: 1 },
  },
];

const CERTIFICATE_TEMPLATE = {
  name: 'Attestation de formation continue',
  description: 'Certificat officiel pour les formations continues accréditées AMF.',
  htmlTemplate: `<!DOCTYPE html>
<html>
<body style="font-family: 'Georgia', serif; text-align: center; padding: 60px;">
  <div style="border: 3px double #1a365d; padding: 50px; max-width: 800px; margin: 0 auto;">
    <h1 style="color: #1a365d; font-size: 28px; margin-bottom: 10px;">ATTESTATION DE FORMATION CONTINUE</h1>
    <p style="color: #718096; font-size: 14px; margin-bottom: 30px;">Programme accrédité par l'Autorité des marchés financiers</p>
    <hr style="border: 1px solid #e2e8f0; margin: 20px 0;" />
    <p style="font-size: 16px; margin: 20px 0;">Ceci certifie que</p>
    <h2 style="color: #2d3748; font-size: 24px; margin: 10px 0;">{{studentName}}</h2>
    <p style="font-size: 16px; margin: 20px 0;">a complété avec succès la formation</p>
    <h3 style="color: #1a365d; font-size: 20px; margin: 10px 0;">{{courseTitle}}</h3>
    <p style="font-size: 14px; color: #4a5568; margin: 10px 0;">{{ufcCredits}} UFC — Catégorie: {{ceCategory}}</p>
    <p style="font-size: 14px; color: #4a5568;">Score obtenu: {{score}}%</p>
    <div style="margin-top: 40px;">
      <p style="font-size: 14px; color: #718096;">Date de complétion: {{completionDate}}</p>
      <p style="font-size: 14px; color: #718096;">Numéro de certificat: {{certificateNumber}}</p>
    </div>
    <div style="margin-top: 30px;">
      <p style="font-size: 14px;">{{signerName}}</p>
      <p style="font-size: 12px; color: #718096;">{{signerTitle}}</p>
    </div>
    <div style="margin-top: 20px;">
      <p style="font-size: 10px; color: #a0aec0;">Vérifiez l'authenticité: {{verificationUrl}}</p>
    </div>
  </div>
</body>
</html>`,
  signerName: 'Marie-Claire Dubois',
  signerTitle: 'Directrice de la formation continue',
  orientation: 'landscape',
  paperSize: 'A4',
  isDefault: true,
};

const REGULATORY_BODY = {
  code: 'AMF',
  name: 'Autorité des marchés financiers',
  province: 'QC',
  websiteUrl: 'https://lautorite.qc.ca',
  contactEmail: 'information@lautorite.qc.ca',
  cePeriodMonths: 24,
  requiredUfc: new Prisma.Decimal(30.0),
  requiredEthicsUfc: new Prisma.Decimal(3.0),
  requiredComplianceUfc: new Prisma.Decimal(2.0),
};

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n=== LMS Seed Script ===\n');

  const args = parseArgs();

  // Resolve tenantId
  let tenantId = args.tenantId;
  if (!tenantId) {
    tenantId = process.env.TENANT_ID ?? undefined;
  }
  if (!tenantId) {
    // Find a tenant that has at least one OWNER or EMPLOYEE user
    const ownerUser = await prisma.user.findFirst({
      where: { role: { in: ['OWNER', 'EMPLOYEE'] } },
      select: { tenantId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (ownerUser?.tenantId) {
      const tenant = await prisma.tenant.findUnique({ where: { id: ownerUser.tenantId }, select: { id: true, name: true } });
      if (tenant) {
        tenantId = tenant.id;
        log('i', `Using tenant with OWNER users: "${tenant.name}" (${tenantId})`);
      }
    }
    // Fallback to first tenant
    if (!tenantId) {
      const firstTenant = await prisma.tenant.findFirst({ select: { id: true, name: true } });
      if (!firstTenant) {
        console.error('ERROR: No tenant found in the database. Pass --tenant-id <id> or create a tenant first.');
        process.exit(1);
      }
      tenantId = firstTenant.id;
      log('i', `Using first tenant: "${firstTenant.name}" (${tenantId})`);
    }
  } else {
    log('i', `Using tenant ID: ${tenantId}`);
  }

  // We also need a userId for the instructor. Try to find an OWNER or EMPLOYEE user.
  const adminUser = await prisma.user.findFirst({
    where: { tenantId, role: { in: ['OWNER', 'EMPLOYEE'] } },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!adminUser) {
    console.error('ERROR: No OWNER or EMPLOYEE user found for this tenant. Create one first.');
    process.exit(1);
  }
  log('i', `Using user: "${adminUser.name}" (${adminUser.id})\n`);

  // -----------------------------------------------------------------------
  // 1. Instructor
  // -----------------------------------------------------------------------
  console.log('1. Instructor');

  const existingInstructor = await prisma.instructorProfile.findFirst({
    where: { tenantId, userId: adminUser.id },
  });

  const instructor = existingInstructor ?? await prisma.instructorProfile.create({
    data: {
      tenantId,
      userId: adminUser.id,
      title: 'Experte en conformité AMF',
      bio: 'Marie-Claire Dubois est une experte reconnue en conformité réglementaire dans le secteur de l\'assurance au Québec. Avec plus de 15 ans d\'expérience à l\'AMF et dans le secteur privé, elle forme les représentants aux meilleures pratiques de conformité.',
      expertise: ['Assurance de personnes', 'Éthique', 'Conformité'],
      isActive: true,
    },
  });
  log(existingInstructor ? '-' : '+', `Instructor: ${instructor.id}${existingInstructor ? ' (already exists)' : ''}`);

  // -----------------------------------------------------------------------
  // 2. Course Categories
  // -----------------------------------------------------------------------
  console.log('\n2. Course Categories');

  const categoryMap = new Map<string, string>();
  for (const cat of CATEGORIES) {
    const existing = await prisma.courseCategory.findFirst({
      where: { tenantId, slug: cat.slug },
    });
    if (existing) {
      categoryMap.set(cat.slug, existing.id);
      log('-', `Category "${cat.name}" (already exists)`);
    } else {
      const created = await prisma.courseCategory.create({
        data: { tenantId, ...cat },
      });
      categoryMap.set(cat.slug, created.id);
      log('+', `Category "${cat.name}"`);
    }
  }

  // -----------------------------------------------------------------------
  // 3. Certificate Template
  // -----------------------------------------------------------------------
  console.log('\n3. Certificate Template');

  const existingTemplate = await prisma.certificateTemplate.findFirst({
    where: { tenantId, name: CERTIFICATE_TEMPLATE.name },
  });

  const template = existingTemplate ?? await prisma.certificateTemplate.create({
    data: {
      tenantId,
      ...CERTIFICATE_TEMPLATE,
    },
  });
  log(existingTemplate ? '-' : '+', `Template: "${CERTIFICATE_TEMPLATE.name}"${existingTemplate ? ' (already exists)' : ''}`);

  // -----------------------------------------------------------------------
  // 4. Course
  // -----------------------------------------------------------------------
  console.log('\n4. Course');

  const existingCourse = await prisma.course.findFirst({
    where: { tenantId, slug: COURSE.slug },
  });

  const course = existingCourse ?? await prisma.course.create({
    data: {
      tenantId,
      ...COURSE,
      categoryId: categoryMap.get('conformite-amf'),
      instructorId: instructor.id,
      certificateTemplateId: template.id,
      publishedAt: new Date(),
    },
  });
  log(existingCourse ? '-' : '+', `Course: "${COURSE.title}"${existingCourse ? ' (already exists)' : ''}`);

  // -----------------------------------------------------------------------
  // 5. Chapters and Lessons
  // -----------------------------------------------------------------------
  console.log('\n5. Chapters & Lessons');

  const chapterIds: string[] = [];

  for (const chapterDef of CHAPTERS) {
    const existingChapter = await prisma.courseChapter.findFirst({
      where: { tenantId, courseId: course.id, title: chapterDef.title },
    });

    const chapter = existingChapter ?? await prisma.courseChapter.create({
      data: {
        tenantId,
        courseId: course.id,
        title: chapterDef.title,
        description: chapterDef.description,
        sortOrder: chapterDef.sortOrder,
        isPublished: true,
      },
    });
    chapterIds.push(chapter.id);
    log(existingChapter ? '-' : '+', `Chapter: "${chapterDef.title}"${existingChapter ? ' (already exists)' : ''}`);

    for (const lessonDef of chapterDef.lessons) {
      const existingLesson = await prisma.lesson.findFirst({
        where: { tenantId, chapterId: chapter.id, title: lessonDef.title },
      });
      if (!existingLesson) {
        await prisma.lesson.create({
          data: {
            tenantId,
            chapterId: chapter.id,
            title: lessonDef.title,
            description: lessonDef.description,
            type: 'TEXT',
            sortOrder: lessonDef.sortOrder,
            isPublished: true,
            isFree: lessonDef.sortOrder === 0 && chapterDef.sortOrder === 0, // First lesson free preview
            textContent: lessonDef.textContent,
            estimatedMinutes: lessonDef.estimatedMinutes,
          },
        });
        log('+', `  Lesson: "${lessonDef.title}"`);
      } else {
        log('-', `  Lesson: "${lessonDef.title}" (already exists)`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // 6. Quizzes
  // -----------------------------------------------------------------------
  console.log('\n6. Quizzes');

  for (const quizDef of QUIZZES) {
    const chapterId = chapterIds[quizDef.chapterIndex];
    if (!chapterId) {
      log('!', `Skipping quiz "${quizDef.title}" — chapter index ${quizDef.chapterIndex} not found`);
      continue;
    }

    const existingQuiz = await prisma.quiz.findFirst({
      where: { tenantId, title: quizDef.title },
    });

    if (existingQuiz) {
      log('-', `Quiz: "${quizDef.title}" (already exists)`);
      continue;
    }

    const quiz = await prisma.quiz.create({
      data: {
        tenantId,
        title: quizDef.title,
        description: quizDef.description,
        passingScore: quizDef.passingScore,
        maxAttempts: quizDef.maxAttempts,
        timeLimit: quizDef.timeLimit,
        shuffleQuestions: true,
        showResults: true,
        questions: {
          create: quizDef.questions.map((q) => ({
            type: q.type,
            question: q.question,
            sortOrder: q.sortOrder,
            points: q.points,
            explanation: q.explanation,
            options: q.options,
          })),
        },
      },
    });

    // Create a quiz-type lesson in the chapter linking to this quiz
    await prisma.lesson.create({
      data: {
        tenantId,
        chapterId,
        title: quizDef.title,
        description: quizDef.description,
        type: 'QUIZ',
        sortOrder: 99, // Place quiz at end of chapter
        isPublished: true,
        quizId: quiz.id,
        estimatedMinutes: quizDef.timeLimit,
      },
    });

    log('+', `Quiz: "${quizDef.title}" (${quizDef.questions.length} questions)`);
  }

  // -----------------------------------------------------------------------
  // 7. Concepts
  // -----------------------------------------------------------------------
  console.log('\n7. Concepts');

  const conceptMap = new Map<string, string>();

  for (const conceptDef of CONCEPTS) {
    const existing = await prisma.lmsConcept.findFirst({
      where: { tenantId, slug: conceptDef.slug },
    });

    if (existing) {
      conceptMap.set(conceptDef.slug, existing.id);
      log('-', `Concept: "${conceptDef.name}" (already exists)`);
    } else {
      const created = await prisma.lmsConcept.create({
        data: {
          tenantId,
          slug: conceptDef.slug,
          name: conceptDef.name,
          description: conceptDef.description,
          domain: conceptDef.domain,
          difficulty: conceptDef.difficulty,
          estimatedMinutes: conceptDef.estimatedMinutes,
          targetBloomLevel: conceptDef.bloomLevel,
          isActive: true,
        },
      });
      conceptMap.set(conceptDef.slug, created.id);
      log('+', `Concept: "${conceptDef.name}"`);
    }
  }

  // -----------------------------------------------------------------------
  // 8. Concept Prerequisites
  // -----------------------------------------------------------------------
  console.log('\n8. Concept Prerequisites');

  for (const prereq of CONCEPT_PREREQUISITES) {
    const conceptId = conceptMap.get(prereq.conceptSlug);
    const prerequisiteId = conceptMap.get(prereq.prerequisiteSlug);
    if (!conceptId || !prerequisiteId) {
      log('!', `Skipping prereq: ${prereq.prerequisiteSlug} -> ${prereq.conceptSlug} (concept not found)`);
      continue;
    }

    const existing = await prisma.lmsConceptPrereq.findFirst({
      where: { conceptId, prerequisiteId },
    });

    if (existing) {
      log('-', `${prereq.prerequisiteSlug} -> ${prereq.conceptSlug} (already exists)`);
    } else {
      await prisma.lmsConceptPrereq.create({
        data: {
          conceptId,
          prerequisiteId,
          strength: prereq.strength,
        },
      });
      log('+', `${prereq.prerequisiteSlug} -> ${prereq.conceptSlug} (strength: ${prereq.strength})`);
    }
  }

  // -----------------------------------------------------------------------
  // 9. Badges
  // -----------------------------------------------------------------------
  console.log('\n9. Badges');

  for (const badgeDef of BADGES) {
    const existing = await prisma.lmsBadge.findFirst({
      where: { tenantId, name: badgeDef.name },
    });

    if (existing) {
      log('-', `Badge: "${badgeDef.name}" (already exists)`);
    } else {
      await prisma.lmsBadge.create({
        data: {
          tenantId,
          name: badgeDef.name,
          description: badgeDef.description,
          criteria: badgeDef.criteria,
          isActive: true,
        },
      });
      log('+', `Badge: "${badgeDef.name}"`);
    }
  }

  // -----------------------------------------------------------------------
  // 10. Regulatory Body (AMF) + Accreditation
  // -----------------------------------------------------------------------
  console.log('\n10. Regulatory Body & Accreditation');

  const existingBody = await prisma.regulatoryBody.findFirst({
    where: { tenantId, code: REGULATORY_BODY.code },
  });

  const regBody = existingBody ?? await prisma.regulatoryBody.create({
    data: {
      tenantId,
      ...REGULATORY_BODY,
    },
  });
  log(existingBody ? '-' : '+', `Regulatory Body: "${REGULATORY_BODY.name}"${existingBody ? ' (already exists)' : ''}`);

  // Create accreditation for the course
  const existingAccreditation = await prisma.courseAccreditation.findFirst({
    where: { tenantId, courseId: course.id, regulatoryBodyId: regBody.id },
  });

  if (existingAccreditation) {
    log('-', 'Accreditation: AMF -> course (already exists)');
  } else {
    await prisma.courseAccreditation.create({
      data: {
        tenantId,
        courseId: course.id,
        regulatoryBodyId: regBody.id,
        ufcCredits: new Prisma.Decimal(5.0),
        ceCategory: 'COMPLIANCE',
        licenseTypes: ['LIFE_INSURANCE', 'DAMAGE_INSURANCE'],
        accreditationNumber: 'AMF-2026-FC-001',
        status: 'APPROVED',
        approvedAt: new Date(),
        expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000), // +2 years
      },
    });
    log('+', 'Accreditation: AMF -> course (5.0 UFC, COMPLIANCE)');
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n=== Seed Complete ===');
  console.log(`  Tenant:       ${tenantId}`);
  console.log(`  Categories:   ${CATEGORIES.length}`);
  console.log(`  Course:       1 ("${COURSE.title}")`);
  console.log(`  Chapters:     ${CHAPTERS.length}`);
  console.log(`  Lessons:      ${CHAPTERS.reduce((sum, ch) => sum + ch.lessons.length, 0)} + ${QUIZZES.length} quiz lessons`);
  console.log(`  Quizzes:      ${QUIZZES.length} (${QUIZZES.reduce((sum, q) => sum + q.questions.length, 0)} questions total)`);
  console.log(`  Concepts:     ${CONCEPTS.length} (${CONCEPT_PREREQUISITES.length} prerequisites)`);
  console.log(`  Badges:       ${BADGES.length}`);
  console.log(`  Template:     1`);
  console.log(`  Reg. Body:    1 (${REGULATORY_BODY.name})`);
  console.log('');
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFATAL ERROR:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
