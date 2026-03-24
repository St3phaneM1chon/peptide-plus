/**
 * Knowledge Base Seed Script — Populates AiTutorKnowledge for Aurelia Online
 * =============================================================================
 * Run with: npx tsx scripts/seed-knowledge.ts [--tenant-id <id>]
 *
 * Seeds 33 knowledge entries across 6 domains:
 * - conformite_amf (7): AMF, LDPSF articles, reglementation
 * - ethique (6): conflits d'interets, loyaute, secret professionnel
 * - produits_assurance (7): vie, invalidite, maladies graves, collective
 * - analyse_besoins (5): ABF, KYC, couverture, recommandation
 * - ufc_formation_continue (5): UFC, cycle AMF, categories, organismes
 * - loi_25 (3): protection renseignements personnels
 *
 * Content is factually accurate Quebec insurance law in French.
 * Idempotent: checks if data exists before creating.
 */

import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Prisma client
// ---------------------------------------------------------------------------

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// ---------------------------------------------------------------------------
// CLI argument parsing (same pattern as seed-lms.ts)
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
// Helper
// ---------------------------------------------------------------------------

function log(prefix: string, msg: string) {
  console.log(`  ${prefix} ${msg}`);
}

// ---------------------------------------------------------------------------
// Knowledge entries — REAL Quebec insurance law content
// ---------------------------------------------------------------------------

interface KnowledgeEntry {
  domain: string;
  title: string;
  content: string;
  source: string;
  tags: string[];
}

