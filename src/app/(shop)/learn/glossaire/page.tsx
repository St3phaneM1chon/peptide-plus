'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from '@/hooks/useTranslations';

// ── Domain types ──
type GlossaryDomain =
  | 'conformite'
  | 'ethique'
  | 'produits'
  | 'juridique'
  | 'organismes'
  | 'epargne'
  | 'invalidite'
  | 'tarification'
  | 'general';

interface GlossaryTerm {
  id: string;
  term: string;
  shortDef: string;
  fullDef: string;
  domain: GlossaryDomain;
  related: string[];
  legalRef?: string;
}

// ── Domain colors ──
const domainColors: Record<GlossaryDomain, string> = {
  conformite: 'bg-blue-100 text-blue-800',
  ethique: 'bg-purple-100 text-purple-800',
  produits: 'bg-green-100 text-green-800',
  juridique: 'bg-red-100 text-red-800',
  organismes: 'bg-amber-100 text-amber-800',
  epargne: 'bg-teal-100 text-teal-800',
  invalidite: 'bg-orange-100 text-orange-800',
  tarification: 'bg-indigo-100 text-indigo-800',
  general: 'bg-gray-100 text-gray-800',
};

// ── 50+ insurance terms ──
const glossaryTerms: GlossaryTerm[] = [
  {
    id: 'actuaire',
    term: 'Actuaire',
    shortDef: 'Professionnel qui evalue les risques financiers et calcule les primes et provisions.',
    fullDef: 'Un actuaire est un specialiste en mathematiques appliquees qui evalue les risques financiers lies aux contrats d\'assurance. Il utilise des modeles statistiques et probabilistes pour calculer les primes, les provisions techniques et les reserves necessaires. Les actuaires jouent un role central dans la tarification des produits et la solvabilite des compagnies d\'assurance.',
    domain: 'tarification',
    related: ['provisions-techniques', 'tarification', 'prime'],
    legalRef: 'Loi sur les assureurs, RLRQ c. A-32.1',
  },
  {
    id: 'agent',
    term: 'Agent',
    shortDef: 'Representant lie exclusivement a un seul assureur pour distribuer ses produits.',
    fullDef: 'Un agent d\'assurance est un representant certifie qui agit exclusivement pour le compte d\'un seul assureur. Contrairement au courtier qui represente le client, l\'agent represente l\'assureur et ne peut offrir que les produits de cette compagnie. L\'agent est soumis aux memes obligations deontologiques que tout representant en assurance au Quebec.',
    domain: 'general',
    related: ['courtier', 'representant', 'cabinet'],
  },
  {
    id: 'amf',
    term: 'AMF',
    shortDef: 'Autorite des marches financiers — organisme de reglementation du secteur financier au Quebec.',
    fullDef: 'L\'Autorite des marches financiers (AMF) est l\'organisme de reglementation et d\'encadrement du secteur financier au Quebec. Elle supervise les assureurs, les courtiers, les agents et tous les intermediaires financiers. L\'AMF delivre les permis d\'exercice, surveille la conformite, recoit les plaintes des consommateurs et peut imposer des sanctions disciplinaires.',
    domain: 'organismes',
    related: ['conformite', 'ldpsf', 'representant'],
    legalRef: 'Loi sur l\'Autorite des marches financiers, RLRQ c. A-33.2',
  },
  {
    id: 'assurance-collective',
    term: 'Assurance collective',
    shortDef: 'Contrat couvrant un groupe de personnes, generalement les employes d\'une entreprise.',
    fullDef: 'L\'assurance collective est un regime d\'assurance souscrit par un employeur ou une association pour couvrir un groupe de personnes. Elle offre typiquement des protections en assurance vie, maladie, invalidite et soins dentaires. Les primes sont generalement partagees entre l\'employeur et les employes. Le contrat-cadre est detenu par le preneur (employeur), et chaque participant recoit un certificat d\'assurance.',
    domain: 'produits',
    related: ['contrat-collectif', 'certificat-assurance', 'invalidite'],
  },
  {
    id: 'assurance-temporaire',
    term: 'Assurance temporaire',
    shortDef: 'Assurance vie couvrant une periode definie (10, 20 ou 30 ans) sans valeur de rachat.',
    fullDef: 'L\'assurance vie temporaire offre une protection pour une duree determinee, habituellement 10, 20 ou 30 ans. Si l\'assure decede pendant la periode couverte, le beneficiaire recoit le capital deces. A l\'expiration du terme, la couverture cesse ou peut etre renouvelee a un taux plus eleve. Ce type d\'assurance n\'accumule pas de valeur de rachat, ce qui la rend plus abordable que l\'assurance permanente.',
    domain: 'produits',
    related: ['assurance-vie-entiere', 'capital-deces', 'prime', 'beneficiaire'],
  },
  {
    id: 'assurance-universelle',
    term: 'Assurance universelle',
    shortDef: 'Assurance vie permanente combinant protection et composante d\'epargne flexible.',
    fullDef: 'L\'assurance vie universelle est un produit permanent qui combine une protection d\'assurance vie avec une composante d\'investissement. Le titulaire peut ajuster ses primes et son capital assure selon ses besoins. La portion epargne croit a l\'abri de l\'impot et peut etre investie dans differents vehicules. C\'est un produit complexe qui necessite un devoir de conseil rigoureux de la part du representant.',
    domain: 'produits',
    related: ['assurance-vie-entiere', 'valeur-rachat', 'prime'],
  },
  {
    id: 'assurance-vie-entiere',
    term: 'Assurance vie entiere',
    shortDef: 'Assurance vie permanente garantie pour toute la vie avec accumulation de valeur de rachat.',
    fullDef: 'L\'assurance vie entiere offre une protection permanente garantie pour toute la duree de vie de l\'assure. Les primes sont generalement fixes et nivelees. Ce produit accumule une valeur de rachat au fil du temps, qui peut etre empruntee ou retiree. A terme, les primes peuvent etre entierement payees (vie entiere liberee). Le capital deces est garanti et verse au beneficiaire au moment du deces.',
    domain: 'produits',
    related: ['assurance-temporaire', 'assurance-universelle', 'valeur-rachat', 'capital-deces'],
  },
  {
    id: 'avenant',
    term: 'Avenant',
    shortDef: 'Document modifiant les conditions d\'un contrat d\'assurance en vigueur.',
    fullDef: 'Un avenant est un document officiel qui vient modifier, ajouter ou supprimer des conditions d\'un contrat d\'assurance existant. Il fait partie integrante de la police et a la meme valeur juridique. Les avenants peuvent couvrir des garanties supplementaires (ex.: exoneration des primes en cas d\'invalidite), modifier les beneficiaires ou ajuster les montants de couverture. Tout avenant doit etre accepte par les deux parties.',
    domain: 'juridique',
    related: ['police', 'exclusion', 'proposition-assurance'],
    legalRef: 'Code civil du Quebec, art. 2405',
  },
  {
    id: 'beneficiaire',
    term: 'Beneficiaire',
    shortDef: 'Personne designee pour recevoir les prestations d\'un contrat d\'assurance.',
    fullDef: 'Le beneficiaire est la personne physique ou morale designee dans un contrat d\'assurance pour recevoir les prestations en cas de sinistre ou de deces de l\'assure. La designation peut etre revocable (modifiable par le titulaire) ou irrevocable (necessite le consentement du beneficiaire pour etre changee). En assurance vie, la designation d\'un beneficiaire permet generalement d\'eviter le processus de succession.',
    domain: 'general',
    related: ['capital-deces', 'police', 'souscripteur'],
    legalRef: 'Code civil du Quebec, art. 2445-2460',
  },
  {
    id: 'cabinet',
    term: 'Cabinet',
    shortDef: 'Entreprise autorisee a offrir des produits d\'assurance par l\'entremise de representants.',
    fullDef: 'Un cabinet est une personne morale ou societe autorisee par l\'AMF a agir comme intermediaire en assurance. Le cabinet emploie ou est rattache a des representants certifies qui distribuent les produits d\'assurance au public. Les cabinets peuvent etre exclusifs (lies a un seul assureur) ou independants (offrant les produits de plusieurs assureurs). Ils ont des obligations de conformite et de surveillance de leurs representants.',
    domain: 'general',
    related: ['agent', 'courtier', 'representant', 'amf'],
    legalRef: 'Loi sur la distribution de produits et services financiers, RLRQ c. D-9.2',
  },
  {
    id: 'capital-deces',
    term: 'Capital deces',
    shortDef: 'Montant verse au beneficiaire lors du deces de l\'assure.',
    fullDef: 'Le capital deces est la somme d\'argent que l\'assureur s\'engage a verser au beneficiaire designe lors du deces de l\'assure. Ce montant est generalement libre d\'impot pour le beneficiaire lorsqu\'il est verse en vertu d\'une police d\'assurance vie. Le capital deces peut etre un montant fixe ou variable selon le type de police et les avenants en place.',
    domain: 'produits',
    related: ['beneficiaire', 'police', 'assurance-vie-entiere'],
  },
  {
    id: 'certificat-assurance',
    term: 'Certificat d\'assurance',
    shortDef: 'Document remis a chaque participant d\'un regime d\'assurance collective.',
    fullDef: 'Le certificat d\'assurance est un document individuel remis a chaque personne couverte par un contrat d\'assurance collective. Il resume les protections, les montants de couverture, les conditions et les exclusions applicables au participant. Le certificat n\'est pas la police elle-meme (detenue par l\'employeur ou le preneur de groupe), mais il constitue la preuve d\'adhesion au regime.',
    domain: 'produits',
    related: ['assurance-collective', 'contrat-collectif', 'police'],
  },
  {
    id: 'conformite',
    term: 'Conformite',
    shortDef: 'Respect des lois, reglements et normes de l\'industrie de l\'assurance.',
    fullDef: 'La conformite designe l\'ensemble des mesures prises par un representant, un cabinet ou un assureur pour s\'assurer du respect des lois, reglements et normes deontologiques applicables au secteur de l\'assurance. Au Quebec, la conformite couvre notamment la formation continue obligatoire (UFC), le devoir de conseil, la connaissance du client, la divulgation des conflits d\'interets et la tenue de dossiers adequats.',
    domain: 'conformite',
    related: ['amf', 'deontologie', 'ldpsf', 'ufc'],
    legalRef: 'Loi sur la distribution de produits et services financiers, RLRQ c. D-9.2',
  },
  {
    id: 'contrat-collectif',
    term: 'Contrat collectif',
    shortDef: 'Police d\'assurance couvrant un ensemble de personnes sous un contrat unique.',
    fullDef: 'Le contrat collectif est la police principale souscrite par un employeur ou un preneur de groupe aupres d\'un assureur. Il definit les garanties, les conditions et les modalites du regime d\'assurance collective. Les participants individuels n\'ont pas acces au contrat-cadre; ils recoivent plutot un certificat d\'assurance resume. Le preneur est responsable de la gestion administrative du regime.',
    domain: 'produits',
    related: ['assurance-collective', 'certificat-assurance'],
  },
  {
    id: 'courtier',
    term: 'Courtier',
    shortDef: 'Intermediaire independant qui represente le client et magasine parmi plusieurs assureurs.',
    fullDef: 'Le courtier d\'assurance est un intermediaire independant qui agit pour le compte du client, contrairement a l\'agent qui represente l\'assureur. Le courtier analyse les besoins du client et magasine parmi les produits de plusieurs assureurs pour trouver la meilleure couverture au meilleur prix. Il a un devoir de conseil envers son client et doit lui recommander les produits les mieux adaptes a sa situation.',
    domain: 'general',
    related: ['agent', 'representant', 'cabinet', 'devoir-conseil'],
  },
  {
    id: 'cri',
    term: 'CRI',
    shortDef: 'Compte de retraite immobilise — recoit les fonds d\'un regime de retraite a la cessation d\'emploi.',
    fullDef: 'Le Compte de Retraite Immobilise (CRI) est un vehicule d\'epargne-retraite qui recoit les sommes provenant d\'un regime de retraite a prestations ou a cotisations determinees lors de la cessation d\'emploi. Les fonds sont immobilises, c\'est-a-dire qu\'ils ne peuvent etre retires avant la retraite sauf dans certaines circonstances exceptionnelles prevues par la loi. A la retraite, le CRI est converti en FRV ou en rente.',
    domain: 'epargne',
    related: ['frv', 'reer', 'ferr', 'rente'],
    legalRef: 'Loi sur les regimes complementaires de retraite, RLRQ c. R-15.1',
  },
  {
    id: 'deontologie',
    term: 'Deontologie',
    shortDef: 'Ensemble des regles ethiques et professionnelles qui gouvernent la pratique en assurance.',
    fullDef: 'La deontologie en assurance regroupe l\'ensemble des regles ethiques et professionnelles auxquelles les representants doivent se conformer dans l\'exercice de leurs fonctions. Elle couvre des aspects comme l\'integrite, la competence, la diligence, le secret professionnel, la prevention des conflits d\'interets et la priorite des interets du client. Le Code de deontologie de la Chambre de la securite financiere est le principal document de reference.',
    domain: 'ethique',
    related: ['conformite', 'devoir-conseil', 'divulgation'],
    legalRef: 'Code de deontologie de la Chambre de la securite financiere, RLRQ c. D-9.2, r. 3',
  },
  {
    id: 'devoir-conseil',
    term: 'Devoir de conseil',
    shortDef: 'Obligation pour le representant de recommander les produits adaptes aux besoins du client.',
    fullDef: 'Le devoir de conseil est l\'obligation fondamentale pour tout representant en assurance de fournir des recommandations eclairees et adaptees a la situation particuliere de chaque client. Cela implique de bien comprendre les besoins, la situation financiere et les objectifs du client, d\'expliquer clairement les produits recommandes ainsi que leurs avantages et inconvenients, et de documenter le tout dans le dossier client. Le manquement au devoir de conseil peut entrainer des sanctions disciplinaires.',
    domain: 'ethique',
    related: ['deontologie', 'divulgation', 'conformite'],
    legalRef: 'LDPSF, art. 27-28',
  },
  {
    id: 'divulgation',
    term: 'Divulgation',
    shortDef: 'Obligation de declarer toute information pertinente lors de la souscription d\'assurance.',
    fullDef: 'La divulgation est l\'obligation pour le proposant de reveler tous les faits pertinents susceptibles d\'influencer la decision de l\'assureur d\'accepter le risque ou d\'en fixer la prime. L\'omission ou la fausse declaration peut entrainer la nullite du contrat. L\'assureur a egalement des obligations de divulgation envers le client, notamment quant aux conditions, exclusions et limitations de la couverture proposee.',
    domain: 'ethique',
    related: ['proposition-assurance', 'periode-contestabilite', 'exclusion'],
    legalRef: 'Code civil du Quebec, art. 2408-2413',
  },
  {
    id: 'dommages-materiels',
    term: 'Dommages materiels',
    shortDef: 'Atteinte physique a un bien, couvert par l\'assurance de dommages.',
    fullDef: 'Les dommages materiels designent les atteintes physiques causees a des biens (immeubles, vehicules, equipements, etc.). En assurance, la couverture des dommages materiels comprend generalement le cout de reparation ou de remplacement du bien endommage. La couverture peut etre etendue ou limitee selon les termes de la police et les avenants en place.',
    domain: 'general',
    related: ['responsabilite-civile', 'sinistre', 'indemnite'],
  },
  {
    id: 'exclusion',
    term: 'Exclusion',
    shortDef: 'Situation, evenement ou condition specifiquement non couvert par un contrat d\'assurance.',
    fullDef: 'Une exclusion est une clause d\'un contrat d\'assurance qui specifie les situations, evenements ou conditions pour lesquels la couverture ne s\'applique pas. Les exclusions courantes incluent les actes intentionnels, la guerre, les actes terroristes, les maladies preexistantes (avec certaines limites) et les activites dangereuses. Le representant a l\'obligation d\'expliquer clairement les exclusions au client avant la souscription.',
    domain: 'juridique',
    related: ['police', 'avenant', 'sinistre'],
    legalRef: 'Code civil du Quebec, art. 2404',
  },
  {
    id: 'ferr',
    term: 'FERR',
    shortDef: 'Fonds enregistre de revenu de retraite — vehicule pour recevoir un revenu de retraite.',
    fullDef: 'Le Fonds Enregistre de Revenu de Retraite (FERR) est un vehicule d\'epargne-retraite dans lequel un REER est converti au plus tard a la fin de l\'annee ou le titulaire atteint 71 ans. Le FERR oblige le titulaire a retirer un montant minimum chaque annee, calcule selon une formule prescrite par la loi. Les retraits sont imposables comme un revenu. Le FERR permet de continuer a faire fructifier les placements a l\'abri de l\'impot.',
    domain: 'epargne',
    related: ['reer', 'cri', 'frv', 'rente'],
    legalRef: 'Loi de l\'impot sur le revenu, art. 146.3',
  },
  {
    id: 'fonds-distincts',
    term: 'Fonds distincts',
    shortDef: 'Fonds de placement offerts par les assureurs avec garantie de capital a l\'echeance ou au deces.',
    fullDef: 'Les fonds distincts sont des produits d\'investissement offerts exclusivement par les compagnies d\'assurance. Ils se distinguent des fonds communs de placement par la garantie de capital (generalement 75% ou 100%) a l\'echeance du contrat ou au deces du detenteur. Les fonds distincts beneficient egalement de la protection contre les creanciers et permettent de nommer un beneficiaire, evitant ainsi les frais de succession.',
    domain: 'produits',
    related: ['produit-structure', 'valeur-rachat', 'capital-deces'],
  },
  {
    id: 'franchise',
    term: 'Franchise',
    shortDef: 'Montant a la charge de l\'assure avant que l\'assureur n\'indemnise un sinistre.',
    fullDef: 'La franchise est le montant que l\'assure doit assumer lui-meme avant que l\'assureur ne commence a indemniser un sinistre. Par exemple, avec une franchise de 500$, l\'assure paie les premiers 500$ de frais et l\'assureur couvre le reste. La franchise peut etre fixe ou en pourcentage. Un montant de franchise plus eleve reduit generalement le cout de la prime.',
    domain: 'general',
    related: ['indemnite', 'sinistre', 'prime'],
  },
  {
    id: 'frv',
    term: 'FRV',
    shortDef: 'Fonds de revenu viager — produit de decaissement pour les fonds immobilises.',
    fullDef: 'Le Fonds de Revenu Viager (FRV) est le vehicule de decaissement des fonds immobilises (CRI). Contrairement au FERR, le FRV impose a la fois un retrait minimum et un retrait maximum annuel, protegeant ainsi les fonds de retraite d\'un epuisement premature. Les retraits sont imposables. A 65 ans, le titulaire peut transferer jusqu\'a 40% du solde dans un FERR non immobilise pour plus de flexibilite.',
    domain: 'epargne',
    related: ['cri', 'ferr', 'reer', 'rente'],
    legalRef: 'Loi sur les regimes complementaires de retraite, RLRQ c. R-15.1',
  },
  {
    id: 'indemnite',
    term: 'Indemnite',
    shortDef: 'Somme versee par l\'assureur pour compenser une perte ou un dommage subi.',
    fullDef: 'L\'indemnite est la compensation financiere versee par l\'assureur a l\'assure ou au beneficiaire a la suite d\'un sinistre couvert par le contrat. Le principe indemnitaire stipule que l\'assure ne peut recevoir plus que la perte reellement subie (en assurance de dommages). En assurance de personnes, l\'indemnite est un montant convenu a l\'avance, independant de la perte reelle.',
    domain: 'general',
    related: ['sinistre', 'prestation', 'franchise'],
    legalRef: 'Code civil du Quebec, art. 2463',
  },
  {
    id: 'invalidite',
    term: 'Invalidite',
    shortDef: 'Etat d\'incapacite empechant une personne d\'exercer son emploi ou toute occupation.',
    fullDef: 'L\'invalidite en assurance designe l\'etat d\'une personne qui, en raison d\'une maladie ou d\'un accident, est incapable d\'exercer son emploi ou toute occupation remuneratrice. Les polices d\'invalidite distinguent habituellement l\'invalidite totale de l\'invalidite partielle, et l\'invalidite de courte duree de celle de longue duree. La definition d\'invalidite varie selon les contrats et peut etre basee sur l\'occupation propre ou toute occupation.',
    domain: 'invalidite',
    related: ['maladie-grave', 'prestation', 'assurance-collective'],
  },
  {
    id: 'ldpsf',
    term: 'LDPSF',
    shortDef: 'Loi sur la distribution de produits et services financiers — cadre juridique de l\'industrie.',
    fullDef: 'La Loi sur la distribution de produits et services financiers (LDPSF) est la loi-cadre qui regit l\'exercice des activites de distribution d\'assurance et de produits financiers au Quebec. Elle etablit les conditions d\'obtention et de maintien du permis d\'exercice, les obligations des representants, les responsabilites des cabinets et les pouvoirs de l\'AMF en matiere de surveillance et de discipline.',
    domain: 'juridique',
    related: ['amf', 'conformite', 'representant'],
    legalRef: 'RLRQ c. D-9.2',
  },
  {
    id: 'maladie-grave',
    term: 'Maladie grave',
    shortDef: 'Assurance versant un montant forfaitaire lors du diagnostic d\'une maladie couverte.',
    fullDef: 'L\'assurance maladies graves verse un montant forfaitaire a l\'assure lorsqu\'il recoit le diagnostic d\'une maladie grave couverte par le contrat, comme le cancer, la crise cardiaque ou l\'AVC. La prestation est versee independamment des frais medicaux reels et peut etre utilisee a la discretion de l\'assure (soins, perte de revenu, adaptation du domicile, etc.). Le nombre de maladies couvertes varie selon les contrats.',
    domain: 'invalidite',
    related: ['invalidite', 'prestation', 'capital-deces'],
  },
  {
    id: 'periode-contestabilite',
    term: 'Periode de contestabilite',
    shortDef: 'Delai pendant lequel l\'assureur peut contester un contrat pour fausse declaration.',
    fullDef: 'La periode de contestabilite est la periode (generalement de 2 ans) pendant laquelle l\'assureur peut annuler un contrat d\'assurance vie ou de personnes en invoquant des fausses declarations ou des omissions de l\'assure dans sa proposition. Apres cette periode, le contrat devient incontestable sauf en cas de fraude. Ce mecanisme protege a la fois l\'assureur et l\'assure.',
    domain: 'juridique',
    related: ['divulgation', 'proposition-assurance', 'police'],
    legalRef: 'Code civil du Quebec, art. 2424',
  },
  {
    id: 'police',
    term: 'Police',
    shortDef: 'Document contractuel qui detaille les conditions, couvertures et exclusions d\'assurance.',
    fullDef: 'La police d\'assurance est le document juridique qui constitue le contrat entre l\'assure et l\'assureur. Elle decrit en detail les couvertures offertes, les exclusions, les conditions generales et particulieres, les obligations de chaque partie, la duree du contrat et les modalites de resiliation. La police est le document de reference en cas de reclamation ou de litige.',
    domain: 'juridique',
    related: ['avenant', 'exclusion', 'prime', 'souscripteur'],
    legalRef: 'Code civil du Quebec, art. 2399-2414',
  },
  {
    id: 'pool-risques',
    term: 'Pool de risques',
    shortDef: 'Regroupement de risques similaires pour mieux les gerer et les repartir.',
    fullDef: 'Un pool de risques est un mecanisme par lequel plusieurs assureurs se regroupent pour couvrir des risques que chacun ne pourrait assumer seul, ou pour mutualiser des risques difficiles a assurer individuellement. Le principe fondamental de l\'assurance repose sur la mutualisation des risques : en regroupant un grand nombre d\'assures, les pertes individuelles sont reparties sur l\'ensemble du groupe.',
    domain: 'tarification',
    related: ['reassurance', 'actuaire', 'tarification'],
  },
  {
    id: 'prestation',
    term: 'Prestation',
    shortDef: 'Somme ou service fourni par l\'assureur en execution de ses obligations contractuelles.',
    fullDef: 'La prestation est la somme d\'argent ou le service que l\'assureur fournit en vertu du contrat d\'assurance lorsque survient un evenement couvert. En assurance de personnes, la prestation peut prendre la forme d\'un capital (montant forfaitaire) ou d\'une rente (versements periodiques). En assurance de dommages, la prestation correspond a l\'indemnisation des pertes subies.',
    domain: 'general',
    related: ['indemnite', 'sinistre', 'capital-deces'],
  },
  {
    id: 'prime',
    term: 'Prime',
    shortDef: 'Montant paye par l\'assure a l\'assureur en echange de la couverture d\'assurance.',
    fullDef: 'La prime est la somme d\'argent que l\'assure verse a l\'assureur pour obtenir et maintenir sa couverture d\'assurance. Son montant est calcule en fonction du risque assure, du montant de couverture, de l\'age et de l\'etat de sante de l\'assure, de la franchise choisie et d\'autres facteurs. Les primes peuvent etre payees mensuellement, trimestriellement ou annuellement.',
    domain: 'general',
    related: ['tarification', 'surprime', 'franchise', 'police'],
  },
  {
    id: 'produit-structure',
    term: 'Produit structure',
    shortDef: 'Produit financier complexe combinant placement et mecanismes de protection.',
    fullDef: 'Un produit structure est un instrument financier qui combine des elements de placement traditionnel avec des mecanismes de protection ou d\'amelioration du rendement. En assurance, les produits structures prennent souvent la forme de fonds distincts ou de billets lies a des indices. Leur complexite exige un devoir de conseil renforce et une divulgation complete des risques au client.',
    domain: 'produits',
    related: ['fonds-distincts', 'devoir-conseil'],
  },
  {
    id: 'proposition-assurance',
    term: 'Proposition d\'assurance',
    shortDef: 'Formulaire rempli par le client pour demander une couverture d\'assurance.',
    fullDef: 'La proposition d\'assurance est le formulaire que le client remplit et signe pour demander une couverture d\'assurance. Elle contient des questions sur l\'identite du proposant, sa sante, ses antecedents medicaux, son mode de vie et d\'autres facteurs pertinents a l\'evaluation du risque. Les reponses doivent etre completes et veridiques, car toute omission ou fausse declaration peut entrainer la nullite du contrat.',
    domain: 'general',
    related: ['divulgation', 'souscripteur', 'tarification', 'periode-contestabilite'],
  },
  {
    id: 'provisions-techniques',
    term: 'Provisions techniques',
    shortDef: 'Reserves financieres constituees par l\'assureur pour honorer ses engagements futurs.',
    fullDef: 'Les provisions techniques sont les reserves financieres que les compagnies d\'assurance doivent constituer et maintenir pour etre en mesure d\'honorer leurs engagements futurs envers les assures. Elles comprennent les provisions pour sinistres survenus mais non encore payes, les provisions pour risques en cours et les provisions pour participations. L\'adequation des provisions est supervisee par les actuaires et les organismes de reglementation.',
    domain: 'tarification',
    related: ['actuaire', 'reassurance'],
  },
  {
    id: 'reassurance',
    term: 'Reassurance',
    shortDef: 'Assurance souscrite par un assureur aupres d\'un autre assureur pour transferer une partie du risque.',
    fullDef: 'La reassurance est le mecanisme par lequel un assureur (le cedant) transfere une partie de ses risques a un autre assureur (le reassureur) moyennant le paiement d\'une prime de reassurance. Cela permet a l\'assureur de reduire son exposition aux sinistres catastrophiques, d\'augmenter sa capacite de souscription et de stabiliser ses resultats financiers. Les principaux types sont la reassurance proportionnelle et non proportionnelle.',
    domain: 'tarification',
    related: ['pool-risques', 'actuaire', 'provisions-techniques'],
  },
  {
    id: 'reer',
    term: 'REER',
    shortDef: 'Regime enregistre d\'epargne-retraite — vehicule d\'epargne avec avantage fiscal.',
    fullDef: 'Le Regime Enregistre d\'Epargne-Retraite (REER) est un vehicule d\'epargne qui permet de deduire les cotisations du revenu imposable. Les placements croissent a l\'abri de l\'impot jusqu\'au retrait. Les cotisations sont limitees a 18% du revenu gagne de l\'annee precedente, jusqu\'a un maximum annuel. Le REER doit etre converti en FERR ou en rente au plus tard a la fin de l\'annee des 71 ans du titulaire.',
    domain: 'epargne',
    related: ['ferr', 'cri', 'frv', 'rente'],
    legalRef: 'Loi de l\'impot sur le revenu, art. 146',
  },
  {
    id: 'rente',
    term: 'Rente',
    shortDef: 'Serie de versements periodiques sur une duree determinee ou viagere.',
    fullDef: 'Une rente est un produit financier qui procure un revenu periodique (mensuel, trimestriel ou annuel) a son titulaire. Elle peut etre viagere (versements a vie) ou certaine (pour une duree determinee). Les rentes sont souvent utilisees pour convertir un capital de retraite en revenu regulier. En assurance, les rentes peuvent etre immediates (versements qui debutent immediatement) ou differees (versements qui debutent a une date future).',
    domain: 'epargne',
    related: ['reer', 'ferr', 'frv', 'cri'],
  },
  {
    id: 'representant',
    term: 'Representant',
    shortDef: 'Personne certifiee autorisee a offrir des produits d\'assurance au public.',
    fullDef: 'Le representant est une personne physique qui detient un certificat d\'exercice delivre par l\'AMF l\'autorisant a offrir des produits d\'assurance au public. Il peut exercer comme agent (lie a un assureur) ou comme courtier (independant). Le representant a des obligations de formation continue (UFC), de deontologie, de devoir de conseil et de tenue de dossiers. Il est soumis a la surveillance de l\'AMF et de la Chambre de la securite financiere.',
    domain: 'general',
    related: ['agent', 'courtier', 'cabinet', 'amf', 'conformite'],
    legalRef: 'LDPSF, art. 12-20',
  },
  {
    id: 'resiliation',
    term: 'Resiliation',
    shortDef: 'Acte de mettre fin a un contrat d\'assurance avant son echeance.',
    fullDef: 'La resiliation est l\'acte par lequel l\'assure ou l\'assureur met fin au contrat d\'assurance avant son terme normal. L\'assure peut generalement resilier en tout temps moyennant un preavis. L\'assureur peut resilier pour des motifs prevus par la loi (non-paiement de la prime, aggravation du risque, fausse declaration). Les conditions et les consequences de la resiliation sont encadrees par le Code civil du Quebec.',
    domain: 'juridique',
    related: ['police', 'prime'],
    legalRef: 'Code civil du Quebec, art. 2477-2479',
  },
  {
    id: 'responsabilite-civile',
    term: 'Responsabilite civile',
    shortDef: 'Obligation de reparer les dommages causes a autrui, couverte par l\'assurance RC.',
    fullDef: 'La responsabilite civile est l\'obligation legale de reparer les dommages (corporels, materiels ou moraux) causes a une autre personne par sa faute, sa negligence ou le fait de ses biens. L\'assurance responsabilite civile couvre les frais de defense et les indemnites que l\'assure pourrait etre tenu de payer. Elle est souvent incluse dans les polices d\'assurance habitation et automobile.',
    domain: 'general',
    related: ['dommages-materiels', 'sinistre', 'indemnite'],
    legalRef: 'Code civil du Quebec, art. 1457-1481',
  },
  {
    id: 'sinistre',
    term: 'Sinistre',
    shortDef: 'Evenement dommageable donnant lieu a une reclamation aupres de l\'assureur.',
    fullDef: 'Le sinistre est un evenement concret (accident, vol, incendie, maladie, deces, etc.) qui cause un dommage couvert par le contrat d\'assurance et qui donne lieu a une reclamation. L\'assure a l\'obligation de declarer le sinistre a son assureur dans un delai raisonnable et de fournir toutes les informations pertinentes. Le traitement du sinistre comprend la declaration, l\'enquete, l\'evaluation des dommages et le reglement.',
    domain: 'general',
    related: ['indemnite', 'prestation', 'exclusion', 'franchise'],
    legalRef: 'Code civil du Quebec, art. 2470-2474',
  },
  {
    id: 'souscripteur',
    term: 'Souscripteur',
    shortDef: 'Personne ou entite qui souscrit un contrat d\'assurance et s\'engage a payer les primes.',
    fullDef: 'Le souscripteur (ou preneur) est la personne physique ou morale qui conclut le contrat d\'assurance avec l\'assureur et qui s\'engage a payer les primes. Le souscripteur n\'est pas necessairement l\'assure (la personne couverte) ni le beneficiaire (la personne qui recevra les prestations). Par exemple, un employeur peut etre le souscripteur d\'un regime d\'assurance collective pour ses employes.',
    domain: 'general',
    related: ['beneficiaire', 'police', 'prime'],
  },
  {
    id: 'subrogation',
    term: 'Subrogation',
    shortDef: 'Droit de l\'assureur de se substituer a l\'assure pour reclamer contre un tiers responsable.',
    fullDef: 'La subrogation est le mecanisme juridique par lequel l\'assureur, apres avoir indemnise son assure, acquiert le droit de poursuivre le tiers responsable du dommage pour recuperer les sommes versees. Ce principe s\'applique principalement en assurance de dommages. L\'assure ne peut prendre aucune mesure qui pourrait compromettre le droit de subrogation de son assureur.',
    domain: 'juridique',
    related: ['indemnite', 'sinistre', 'responsabilite-civile'],
    legalRef: 'Code civil du Quebec, art. 2474',
  },
  {
    id: 'surprime',
    term: 'Surprime',
    shortDef: 'Montant supplementaire ajoute a la prime standard en raison d\'un risque aggrave.',
    fullDef: 'La surprime est un montant additionnel ajoute a la prime d\'assurance de base lorsque l\'assure presente un risque plus eleve que la norme. Les facteurs pouvant entrainer une surprime incluent un etat de sante preoccupant, un metier dangereux, des activites a risque (aviation, plongee sous-marine) ou un historique de reclamations defavorable. La surprime permet a l\'assureur d\'accepter des risques qui seraient autrement refuses.',
    domain: 'tarification',
    related: ['tarification', 'prime', 'actuaire'],
  },
  {
    id: 'tarification',
    term: 'Tarification',
    shortDef: 'Processus d\'evaluation du risque et de determination de la prime d\'assurance.',
    fullDef: 'La tarification est le processus par lequel l\'assureur evalue le niveau de risque d\'un proposant et determine la prime appropriee. Ce processus implique l\'analyse de nombreux facteurs : age, sexe, etat de sante, antecedents medicaux et familiaux, mode de vie, profession et montant de couverture demande. La tarification peut mener a une acceptation aux taux standard, avec surprime, avec exclusion ou a un refus.',
    domain: 'tarification',
    related: ['prime', 'surprime', 'actuaire', 'proposition-assurance'],
  },
  {
    id: 'ufc',
    term: 'UFC',
    shortDef: 'Unites de formation continue — exigence de perfectionnement obligatoire pour les representants.',
    fullDef: 'Les Unites de Formation Continue (UFC) constituent l\'exigence de perfectionnement professionnel obligatoire pour maintenir le droit d\'exercice d\'un representant en assurance. Au Quebec, chaque representant doit cumuler un nombre minimum d\'UFC par periode de reference (generalement 30 UFC en 2 ans). Les UFC assurent que les representants maintiennent et mettent a jour leurs competences tout au long de leur carriere. Certaines UFC sont obligatoires dans des matieres specifiques comme la conformite et la deontologie.',
    domain: 'conformite',
    related: ['amf', 'conformite', 'representant'],
    legalRef: 'Reglement sur la formation continue obligatoire, RLRQ c. D-9.2, r. 11',
  },
  {
    id: 'valeur-rachat',
    term: 'Valeur de rachat',
    shortDef: 'Montant accumulable dans une police d\'assurance permanente, accessible par retrait ou emprunt.',
    fullDef: 'La valeur de rachat est la somme accumulee dans une police d\'assurance vie permanente (vie entiere ou universelle) que le titulaire peut recuperer en totalite ou en partie s\'il decide de mettre fin au contrat ou d\'effectuer un retrait partiel. La valeur de rachat croit au fil du temps en fonction des primes versees et du rendement des placements. Le rachat partiel ou total peut avoir des consequences fiscales.',
    domain: 'produits',
    related: ['assurance-vie-entiere', 'assurance-universelle', 'fonds-distincts'],
  },
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function GlossairePage() {
  const { t } = useTranslations();
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<GlossaryDomain | 'all'>('all');
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  // Filter terms based on search and domain
  const filteredTerms = useMemo(() => {
    let filtered = glossaryTerms;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (term) =>
          term.term.toLowerCase().includes(q) ||
          term.shortDef.toLowerCase().includes(q) ||
          term.fullDef.toLowerCase().includes(q)
      );
    }
    if (selectedDomain !== 'all') {
      filtered = filtered.filter((term) => term.domain === selectedDomain);
    }
    return filtered.sort((a, b) => a.term.localeCompare(b.term, 'fr'));
  }, [search, selectedDomain]);

  // Group terms by first letter
  const groupedTerms = useMemo(() => {
    const groups: Record<string, GlossaryTerm[]> = {};
    for (const term of filteredTerms) {
      const letter = term.term.charAt(0).toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(term);
    }
    return groups;
  }, [filteredTerms]);

  // Available letters
  const availableLetters = useMemo(() => new Set(Object.keys(groupedTerms)), [groupedTerms]);

  const scrollToLetter = useCallback((letter: string) => {
    setActiveLetter(letter);
    const el = document.getElementById(`letter-${letter}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const toggleTerm = useCallback((termId: string) => {
    setExpandedTermId((prev) => (prev === termId ? null : termId));
  }, []);

  const findTermByRelated = useCallback(
    (relatedId: string) => {
      return glossaryTerms.find((t2) => t2.id === relatedId);
    },
    []
  );

  const domains: { key: GlossaryDomain | 'all'; label: string }[] = [
    { key: 'all', label: t('learn.glossary.allDomains') },
    { key: 'conformite', label: t('learn.glossary.domainConformite') },
    { key: 'ethique', label: t('learn.glossary.domainEthique') },
    { key: 'produits', label: t('learn.glossary.domainProduits') },
    { key: 'juridique', label: t('learn.glossary.domainJuridique') },
    { key: 'organismes', label: t('learn.glossary.domainOrganismes') },
    { key: 'epargne', label: t('learn.glossary.domainEpargne') },
    { key: 'invalidite', label: t('learn.glossary.domainInvalidite') },
    { key: 'tarification', label: t('learn.glossary.domainTarification') },
    { key: 'general', label: t('learn.glossary.domainGeneral') },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-[#143C78] text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link
            href="/learn"
            className="inline-flex items-center text-sm text-blue-200 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-4 h-4 mr-1 rtl:mr-0 rtl:ml-1 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('learn.backToLearning')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            {t('learn.glossary.title')}
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto">
            {t('learn.glossary.subtitle')}
          </p>
          <p className="mt-3 text-sm text-blue-300">
            {t('learn.glossary.termCount', { count: glossaryTerms.length })}
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search & Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-6 sticky top-20 z-10">
          {/* Search bar */}
          <div className="relative mb-4">
            <svg
              className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('learn.glossary.searchPlaceholder')}
              className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 rtl:right-auto rtl:left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Alphabet index */}
          <div className="flex flex-wrap gap-1 mb-4">
            {ALPHABET.map((letter) => {
              const isAvailable = availableLetters.has(letter);
              return (
                <button
                  key={letter}
                  onClick={() => isAvailable && scrollToLetter(letter)}
                  disabled={!isAvailable}
                  className={`w-8 h-8 flex items-center justify-center rounded text-sm font-semibold transition-colors ${
                    activeLetter === letter
                      ? 'bg-blue-600 text-white'
                      : isAvailable
                        ? 'bg-gray-100 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
                        : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>

          {/* Domain filter */}
          <div className="flex flex-wrap gap-2">
            {domains.map((d) => (
              <button
                key={d.key}
                onClick={() => setSelectedDomain(d.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedDomain === d.key
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-4">
          {t('learn.glossary.resultsCount', { count: filteredTerms.length })}
        </p>

        {/* Terms grouped by letter */}
        {filteredTerms.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">
              <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {t('learn.glossary.noResults')}
            </h3>
            <p className="text-gray-500">
              {t('learn.glossary.noResultsDesc')}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {ALPHABET.filter((letter) => groupedTerms[letter]).map((letter) => (
              <div key={letter} id={`letter-${letter}`} className="scroll-mt-52">
                {/* Letter header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white font-bold text-lg rounded-lg">
                    {letter}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">
                    {groupedTerms[letter].length} {groupedTerms[letter].length === 1 ? t('learn.glossary.termSingular') : t('learn.glossary.termPlural')}
                  </span>
                </div>

                {/* Terms */}
                <div className="space-y-2">
                  {groupedTerms[letter].map((term) => {
                    const isExpanded = expandedTermId === term.id;
                    return (
                      <div
                        key={term.id}
                        className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all duration-200 ${
                          isExpanded ? 'ring-2 ring-blue-200' : 'hover:shadow-md'
                        }`}
                      >
                        {/* Collapsed view */}
                        <button
                          onClick={() => toggleTerm(term.id)}
                          className="w-full px-5 py-4 flex items-start gap-4 text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h3 className="font-semibold text-gray-900">{term.term}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${domainColors[term.domain]}`}>
                                {domains.find((d) => d.key === term.domain)?.label || term.domain}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {term.shortDef}
                            </p>
                          </div>
                          <svg
                            className={`w-5 h-5 text-gray-400 flex-shrink-0 mt-1 transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Expanded view */}
                        {isExpanded && (
                          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                            <p className="text-gray-700 leading-relaxed mb-4">
                              {term.fullDef}
                            </p>

                            {/* Legal reference */}
                            {term.legalRef && (
                              <div className="flex items-start gap-2 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                                </svg>
                                <div>
                                  <span className="text-xs font-semibold text-amber-800">
                                    {t('learn.glossary.legalReference')}
                                  </span>
                                  <p className="text-sm text-amber-700">{term.legalRef}</p>
                                </div>
                              </div>
                            )}

                            {/* Related terms */}
                            {term.related.length > 0 && (
                              <div className="mb-4">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                  {t('learn.glossary.relatedTerms')}
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {term.related.map((relId) => {
                                    const relatedTerm = findTermByRelated(relId);
                                    if (!relatedTerm) return null;
                                    return (
                                      <button
                                        key={relId}
                                        onClick={() => {
                                          setExpandedTermId(relId);
                                          const el = document.getElementById(`letter-${relatedTerm.term.charAt(0).toUpperCase()}`);
                                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }}
                                        className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors"
                                      >
                                        {relatedTerm.term}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Ask Aurelia button */}
                            <Link
                              href="/learn/dashboard"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white text-sm font-medium rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                              </svg>
                              {t('learn.glossary.askAurelia')}
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Back to top */}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {t('learn.glossary.backToTop')}
          </button>
        </div>
      </div>
    </div>
  );
}