const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
  // =========================================================================
  // DOMAIN: conformite_amf
  // =========================================================================
  {
    domain: 'conformite_amf',
    title: "AMF — Rôle et mission de l'Autorité des marchés financiers",
    content: `L'Autorité des marchés financiers (AMF) est l'organisme de réglementation et d'encadrement du secteur financier au Québec. Créée en 2004 par la Loi sur l'Autorité des marchés financiers (RLRQ, c. A-33.2), elle résulte de la fusion de cinq organismes, dont la Commission des valeurs mobilières du Québec et l'Inspecteur général des institutions financières.

L'AMF a pour mission de veiller à la protection du public dans le domaine financier, notamment en encadrant les marchés de valeurs mobilières, les produits et services financiers, et les institutions financières. Elle délivre les certificats de représentant (permis) nécessaires pour exercer dans le domaine de l'assurance de personnes, de l'assurance de dommages, de la planification financière et du courtage en épargne collective.

Ses principaux pouvoirs incluent : l'octroi et la révocation des certificats de représentant, l'inspection et l'enquête sur les pratiques des professionnels, l'imposition de sanctions administratives (pénalités, suspensions, radiations), la prise de mesures conservatoires pour protéger le public, et l'édiction de règlements sur l'exercice des activités des représentants.

L'AMF administre également le Fonds d'indemnisation des services financiers (FISF), qui offre une protection aux consommateurs victimes de fraude ou de pratiques malhonnêtes de la part d'un représentant inscrit. L'indemnisation maximale est de 200 000 $ par réclamation.

Le registre public de l'AMF permet à tout citoyen de vérifier si un représentant détient un certificat valide et s'il a fait l'objet de sanctions disciplinaires. Ce registre est consultable en ligne sur le site lautorite.qc.ca.`,
    source: 'Loi sur l\'Autorité des marchés financiers, RLRQ c. A-33.2',
    tags: ['amf', 'réglementation', 'encadrement', 'certificat', 'permis', 'protection du public', 'FISF'],
  },
  {
    domain: 'conformite_amf',
    title: 'LDPSF — Loi sur la distribution de produits et services financiers (vue d\'ensemble)',
    content: `La Loi sur la distribution de produits et services financiers (LDPSF, RLRQ c. D-9.2) est le cadre législatif fondamental qui régit l'exercice des activités de distribution d'assurance et de produits financiers au Québec. Adoptée en 1998 et entrée en vigueur le 1er octobre 1999, elle remplace l'ancienne Loi sur les intermédiaires de marché.

La LDPSF établit les catégories de disciplines dans lesquelles un représentant peut exercer : assurance de personnes, assurance de dommages, assurance collective de personnes, planification financière, courtage en épargne collective, courtage en plans de bourses d'études et courtage en valeurs mobilières.

La loi impose à tout représentant de détenir un certificat délivré par l'AMF pour exercer dans sa discipline. Ce certificat est personnel, incessible et valide pour une période déterminée, sous réserve du respect des exigences de formation continue.

Les chapitres clés de la LDPSF couvrent : les conditions d'inscription et de maintien du certificat (titre II), les obligations et devoirs des représentants envers leurs clients (titre III), les règles applicables aux cabinets et sociétés autonomes (titre IV), le rôle et les pouvoirs de l'AMF en matière d'encadrement (titre V), et les dispositions pénales et sanctions (titre VI).

La LDPSF est complétée par plusieurs règlements, notamment le Règlement sur l'exercice des activités des représentants, le Code de déontologie de la Chambre de la sécurité financière, et les lignes directrices de l'AMF. Ensemble, ces textes forment le corpus réglementaire que tout représentant doit maîtriser.`,
    source: 'LDPSF, RLRQ c. D-9.2',
    tags: ['ldpsf', 'loi', 'distribution', 'certificat', 'disciplines', 'cadre législatif'],
  },
  {
    domain: 'conformite_amf',
    title: 'Article 16 LDPSF — Obligation d\'agir avec compétence et professionnalisme',
    content: `L'article 16 de la LDPSF impose au représentant d'agir avec compétence et professionnalisme. Cette obligation est fondamentale et conditionne l'ensemble de la relation entre le représentant et son client. Elle se décline en plusieurs dimensions concrètes.

La compétence technique exige que le représentant possède les connaissances nécessaires dans sa discipline pour évaluer correctement la situation financière du client, comprendre les produits qu'il propose, et formuler des recommandations appropriées. Le représentant qui propose un produit qu'il ne comprend pas pleinement contrevient à cette obligation.

Le professionnalisme implique un comportement irréprochable dans toutes les interactions avec le client : ponctualité, rigueur dans la documentation, suivi diligent des dossiers, communication claire et respectueuse, et respect des délais. Il inclut également l'obligation de maintenir ses compétences à jour par la formation continue.

L'article 16 est souvent invoqué conjointement avec l'article 12 du Code de déontologie de la Chambre de la sécurité financière, qui précise que le représentant doit « exercer ses activités avec intégrité ». Les tribunaux et le comité de discipline interprètent largement cette obligation.

Les manquements à l'article 16 peuvent entraîner des sanctions disciplinaires allant de la réprimande à la radiation permanente, en passant par des amendes pouvant atteindre 50 000 $ par infraction (art. 376 LDPSF). Le représentant peut également engager sa responsabilité civile envers le client pour les dommages causés par son incompétence.

En pratique, le respect de l'article 16 se manifeste par une analyse des besoins rigoureuse, des explications claires sur les produits recommandés, une documentation complète du dossier client, et un suivi régulier de la situation du client.`,
    source: 'LDPSF, art. 16',
    tags: ['article 16', 'compétence', 'professionnalisme', 'obligations', 'sanctions', 'code de déontologie'],
  },
  {
    domain: 'conformite_amf',
    title: 'Article 27 LDPSF — Devoir de conseil et analyse des besoins',
    content: `L'article 27 de la LDPSF constitue l'une des pierres angulaires de la protection du consommateur en assurance au Québec. Il impose au représentant un devoir de conseil qui se traduit par l'obligation de recueillir les renseignements nécessaires pour identifier les besoins du client avant de lui proposer un produit d'assurance ou un produit financier.

Concrètement, le représentant doit effectuer une analyse des besoins financiers (ABF) complète avant toute recommandation. Cette analyse doit prendre en compte la situation personnelle, familiale et financière du client, ses objectifs à court et long terme, sa tolérance au risque, et ses besoins de protection actuels et futurs.

Le devoir de conseil comporte deux volets essentiels. Le volet « information » oblige le représentant à fournir au client toute l'information pertinente pour prendre une décision éclairée : caractéristiques du produit, avantages, limites, exclusions, coûts et alternatives possibles. Le volet « recommandation » oblige le représentant à formuler une recommandation adaptée au profil spécifique du client, et non pas simplement à présenter un catalogue de produits.

L'article 27 ne se limite pas au moment de la souscription initiale. Il s'applique aussi lors du renouvellement d'une police, de la modification des garanties, ou de tout changement significatif dans la situation du client. Le représentant a un devoir continu de s'assurer que la couverture reste adéquate.

Les tribunaux ont confirmé à plusieurs reprises que le non-respect de l'article 27 constitue une faute professionnelle pouvant donner lieu à des poursuites en responsabilité civile, indépendamment des sanctions disciplinaires. Le client qui subit un préjudice en raison d'un conseil inadéquat peut réclamer des dommages-intérêts au représentant et à son cabinet.`,
    source: 'LDPSF, art. 27',
    tags: ['article 27', 'devoir de conseil', 'analyse des besoins', 'ABF', 'recommandation', 'protection du consommateur'],
  },
  {
    domain: 'conformite_amf',
    title: 'Article 28 LDPSF — Obligation de divulgation des conflits d\'intérêts',
    content: `L'article 28 de la LDPSF impose au représentant de divulguer tout conflit d'intérêts, réel ou potentiel, pouvant affecter la qualité de ses recommandations. Cette obligation de transparence est essentielle à la confiance du client envers son représentant.

Un conflit d'intérêts survient lorsque les intérêts personnels, financiers ou professionnels du représentant entrent en opposition avec ceux de son client. Les situations de conflit d'intérêts les plus courantes incluent : les commissions et rémunérations variables selon les produits vendus, les incitatifs (voyages, bonis) offerts par les assureurs, les liens financiers ou familiaux avec un assureur ou un fournisseur de produits, et la double inscription (représentant dans plusieurs disciplines).

La divulgation doit être faite de manière claire, complète et en temps opportun — c'est-à-dire AVANT la conclusion de toute transaction. Le représentant ne peut pas se contenter d'un formulaire de divulgation standard remis sans explication. Il doit s'assurer que le client comprend la nature et la portée du conflit.

La divulgation seule ne suffit pas toujours. Si le conflit est tel qu'il compromet irrémédiablement l'objectivité du représentant, celui-ci doit refuser le mandat ou diriger le client vers un autre professionnel. L'article 28 doit être lu conjointement avec l'article 19 du Code de déontologie, qui précise les modalités de gestion des conflits d'intérêts.

Les sanctions pour non-divulgation sont sévères. Le comité de discipline peut imposer des amendes, suspendre ou radier le représentant. De plus, le défaut de divulgation peut constituer un vice de consentement permettant au client d'annuler la transaction et de réclamer des dommages-intérêts. L'AMF considère les manquements à l'obligation de divulgation comme des infractions graves portant atteinte à la confiance du public envers la profession.`,
    source: 'LDPSF, art. 28; Code de déontologie CSF, art. 19',
    tags: ['article 28', 'conflits d\'intérêts', 'divulgation', 'transparence', 'commissions', 'sanctions'],
  },
  {
    domain: 'conformite_amf',
    title: 'Règlement sur l\'exercice des activités des représentants',
    content: `Le Règlement sur l'exercice des activités des représentants (RLRQ, c. D-9.2, r. 10) précise les modalités d'application de la LDPSF. Ce règlement détaille les obligations pratiques auxquelles le représentant doit se conformer dans l'exercice quotidien de ses fonctions.

En matière de tenue de dossiers, le règlement exige que le représentant constitue et conserve un dossier pour chaque client contenant : l'analyse des besoins financiers, les propositions d'assurance présentées, les polices émises, les notes de rencontre, les consentements obtenus, la correspondance pertinente, et toute modification apportée aux couvertures. Ces dossiers doivent être conservés pendant au moins cinq ans après la fin de la relation d'affaires.

Le règlement encadre également la rémunération du représentant. Celui-ci doit divulguer au client la nature et la source de sa rémunération. Les ententes de rémunération ne doivent pas créer d'incitatifs à privilégier un produit au détriment des intérêts du client. Le « churning » (remplacement injustifié de polices pour générer de nouvelles commissions) est expressément interdit.

Les obligations en matière de publicité sont aussi couvertes. Toute publicité doit être véridique, claire et non trompeuse. Elle doit identifier le cabinet ou la société autonome au nom duquel le représentant agit. Les comparaisons avec des produits concurrents doivent être factuelles et documentées.

Le règlement prescrit les conditions de remplacement d'une police d'assurance. Le représentant qui propose un remplacement doit comparer objectivement les avantages et inconvénients de la nouvelle police par rapport à l'existante, en utilisant le formulaire prescrit. Il doit informer le client des risques de perte de droits acquis, de période d'exclusion ou de nouvelle évaluation médicale.

Le non-respect du règlement expose le représentant aux mêmes sanctions que le non-respect de la LDPSF.`,
    source: 'Règlement sur l\'exercice des activités des représentants, RLRQ c. D-9.2, r. 10',
    tags: ['règlement', 'tenue de dossiers', 'rémunération', 'publicité', 'remplacement de police', 'churning'],
  },
  {
    domain: 'conformite_amf',
    title: 'Code de déontologie des représentants en assurance',
    content: `Le Code de déontologie de la Chambre de la sécurité financière (CSF) établit les normes éthiques et professionnelles auxquelles sont assujettis les représentants en assurance de personnes, en assurance collective et en planification financière au Québec. Ce code a force de loi et son non-respect peut entraîner des sanctions disciplinaires.

Les devoirs fondamentaux du représentant selon le code incluent : le devoir d'intégrité (art. 12) — le représentant doit exercer ses activités avec honnêteté, loyauté et compétence; le devoir d'indépendance (art. 13) — il doit subordonner son intérêt personnel à celui du client; et le devoir de diligence (art. 14) — il doit agir avec soin et promptitude.

Le code détaille les obligations envers le client : obligation d'informer (art. 15-17), obligation de conseil (art. 18), obligation de confidentialité (art. 21-22), obligation de disponibilité (art. 23), et obligation de collaboration avec les autorités réglementaires (art. 24-25). Le représentant doit également s'abstenir de toute pratique discriminatoire et traiter tous ses clients avec respect et équité.

En matière de conflits d'intérêts, le code est particulièrement strict. L'article 19 interdit au représentant de se placer en situation de conflit d'intérêts. Si un conflit est inévitable, il doit le divulguer par écrit au client et obtenir son consentement avant de poursuivre le mandat. Le représentant ne peut jamais accepter d'avantages susceptibles d'influencer ses recommandations.

Le comité de discipline de la CSF est l'instance chargée d'entendre les plaintes pour contravention au code. Les sanctions possibles incluent : la réprimande, l'amende (jusqu'à 50 000 $ par chef d'accusation), la suspension du certificat, la radiation temporaire ou permanente, et l'obligation de suivre une formation complémentaire. Les décisions du comité sont publiques et consultables sur le site de la CSF.`,
    source: 'Code de déontologie de la Chambre de la sécurité financière, RLRQ c. D-9.2, r. 3',
    tags: ['code de déontologie', 'CSF', 'intégrité', 'indépendance', 'diligence', 'sanctions disciplinaires'],
  },

  // =========================================================================
  // DOMAIN: ethique
  // =========================================================================
  {
    domain: 'ethique',
    title: 'Conflits d\'intérêts — Définition, types et gestion',
    content: `Un conflit d'intérêts en assurance survient lorsqu'un représentant se trouve dans une situation où ses intérêts personnels, financiers ou professionnels pourraient compromettre l'objectivité de ses recommandations envers le client. La gestion adéquate des conflits d'intérêts est une obligation fondamentale consacrée aux articles 18-19 du Code de déontologie de la CSF et à l'article 28 de la LDPSF.

Les types de conflits d'intérêts les plus fréquents sont : les conflits financiers (commissions plus élevées sur certains produits, bonis de production, voyages-récompenses offerts par les assureurs), les conflits relationnels (vendre à un membre de sa famille, recommander les produits d'un assureur dont on est actionnaire), les conflits de rôle (agir à la fois comme courtier et comme expert en sinistres), et les conflits institutionnels (les politiques du cabinet favorisant certains assureurs).

La gestion des conflits d'intérêts suit un processus en quatre étapes. Premièrement, l'identification : le représentant doit être en mesure de reconnaître les situations de conflit potentiel, même subtiles. Deuxièmement, l'évaluation : il doit évaluer la gravité du conflit et son impact potentiel sur ses recommandations. Troisièmement, la divulgation : tout conflit identifié doit être divulgué au client de manière claire, par écrit si possible, AVANT toute recommandation. Quatrièmement, la gestion : le représentant doit mettre en place des mesures pour atténuer le conflit (par exemple, présenter des alternatives de plusieurs assureurs) ou, si le conflit est irréconciliable, se retirer du dossier.

Le « test de l'observateur raisonnable » est un critère utile : si un observateur raisonnable et informé conclurait que les intérêts du représentant pourraient influencer ses recommandations, il y a un conflit d'intérêts qui doit être géré. Le doute doit toujours profiter au client.`,
    source: 'Code de déontologie CSF, art. 18-19; LDPSF, art. 28',
    tags: ['conflits d\'intérêts', 'divulgation', 'gestion', 'commissions', 'éthique', 'objectivité'],
  },
  {
    domain: 'ethique',
    title: 'Obligation de loyauté envers le client',
    content: `L'obligation de loyauté est un devoir fondamental du représentant en assurance au Québec, consacré à l'article 16 de la LDPSF et à l'article 12 du Code de déontologie de la CSF. Elle exige que le représentant place les intérêts de son client au-dessus de ses propres intérêts et de ceux de son cabinet en toute circonstance.

Cette obligation se manifeste concrètement de plusieurs façons. Le représentant doit recommander le produit le plus approprié aux besoins du client, même si ce produit génère une commission inférieure. Il doit informer le client de l'existence d'alternatives qui pourraient mieux correspondre à ses besoins, même si ces alternatives sont offertes par un concurrent. Il doit conseiller au client de ne pas souscrire un produit s'il estime que celui-ci ne répond pas à un besoin réel.

La loyauté implique également la transparence totale. Le représentant ne doit jamais dissimuler d'informations pertinentes au client, qu'il s'agisse des limites d'un produit, des exclusions d'une police, des frais cachés, ou de sa propre rémunération. L'omission stratégique d'informations constitue un manquement à l'obligation de loyauté tout autant que la désinformation active.

Le devoir de loyauté perdure après la vente du produit. Le représentant doit assurer un suivi de la situation de son client et l'informer proactivement si des changements dans sa situation personnelle ou dans le marché rendent sa couverture inadéquate. L'abandon du client après la transaction (vente et oubli) constitue un manquement à l'obligation de loyauté.

Le comité de discipline de la CSF a rendu de nombreuses décisions sanctionnant des manquements à l'obligation de loyauté, incluant des cas de remplacement de polices injustifié (churning), de vente de produits inadaptés au profil du client, et d'omission de divulgation de commissions exceptionnelles.`,
    source: 'LDPSF, art. 16; Code de déontologie CSF, art. 12-13',
    tags: ['loyauté', 'intérêt du client', 'transparence', 'devoir', 'éthique professionnelle'],
  },
  {
    domain: 'ethique',
    title: 'Secret professionnel en assurance',
    content: `Le secret professionnel en assurance est une obligation juridique qui interdit au représentant de divulguer les renseignements confidentiels obtenus dans l'exercice de ses fonctions, sans le consentement du client. Cette obligation est consacrée à l'article 21 du Code de déontologie de la CSF, à l'article 9 de la Charte des droits et libertés de la personne du Québec, et aux dispositions du Code civil du Québec sur le respect de la vie privée.

Les renseignements protégés par le secret professionnel incluent : l'ensemble des informations personnelles et financières recueillies lors de l'analyse des besoins (revenus, dettes, patrimoine), les renseignements médicaux communiqués dans le cadre d'une proposition d'assurance, les détails des polices d'assurance souscrites, et toute autre information confidentielle révélée dans le cadre de la relation professionnelle.

Le secret professionnel comporte des exceptions limitées : le consentement explicite du client (idéalement écrit), une ordonnance d'un tribunal, une obligation légale expresse (par exemple, la déclaration de soupçons en matière de blanchiment d'argent sous la LRPCFAT), ou la nécessité de se défendre dans le cadre d'une procédure disciplinaire ou judiciaire.

En pratique, le représentant doit mettre en place des mesures pour protéger la confidentialité : documents clients rangés dans des classeurs verrouillés ou protégés par mot de passe, conversations téléphoniques dans un lieu privé, transmission de documents par voie sécurisée, et destruction sécurisée des documents périmés. Le partage de renseignements avec des collègues du même cabinet est permis uniquement dans la mesure nécessaire au service du client.

La violation du secret professionnel peut entraîner des sanctions disciplinaires, des poursuites civiles en dommages-intérêts, et même des poursuites pénales dans les cas graves. Depuis l'entrée en vigueur de la Loi 25, les obligations de confidentialité ont été renforcées avec des pénalités administratives pouvant atteindre 10 millions de dollars ou 2 % du chiffre d'affaires mondial.`,
    source: 'Code de déontologie CSF, art. 21-22; Charte des droits et libertés, art. 9',
    tags: ['secret professionnel', 'confidentialité', 'renseignements personnels', 'vie privée', 'consentement'],
  },
  {
    domain: 'ethique',
    title: 'Publicité et représentation des produits',
    content: `La publicité et la représentation des produits d'assurance sont encadrées par le Règlement sur l'exercice des activités des représentants et les articles 29 à 33 du Code de déontologie de la CSF. Ces règles visent à protéger le public contre les pratiques publicitaires trompeuses ou abusives.

Toute publicité d'un représentant ou d'un cabinet doit être véridique, exacte et non trompeuse. Elle ne doit pas créer d'attentes irréalistes quant aux rendements, aux garanties ou aux avantages d'un produit d'assurance. Les illustrations de rendement doivent être basées sur des hypothèses raisonnables et clairement identifiées comme des projections, non des garanties.

Le représentant ne doit jamais comparer de manière déloyale les produits d'un assureur à ceux d'un concurrent. Les comparaisons doivent être objectives, factuelles, documentées et fondées sur des données vérifiables. Dénigrer les produits d'un concurrent constitue une faute déontologique.

En matière de titres et désignations, le représentant ne peut utiliser que les titres auxquels il a droit en vertu de son certificat AMF. Il est interdit d'utiliser des titres trompeurs qui pourraient laisser croire à une expertise ou une accréditation non détenue. Par exemple, un représentant en assurance de personnes ne peut se présenter comme « planificateur financier » s'il ne détient pas le titre correspondant.

La publicité sur les réseaux sociaux est soumise aux mêmes règles. Les témoignages de clients doivent être authentiques et non rémunérés. Les contenus sponsorisés doivent être identifiés comme tels. L'AMF et la CSF surveillent activement les plateformes numériques et peuvent sanctionner les infractions commises en ligne.

Les sanctions pour publicité trompeuse incluent des amendes, des ordonnances de cessation, et des obligations de publier des rectificatifs aux frais du contrevenant.`,
    source: 'Règlement sur l\'exercice des activités des représentants; Code de déontologie CSF, art. 29-33',
    tags: ['publicité', 'représentation', 'marketing', 'comparaisons', 'titres professionnels', 'réseaux sociaux'],
  },
  {
    domain: 'ethique',
    title: 'Traitement des plaintes du client',
    content: `Le traitement des plaintes est une obligation réglementaire et éthique pour tout cabinet et représentant en assurance au Québec. L'AMF exige que chaque cabinet adopte une politique de traitement des plaintes conforme à ses lignes directrices, et que cette politique soit communiquée aux clients.

Le processus de traitement des plaintes comporte plusieurs étapes obligatoires. À la réception de la plainte, le cabinet doit accuser réception dans un délai de 48 heures et confier le dossier à un responsable du traitement des plaintes indépendant de la situation faisant l'objet de la plainte. Le plaignant doit être informé de ses droits, y compris le droit de s'adresser à l'AMF s'il n'est pas satisfait du traitement.

L'enquête interne doit être menée avec diligence et impartialité. Le responsable doit recueillir tous les faits pertinents, consulter le dossier client, entendre les parties impliquées, et documenter chaque étape. Le représentant visé par la plainte doit coopérer pleinement à l'enquête.

La réponse finale doit être communiquée au plaignant dans un délai raisonnable (généralement 30 à 90 jours, selon la complexité) et inclure : un résumé des faits retenus, l'analyse de la situation, la conclusion, et les mesures correctrices adoptées le cas échéant. Si la plainte est jugée fondée, le cabinet doit prendre les mesures nécessaires pour corriger la situation et prévenir la récurrence.

Le cabinet doit tenir un registre des plaintes accessible à l'AMF lors d'inspections. Ce registre doit inclure la date, la nature de la plainte, le résultat du traitement, et les mesures prises. L'analyse des tendances de plaintes fait partie des meilleures pratiques de conformité.

Si le client n'est pas satisfait de la réponse du cabinet, il peut s'adresser à l'AMF, qui dispose d'un service d'assistance aux consommateurs et peut agir comme médiateur, ouvrir une enquête, ou diriger le consommateur vers les tribunaux compétents.`,
    source: 'Ligne directrice de l\'AMF sur le traitement des plaintes; LDPSF, art. 103-105',
    tags: ['plaintes', 'traitement', 'registre', 'AMF', 'médiation', 'mesures correctrices'],
  },
  {
    domain: 'ethique',
    title: 'Responsabilité professionnelle du représentant',
    content: `La responsabilité professionnelle du représentant en assurance comporte trois volets : la responsabilité disciplinaire, la responsabilité civile et la responsabilité pénale. Chacune opère de manière indépendante, ce qui signifie qu'un même acte peut donner lieu à des poursuites sur les trois plans simultanément.

La responsabilité disciplinaire est engagée devant le comité de discipline de la CSF lorsque le représentant contrevient au Code de déontologie, à la LDPSF ou aux règlements. Les plaintes peuvent être déposées par le syndic de la CSF (d'office ou sur signalement) ou par l'AMF. Les sanctions vont de la réprimande à la radiation permanente, en passant par des amendes pouvant atteindre 50 000 $ par chef d'accusation et des ordonnances de formation complémentaire.

La responsabilité civile est engagée lorsque le client subit un préjudice en raison d'une faute du représentant. Pour établir cette responsabilité, le client doit démontrer trois éléments : une faute (manquement à une obligation), un dommage (perte financière, préjudice moral), et un lien de causalité entre la faute et le dommage. Les cas les plus courants incluent : le conseil inadéquat, l'omission de recommander une couverture nécessaire, le remplacement injustifié d'une police, et la non-divulgation d'informations essentielles.

La responsabilité pénale est engagée dans les cas les plus graves : fraude, faux et usage de faux, abus de confiance, blanchiment d'argent, ou exercice illégal d'activités réservées. Ces infractions peuvent entraîner des amendes substantielles et des peines d'emprisonnement.

Pour se protéger, le représentant doit maintenir une assurance responsabilité professionnelle (E&O — Errors and Omissions) dont les montants minimums sont prescrits par règlement. Cette assurance couvre les réclamations découlant d'erreurs, d'omissions ou de négligences dans l'exercice de ses fonctions. Le cabinet est solidairement responsable des actes de ses représentants dans le cadre de leurs fonctions.`,
    source: 'LDPSF, art. 376-378; Code civil du Québec, art. 1457-1458',
    tags: ['responsabilité professionnelle', 'disciplinaire', 'civile', 'pénale', 'assurance E&O', 'faute'],
  },

  // =========================================================================
  // DOMAIN: produits_assurance
  // =========================================================================
  {
    domain: 'produits_assurance',
    title: 'Assurance vie temporaire — Caractéristiques et utilisation',
    content: `L'assurance vie temporaire est un produit de protection pure qui couvre le risque de décès pendant une période déterminée (le terme). C'est le type d'assurance vie le plus simple, le plus abordable et le plus populaire auprès des jeunes familles et des emprunteurs.

Les principales caractéristiques de l'assurance vie temporaire sont : une durée fixe (10, 20 ou 30 ans sont les termes les plus courants), des primes généralement nivelées pour la durée du terme (mais augmentant significativement au renouvellement), aucune valeur de rachat ou composante épargne, et un capital-décès fixe versé aux bénéficiaires si le décès survient pendant le terme.

Les utilisations classiques de la temporaire incluent : la protection d'un prêt hypothécaire (couvrir le solde du prêt en cas de décès), la protection du revenu familial (remplacer le revenu d'un parent pendant les années d'éducation des enfants), la protection d'un emprunt commercial (associés, cautionnement), et les besoins temporaires de couverture (période d'accumulation de patrimoine).

L'assurance vie temporaire est généralement renouvelable et transformable. Le privilège de renouvellement permet de prolonger la couverture au terme sans preuve de santé, mais à des primes majorées basées sur l'âge atteint. Le privilège de transformation permet de convertir la police temporaire en police permanente (vie entière ou universelle) sans preuve d'assurabilité, ce qui est particulièrement précieux si l'état de santé de l'assuré s'est détérioré.

Lors de l'analyse des besoins, le représentant doit évaluer si le besoin de couverture est réellement temporaire ou permanent. Recommander une temporaire pour un besoin permanent (comme les frais funéraires ou la planification successorale) constitue un conseil inadéquat. Inversement, recommander une permanente à un jeune parent qui a surtout besoin d'un capital élevé pendant 20 ans peut être inapproprié si le budget est limité.`,
    source: 'Guide de pratique en assurance de personnes, ChAD/CSF',
    tags: ['assurance vie', 'temporaire', 'terme', 'renouvelable', 'transformable', 'prêt hypothécaire'],
  },
  {
    domain: 'produits_assurance',
    title: 'Assurance vie entière — Valeur de rachat et composante épargne',
    content: `L'assurance vie entière (ou assurance vie permanente traditionnelle) offre une protection à vie avec une composante d'épargne intégrée appelée valeur de rachat. Les primes sont fixes pendant toute la durée du contrat, ce qui signifie qu'elles sont plus élevées qu'une temporaire dans les premières années, mais n'augmentent jamais.

La valeur de rachat est un élément distinctif de la vie entière. Elle s'accumule au fil des années à mesure que les primes versées dépassent le coût réel de l'assurance. Cette valeur appartient au titulaire de la police et peut être utilisée de plusieurs façons : rachat partiel ou total (résiliation de la police contre versement de la valeur accumulée), avance sur police (emprunt garanti par la valeur de rachat, à un taux d'intérêt souvent avantageux), ou mise en gage (utiliser la police comme garantie d'un prêt).

Les variantes de la vie entière incluent : la vie entière avec participations (polices participantes émises par les mutuelles comme Desjardins et La Capitale, où les participations annuelles peuvent augmenter la couverture, réduire les primes ou être versées en espèces), la vie entière à paiements limités (primes payables sur 10, 15 ou 20 ans, la police étant ensuite libérée de primes), et la vie entière ajustable (certains éléments peuvent être modifiés au fil du temps).

Les avantages fiscaux de la vie entière sont significatifs au Québec et au Canada. La croissance de la valeur de rachat à l'intérieur de la police est exonérée d'impôt tant qu'elle est conforme aux règles de police exonérée de la Loi de l'impôt sur le revenu. Le capital-décès est versé libre d'impôt aux bénéficiaires désignés. De plus, la police est un actif insaisissable par les créanciers si un bénéficiaire irrévocable ou un membre de la famille immédiate est désigné.

Le représentant doit clairement expliquer au client que les rendements de la composante épargne sont généralement modestes comparés à d'autres véhicules de placement, et que le principal avantage est la protection permanente avec avantages fiscaux et successoraux.`,
    source: 'Guide de pratique en assurance de personnes; Loi de l\'impôt sur le revenu, art. 148',
    tags: ['assurance vie entière', 'permanente', 'valeur de rachat', 'participations', 'avantages fiscaux', 'épargne'],
  },
  {
    domain: 'produits_assurance',
    title: 'Assurance vie universelle — Flexibilité et investissement',
    content: `L'assurance vie universelle (VU) est un produit d'assurance permanente qui combine une protection en cas de décès avec un compte de placement à avantages fiscaux. Elle offre une flexibilité supérieure à la vie entière en permettant au titulaire d'ajuster ses primes et sa couverture selon l'évolution de ses besoins.

La structure de la VU comprend deux composantes : le coût d'assurance (qui peut être temporaire renouvelable annuellement ou nivelé à vie) et le compte de placement (dans lequel les primes excédentaires s'accumulent à l'abri de l'impôt). Le titulaire peut verser des primes entre un minimum (suffisant pour maintenir la couverture) et un maximum (dicté par les règles de police exonérée de la Loi de l'impôt sur le revenu).

Les options de placement varient selon les assureurs et incluent généralement : des comptes à taux garanti (similaires à un CPG), des comptes indexés (rendement lié à un indice boursier avec protection du capital), et des fonds distincts (fonds de placement avec garanties de l'assureur, notamment la garantie à l'échéance et la garantie au décès de 75 % ou 100 % du capital investi).

La VU est particulièrement adaptée aux clients qui ont maximisé leurs REER et CELI et cherchent un abri fiscal supplémentaire, aux propriétaires d'entreprises pour la stratégie de placement corporatif assuré, et pour la planification successorale (payer les impôts au décès sans liquider les actifs de la succession).

Les risques et limites de la VU doivent être clairement expliqués au client : si les rendements du compte de placement sont insuffisants ou si les primes sont trop basses, la police peut devenir sous-financée et le client pourrait devoir augmenter ses primes ou voir sa couverture réduite. Les frais de gestion internes sont souvent plus élevés que les fonds communs comparables. La complexité du produit exige une compréhension approfondie de la part du représentant et des explications claires au client.`,
    source: 'Guide de pratique en assurance de personnes; Loi de l\'impôt sur le revenu, art. 148',
    tags: ['assurance vie universelle', 'placement', 'flexibilité', 'police exonérée', 'fonds distincts', 'planification successorale'],
  },
  {
    domain: 'produits_assurance',
    title: 'Assurance invalidité — Court terme vs long terme',
    content: `L'assurance invalidité (ou assurance salaire) protège le revenu d'un assuré en cas d'incapacité de travailler due à une maladie ou un accident. C'est un produit essentiel que le représentant doit proposer à tout client dont les revenus dépendent de sa capacité de travail, car le risque d'invalidité avant 65 ans est statistiquement plus élevé que le risque de décès.

L'assurance invalidité de courte durée (ICD) couvre les incapacités temporaires, généralement pour une période de 15 à 26 semaines. Elle verse un pourcentage du revenu (habituellement 60 à 70 %) après un court délai de carence (0 à 14 jours). L'ICD est souvent fournie par l'employeur dans le cadre d'un régime collectif. En l'absence de couverture collective, le représentant doit recommander une couverture individuelle.

L'assurance invalidité de longue durée (ILD) prend le relais après l'expiration de l'ICD. Elle couvre les incapacités prolongées et verse des prestations jusqu'à l'âge de 65 ans dans la plupart des contrats. Le délai de carence est typiquement de 90 ou 120 jours (correspondant à la fin de l'ICD). Le montant de la prestation est habituellement de 60 à 70 % du revenu brut.

Les définitions d'invalidité sont cruciales et varient selon les contrats. La définition « profession propre » (own occupation) protège l'assuré s'il ne peut exercer SA profession habituelle. La définition « toute occupation » (any occupation) ne couvre que si l'assuré ne peut exercer AUCUNE profession raisonnablement adaptée à sa formation et son expérience. Beaucoup de contrats combinent les deux : profession propre pendant les 24 premiers mois, puis toute occupation par la suite.

Le représentant doit analyser plusieurs facteurs lors de la recommandation : le niveau de revenu du client, ses obligations financières fixes, l'existence d'une couverture collective, la nature de sa profession (les professions à risque coûtent plus cher), et sa capacité d'épargne (un fonds d'urgence peut justifier un délai de carence plus long et des primes réduites). Il doit également informer le client que les prestations d'invalidité individuelle payées avec des primes personnelles après impôt sont reçues libres d'impôt.`,
    source: 'Guide de pratique en assurance de personnes',
    tags: ['assurance invalidité', 'court terme', 'long terme', 'revenu', 'délai de carence', 'profession propre'],
  },
  {
    domain: 'produits_assurance',
    title: 'Assurance maladies graves — Prestations du vivant',
    content: `L'assurance maladies graves (AMG) verse une prestation forfaitaire unique à l'assuré qui reçoit un diagnostic d'une maladie couverte par le contrat et survit au délai de survie (généralement 30 jours après le diagnostic). Contrairement à l'assurance vie qui protège les proches en cas de décès, l'AMG protège l'assuré lui-même en lui fournissant des liquidités pour faire face aux conséquences financières d'une maladie grave.

Les maladies typiquement couvertes varient selon les assureurs, mais les contrats standards couvrent entre 25 et 35 conditions, les plus fréquentes étant : le cancer (représente environ 70 % des réclamations), les maladies cardiaques (crise cardiaque, pontage coronarien), l'accident vasculaire cérébral (AVC), la sclérose en plaques, l'insuffisance rénale, la transplantation d'organe, la cécité et la surdité. Chaque condition a une définition médicale précise dans le contrat.

La prestation est versée en un seul montant, libre d'impôt, et l'assuré peut l'utiliser comme bon lui semble : traitements médicaux non couverts par la RAMQ (médicaments, traitements expérimentaux, soins aux États-Unis), modifications au domicile, remplacement de revenu pendant la convalescence, aide domestique, ou simple réduction de l'endettement pour diminuer le stress financier.

Les formules de couverture incluent : la temporaire 10 ou 20 ans (protection à moindre coût pendant une période définie), la permanente (protection à vie avec primes nivelées ou libérées), et l'option « remboursement des primes » (si aucune réclamation n'est faite à une date donnée ou au décès, les primes versées sont remboursées intégralement). Cette dernière option augmente les primes d'environ 30-50 % mais élimine la notion de « perte si pas de réclamation ».

Lors de l'analyse des besoins, le représentant doit évaluer : les antécédents familiaux du client, sa couverture collective existante (certains régimes offrent une AMG limitée), son niveau d'endettement, sa capacité d'épargne d'urgence, et l'impact financier qu'une maladie grave aurait sur sa famille. Un montant de couverture correspondant à 2-3 ans de revenu brut est souvent recommandé comme point de départ.`,
    source: 'Guide de pratique en assurance de personnes; Association canadienne des compagnies d\'assurances de personnes (ACCAP)',
    tags: ['maladies graves', 'prestation du vivant', 'cancer', 'cardiaque', 'AVC', 'remboursement de primes'],
  },
  {
    domain: 'produits_assurance',
    title: 'Assurance collective — Avantages sociaux en entreprise',
    content: `L'assurance collective est un régime d'avantages sociaux offert par un employeur à ses employés. Elle constitue un pilier majeur de la rémunération globale au Québec et couvre typiquement l'assurance vie, l'assurance invalidité (courte et longue durée), les soins médicaux et dentaires, et parfois l'assurance maladies graves et les soins de la vue.

Le cadre réglementaire de l'assurance collective au Québec est principalement régi par le chapitre II du titre III de la LDPSF, qui concerne spécifiquement les représentants en assurance collective de personnes. Le représentant en assurance collective doit détenir un certificat distinct de celui en assurance de personnes individuelle.

Les avantages de l'assurance collective pour l'employeur incluent : la déductibilité fiscale des primes (charge d'exploitation), l'outil de recrutement et de rétention des talents, la réduction de l'absentéisme par l'accès aux soins, et les tarifs de groupe généralement plus avantageux que les régimes individuels. Pour l'employé, les avantages sont : l'accès à une couverture souvent sans preuve d'assurabilité (ou avec des preuves simplifiées), les primes partagées avec l'employeur, et la commodité de la retenue salariale.

Les limites de l'assurance collective doivent être comprises par le représentant et expliquées au client : la couverture prend fin à la cessation d'emploi (avec un droit de transformation limité dans le temps, généralement 31 jours), les montants de couverture sont souvent plafonnés et peuvent être insuffisants pour les revenus élevés, l'employé a peu de contrôle sur les garanties choisies, et les modifications au régime sont décidées par l'employeur.

Le rôle du représentant en assurance collective est de conseiller l'employeur dans la conception du régime, de négocier les conditions avec les assureurs, de gérer les renouvellements annuels (en analysant l'expérience de réclamations et en négociant les hausses de primes), et de s'assurer que le régime respecte les exigences réglementaires, y compris la Loi sur les normes du travail et la Régie de l'assurance maladie du Québec (RAMQ).`,
    source: 'LDPSF, titre III, chap. II; Loi sur les normes du travail',
    tags: ['assurance collective', 'avantages sociaux', 'employeur', 'régime collectif', 'transformation', 'renouvellement'],
  },
  {
    domain: 'produits_assurance',
    title: 'Rentes et produits de retraite',
    content: `Les rentes sont des contrats d'assurance qui fournissent un revenu périodique (mensuel, trimestriel ou annuel) pendant une période déterminée ou à vie. Elles jouent un rôle central dans la planification de la retraite en offrant une garantie de revenu que les placements traditionnels ne peuvent assurer.

Les types de rentes incluent : la rente viagère (versements à vie, cessent au décès sauf si une garantie de période est incluse), la rente certaine (versements pendant une durée fixe, par exemple 10 ou 20 ans, indépendamment du décès), la rente viagère avec période garantie (combine les deux — versements à vie mais avec un minimum garanti, par exemple 10 ans), la rente réversible (continue de verser un pourcentage au conjoint survivant après le décès du rentier), et la rente indexée (versements ajustés annuellement selon l'inflation ou un taux fixe).

Au Québec, les rentes peuvent être enregistrées (dans un REER ou un FERR) ou non enregistrées. Les rentes prescrites (non enregistrées avec primes nivelées) offrent un avantage fiscal intéressant : le revenu imposable est réparti également sur toute la durée de la rente, ce qui réduit l'impôt payé dans les premières années par rapport à une rente non prescrite.

Les produits de retraite connexes incluent les fonds distincts avec garanties de retrait (FRG ou GMWB — Guaranteed Minimum Withdrawal Benefit), qui combinent un placement dans des fonds distincts avec une garantie de revenu viager. Ces produits offrent un plancher de revenu garanti tout en permettant au capital de croître si les marchés sont favorables.

Le représentant doit considérer plusieurs facteurs dans sa recommandation : l'espérance de vie du client (les clients en bonne santé favorisent les rentes viagères), ses autres sources de revenu (RRQ, PSV, REER/FERR, régime de retraite d'employeur), son besoin de liquidités (une fois le capital converti en rente, il n'est généralement plus accessible), son taux d'imposition marginal, et son aversion au risque de longévité (le risque de survivre à ses épargnes).

La suitability (convenance) du produit est particulièrement importante avec les rentes en raison de leur caractère souvent irrévocable. Le représentant doit s'assurer que le client comprend qu'il échange la liquidité de son capital contre la sécurité d'un revenu garanti.`,
    source: 'Guide de pratique en assurance de personnes; Loi de l\'impôt sur le revenu, art. 60-61',
    tags: ['rentes', 'retraite', 'revenu viager', 'fonds distincts', 'planification financière', 'FERR', 'REER'],
  },

  // =========================================================================
  // DOMAIN: analyse_besoins
  // =========================================================================
  {
    domain: 'analyse_besoins',
    title: 'Processus d\'analyse des besoins financiers',
    content: `L'analyse des besoins financiers (ABF) est le processus central de l'activité du représentant en assurance, rendu obligatoire par l'article 27 de la LDPSF. C'est la démarche par laquelle le représentant recueille, analyse et interprète les informations nécessaires pour formuler des recommandations adaptées au profil unique de chaque client.

Le processus d'ABF comporte cinq étapes structurées. La première est la collecte d'informations : le représentant recueille les données personnelles (état civil, personnes à charge, état de santé), financières (revenus, dépenses, actifs, passifs, impôts), professionnelles (emploi, stabilité, avantages sociaux) et les objectifs du client (court terme, moyen terme, long terme).

La deuxième étape est l'évaluation de la situation actuelle : le représentant dresse un portrait complet de la situation financière du client, incluant son bilan patrimonial, son budget, ses couvertures d'assurance existantes (individuelles et collectives), et ses lacunes de protection.

La troisième étape est l'identification des besoins : à partir de l'analyse, le représentant identifie les besoins de protection (décès, invalidité, maladie grave), les besoins d'épargne (retraite, éducation des enfants, fonds d'urgence), et les besoins de planification successorale. Chaque besoin est quantifié autant que possible.

La quatrième étape est la formulation des recommandations : le représentant propose des solutions concrètes (produits d'assurance, véhicules d'épargne, stratégies fiscales) qui répondent aux besoins identifiés, en tenant compte du budget du client et de sa tolérance au risque. Plusieurs options doivent être présentées lorsque pertinent.

La cinquième étape est la documentation et le suivi : l'ABF doit être consignée par écrit dans le dossier client, signée par le client, et mise à jour périodiquement (au minimum tous les 2-3 ans ou lors de tout changement significatif dans la situation du client : mariage, naissance, divorce, changement d'emploi, héritage, maladie).

Le défaut de réaliser une ABF complète avant de recommander un produit constitue un manquement grave aux obligations du représentant et expose celui-ci à des sanctions disciplinaires et à la responsabilité civile.`,
    source: 'LDPSF, art. 27; Règlement sur l\'exercice des activités des représentants',
    tags: ['analyse des besoins', 'ABF', 'collecte d\'information', 'recommandation', 'documentation', 'suivi'],
  },
  {
    domain: 'analyse_besoins',
    title: 'Questionnaire de connaissance du client (KYC)',
    content: `Le questionnaire de connaissance du client (Know Your Client — KYC) est l'outil formel par lequel le représentant recueille les informations nécessaires à l'analyse des besoins financiers. Ce document est exigé par la réglementation et constitue la pièce maîtresse du dossier client.

Les sections essentielles d'un questionnaire KYC complet incluent l'identification du client (nom, date de naissance, adresse, coordonnées, numéro d'assurance sociale, état civil, régime matrimonial), les personnes à charge (enfants, conjoint, parents à charge, avec leurs âges et besoins spécifiques), la situation professionnelle (employeur, poste, ancienneté, stabilité d'emploi, revenus, avantages sociaux), et le bilan financier détaillé.

Le bilan financier doit couvrir les revenus (bruts et nets, de toutes sources), les dépenses courantes (logement, transport, alimentation, éducation), les actifs (immobiliers, financiers, régimes de retraite — REER, CELI, FERR, régime d'employeur), les passifs (hypothèque, prêts, marges de crédit, cartes de crédit), et les couvertures existantes (assurance vie, invalidité, maladies graves, tant individuelles que collectives).

Le KYC doit également documenter les objectifs du client (retraite à quel âge, éducation des enfants, remboursement de dettes, achat immobilier, transmission du patrimoine), sa tolérance au risque (conservateur, modéré, équilibré, dynamique, audacieux), son horizon de placement, et son niveau de littératie financière.

Les obligations du représentant envers le KYC sont strictes. Il doit : recueillir les informations de manière rigoureuse et objective (ne pas « deviner » ou « compléter » des réponses), faire signer le document par le client, mettre à jour le KYC lors de chaque rencontre significative, conserver le document selon les règles de conservation des dossiers (minimum 5 ans après la fin de la relation), et ne jamais partager les informations sans le consentement du client (secret professionnel).

Le KYC sert de base probante en cas de litige : si un client allègue un conseil inadéquat, le KYC correctement rempli et signé démontre que le représentant a fait preuve de diligence dans la collecte d'informations.`,
    source: 'LDPSF, art. 27; Règlement sur l\'exercice des activités des représentants, art. 6-8',
    tags: ['KYC', 'connaissance du client', 'questionnaire', 'bilan financier', 'objectifs', 'tolérance au risque'],
  },
  {
    domain: 'analyse_besoins',
    title: 'Détermination du capital décès nécessaire',
    content: `La détermination du capital décès nécessaire est un calcul fondamental de l'analyse des besoins financiers. Il vise à établir le montant d'assurance vie requis pour que les personnes à charge du client puissent maintenir leur niveau de vie en cas de décès de ce dernier.

La méthode des besoins (needs approach) est la plus utilisée et la plus rigoureuse. Elle consiste à calculer : les besoins immédiats (frais funéraires : 10 000 à 20 000 $, dettes à rembourser immédiatement, impôts au décès, fonds d'urgence pour la période d'ajustement), les besoins transitoires (remplacement du revenu pendant une période définie, frais d'éducation des enfants, pension alimentaire si applicable), et les besoins permanents (revenu du conjoint survivant jusqu'à la retraite, fonds de retraite du conjoint si nécessaire).

La formule simplifiée est : Capital requis = Besoins immédiats + Valeur actualisée des besoins transitoires + Valeur actualisée des besoins permanents - Ressources existantes (couvertures actuelles, épargne, régimes d'État comme RRQ survivant, actifs liquidables).

La méthode du revenu (income approach) est une alternative plus simple : elle consiste à multiplier le revenu annuel net du client par un facteur (souvent 7 à 10). Par exemple, un revenu net de 80 000 $ × 10 = 800 000 $. Cette méthode est utile pour une estimation rapide mais manque de précision car elle ne tient pas compte des besoins spécifiques du client.

Des facteurs spécifiques doivent être considérés dans le calcul : l'âge des enfants (les familles avec de jeunes enfants ont des besoins plus élevés et plus longs), le régime matrimonial (séparation de biens vs société d'acquêts), l'existence d'un testament et d'un mandat de protection, les prestations de survivant du RRQ et de la PSV, les couvertures collectives de l'employeur, et les actifs du client (un client avec un patrimoine important a besoin de moins d'assurance).

Le représentant doit documenter clairement le calcul dans le dossier client et le réviser périodiquement, notamment lors de changements familiaux (naissance, divorce) ou financiers (achat immobilier, changement d'emploi) significatifs.`,
    source: 'Guide de pratique en assurance de personnes; IQPF — méthode d\'analyse des besoins',
    tags: ['capital décès', 'besoins', 'méthode des besoins', 'revenu', 'analyse', 'calcul de couverture'],
  },
  {
    domain: 'analyse_besoins',
    title: 'Analyse de la couverture existante',
    content: `L'analyse de la couverture existante est une étape essentielle de l'ABF qui consiste à inventorier, évaluer et comparer les protections d'assurance actuelles du client avec ses besoins réels. Cette analyse permet d'identifier les lacunes (sous-assurance), les chevauchements (sur-assurance) et les opportunités d'optimisation.

L'inventaire des couvertures existantes doit être exhaustif et inclure : les polices d'assurance individuelle (vie, invalidité, maladies graves, soins de longue durée), les régimes d'assurance collective de l'employeur (avec les montants, les conditions et les limites de chaque garantie), les régimes publics (RAMQ, RRQ, SAAQ, CNESST), les protections liées aux cartes de crédit ou aux prêts (assurance vie et invalidité hypothécaire, assurance voyage), et les protections incluses dans les ordres professionnels ou associations.

Pour chaque couverture, le représentant doit documenter : le type de produit, l'assureur, le numéro de police, le montant de couverture, les primes, le bénéficiaire désigné, les conditions et exclusions importantes, la date d'échéance ou de renouvellement, et les options de conversion ou de transformation disponibles.

L'analyse comparative consiste ensuite à mettre en parallèle les besoins identifiés et les couvertures existantes pour chaque catégorie de risque. Par exemple : besoin en assurance vie = 750 000 $, couverture actuelle = 200 000 $ (collective) + 100 000 $ (individuelle) = 300 000 $, donc lacune = 450 000 $.

Les pièges à éviter lors de cette analyse incluent : oublier les régimes collectifs de l'employeur du conjoint, ne pas considérer les prestations du RRQ en cas de décès ou d'invalidité, ignorer les couvertures créditeur (qui protègent le prêteur, pas nécessairement le client), surestimer la valeur des couvertures collectives (qui prennent fin à la cessation d'emploi), et ne pas tenir compte de la fiscalité (les prestations d'invalidité payées par l'employeur sont imposables, contrairement à celles payées par le particulier).

Le représentant doit recommander au client de centraliser l'information sur ses couvertures et de réviser son analyse au moins tous les deux ans ou lors de tout événement de vie significatif.`,
    source: 'LDPSF, art. 27; Guide de pratique en assurance de personnes',
    tags: ['couverture existante', 'inventaire', 'lacune', 'analyse comparative', 'régime collectif', 'optimisation'],
  },
  {
    domain: 'analyse_besoins',
    title: 'Recommandation adaptée au profil de risque',
    content: `La formulation d'une recommandation adaptée au profil de risque du client est l'aboutissement du processus d'analyse des besoins financiers. Cette recommandation doit être personnalisée, justifiée, documentée et communiquée de manière claire au client.

Le profil de risque du client en assurance se décline sur plusieurs axes : sa tolérance au risque financier (capacité émotionnelle à accepter la volatilité des placements), sa capacité financière (budget disponible pour les primes d'assurance et l'épargne), son horizon temporel (court, moyen ou long terme selon ses objectifs), et sa situation familiale et professionnelle (stabilité, personnes à charge, perspectives de carrière).

La recommandation doit respecter le principe de convenance (suitability) : le produit recommandé doit être approprié au profil du client. Recommander un produit complexe (assurance vie universelle avec fonds distincts) à un client qui a besoin d'une protection simple constitue un manquement à cette obligation. Inversement, recommander uniquement une temporaire 10 ans à un client aisé ayant des objectifs de planification successorale peut être insuffisant.

Les éléments d'une recommandation conforme incluent : l'identification claire du besoin auquel elle répond, les caractéristiques du produit recommandé (type, montant, durée, coût), la justification du choix (pourquoi ce produit plutôt qu'un autre), la présentation d'alternatives considérées et les raisons de leur rejet, les limites et exclusions importantes du produit, et l'impact sur le budget global du client.

Le représentant doit présenter au moins deux options lorsque c'est pertinent, en expliquant les avantages et inconvénients de chacune. Le client doit disposer du temps nécessaire pour réfléchir et poser des questions avant de prendre sa décision. Le représentant ne doit jamais exercer de pression indue.

La recommandation doit être documentée par écrit dans le dossier client, avec les motifs qui la soutiennent. Cette documentation est essentielle en cas de litige : elle démontre que le représentant a fait preuve de diligence et que la recommandation était fondée sur une analyse rigoureuse des besoins du client.`,
    source: 'LDPSF, art. 27; Code de déontologie CSF, art. 15-18',
    tags: ['recommandation', 'profil de risque', 'convenance', 'suitability', 'personnalisation', 'documentation'],
  },

  // =========================================================================
  // DOMAIN: ufc_formation_continue
  // =========================================================================
  {
    domain: 'ufc_formation_continue',
    title: 'UFC — Unités de formation continue (système et obligations)',
    content: `Les Unités de Formation Continue (UFC) sont le mécanisme par lequel l'AMF s'assure que les représentants en assurance maintiennent et développent leurs compétences professionnelles tout au long de leur carrière. Le système d'UFC est obligatoire pour tous les représentants détenant un certificat de l'AMF dans les disciplines d'assurance de personnes, d'assurance de dommages, de planification financière et de courtage.

Le terme « UFC » est l'équivalent québécois des « Continuing Education (CE) credits » utilisés dans le reste du Canada et aux États-Unis. Une UFC correspond généralement à une heure de formation structurée et reconnue.

Les exigences minimales pour un cycle de deux ans sont : un minimum de 30 UFC au total, dont au moins 3 UFC en éthique et déontologie, et au moins 2 UFC en conformité réglementaire. Les UFC restantes peuvent être dans des matières générales liées à la discipline du représentant.

Les activités reconnues pour l'obtention d'UFC incluent : les cours en présentiel offerts par des organismes de formation accrédités, les cours en ligne accrédités par l'AMF, les congrès et colloques de l'industrie (avec attestation de présence), la rédaction d'articles ou de publications professionnelles (avec approbation préalable), et la participation à des groupes de formation structurés.

Le représentant est responsable de conserver les attestations de participation et de les fournir à l'AMF sur demande. Bien que l'AMF ait modernisé son système de suivi, le représentant prudent conserve ses propres copies de toutes les attestations.

Le coût de la formation continue est généralement assumé par le représentant ou par son cabinet. Certains cabinets offrent un budget de formation annuel ou organisent des formations internes accréditées. Les frais de formation continue sont déductibles d'impôt comme dépenses d'emploi ou d'entreprise.`,
    source: 'Règlement sur la formation continue obligatoire, RLRQ c. D-9.2, r. 5.1',
    tags: ['UFC', 'formation continue', 'obligations', 'accréditation', 'heures', 'compétences'],
  },
  {
    domain: 'ufc_formation_continue',
    title: 'Cycle de formation continue AMF (2 ans)',
    content: `Le cycle de formation continue de l'AMF est une période de référence de deux ans durant laquelle le représentant doit accumuler le nombre minimal d'UFC requises pour maintenir son certificat en vigueur. Le non-respect de cette obligation peut entraîner la suspension ou la non-reconduction du certificat.

Le cycle commence à la date de délivrance initiale du certificat et se renouvelle automatiquement par périodes de deux ans. Par exemple, un représentant dont le certificat a été délivré le 1er mars 2024 doit compléter ses UFC avant le 28 février 2026. L'AMF envoie des avis de rappel, mais le représentant est ultimement responsable du suivi de ses obligations.

La répartition des UFC doit respecter les minimums par catégorie : au moins 3 UFC en éthique et déontologie (déontologie, conflits d'intérêts, responsabilité professionnelle), au moins 2 UFC en conformité (réglementation, lois, changements législatifs), et le solde en formation générale (produits, techniques de vente, gestion de pratique, fiscalité, planification financière). Le total minimum de 30 UFC doit être atteint.

Les UFC ne sont pas transférables d'un cycle à l'autre. Les UFC excédentaires accumulées dans un cycle ne peuvent pas être reportées au cycle suivant. Le représentant ne peut pas non plus « anticiper » les UFC d'un cycle futur.

En cas de circonstances exceptionnelles (maladie grave, congé de maternité/paternité, service militaire), le représentant peut demander à l'AMF une prolongation du cycle ou une réduction des exigences. Cette demande doit être faite par écrit, avec pièces justificatives, avant l'expiration du cycle.

Le suivi des UFC se fait via le portail en ligne de l'AMF, où le représentant peut consulter son relevé d'UFC accumulées. Les organismes de formation accrédités sont tenus de déclarer les participations directement à l'AMF dans un délai prescrit. Le représentant doit toutefois vérifier régulièrement que toutes ses formations ont été correctement comptabilisées.`,
    source: 'Règlement sur la formation continue obligatoire, RLRQ c. D-9.2, r. 5.1',
    tags: ['cycle', 'deux ans', 'minimum', 'répartition', 'report', 'portail AMF'],
  },
  {
    domain: 'ufc_formation_continue',
    title: 'Catégories d\'UFC reconnues (générale, éthique, conformité)',
    content: `Les UFC sont classées en trois catégories principales, chacune répondant à un objectif spécifique de développement professionnel. La compréhension de ces catégories est essentielle pour le représentant qui planifie sa formation continue.

La catégorie « Éthique et déontologie » (minimum 3 UFC par cycle) couvre les formations portant sur les principes déontologiques, les obligations professionnelles, les conflits d'intérêts, la responsabilité professionnelle, le secret professionnel, le traitement des plaintes, et les cas d'étude disciplinaires. Ces formations visent à maintenir et renforcer les valeurs éthiques du représentant. Les sujets typiques incluent : analyse de décisions disciplinaires récentes, études de cas éthiques, évolution des normes déontologiques, et pratiques exemplaires en matière de gouvernance.

La catégorie « Conformité réglementaire » (minimum 2 UFC par cycle) porte sur l'environnement réglementaire, les changements législatifs et réglementaires, les obligations de conformité, la prévention du blanchiment d'argent, la protection des renseignements personnels (Loi 25), et les nouvelles exigences de l'AMF. Ces formations sont particulièrement importantes car l'environnement réglementaire évolue constamment. Les modifications à la LDPSF, les nouvelles directives de l'AMF, et les développements jurisprudentiels doivent être maîtrisés.

La catégorie « Formation générale » (solde des UFC requises) englobe un large éventail de sujets liés à la discipline du représentant : connaissance des produits d'assurance (nouveaux produits, caractéristiques, comparaisons), techniques d'analyse des besoins financiers, planification financière et fiscale, gestion de pratique et développement des affaires, technologies de l'information appliquées à l'assurance, communication et relation client, et spécialités sectorielles (marché des professionnels, entreprises, aînés).

La qualité de la formation est aussi importante que la quantité. L'AMF encourage les représentants à choisir des formations qui correspondent à leurs lacunes identifiées et à leur clientèle cible, plutôt que de simplement accumuler des heures dans des sujets familiers. Les formations de haute qualité contribuent réellement au développement professionnel et à la protection du public.`,
    source: 'Règlement sur la formation continue obligatoire, RLRQ c. D-9.2, r. 5.1, art. 3-5',
    tags: ['catégories UFC', 'éthique', 'conformité', 'formation générale', 'planification', 'développement'],
  },
  {
    domain: 'ufc_formation_continue',
    title: 'Organismes de formation accrédités',
    content: `Pour qu'une formation donne droit à des UFC, elle doit être offerte ou reconnue par un organisme de formation accrédité par l'AMF. L'accréditation garantit que le contenu, la qualité pédagogique et la durée de la formation répondent aux normes établies par l'AMF.

Les principaux organismes de formation accrédités au Québec incluent : la Chambre de la sécurité financière (CSF), qui offre un large éventail de formations en ligne et en présentiel pour les représentants en assurance de personnes et en planification financière; la Chambre de l'assurance de dommages (ChAD), pour les représentants en assurance de dommages; l'Institut québécois de planification financière (IQPF), pour les formations en planification financière; les universités et cégeps (programmes crédités en finance, assurance, fiscalité); et les organismes privés accrédités (firmes de formation spécialisées ayant obtenu l'accréditation de l'AMF).

Le processus d'accréditation d'un organisme exige la démonstration de la qualité du contenu pédagogique, des qualifications des formateurs, des méthodes d'évaluation des apprentissages, et des procédures administratives adéquates (inscriptions, attestations, déclarations à l'AMF).

Les assureurs et les cabinets peuvent également organiser des formations internes accréditées, à condition d'obtenir l'approbation préalable de l'AMF pour chaque activité. Ces formations internes sont particulièrement utiles pour traiter des sujets spécifiques à la pratique du cabinet ou aux produits d'un assureur particulier.

Le représentant doit vérifier AVANT de s'inscrire à une formation que celle-ci est accréditée et que les UFC seront reconnues dans la catégorie souhaitée. Le registre des organismes et des formations accréditées est consultable sur le site de l'AMF. Les formations non accréditées, aussi pertinentes soient-elles, ne comptent pas dans le calcul des UFC obligatoires.

Les formations en ligne (e-learning) sont de plus en plus populaires et reconnues par l'AMF, à condition qu'elles incluent des mécanismes de validation de la participation et de l'apprentissage (quiz, exercices, temps minimal de connexion). Les webinaires en direct sont généralement traités comme des formations en présentiel pour l'attribution des UFC.`,
    source: 'AMF — Liste des organismes de formation accrédités; Règlement sur la formation continue, art. 8-10',
    tags: ['organismes accrédités', 'CSF', 'ChAD', 'IQPF', 'e-learning', 'accréditation'],
  },
  {
    domain: 'ufc_formation_continue',
    title: 'Conséquences du non-respect des obligations de formation',
    content: `Le non-respect des obligations de formation continue entraîne des conséquences progressives qui peuvent aller jusqu'à la perte du droit d'exercer. L'AMF applique un processus gradué, mais ferme, pour assurer la conformité des représentants.

La première étape est l'avis de rappel. Environ six mois avant la fin du cycle, l'AMF envoie un avis au représentant dont le relevé d'UFC est incomplet. Cet avis précise le nombre d'UFC manquantes et le délai restant. Le représentant diligent prend immédiatement les mesures nécessaires pour compléter ses obligations.

Si les UFC ne sont pas complétées à l'échéance du cycle, l'AMF émet un avis de défaut avec un délai de grâce (généralement 90 jours) pour régulariser la situation. Pendant ce délai, le représentant conserve son certificat mais est en situation de non-conformité. Il est fortement recommandé de compléter les UFC manquantes le plus rapidement possible.

Si le défaut persiste après le délai de grâce, l'AMF peut suspendre le certificat du représentant. La suspension signifie l'interdiction immédiate d'exercer toute activité de représentation en assurance. Le représentant suspendu ne peut pas solliciter de clients, conclure de transactions, ou recevoir de commissions sur de nouvelles ventes. Les clients existants doivent être transférés à un autre représentant ou au cabinet.

Pour obtenir la levée de la suspension, le représentant doit compléter les UFC manquantes et présenter une demande de rétablissement à l'AMF, accompagnée des frais de rétablissement. L'AMF peut exiger des UFC supplémentaires avant de rétablir le certificat.

En cas de récidive (non-conformité répétée sur plusieurs cycles), l'AMF peut refuser de renouveler le certificat, ce qui équivaut à une radiation. Le représentant doit alors reprendre l'ensemble du processus d'inscription, incluant potentiellement les examens de qualification.

Les conséquences collatérales sont également significatives : perte de revenus pendant la suspension, atteinte à la réputation professionnelle, inscription au registre public des sanctions de l'AMF, responsabilité civile potentielle envers les clients affectés par la suspension, et difficultés à retrouver un emploi ou un rattachement à un cabinet. La formation continue n'est pas une formalité — c'est une condition essentielle au maintien du droit d'exercer.`,
    source: 'LDPSF, art. 220-222; Règlement sur la formation continue obligatoire',
    tags: ['non-respect', 'suspension', 'radiation', 'avis de défaut', 'rétablissement', 'conséquences'],
  },

  // =========================================================================
  // DOMAIN: loi_25
  // =========================================================================
  {
    domain: 'loi_25',
    title: 'Loi 25 (protection des renseignements personnels) — Impact en assurance',
    content: `La Loi 25, officiellement la Loi modernisant des dispositions législatives en matière de protection des renseignements personnels (2021, chapitre 25), modernise le cadre de protection des données au Québec. Entrée en vigueur progressivement entre septembre 2022 et septembre 2024, elle impose des obligations significatives aux représentants et cabinets d'assurance qui collectent et traitent des renseignements personnels.

L'impact principal en assurance concerne la collecte massive de données sensibles inhérente à l'activité : renseignements médicaux, informations financières, habitudes de vie, antécédents familiaux, et données biométriques dans certains cas. Ces données sont parmi les plus sensibles au sens de la Loi 25.

Les obligations clés pour les représentants et cabinets incluent : la nomination d'un responsable de la protection des renseignements personnels (par défaut, la personne ayant la plus haute autorité), la réalisation d'évaluations des facteurs relatifs à la vie privée (EFVP) pour tout nouveau projet impliquant des renseignements personnels, la mise en place de politiques et pratiques de gouvernance encadrant la collecte, l'utilisation, la conservation et la destruction des renseignements, et la notification obligatoire à la Commission d'accès à l'information (CAI) et aux personnes concernées en cas d'incident de confidentialité présentant un risque sérieux de préjudice.

Les pénalités pour non-conformité sont substantielles : les pénalités administratives peuvent atteindre 10 millions de dollars ou 2 % du chiffre d'affaires mondial, et les pénalités pénales peuvent atteindre 25 millions de dollars ou 4 % du chiffre d'affaires mondial. De plus, un droit d'action privé permet aux individus de réclamer des dommages-intérêts punitifs d'au moins 1 000 $ en cas de violation intentionnelle ou de négligence grave.

Pour le représentant, les implications pratiques incluent : l'obligation d'obtenir un consentement valide (manifeste, libre, éclairé, spécifique et temporaire) avant de collecter des renseignements personnels, la limitation de la collecte aux informations nécessaires à la finalité déclarée, la sécurisation adéquate des données (chiffrement, accès limité, mots de passe robustes), et le respect du droit des clients à l'accès, à la rectification et à la suppression de leurs données.`,
    source: 'Loi 25, LQ 2021, c. 25; Loi sur la protection des renseignements personnels dans le secteur privé, RLRQ c. P-39.1',
    tags: ['loi 25', 'protection des données', 'renseignements personnels', 'EFVP', 'CAI', 'pénalités', 'consentement'],
  },
  {
    domain: 'loi_25',
    title: 'Consentement et collecte de données — Obligations du représentant',
    content: `La Loi 25 renforce considérablement les exigences en matière de consentement pour la collecte de renseignements personnels. Pour le représentant en assurance, qui collecte quotidiennement des données sensibles, ces exigences sont particulièrement pertinentes.

Le consentement doit répondre à cinq critères cumulatifs sous la Loi 25. Il doit être manifeste (exprimé de manière claire et sans ambiguïté, idéalement par écrit ou par un geste positif — le silence ne constitue pas un consentement), libre (donné sans contrainte — le refus ne doit pas entraîner de conséquences disproportionnées), éclairé (le client doit comprendre quelles données sont collectées, pourquoi, comment elles seront utilisées, à qui elles seront communiquées, et pendant combien de temps elles seront conservées), spécifique (chaque finalité nécessite un consentement distinct — un consentement général « pour toutes fins » n'est plus valide), et temporaire (le consentement est donné pour la durée nécessaire à la réalisation de la finalité déclarée).

Dans le contexte de l'assurance, le représentant doit obtenir un consentement distinct pour : la collecte des renseignements médicaux (questionnaire de santé pour la tarification), le partage avec l'assureur (communication des données à la compagnie d'assurance pour l'émission de la police), la vérification de crédit (si pertinent pour certains produits), le marketing et les communications commerciales (envoi de nouvelles offres, bulletins d'information), et le transfert à des tiers (partenaires, sous-traitants, fournisseurs de services).

Le représentant doit informer le client de ses droits : droit d'accès à ses renseignements, droit de rectification, droit de retirer son consentement à tout moment, et nouveau droit à la portabilité des données (depuis septembre 2024). Le retrait du consentement prend effet pour l'avenir et n'affecte pas la légalité du traitement effectué avant le retrait.

La collecte doit être limitée au strict nécessaire (principe de minimisation). Le représentant ne doit pas collecter plus d'informations que ce qui est requis pour l'analyse des besoins et la souscription du produit. Par exemple, demander les revenus détaillés de tous les membres du foyer n'est pas nécessaire pour une simple assurance auto.

Le représentant doit conserver les preuves de consentement dans le dossier client. En cas de litige ou d'inspection, il doit pouvoir démontrer que le consentement a été obtenu de manière conforme avant toute collecte ou communication de renseignements personnels.`,
    source: 'Loi sur la protection des renseignements personnels dans le secteur privé, art. 14; Loi 25',
    tags: ['consentement', 'collecte de données', 'minimisation', 'droits du client', 'portabilité', 'retrait du consentement'],
  },
  {
    domain: 'loi_25',
    title: 'Droits des assurés — Accès, rectification, suppression',
    content: `La Loi 25 et la Loi sur la protection des renseignements personnels dans le secteur privé confèrent aux assurés des droits fondamentaux sur leurs renseignements personnels. Le représentant doit connaître ces droits, les respecter et être en mesure de les mettre en oeuvre.

Le droit d'accès (art. 27 de la Loi sur le privé) permet à toute personne de demander à un cabinet ou à un représentant la communication des renseignements personnels la concernant. La demande peut être verbale ou écrite. Le cabinet doit y répondre dans un délai de 30 jours. L'accès doit être gratuit (sauf frais raisonnables de transcription). Le cabinet ne peut refuser l'accès que dans des circonstances limitées prévues par la loi (par exemple, si la communication risquerait de révéler un renseignement personnel d'un tiers).

Le droit de rectification (art. 28) permet à l'assuré de faire corriger des renseignements inexacts, incomplets ou équivoques. Si le cabinet refuse la rectification, il doit permettre à la personne de déposer un commentaire qui sera ajouté au dossier. La rectification doit être communiquée à toute personne à qui les renseignements erronés ont été transmis, dans la mesure du possible.

Le droit à la désindexation et à la suppression est un ajout de la Loi 25. L'assuré peut demander la cessation de la diffusion de ses renseignements personnels ou la désindexation de tout lien associé à son nom, si cette diffusion contrevient à la loi ou si les conditions initiales de collecte ne sont plus remplies. Pour les renseignements qui ne sont plus nécessaires à la finalité déclarée, l'assuré peut demander leur destruction.

Le droit à la portabilité (en vigueur depuis septembre 2024) permet à l'assuré de demander que ses renseignements personnels soient communiqués dans un format technologique structuré et couramment utilisé, soit à la personne elle-même, soit à un tiers (par exemple, un nouveau cabinet). Ce droit facilite la mobilité des clients entre cabinets.

En cas de refus d'exercice d'un droit, l'assuré peut s'adresser à la Commission d'accès à l'information (CAI), qui peut ordonner la communication, la rectification ou la destruction des renseignements. Les décisions de la CAI sont exécutoires et susceptibles de révision judiciaire.

Le représentant doit mettre en place des procédures internes pour traiter les demandes d'accès, de rectification et de suppression dans les délais prescrits. L'absence de procédure ou le non-respect des délais constitue une infraction à la loi et peut entraîner des pénalités administratives.`,
    source: 'Loi sur la protection des renseignements personnels dans le secteur privé, art. 27-28, 28.1; Loi 25',
    tags: ['droits des assurés', 'accès', 'rectification', 'suppression', 'portabilité', 'CAI', 'délais'],
  },
];

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function main() {
  console.log('\n=== Knowledge Base Seed Script ===\n');

  const args = parseArgs();

  // Resolve tenantId (same pattern as seed-lms.ts)
  let tenantId = args.tenantId;
  if (!tenantId) {
    tenantId = process.env.TENANT_ID ?? undefined;
  }
  if (!tenantId) {
    const ownerUser = await prisma.user.findFirst({
      where: { role: { in: ['OWNER', 'EMPLOYEE'] } },
      select: { tenantId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (ownerUser?.tenantId) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: ownerUser.tenantId },
        select: { id: true, name: true },
      });
      if (tenant) {
        tenantId = tenant.id;
        log('[i]', `Using tenant with OWNER users: "${tenant.name}" (${tenantId})`);
      }
    }
    if (!tenantId) {
      const firstTenant = await prisma.tenant.findFirst({
        select: { id: true, name: true },
      });
      if (!firstTenant) {
        console.error('ERROR: No tenant found in the database. Pass --tenant-id <id> or create a tenant first.');
        process.exit(1);
      }
      tenantId = firstTenant.id;
      log('[i]', `Using first tenant: "${firstTenant.name}" (${tenantId})`);
    }
  } else {
    log('[i]', `Using tenant ID: ${tenantId}`);
  }

  // -----------------------------------------------------------------------
  // Seed knowledge entries
  // -----------------------------------------------------------------------
  console.log(`\nSeeding ${KNOWLEDGE_ENTRIES.length} knowledge entries across ${new Set(KNOWLEDGE_ENTRIES.map(e => e.domain)).size} domains...\n`);

  const domainStats: Record<string, { created: number; skipped: number }> = {};
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const entry of KNOWLEDGE_ENTRIES) {
    // Track domain stats
    if (!domainStats[entry.domain]) {
      domainStats[entry.domain] = { created: 0, skipped: 0 };
    }

    // Check if already exists (idempotent)
    const existing = await prisma.aiTutorKnowledge.findFirst({
      where: {
        tenantId,
        domain: entry.domain,
        title: entry.title,
      },
    });

    if (existing) {
      domainStats[entry.domain].skipped++;
      totalSkipped++;
      log('[-]', `Skipped (exists): ${entry.title.substring(0, 60)}...`);
      continue;
    }

    // Create the knowledge entry
    await prisma.aiTutorKnowledge.create({
      data: {
        tenantId,
        domain: entry.domain,
        title: entry.title,
        content: entry.content,
        source: entry.source,
        metadata: { tags: entry.tags },
        isActive: true,
      },
    });

    domainStats[entry.domain].created++;
    totalCreated++;
    log('[+]', `Created: ${entry.title.substring(0, 60)}...`);
  }

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n=== Summary ===\n');
  console.log(`  Total: ${KNOWLEDGE_ENTRIES.length} entries`);
  console.log(`  Created: ${totalCreated}`);
  console.log(`  Skipped: ${totalSkipped} (already existed)\n`);
  console.log('  By domain:');
  for (const [domain, stats] of Object.entries(domainStats).sort()) {
    console.log(`    ${domain}: ${stats.created} created, ${stats.skipped} skipped`);
  }
  console.log('\n  Done.\n');
}

// ---------------------------------------------------------------------------
// Execute
// ---------------------------------------------------------------------------

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
