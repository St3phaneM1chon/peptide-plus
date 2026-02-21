// =====================================================
// COUNTRY FISCAL OBLIGATIONS AND COMPLIANCE DATA
// EXHAUSTIVE RESEARCH-BASED INFORMATION
// Last Updated: January 2026
// =====================================================

export interface TaxObligation {
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  rate?: string;
  threshold?: string;
  frequency?: 'monthly' | 'quarterly' | 'annually' | 'one-time';
  deadline?: string;
  required: boolean;
  url?: string;
}

export interface AnnualTask {
  id: string;
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  dueDate: string;
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time';
  status?: 'pending' | 'completed' | 'overdue';
}

export interface RegulatoryRequirement {
  name: string;
  nameFr: string;
  description: string;
  descriptionFr: string;
  authority: string;
  url?: string;
  required: boolean;
}

export interface CountryCompliance {
  code: string;
  name: string;
  nameFr: string;
  region: string;
  regionFr: string;
  hasFTA: boolean;
  ftaName?: string;
  ftaDetails?: string;
  
  // Canadian export obligations
  canadianObligations: {
    zeroRated: boolean;
    cersRequired: boolean;
    cersThreshold: number;
    cersTimeline?: string;
    certificateOfOrigin: boolean;
    certificateOfOriginForm?: string;
    exportPermit: boolean;
    exportPermitDetails?: string;
    healthCanadaApproval?: boolean;
    healthCanadaDetails?: string;
  };
  
  // Destination country obligations
  destinationObligations: TaxObligation[];
  
  // Regulatory requirements for products
  regulatoryRequirements: RegulatoryRequirement[];
  
  // Annual/periodic tasks
  annualTasks: AnnualTask[];
  
  // Important notes and warnings
  notes: string[];
  notesFr: string[];
  
  // Shipping info
  shippingDays: string;
  shippingCost: number;
  
  // Currency info
  localCurrency: string;
  localCurrencySymbol: string;
  
  // De minimis threshold (value below which no duty/tax applies)
  deMinimisThreshold?: string;
  
  // Key contacts and resources
  resources: {
    name: string;
    url: string;
    description: string;
  }[];
}

// =====================================================
// CANADA - DOMESTIC SALES
// =====================================================
export const CANADA_COMPLIANCE: CountryCompliance = {
  code: 'CA',
  name: 'Canada',
  nameFr: 'Canada',
  region: 'North America',
  regionFr: 'Amérique du Nord',
  hasFTA: true,
  
  canadianObligations: {
    zeroRated: false,
    cersRequired: false,
    cersThreshold: 0,
    certificateOfOrigin: false,
    exportPermit: false,
    healthCanadaApproval: true,
    healthCanadaDetails: 'Research peptides may require Health Canada approval under Controlled Drugs and Substances Act (CDSA) and Precursor Control Regulations (PCR). New Controlled Substances Regulations effective October 1, 2026.',
  },
  
  destinationObligations: [
    {
      name: 'GST/HST Collection',
      nameFr: 'Perception TPS/TVH',
      description: 'Collect and remit GST/HST based on customer province. Registration required if taxable supplies exceed $30,000 in any 4 consecutive calendar quarters.',
      descriptionFr: 'Percevoir et remettre la TPS/TVH selon la province du client. Inscription requise si fournitures taxables > 30 000 $ sur 4 trimestres consécutifs.',
      rate: '5% GST only (AB, BC, MB, SK, territories) | 13% HST (ON) | 14% HST (NS) | 15% HST (NB, NL, PE)',
      frequency: 'monthly',
      required: true,
      url: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html',
    },
    {
      name: 'Quebec QST',
      nameFr: 'TVQ Québec',
      description: 'Quebec Sales Tax at 9.975% on top of 5% GST. File separately with Revenu Québec.',
      descriptionFr: 'Taxe de vente du Québec de 9,975% en plus de la TPS de 5%. Déclaration séparée à Revenu Québec.',
      rate: '9.975% QST + 5% GST = 14.975% effective',
      frequency: 'monthly',
      required: true,
      url: 'https://www.revenuquebec.ca/en/businesses/consumption-taxes/gsthst-and-qst/',
    },
    {
      name: 'BC PST',
      nameFr: 'TVP Colombie-Britannique',
      description: 'British Columbia Provincial Sales Tax at 7%.',
      descriptionFr: 'Taxe de vente provinciale de la Colombie-Britannique de 7%.',
      rate: '7% PST + 5% GST = 12%',
      frequency: 'monthly',
      required: true,
    },
    {
      name: 'Saskatchewan PST',
      nameFr: 'TVP Saskatchewan',
      description: 'Saskatchewan Provincial Sales Tax at 6%.',
      descriptionFr: 'Taxe de vente provinciale de la Saskatchewan de 6%.',
      rate: '6% PST + 5% GST = 11%',
      frequency: 'monthly',
      required: true,
    },
    {
      name: 'Manitoba RST',
      nameFr: 'TVD Manitoba',
      description: 'Manitoba Retail Sales Tax at 7%.',
      descriptionFr: 'Taxe de vente au détail du Manitoba de 7%.',
      rate: '7% RST + 5% GST = 12%',
      frequency: 'monthly',
      required: true,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'Health Canada - Controlled Substances',
      nameFr: 'Santé Canada - Substances contrôlées',
      description: 'Certain peptides may fall under Controlled Drugs and Substances Act. New regulations effective October 1, 2026. Export permits may be required.',
      descriptionFr: 'Certains peptides peuvent être soumis à la Loi réglementant certaines drogues. Nouveaux règlements en vigueur le 1er octobre 2026. Permis d\'exportation possiblement requis.',
      authority: 'Health Canada - Office of Controlled Substances',
      url: 'https://www.canada.ca/en/health-canada/services/health-concerns/controlled-substances-precursor-chemicals.html',
      required: true,
    },
    {
      name: 'Natural Health Products Regulations',
      nameFr: 'Règlement sur les produits de santé naturels',
      description: 'If products are marketed for health benefits, Natural Product Number (NPN) may be required.',
      descriptionFr: 'Si les produits sont commercialisés pour des bienfaits santé, un numéro de produit naturel (NPN) peut être requis.',
      authority: 'Health Canada',
      url: 'https://www.canada.ca/en/health-canada/services/drugs-health-products/natural-non-prescription.html',
      required: false,
    },
  ],
  
  annualTasks: [
    {
      id: 'ca-gst-annual',
      name: 'GST/HST Annual Return',
      nameFr: 'Déclaration annuelle TPS/TVH',
      description: 'File annual GST/HST return with CRA. Due within 3 months of fiscal year end (or June 15 for calendar year).',
      descriptionFr: 'Produire la déclaration annuelle TPS/TVH auprès de l\'ARC. Échéance 3 mois après fin d\'exercice.',
      dueDate: 'March 31 (calendar year filers)',
      frequency: 'annually',
    },
    {
      id: 'ca-qst-annual',
      name: 'QST Annual Return (Quebec)',
      nameFr: 'Déclaration annuelle TVQ',
      description: 'File annual QST return with Revenu Québec if registered.',
      descriptionFr: 'Produire la déclaration annuelle TVQ auprès de Revenu Québec si inscrit.',
      dueDate: 'March 31',
      frequency: 'annually',
    },
    {
      id: 'ca-t2-corporate',
      name: 'T2 Corporate Tax Return',
      nameFr: 'Déclaration T2 impôt des sociétés',
      description: 'File annual corporate income tax return within 6 months of fiscal year end.',
      descriptionFr: 'Produire la déclaration d\'impôt sur le revenu des sociétés dans les 6 mois suivant la fin de l\'exercice.',
      dueDate: '6 months after fiscal year end',
      frequency: 'annually',
    },
    {
      id: 'ca-iti-review',
      name: 'Input Tax Credit Review',
      nameFr: 'Révision des crédits de taxe sur intrants',
      description: 'Review and reconcile ITCs claimed on business purchases.',
      descriptionFr: 'Réviser et réconcilier les CTI réclamés sur les achats d\'entreprise.',
      dueDate: 'Quarterly',
      frequency: 'quarterly',
    },
  ],
  
  notes: [
    'GST/HST registration required if taxable supplies exceed $30,000 in any 4 consecutive calendar quarters',
    'Place of supply rules determine which province\'s tax rate applies based on delivery destination',
    'Input Tax Credits (ITCs) can be claimed on business purchases - keep all receipts',
    'Small supplier exemption: Can choose not to register if under $30,000 threshold',
    'New Controlled Substances Regulations will replace current regulations on October 1, 2026',
    'Health Canada export permit processing: 45 calendar day service standard',
  ],
  notesFr: [
    'Inscription TPS/TVH requise si fournitures taxables > 30 000 $ sur 4 trimestres civils consécutifs',
    'Les règles sur le lieu de fourniture déterminent le taux de taxe provincial selon la destination de livraison',
    'Les crédits de taxe sur intrants (CTI) peuvent être réclamés - conserver tous les reçus',
    'Exemption de petit fournisseur: Peut choisir de ne pas s\'inscrire si sous le seuil de 30 000 $',
    'Nouveaux règlements sur les substances contrôlées en vigueur le 1er octobre 2026',
    'Traitement des permis d\'exportation Santé Canada: norme de service de 45 jours',
  ],
  
  shippingDays: '2-5',
  shippingCost: 15,
  localCurrency: 'CAD',
  localCurrencySymbol: '$',
  
  resources: [
    { name: 'CRA GST/HST Guide', url: 'https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses.html', description: 'Official GST/HST business guide' },
    { name: 'Revenu Québec', url: 'https://www.revenuquebec.ca/', description: 'Quebec tax authority' },
    { name: 'Health Canada Controlled Substances', url: 'https://www.canada.ca/en/health-canada/services/health-concerns/controlled-substances-precursor-chemicals.html', description: 'Controlled substances regulations' },
  ],
};

// =====================================================
// UNITED STATES
// =====================================================
export const USA_COMPLIANCE: CountryCompliance = {
  code: 'US',
  name: 'United States',
  nameFr: 'États-Unis',
  region: 'North America',
  regionFr: 'Amérique du Nord',
  hasFTA: true,
  ftaName: 'CUSMA/USMCA',
  ftaDetails: 'Canada-United States-Mexico Agreement (CUSMA/ACEUM) - Entered into force July 1, 2020. Provides duty-free access for most Canadian goods with certificate of origin.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: false,
    cersThreshold: 0,
    cersTimeline: 'No CERS required for US exports',
    certificateOfOrigin: true,
    certificateOfOriginForm: 'CUSMA Certificate of Origin - Not required for shipments under CAD $3,300',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'US Customs De Minimis',
      nameFr: 'Seuil de minimis douanes US',
      description: 'No duties or taxes for shipments valued at $800 USD or less. This is the highest de minimis threshold in the world.',
      descriptionFr: 'Aucun droit ou taxe pour les envois de 800 $ USD ou moins. C\'est le seuil de minimis le plus élevé au monde.',
      threshold: '$800 USD',
      required: false,
    },
    {
      name: 'Sales Tax Nexus',
      nameFr: 'Nexus de taxe de vente',
      description: 'No US sales tax obligation unless "nexus" established. Nexus triggered by: >$100k sales in a state, OR physical presence (warehouse, employees). Each state has different thresholds.',
      descriptionFr: 'Aucune obligation de taxe de vente sauf si "nexus" établi. Nexus déclenché par: >100k$ ventes dans un état, OU présence physique.',
      threshold: '$100,000/year per state (varies)',
      required: false,
      url: 'https://www.avalara.com/us/en/learn/sales-tax/nexus.html',
    },
    {
      name: 'FDA Import Review',
      nameFr: 'Révision FDA à l\'importation',
      description: 'All FDA-regulated products imported into US must comply with same standards as domestic products. FDA ImportShield Program (FISP) launched August 2025 for faster processing.',
      descriptionFr: 'Tous les produits réglementés FDA importés doivent respecter les mêmes normes que les produits domestiques. Programme FDA ImportShield lancé août 2025.',
      required: true,
      url: 'https://www.fda.gov/industry/import-program',
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'FDA Import Requirements',
      nameFr: 'Exigences FDA importation',
      description: 'Products must be declared to US Customs and Border Protection (CBP). FDA screens all electronic data and flags higher-risk products. Complete and accurate entry data expedites review.',
      descriptionFr: 'Les produits doivent être déclarés aux douanes américaines. La FDA examine les données électroniques et signale les produits à risque.',
      authority: 'US Food and Drug Administration (FDA)',
      url: 'https://www.fda.gov/industry/import-program/import-basics',
      required: true,
    },
    {
      name: 'Research Peptides Legal Status',
      nameFr: 'Statut légal peptides de recherche',
      description: 'FDA-approved peptides (semaglutide, tirzepatide) are legal with prescription. Research peptides sold "for research only" exist in a gray area - not FDA-approved for human use.',
      descriptionFr: 'Les peptides approuvés FDA sont légaux avec ordonnance. Les peptides de recherche vendus "pour recherche seulement" sont dans une zone grise.',
      authority: 'FDA',
      url: 'https://www.fda.gov/',
      required: true,
    },
    {
      name: 'CBP Entry Submission',
      nameFr: 'Soumission d\'entrée CBP',
      description: 'All imports must be declared to CBP. Most importers use licensed customs brokers. FDA ImportShield Program provides 70% faster processing for compliant shipments.',
      descriptionFr: 'Toutes les importations doivent être déclarées aux douanes. La plupart des importateurs utilisent des courtiers en douane agréés.',
      authority: 'US Customs and Border Protection',
      url: 'https://www.cbp.gov/',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'us-nexus-review',
      name: 'Sales Tax Nexus Review',
      nameFr: 'Révision du nexus de taxe de vente',
      description: 'Review sales by state to determine if nexus thresholds ($100k+) have been met. Register for sales tax in states where nexus is established.',
      descriptionFr: 'Réviser les ventes par état pour déterminer si les seuils de nexus sont atteints.',
      dueDate: 'December 31',
      frequency: 'annually',
    },
    {
      id: 'us-cusma-origin',
      name: 'CUSMA Origin Documentation',
      nameFr: 'Documentation origine ACEUM',
      description: 'Maintain certificates of origin for CUSMA preferential treatment. Keep records for 5 years.',
      descriptionFr: 'Maintenir les certificats d\'origine pour le traitement préférentiel ACEUM. Conserver les dossiers 5 ans.',
      dueDate: 'Ongoing',
      frequency: 'annually',
    },
    {
      id: 'us-fda-facility',
      name: 'FDA Facility Registration Renewal',
      nameFr: 'Renouvellement enregistrement établissement FDA',
      description: 'If FDA-registered facility, renew registration during October-December renewal period.',
      descriptionFr: 'Si établissement enregistré FDA, renouveler l\'inscription pendant la période octobre-décembre.',
      dueDate: 'October 1 - December 31',
      frequency: 'annually',
    },
  ],
  
  notes: [
    'Exports to US are ZERO-RATED for all Canadian GST/HST/PST',
    'NO CERS declaration required for US exports (unlike other international destinations)',
    'CUSMA provides preferential tariff treatment - most goods enter duty-free',
    '$800 USD de minimis threshold - highest in the world - no duties/taxes below this',
    'Certificate of origin NOT required for shipments under CAD $3,300',
    'Marketplace facilitators (Amazon, eBay, Shopify) collect and remit sales tax automatically',
    'FDA ImportShield Program (launched Aug 2025) provides 70% faster processing',
    'Research peptides legal status is complex - consult legal counsel for specific products',
  ],
  notesFr: [
    'Exportations vers les USA DÉTAXÉES pour toutes les TPS/TVH/TVP canadiennes',
    'AUCUNE déclaration SCDE requise pour exportations US (contrairement aux autres destinations)',
    'L\'ACEUM offre un traitement tarifaire préférentiel - la plupart des biens entrent en franchise',
    'Seuil de minimis de 800 $ USD - le plus élevé au monde - aucun droit/taxe en dessous',
    'Certificat d\'origine NON requis pour envois < 3 300 $ CAD',
    'Les facilitateurs de marché collectent et remettent la taxe de vente automatiquement',
    'Programme FDA ImportShield (lancé août 2025) - traitement 70% plus rapide',
  ],
  
  shippingDays: '5-10',
  shippingCost: 25,
  localCurrency: 'USD',
  localCurrencySymbol: '$',
  deMinimisThreshold: '$800 USD',
  
  resources: [
    { name: 'US CBP', url: 'https://www.cbp.gov/', description: 'US Customs and Border Protection' },
    { name: 'FDA Import Program', url: 'https://www.fda.gov/industry/import-program', description: 'FDA import requirements' },
    { name: 'CUSMA Info', url: 'https://www.cbsa-asfc.gc.ca/services/cusma-aceum/', description: 'CUSMA overview for importers' },
    { name: 'Avalara Sales Tax Nexus', url: 'https://www.avalara.com/us/en/learn/sales-tax/nexus.html', description: 'Sales tax nexus guide' },
  ],
};

// =====================================================
// EUROPEAN UNION
// =====================================================
export const EU_COMPLIANCE: CountryCompliance = {
  code: 'EU',
  name: 'European Union',
  nameFr: 'Union européenne',
  region: 'Europe',
  regionFr: 'Europe',
  hasFTA: true,
  ftaName: 'CETA',
  ftaDetails: 'Comprehensive Economic and Trade Agreement - Provisionally applied since September 21, 2017. Eliminates 99% of tariffs on Canadian goods. Saved Canadian exporters $890.6 million in duties in 2021.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    cersTimeline: 'Submit via CERS portal: Mail 2hrs prior, Vessel 48hrs prior, Air 2hrs prior, Rail 2hrs prior',
    certificateOfOrigin: true,
    certificateOfOriginForm: 'EUR.1 Certificate or Declaration of Origin - Required for CETA preferential tariffs',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'VAT Registration (IOSS)',
      nameFr: 'Inscription TVA (IOSS)',
      description: 'Import One-Stop Shop for shipments ≤€150. Register in ONE EU country, collect VAT at sale, file monthly. Non-EU sellers must appoint EU intermediary.',
      descriptionFr: 'Guichet unique pour envois ≤150€. S\'inscrire dans UN pays UE, percevoir TVA à la vente, déclarer mensuellement. Vendeurs non-UE doivent nommer intermédiaire UE.',
      rate: '15-27% depending on country',
      threshold: '€150 per consignment',
      frequency: 'monthly',
      required: true,
      url: 'https://vat-one-stop-shop.ec.europa.eu/',
    },
    {
      name: 'VAT for shipments >€150',
      nameFr: 'TVA pour envois >150€',
      description: 'Customer pays VAT at import via customs. Consider local VAT registration in high-volume countries.',
      descriptionFr: 'Le client paie la TVA à l\'importation. Considérer inscription TVA locale dans pays à fort volume.',
      rate: '15-27%',
      required: false,
    },
    {
      name: 'EU VAT Rates by Country',
      nameFr: 'Taux TVA UE par pays',
      description: 'Hungary 27% | Denmark/Sweden 25% | Poland/Portugal 23% | Italy/Belgium/Netherlands/Spain 21% | France/Austria/UK 20% | Germany 19% | Luxembourg 17%',
      descriptionFr: 'Hongrie 27% | Danemark/Suède 25% | Pologne/Portugal 23% | Italie/Belgique/Pays-Bas/Espagne 21% | France/Autriche 20% | Allemagne 19% | Luxembourg 17%',
      rate: '17-27%',
      required: true,
    },
    {
      name: 'CETA Certificate of Origin',
      nameFr: 'Certificat d\'origine AECG',
      description: 'Required for CETA preferential tariffs (99% eliminated). Statement on invoice for shipments <€6,000 or by approved exporters.',
      descriptionFr: 'Requis pour tarifs préférentiels AECG. Déclaration sur facture pour envois <6 000€ ou par exportateurs agréés.',
      required: true,
      url: 'https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/canada/eu-canada-agreement/export-info-businesses_en',
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'EU Product Compliance',
      nameFr: 'Conformité produits UE',
      description: 'Products must meet EU technical regulations, consumer protection, and data protection (GDPR) standards.',
      descriptionFr: 'Les produits doivent respecter les règlements techniques UE, protection des consommateurs et données (RGPD).',
      authority: 'European Commission',
      url: 'https://trade.ec.europa.eu/access-to-markets/',
      required: true,
    },
    {
      name: 'Animal/Plant/Food Safety',
      nameFr: 'Sécurité animale/végétale/alimentaire',
      description: 'Compliance with EU sanitary and phytosanitary measures required for relevant products.',
      descriptionFr: 'Conformité aux mesures sanitaires et phytosanitaires de l\'UE requise pour les produits concernés.',
      authority: 'European Commission - DG SANTE',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'eu-ioss-monthly',
      name: 'IOSS Monthly Declaration',
      nameFr: 'Déclaration mensuelle IOSS',
      description: 'Submit monthly IOSS VAT return by end of following month. Pay VAT collected to registration country.',
      descriptionFr: 'Soumettre la déclaration TVA IOSS mensuelle avant fin du mois suivant.',
      dueDate: 'End of following month',
      frequency: 'monthly',
    },
    {
      id: 'eu-ceta-origin',
      name: 'CETA Origin Documentation Review',
      nameFr: 'Révision documentation origine AECG',
      description: 'Ensure all certificates of origin properly maintained. Keep records for minimum 6 years.',
      descriptionFr: 'S\'assurer que tous les certificats d\'origine sont correctement maintenus. Conserver 6 ans minimum.',
      dueDate: 'Quarterly',
      frequency: 'quarterly',
    },
    {
      id: 'eu-vat-annual',
      name: 'IOSS Annual Review',
      nameFr: 'Révision annuelle IOSS',
      description: 'Review IOSS registration status, intermediary agreement if applicable, and compliance.',
      descriptionFr: 'Réviser l\'inscription IOSS, accord d\'intermédiaire si applicable, et conformité.',
      dueDate: 'January 31',
      frequency: 'annually',
    },
  ],
  
  notes: [
    'CETA eliminates 99% of tariffs on Canadian goods - saved $890.6M in duties in 2021',
    'IOSS simplifies VAT for e-commerce shipments ≤€150 - ONE registration for all 27 countries',
    'Since July 1, 2021: ALL imports subject to VAT - no €22 exemption anymore',
    'Non-EU sellers MUST appoint EU intermediary for IOSS registration',
    'Marketplaces (Amazon, eBay, Etsy) collect VAT automatically for marketplace sales',
    'Keep export documentation for MINIMUM 6 years',
    'VAT rates: Hungary highest at 27%, Luxembourg lowest at 17%',
    'Without IOSS, VAT collected by carrier at delivery - poor customer experience',
  ],
  notesFr: [
    'L\'AECG élimine 99% des tarifs sur biens canadiens - économisé 890,6M$ en droits en 2021',
    'L\'IOSS simplifie la TVA pour envois e-commerce ≤150€ - UNE inscription pour 27 pays',
    'Depuis 1er juillet 2021: TOUTES les importations soumises à TVA - plus d\'exemption 22€',
    'Vendeurs non-UE DOIVENT nommer intermédiaire UE pour inscription IOSS',
    'Les places de marché perçoivent la TVA automatiquement',
    'Conserver documentation d\'exportation MINIMUM 6 ans',
  ],
  
  shippingDays: '7-14',
  shippingCost: 50,
  localCurrency: 'EUR',
  localCurrencySymbol: '€',
  deMinimisThreshold: '€0 (no exemption since July 2021)',
  
  resources: [
    { name: 'EU VAT One Stop Shop', url: 'https://vat-one-stop-shop.ec.europa.eu/', description: 'Official IOSS registration portal' },
    { name: 'CETA Export Info', url: 'https://policy.trade.ec.europa.eu/eu-trade-relationships-country-and-region/countries-and-regions/canada/eu-canada-agreement/export-info-businesses_en', description: 'CETA requirements for Canadian businesses' },
    { name: 'Access2Markets', url: 'https://trade.ec.europa.eu/access-to-markets/', description: 'EU tariff and requirement database' },
  ],
};

// =====================================================
// UNITED KINGDOM
// =====================================================
export const UK_COMPLIANCE: CountryCompliance = {
  code: 'GB',
  name: 'United Kingdom',
  nameFr: 'Royaume-Uni',
  region: 'Europe',
  regionFr: 'Europe',
  hasFTA: true,
  ftaName: 'TCA (Trade Continuity Agreement)',
  ftaDetails: 'Canada-UK Trade Continuity Agreement - Entered into force April 1, 2021. Essentially a rollover of CETA. Eliminates 99% of tariffs. UK also joined CPTPP in 2023.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    cersTimeline: 'Standard CERS timelines apply',
    certificateOfOrigin: true,
    certificateOfOriginForm: 'TCA Certificate of Origin',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'UK VAT Registration (≤£135)',
      nameFr: 'Inscription TVA UK (≤135£)',
      description: 'MANDATORY for overseas sellers dispatching goods ≤£135 to UK customers. Collect VAT at point of sale.',
      descriptionFr: 'OBLIGATOIRE pour vendeurs étrangers expédiant biens ≤135£ aux clients UK. Percevoir TVA au point de vente.',
      rate: '20%',
      threshold: '£135 per consignment',
      frequency: 'quarterly',
      required: true,
      url: 'https://www.gov.uk/guidance/vat-and-overseas-goods-sold-directly-to-customers-in-the-uk',
    },
    {
      name: 'VAT for shipments >£135',
      nameFr: 'TVA pour envois >135£',
      description: 'Customer/importer pays VAT at import. Seller not required to collect. Consider Postponed VAT Accounting if UK VAT registered.',
      descriptionFr: 'Le client/importateur paie la TVA à l\'importation. Vendeur non tenu de percevoir.',
      rate: '20%',
      required: false,
    },
    {
      name: 'UK VAT Registration Threshold',
      nameFr: 'Seuil inscription TVA UK',
      description: 'UK domestic businesses: £90,000/year threshold (highest in OECD). But overseas sellers MUST register for goods ≤£135.',
      descriptionFr: 'Entreprises domestiques UK: seuil 90 000£/an. Mais vendeurs étrangers DOIVENT s\'inscrire pour biens ≤135£.',
      threshold: '£90,000/year (domestic) | £0 (overseas sellers for ≤£135 goods)',
      required: true,
    },
    {
      name: 'Safety & Security Declarations',
      nameFr: 'Déclarations sûreté et sécurité',
      description: 'MANDATORY since January 31, 2025 for all EU imports to UK. Required for all international shipments.',
      descriptionFr: 'OBLIGATOIRE depuis 31 janvier 2025 pour toutes importations UE vers UK.',
      required: true,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'MHRA Compliance',
      nameFr: 'Conformité MHRA',
      description: 'Medicines and Healthcare products Regulatory Agency requirements for health products.',
      descriptionFr: 'Exigences de l\'Agence de réglementation des médicaments et produits de santé.',
      authority: 'MHRA',
      url: 'https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency',
      required: true,
    },
    {
      name: 'UK Product Safety',
      nameFr: 'Sécurité produits UK',
      description: 'Products must meet UK safety standards. UKCA marking may be required (replaces CE marking post-Brexit).',
      descriptionFr: 'Les produits doivent respecter les normes de sécurité UK. Marquage UKCA possiblement requis.',
      authority: 'Office for Product Safety and Standards',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'uk-vat-quarterly',
      name: 'UK VAT Quarterly Return',
      nameFr: 'Déclaration TVA UK trimestrielle',
      description: 'Submit VAT return and payment within 1 month + 7 days after quarter end.',
      descriptionFr: 'Soumettre la déclaration TVA et paiement dans 1 mois + 7 jours après fin de trimestre.',
      dueDate: '1 month + 7 days after quarter end',
      frequency: 'quarterly',
    },
    {
      id: 'uk-vat-annual',
      name: 'UK VAT Annual Review',
      nameFr: 'Révision annuelle TVA UK',
      description: 'Review UK VAT registration status and sales volume.',
      descriptionFr: 'Réviser le statut d\'inscription TVA UK et le volume des ventes.',
      dueDate: 'April 30',
      frequency: 'annually',
    },
  ],
  
  notes: [
    'TCA provides 99% tariff elimination on Canadian goods (CETA rollover)',
    'UK is SEPARATE from EU VAT system since Brexit',
    'Overseas sellers MUST register for VAT and collect 20% on goods ≤£135 sold to UK consumers',
    'VAT-registered sellers must show VAT-INCLUSIVE prices to UK consumers',
    'Since Jan 2021: No Low Value Consignment Relief - ALL imports subject to VAT',
    'Safety & Security declarations MANDATORY since January 31, 2025',
    'Postponed VAT Accounting available for UK VAT-registered importers',
    'UK joined CPTPP in 2023 - additional preferential trade benefits',
    '£90,000 VAT registration threshold is highest in OECD (for domestic businesses)',
  ],
  notesFr: [
    'L\'ACC offre 99% d\'élimination des tarifs sur biens canadiens',
    'Le UK est SÉPARÉ du système TVA de l\'UE depuis le Brexit',
    'Vendeurs étrangers DOIVENT s\'inscrire TVA et percevoir 20% sur biens ≤135£',
    'Les vendeurs inscrits TVA doivent afficher les prix TTC aux consommateurs UK',
    'Depuis jan 2021: pas d\'exemption - TOUTES importations soumises à TVA',
    'Déclarations sûreté/sécurité OBLIGATOIRES depuis 31 janvier 2025',
    'Le UK a rejoint le PTPGP en 2023',
  ],
  
  shippingDays: '7-12',
  shippingCost: 45,
  localCurrency: 'GBP',
  localCurrencySymbol: '£',
  deMinimisThreshold: '£0 (no exemption since January 2021)',
  
  resources: [
    { name: 'HMRC VAT for Overseas Sellers', url: 'https://www.gov.uk/guidance/vat-and-overseas-goods-sold-directly-to-customers-in-the-uk', description: 'UK VAT requirements for foreign sellers' },
    { name: 'UK VAT Registration', url: 'https://www.gov.uk/vat-registration', description: 'VAT registration guidance' },
    { name: 'TCA Information', url: 'https://www.gov.uk/guidance/summary-of-the-uk-canada-trade-continuity-agreement', description: 'Canada-UK TCA details' },
  ],
};

// =====================================================
// JAPAN
// =====================================================
export const JAPAN_COMPLIANCE: CountryCompliance = {
  code: 'JP',
  name: 'Japan',
  nameFr: 'Japon',
  region: 'Asia-Pacific',
  regionFr: 'Asie-Pacifique',
  hasFTA: true,
  ftaName: 'CPTPP',
  ftaDetails: 'Comprehensive and Progressive Agreement for Trans-Pacific Partnership - Entered into force December 30, 2018. Japan is the largest economy in CPTPP. Progressive tariff elimination (90% over 20 years).',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    cersTimeline: 'Standard CERS timelines apply',
    certificateOfOrigin: true,
    certificateOfOriginForm: 'CPTPP Certificate of Origin - Required for EPA preferential rates',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'Japan Consumption Tax (JCT)',
      nameFr: 'Taxe de consommation japonaise',
      description: 'Standard rate 10% (8% for certain food products). Registration required if taxable sales exceed ¥10 million in base period.',
      descriptionFr: 'Taux standard 10% (8% pour certains aliments). Inscription requise si ventes taxables > 10M¥.',
      rate: '10% (standard) | 8% (reduced for food)',
      threshold: '¥10,000,000 (approx. $90,000 CAD)',
      required: false,
    },
    {
      name: 'JCT Platform Taxation (April 2025)',
      nameFr: 'Taxation plateformes JCT (avril 2025)',
      description: 'Since April 1, 2025: Foreign businesses providing B2C electronic services via digital platforms are no longer directly liable. Platform is deemed provider and must file/pay JCT.',
      descriptionFr: 'Depuis 1er avril 2025: Entreprises étrangères fournissant services électroniques B2C via plateformes ne sont plus directement responsables.',
      rate: '10%',
      required: true,
    },
    {
      name: 'CPTPP Preferential Tariffs',
      nameFr: 'Tarifs préférentiels PTPGP',
      description: 'EPA (Economic Partnership Agreement) rates available for goods meeting CPTPP Rules of Origin. Certificate of origin required.',
      descriptionFr: 'Taux AEP disponibles pour biens respectant les règles d\'origine PTPGP. Certificat d\'origine requis.',
      required: true,
    },
    {
      name: 'Simplified Tariff for Small Packages',
      nameFr: 'Tarif simplifié petits colis',
      description: 'Simplified rates apply when total import value doesn\'t exceed ¥200,000.',
      descriptionFr: 'Taux simplifiés s\'appliquent quand valeur totale d\'importation < 200 000¥.',
      threshold: '¥200,000',
      required: false,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'Japan Customs Declaration',
      nameFr: 'Déclaration douanes Japon',
      description: 'All imports must be declared to Japan Customs. Classification under Japan Tariff Schedule (2025 edition).',
      descriptionFr: 'Toutes les importations doivent être déclarées aux douanes japonaises.',
      authority: 'Japan Customs',
      url: 'https://www.customs.go.jp/english/',
      required: true,
    },
    {
      name: 'MHLW Health Product Regulations',
      nameFr: 'Réglementation produits santé MHLW',
      description: 'Ministry of Health, Labour and Welfare regulates pharmaceuticals, medical devices, and certain supplements.',
      descriptionFr: 'Le ministère de la Santé réglemente les produits pharmaceutiques, dispositifs médicaux et certains suppléments.',
      authority: 'Ministry of Health, Labour and Welfare (MHLW)',
      url: 'https://www.mhlw.go.jp/english/',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'jp-jct-review',
      name: 'JCT Registration Threshold Review',
      nameFr: 'Révision seuil inscription JCT',
      description: 'Review if sales exceed ¥10 million threshold for JCT registration.',
      descriptionFr: 'Vérifier si les ventes dépassent le seuil de 10M¥ pour inscription JCT.',
      dueDate: 'December 31',
      frequency: 'annually',
    },
    {
      id: 'jp-cptpp-origin',
      name: 'CPTPP Origin Documentation',
      nameFr: 'Documentation origine PTPGP',
      description: 'Maintain certificates of origin for CPTPP preferential treatment.',
      descriptionFr: 'Maintenir les certificats d\'origine pour le traitement préférentiel PTPGP.',
      dueDate: 'Ongoing',
      frequency: 'annually',
    },
  ],
  
  notes: [
    'CPTPP provides progressive tariff elimination (90% over 20 years)',
    'Japan is the LARGEST economy in CPTPP',
    'JCT rate is 10% standard, 8% reduced for certain food products',
    'JCT exemption: taxable sales ≤¥10 million in base period (2 years prior)',
    'Platform taxation effective April 2025 - platforms now responsible for B2C e-services JCT',
    'Simplified tariff rates available for imports under ¥200,000',
    'Complex cultural and regulatory requirements - consider local import agent',
    'October 2024: Stricter JCT exemption rules for foreign entities',
  ],
  notesFr: [
    'Le PTPGP offre une élimination progressive des tarifs (90% sur 20 ans)',
    'Le Japon est la PLUS GRANDE économie du PTPGP',
    'Taux JCT de 10% standard, 8% réduit pour certains aliments',
    'Exemption JCT: ventes taxables ≤10M¥ dans période de base (2 ans avant)',
    'Taxation plateformes en vigueur avril 2025 - plateformes responsables pour JCT e-services B2C',
    'Exigences culturelles et réglementaires complexes - considérer agent local',
  ],
  
  shippingDays: '10-18',
  shippingCost: 55,
  localCurrency: 'JPY',
  localCurrencySymbol: '¥',
  deMinimisThreshold: '¥10,000 (approx. $90 CAD)',
  
  resources: [
    { name: 'Japan Customs', url: 'https://www.customs.go.jp/english/', description: 'Japan Customs information' },
    { name: 'Japan Tariff Schedule 2025', url: 'https://www.customs.go.jp/english/tariff/2025_01_01/index.htm', description: 'Current tariff schedule' },
    { name: 'Japan NTA Consumption Tax', url: 'https://www.nta.go.jp/english/taxes/consumption_tax/', description: 'Consumption tax information' },
  ],
};

// =====================================================
// AUSTRALIA
// =====================================================
export const AUSTRALIA_COMPLIANCE: CountryCompliance = {
  code: 'AU',
  name: 'Australia',
  nameFr: 'Australie',
  region: 'Asia-Pacific',
  regionFr: 'Asie-Pacifique',
  hasFTA: true,
  ftaName: 'CPTPP',
  ftaDetails: 'CPTPP member. Progressive tariff elimination. Simple GST system with single 10% rate.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    certificateOfOrigin: true,
    certificateOfOriginForm: 'CPTPP Certificate of Origin',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'Australian GST Registration',
      nameFr: 'Inscription GST Australie',
      description: 'REQUIRED if Australian sales (including low value goods) exceed A$75,000. Registration within 21 days of exceeding threshold.',
      descriptionFr: 'REQUISE si ventes australiennes > 75 000 A$. Inscription dans 21 jours après dépassement du seuil.',
      rate: '10%',
      threshold: 'A$75,000 (A$150,000 for non-profits)',
      frequency: 'quarterly',
      required: true,
      url: 'https://www.ato.gov.au/businesses-and-organisations/international-tax-for-business/gst-for-non-resident-businesses',
    },
    {
      name: 'Low Value Goods GST (≤A$1,000)',
      nameFr: 'GST biens faible valeur (≤1 000 A$)',
      description: 'GST MUST be collected at point of sale for goods ≤A$1,000 sold to Australian consumers. Calculated on intrinsic value.',
      descriptionFr: 'La GST DOIT être perçue au point de vente pour biens ≤1 000 A$ vendus aux consommateurs australiens.',
      rate: '10%',
      threshold: 'A$1,000',
      required: true,
    },
    {
      name: 'Simplified GST Registration',
      nameFr: 'Inscription GST simplifiée',
      description: 'Non-residents can use simplified registration with Australian Reference Number (ARN) - no ABN or identity proof required.',
      descriptionFr: 'Non-résidents peuvent utiliser l\'inscription simplifiée avec ARN - pas besoin d\'ABN ou preuve d\'identité.',
      required: false,
      url: 'https://www.ato.gov.au/businesses-and-organisations/international-tax-for-business/gst-for-non-resident-businesses/gst-registration-for-non-resident-businesses/simplified-gst-registration',
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'TGA Compliance',
      nameFr: 'Conformité TGA',
      description: 'Therapeutic Goods Administration regulates medicines, medical devices, biologicals. Certain peptides may require TGA approval.',
      descriptionFr: 'La TGA réglemente médicaments, dispositifs médicaux, produits biologiques. Certains peptides peuvent nécessiter approbation TGA.',
      authority: 'Therapeutic Goods Administration (TGA)',
      url: 'https://www.tga.gov.au/',
      required: true,
    },
    {
      name: 'Biosecurity Import Conditions',
      nameFr: 'Conditions biosécurité importation',
      description: 'Australia has strict biosecurity requirements. Check BICON for import conditions.',
      descriptionFr: 'L\'Australie a des exigences strictes de biosécurité. Vérifier BICON pour conditions d\'importation.',
      authority: 'Department of Agriculture',
      url: 'https://bicon.agriculture.gov.au/',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'au-gst-quarterly',
      name: 'Australian GST Quarterly Return (BAS)',
      nameFr: 'Déclaration GST Australie trimestrielle (BAS)',
      description: 'Submit Business Activity Statement by 28th of month following quarter.',
      descriptionFr: 'Soumettre la Déclaration d\'activité commerciale le 28 du mois suivant le trimestre.',
      dueDate: '28th of month following quarter',
      frequency: 'quarterly',
    },
    {
      id: 'au-threshold-review',
      name: 'GST Threshold Review',
      nameFr: 'Révision seuil GST',
      description: 'Review if sales threshold (A$75,000) has been met. Register within 21 days if exceeded.',
      descriptionFr: 'Vérifier si le seuil de ventes (75 000 A$) est atteint. S\'inscrire dans 21 jours si dépassé.',
      dueDate: 'Monthly review recommended',
      frequency: 'annually',
    },
  ],
  
  notes: [
    'GST registration required within 21 DAYS of exceeding A$75,000 threshold',
    'Simple GST system with SINGLE rate of 10%',
    'Prices displayed to Australian consumers MUST include GST',
    'Low value goods (≤A$1,000): GST collected at sale, not at border',
    'Simplified registration available - use ARN instead of ABN',
    'No GST on certain health and medical products',
    'CPTPP provides progressive tariff elimination',
    'Strict biosecurity - check BICON for import conditions',
  ],
  notesFr: [
    'Inscription GST requise dans 21 JOURS après dépassement du seuil 75 000 A$',
    'Système GST simple avec taux UNIQUE de 10%',
    'Les prix affichés aux consommateurs australiens DOIVENT inclure la GST',
    'Biens faible valeur (≤1 000 A$): GST perçue à la vente, pas à la frontière',
    'Inscription simplifiée disponible - utiliser ARN au lieu d\'ABN',
  ],
  
  shippingDays: '10-18',
  shippingCost: 55,
  localCurrency: 'AUD',
  localCurrencySymbol: 'A$',
  deMinimisThreshold: 'A$0 for GST on low value goods (collected at sale)',
  
  resources: [
    { name: 'ATO GST for Non-Residents', url: 'https://www.ato.gov.au/businesses-and-organisations/international-tax-for-business/gst-for-non-resident-businesses', description: 'GST requirements for foreign sellers' },
    { name: 'TGA', url: 'https://www.tga.gov.au/', description: 'Therapeutic goods regulations' },
    { name: 'BICON', url: 'https://bicon.agriculture.gov.au/', description: 'Biosecurity import conditions' },
  ],
};

// =====================================================
// MEXICO
// =====================================================
export const MEXICO_COMPLIANCE: CountryCompliance = {
  code: 'MX',
  name: 'Mexico',
  nameFr: 'Mexique',
  region: 'North America',
  regionFr: 'Amérique du Nord',
  hasFTA: true,
  ftaName: 'CUSMA + CPTPP',
  ftaDetails: 'Covered by both CUSMA/USMCA (July 2020) and CPTPP. Most goods enter duty-free with certificate of origin.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    certificateOfOrigin: true,
    certificateOfOriginForm: 'CUSMA Certificate of Origin - Not required for shipments under CAD $3,300',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'Mexico IVA (VAT)',
      nameFr: 'IVA Mexique (TVA)',
      description: 'Standard rate 16%. Reduced rate 8% in border regions. 0% for exports, basic food, medicines. No registration threshold - all taxable suppliers must register.',
      descriptionFr: 'Taux standard 16%. Taux réduit 8% dans régions frontalières. 0% pour exportations, aliments de base, médicaments.',
      rate: '16% (standard) | 8% (border regions) | 0% (exports, food, medicines)',
      required: true,
    },
    {
      name: 'Import Duties',
      nameFr: 'Droits d\'importation',
      description: 'MFN rates 0-35%. Most industrial inputs, machinery, IT goods enter duty-free. Duty calculated on CIF value. CUSMA: duty-free for qualifying goods.',
      descriptionFr: 'Taux NPF 0-35%. La plupart des intrants industriels, machines, produits TI entrent en franchise.',
      rate: '0-35% MFN | 0% CUSMA',
      required: true,
    },
    {
      name: 'CUSMA Courier Flat Rate',
      nameFr: 'Taux forfaitaire courrier ACEUM',
      description: 'For CUSMA courier shipments FOB $50-117 USD: flat combined duty+tax rate of 17%. Over $117: normal duties/taxes.',
      descriptionFr: 'Pour envois courrier ACEUM FOB 50-117 USD: taux forfaitaire combiné 17%. Plus de 117$: droits/taxes normaux.',
      rate: '17% flat (FOB $50-117 USD)',
      threshold: '$117 USD',
      required: false,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'SAT Registration',
      nameFr: 'Inscription SAT',
      description: 'Mexican Tax Administration Service (SAT) manages import/export procedures.',
      descriptionFr: 'Le Service d\'administration fiscale du Mexique gère les procédures d\'import/export.',
      authority: 'SAT (Servicio de Administración Tributaria)',
      url: 'https://www.sat.gob.mx/',
      required: true,
    },
    {
      name: 'COFEPRIS Health Products',
      nameFr: 'Produits santé COFEPRIS',
      description: 'Federal Commission for Protection against Sanitary Risks regulates health products, supplements, pharmaceuticals.',
      descriptionFr: 'La Commission fédérale de protection contre les risques sanitaires réglemente les produits de santé.',
      authority: 'COFEPRIS',
      url: 'https://www.gob.mx/cofepris',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'mx-cusma-origin',
      name: 'CUSMA Origin Documentation',
      nameFr: 'Documentation origine ACEUM',
      description: 'Maintain certificates of origin. Not required for shipments under CAD $3,300.',
      descriptionFr: 'Maintenir les certificats d\'origine. Non requis pour envois < 3 300 $ CAD.',
      dueDate: 'Ongoing',
      frequency: 'annually',
    },
  ],
  
  notes: [
    'CUSMA provides duty-free access for most Canadian goods',
    'CPTPP also applies - choose most favorable treatment',
    'IVA standard rate 16%, NO registration threshold',
    'Border regions benefit from reduced 8% IVA rate',
    'Courier flat rate 17% for CUSMA shipments FOB $50-117 USD',
    'Certificate of origin NOT required for shipments under CAD $3,300',
    'IVA calculated on CIF value + duty + shipping + insurance',
  ],
  notesFr: [
    'L\'ACEUM offre accès en franchise pour la plupart des biens canadiens',
    'Le PTPGP s\'applique aussi - choisir traitement le plus favorable',
    'Taux IVA standard 16%, PAS de seuil d\'inscription',
    'Régions frontalières bénéficient du taux réduit 8%',
    'Certificat d\'origine NON requis pour envois < 3 300 $ CAD',
  ],
  
  shippingDays: '7-14',
  shippingCost: 35,
  localCurrency: 'MXN',
  localCurrencySymbol: '$',
  deMinimisThreshold: '$50 USD',
  
  resources: [
    { name: 'CUSMA Info', url: 'https://www.cbsa-asfc.gc.ca/services/cusma-aceum/', description: 'CUSMA requirements' },
    { name: 'SAT Mexico', url: 'https://www.sat.gob.mx/', description: 'Mexican tax authority' },
    { name: 'COFEPRIS', url: 'https://www.gob.mx/cofepris', description: 'Health products regulation' },
  ],
};

// =====================================================
// UNITED ARAB EMIRATES
// =====================================================
export const UAE_COMPLIANCE: CountryCompliance = {
  code: 'AE',
  name: 'United Arab Emirates',
  nameFr: 'Émirats arabes unis',
  region: 'Middle East',
  regionFr: 'Moyen-Orient',
  hasFTA: false,
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    certificateOfOrigin: true,
    certificateOfOriginForm: 'Standard Certificate of Origin',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'UAE VAT',
      nameFr: 'TVA EAU',
      description: 'Standard rate 5% since January 2018. MANDATORY registration if taxable supplies in UAE exceed AED 375,000. Voluntary at AED 187,500+.',
      descriptionFr: 'Taux standard 5% depuis janvier 2018. Inscription OBLIGATOIRE si fournitures taxables > 375 000 AED.',
      rate: '5%',
      threshold: 'AED 375,000 (mandatory) | AED 187,500 (voluntary)',
      frequency: 'quarterly',
      required: true,
      url: 'https://tax.gov.ae/en/default.aspx',
    },
    {
      name: 'Import Duties',
      nameFr: 'Droits d\'importation',
      description: 'Standard rate 5% on most goods. Exemptions for food and medicines. No FTA with Canada - standard tariffs apply.',
      descriptionFr: 'Taux standard 5% sur la plupart des biens. Exemptions pour alimentation et médicaments.',
      rate: '5%',
      required: true,
    },
    {
      name: 'Electronic Marketplace Rules (April 2025)',
      nameFr: 'Règles places de marché électroniques (avril 2025)',
      description: 'Since April 2025: Platforms responsible for VAT collection on behalf of unregistered resident suppliers.',
      descriptionFr: 'Depuis avril 2025: Plateformes responsables de la perception TVA pour fournisseurs résidents non inscrits.',
      required: true,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'FTA Registration',
      nameFr: 'Inscription FTA',
      description: 'Federal Tax Authority handles all VAT registration and compliance.',
      descriptionFr: 'L\'Autorité fiscale fédérale gère toutes les inscriptions TVA et la conformité.',
      authority: 'Federal Tax Authority (FTA)',
      url: 'https://tax.gov.ae/',
      required: true,
    },
    {
      name: 'Dubai Municipality Requirements',
      nameFr: 'Exigences Municipalité de Dubai',
      description: 'Health and safety products may require Dubai Municipality approval for import.',
      descriptionFr: 'Les produits de santé et sécurité peuvent nécessiter l\'approbation de la Municipalité de Dubai.',
      authority: 'Dubai Municipality',
      required: false,
    },
  ],
  
  annualTasks: [
    {
      id: 'ae-vat-quarterly',
      name: 'UAE VAT Return',
      nameFr: 'Déclaration TVA EAU',
      description: 'File VAT return with FTA. Final deadline January 28, 2026 for current period.',
      descriptionFr: 'Produire la déclaration TVA auprès de la FTA. Échéance finale 28 janvier 2026.',
      dueDate: 'Quarterly (28th of following month)',
      frequency: 'quarterly',
    },
    {
      id: 'ae-threshold-review',
      name: 'VAT Threshold Review',
      nameFr: 'Révision seuil TVA',
      description: 'Review if sales exceed AED 375,000 threshold for mandatory VAT registration.',
      descriptionFr: 'Vérifier si les ventes dépassent le seuil de 375 000 AED.',
      dueDate: 'December 31',
      frequency: 'annually',
    },
  ],
  
  notes: [
    'VAT 5% since January 2018 - one of lowest rates globally',
    'NO FTA with Canada - standard tariffs apply',
    'UAE is gateway to GCC markets',
    'Strong demand for Canadian agricultural products, pharmaceuticals',
    'Consider Dubai as logistics hub for Middle East distribution',
    'April 2025: New electronic marketplace VAT collection rules',
    'Minimum VAT refund threshold increased to SAR 5,000 (from SAR 1,000)',
  ],
  notesFr: [
    'TVA 5% depuis janvier 2018 - un des taux les plus bas au monde',
    'PAS d\'ALE avec le Canada - tarifs standards s\'appliquent',
    'Les EAU sont la porte d\'entrée vers les marchés du CCG',
    'Forte demande pour produits agricoles canadiens, pharmaceutiques',
    'Considérer Dubai comme hub logistique pour distribution Moyen-Orient',
  ],
  
  shippingDays: '10-20',
  shippingCost: 60,
  localCurrency: 'AED',
  localCurrencySymbol: 'د.إ',
  
  resources: [
    { name: 'UAE FTA', url: 'https://tax.gov.ae/', description: 'Federal Tax Authority' },
    { name: 'UAE VAT Guide', url: 'https://tax.gov.ae/en/taxes/Vat/vat.topics/registration.for.vat.aspx', description: 'VAT registration information' },
  ],
};

// =====================================================
// SAUDI ARABIA
// =====================================================
export const SAUDI_COMPLIANCE: CountryCompliance = {
  code: 'SA',
  name: 'Saudi Arabia',
  nameFr: 'Arabie saoudite',
  region: 'Middle East',
  regionFr: 'Moyen-Orient',
  hasFTA: false,
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    certificateOfOrigin: true,
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'Saudi Arabia VAT',
      nameFr: 'TVA Arabie saoudite',
      description: 'Standard rate 15% since July 2020 (was 5%). Applies to most goods at point of entry. Zero-rated: exports, international transport, gold 99%+, essential food, medical equipment.',
      descriptionFr: 'Taux standard 15% depuis juillet 2020 (était 5%). S\'applique à la plupart des biens à l\'entrée.',
      rate: '15%',
      required: true,
    },
    {
      name: 'April 2025 VAT Amendments',
      nameFr: 'Amendements TVA avril 2025',
      description: 'New rules: Electronic marketplaces responsible for VAT collection for unregistered suppliers. VAT grouping criteria updated. Foreign VAT refund minimum increased to SAR 5,000.',
      descriptionFr: 'Nouvelles règles: Places de marché électroniques responsables de la perception TVA.',
      required: true,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'ZATCA Registration',
      nameFr: 'Inscription ZATCA',
      description: 'Zakat, Tax and Customs Authority handles all tax and customs matters.',
      descriptionFr: 'L\'Autorité du Zakat, des Taxes et des Douanes gère toutes les questions fiscales et douanières.',
      authority: 'ZATCA',
      url: 'https://zatca.gov.sa/',
      required: true,
    },
    {
      name: 'SFDA Health Products',
      nameFr: 'Produits santé SFDA',
      description: 'Saudi Food and Drug Authority regulates pharmaceuticals, medical devices, food products.',
      descriptionFr: 'L\'Autorité saoudienne des aliments et médicaments réglemente les produits pharmaceutiques.',
      authority: 'SFDA',
      url: 'https://www.sfda.gov.sa/',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'sa-vat-return',
      name: 'Saudi VAT Return',
      nameFr: 'Déclaration TVA Arabie saoudite',
      description: 'File VAT return with ZATCA. Can now be submitted monthly, quarterly, or yearly.',
      descriptionFr: 'Produire la déclaration TVA auprès de ZATCA. Peut maintenant être mensuelle, trimestrielle ou annuelle.',
      dueDate: 'Varies by election',
      frequency: 'quarterly',
    },
  ],
  
  notes: [
    'VAT rate 15% since July 2020 - TRIPLED from original 5%',
    'No FTA with Canada - standard tariffs apply',
    'April 2025: Major VAT amendments effective April 18, 2025',
    'Electronic marketplace rules: platforms responsible for VAT collection',
    'Foreign VAT refund minimum now SAR 5,000 (was SAR 1,000)',
    'Zero-rated: exports outside GCC, gold 99%+, essential food, medical equipment',
    'Strong market for Canadian military equipment, vehicles, pharmaceuticals',
  ],
  notesFr: [
    'Taux TVA 15% depuis juillet 2020 - TRIPLÉ par rapport aux 5% originaux',
    'Pas d\'ALE avec le Canada - tarifs standards s\'appliquent',
    'Avril 2025: Amendements TVA majeurs en vigueur 18 avril 2025',
    'Minimum remboursement TVA étrangère maintenant 5 000 SAR',
  ],
  
  shippingDays: '10-20',
  shippingCost: 60,
  localCurrency: 'SAR',
  localCurrencySymbol: '﷼',
  
  resources: [
    { name: 'ZATCA', url: 'https://zatca.gov.sa/', description: 'Saudi tax and customs authority' },
    { name: 'SFDA', url: 'https://www.sfda.gov.sa/', description: 'Food and drug authority' },
  ],
};

// =====================================================
// ISRAEL
// =====================================================
export const ISRAEL_COMPLIANCE: CountryCompliance = {
  code: 'IL',
  name: 'Israel',
  nameFr: 'Israël',
  region: 'Middle East',
  regionFr: 'Moyen-Orient',
  hasFTA: true,
  ftaName: 'CIFTA (Canada-Israel FTA)',
  ftaDetails: 'Initiated 1997, modernized September 1, 2019. Provides preferential tariffs on agricultural, agro-food, and fishery products.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    certificateOfOrigin: true,
    certificateOfOriginForm: 'CIFTA Certificate of Origin - Can be in English, French, Hebrew, or Arabic',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'Israeli VAT (Ma\'am)',
      nameFr: 'TVA israélienne (Ma\'am)',
      description: 'Standard rate 18%. Consumer typically pays at import. Tax treaty exists with Canada to avoid double taxation.',
      descriptionFr: 'Taux standard 18%. Le consommateur paie généralement à l\'importation. Convention fiscale avec le Canada.',
      rate: '18%',
      required: false,
    },
    {
      name: 'CIFTA Preferential Tariffs',
      nameFr: 'Tarifs préférentiels ALEIC',
      description: 'Certificate of origin required for reduced/eliminated tariffs. Goods under $3,300 exempt from certificate requirement.',
      descriptionFr: 'Certificat d\'origine requis pour tarifs réduits/éliminés. Biens < 3 300 $ exemptés du certificat.',
      threshold: '$3,300 (certificate exemption)',
      required: true,
    },
    {
      name: 'Trans-shipment Rules',
      nameFr: 'Règles de transbordement',
      description: 'Goods shipped through non-party territories (including US) remain eligible if under customs control. Minor processing in US, EU/EFTA, Jordan, Mexico allowed with Form E669.',
      descriptionFr: 'Biens expédiés via territoires tiers restent admissibles si sous contrôle douanier.',
      required: true,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'Israel Tax Authority',
      nameFr: 'Administration fiscale israélienne',
      description: 'Handles customs and VAT matters.',
      descriptionFr: 'Gère les questions douanières et de TVA.',
      authority: 'Israel Tax Authority',
      url: 'https://www.gov.il/en/departments/israel_tax_authority',
      required: true,
    },
    {
      name: 'Ministry of Health',
      nameFr: 'Ministère de la Santé',
      description: 'Regulates health products, pharmaceuticals, medical devices.',
      descriptionFr: 'Réglemente les produits de santé, pharmaceutiques, dispositifs médicaux.',
      authority: 'Israel Ministry of Health',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'il-cifta-docs',
      name: 'CIFTA Documentation Review',
      nameFr: 'Révision documentation ALEIC',
      description: 'Ensure certificates of origin properly maintained. Declaration of Minor Processing (Form E669) if applicable.',
      descriptionFr: 'S\'assurer que les certificats d\'origine sont correctement maintenus.',
      dueDate: 'Quarterly',
      frequency: 'quarterly',
    },
  ],
  
  notes: [
    'CIFTA (since 1997, modernized 2019) provides preferential tariff treatment',
    'VAT rate is 18% - consumer pays at import',
    'Tax treaty exists to avoid double taxation between Canada and Israel',
    'Strong tech and pharmaceutical market',
    'Goods under $3,300 exempt from certificate of origin requirement',
    'Certificate can be in English, French, Hebrew, or Arabic',
    'Trans-shipment through US allowed if goods remain under customs control',
  ],
  notesFr: [
    'L\'ALEIC (depuis 1997, modernisé 2019) offre un traitement tarifaire préférentiel',
    'Taux de TVA de 18% - le consommateur paie à l\'importation',
    'Convention fiscale pour éviter la double imposition entre Canada et Israël',
    'Fort marché technologique et pharmaceutique',
    'Biens < 3 300 $ exemptés de certificat d\'origine',
  ],
  
  shippingDays: '10-20',
  shippingCost: 60,
  localCurrency: 'ILS',
  localCurrencySymbol: '₪',
  deMinimisThreshold: '$75 USD (informal)',
  
  resources: [
    { name: 'CIFTA Information', url: 'https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/agr-acc/israel/fta-ale/', description: 'Canada-Israel FTA details' },
    { name: 'Israel Tax Authority', url: 'https://www.gov.il/en/departments/israel_tax_authority', description: 'Israeli tax information' },
  ],
};

// =====================================================
// CHILE
// =====================================================
export const CHILE_COMPLIANCE: CountryCompliance = {
  code: 'CL',
  name: 'Chile',
  nameFr: 'Chili',
  region: 'South America',
  regionFr: 'Amérique du Sud',
  hasFTA: true,
  ftaName: 'CCFTA + CPTPP',
  ftaDetails: 'Canada-Chile FTA (CCFTA) since 1997 - Canada\'s FIRST FTA in Latin America. Also covered by CPTPP (2023). Most goods enter duty-free.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    certificateOfOrigin: true,
    certificateOfOriginForm: 'Form B240 - CCFTA Certificate of Origin. Can be used for single or multiple shipments over up to 1 year.',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'Chilean IVA',
      nameFr: 'IVA chilienne',
      description: 'Standard rate 19%. Consumer pays at import. Recoverable for businesses.',
      descriptionFr: 'Taux standard 19%. Le consommateur paie à l\'importation. Récupérable pour entreprises.',
      rate: '19%',
      required: false,
    },
    {
      name: 'CCFTA Duty-Free Access',
      nameFr: 'Accès en franchise ALECC',
      description: 'Most Canadian goods enter duty-free with valid certificate of origin (Form B240).',
      descriptionFr: 'La plupart des biens canadiens entrent en franchise avec certificat d\'origine valide.',
      required: true,
    },
    {
      name: 'Rules of Origin Requirements',
      nameFr: 'Exigences règles d\'origine',
      description: 'Goods qualify if: wholly obtained in Canada/Chile, meet tariff classification change in Annex D-01, produced from originating materials, OR meet 35% regional value content (transaction value) or 25% (net cost).',
      descriptionFr: 'Biens admissibles si: entièrement obtenus au Canada/Chili, satisfont changement de classification, ou satisfont 35% contenu de valeur régionale.',
      required: true,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'Chilean Customs (SNA)',
      nameFr: 'Douanes chiliennes (SNA)',
      description: 'Servicio Nacional de Aduanas handles import procedures.',
      descriptionFr: 'Le Service national des douanes gère les procédures d\'importation.',
      authority: 'Servicio Nacional de Aduanas',
      url: 'https://www.aduana.cl/',
      required: true,
    },
    {
      name: 'ISP Health Products',
      nameFr: 'Produits santé ISP',
      description: 'Instituto de Salud Pública regulates pharmaceuticals, medical devices, supplements.',
      descriptionFr: 'L\'Institut de santé publique réglemente les produits pharmaceutiques et suppléments.',
      authority: 'ISP Chile',
      url: 'https://www.ispch.cl/',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'cl-ccfta-docs',
      name: 'CCFTA Documentation Review',
      nameFr: 'Révision documentation ALECC',
      description: 'Maintain Form B240 certificates of origin. Blanket certificates valid for 1 year.',
      descriptionFr: 'Maintenir les certificats d\'origine Formulaire B240. Certificats généraux valides 1 an.',
      dueDate: 'Quarterly',
      frequency: 'quarterly',
    },
  ],
  
  notes: [
    'CCFTA (1997) was Canada\'s FIRST FTA in Latin America',
    'Also covered by CPTPP since 2023 - choose most favorable treatment',
    'IVA rate is 19%',
    'Form B240 can cover multiple shipments for up to 1 year (blanket certificate)',
    'Regional value content: 35% (transaction value) or 25% (net cost method)',
    'Strong market for Canadian agricultural, mining equipment, technology',
  ],
  notesFr: [
    'L\'ALECC (1997) était le PREMIER ALE du Canada en Amérique latine',
    'Aussi couvert par le PTPGP depuis 2023 - choisir traitement le plus favorable',
    'Taux d\'IVA de 19%',
    'Formulaire B240 peut couvrir plusieurs envois jusqu\'à 1 an (certificat général)',
  ],
  
  shippingDays: '10-20',
  shippingCost: 45,
  localCurrency: 'CLP',
  localCurrencySymbol: '$',
  deMinimisThreshold: '$30 USD',
  
  resources: [
    { name: 'CCFTA Information', url: 'https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/agr-acc/chile-chili/', description: 'Canada-Chile FTA details' },
    { name: 'Form B240', url: 'https://www.cbsa-asfc.gc.ca/publications/forms-formulaires/b240-eng.html', description: 'CCFTA Certificate of Origin form' },
    { name: 'Chilean Customs', url: 'https://www.aduana.cl/', description: 'Chilean customs authority' },
  ],
};

// =====================================================
// PERU
// =====================================================
export const PERU_COMPLIANCE: CountryCompliance = {
  code: 'PE',
  name: 'Peru',
  nameFr: 'Pérou',
  region: 'South America',
  regionFr: 'Amérique du Sud',
  hasFTA: true,
  ftaName: 'CPFTA + CPTPP',
  ftaDetails: 'Canada-Peru FTA (CPFTA) since August 1, 2009. Also covered by CPTPP (September 2021). Canadian goods NOT subject to import duties with certificate of origin.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    certificateOfOrigin: true,
    certificateOfOriginForm: 'CPFTA Certificate of Origin or CPTPP Certification of Origin',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'Peruvian IGV',
      nameFr: 'IGV péruvienne',
      description: 'Impuesto General a las Ventas - Standard rate 18% (16% IGV + 2% municipal tax). Consumer pays at import.',
      descriptionFr: 'Impuesto General a las Ventas - Taux standard 18% (16% IGV + 2% taxe municipale).',
      rate: '18% (16% + 2%)',
      required: false,
    },
    {
      name: 'CPFTA Duty-Free Access',
      nameFr: 'Accès en franchise ALECP',
      description: 'Canadian goods NOT subject to import duties with valid certificate of origin. BEST market access in South America.',
      descriptionFr: 'Biens canadiens NON soumis aux droits d\'importation avec certificat d\'origine valide. MEILLEUR accès en Amérique du Sud.',
      required: true,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'SUNAT',
      nameFr: 'SUNAT',
      description: 'Superintendencia Nacional de Aduanas y de Administración Tributaria handles customs and tax.',
      descriptionFr: 'La Surintendance nationale des douanes et de l\'administration fiscale gère les douanes et taxes.',
      authority: 'SUNAT',
      url: 'https://www.sunat.gob.pe/',
      required: true,
    },
    {
      name: 'DIGEMID Health Products',
      nameFr: 'Produits santé DIGEMID',
      description: 'Dirección General de Medicamentos, Insumos y Drogas regulates pharmaceuticals and health products.',
      descriptionFr: 'La Direction générale des médicaments réglemente les produits pharmaceutiques et de santé.',
      authority: 'DIGEMID',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'pe-cpfta-docs',
      name: 'CPFTA Documentation Review',
      nameFr: 'Révision documentation ALECP',
      description: 'Maintain certificates of origin for duty-free treatment.',
      descriptionFr: 'Maintenir les certificats d\'origine pour traitement en franchise.',
      dueDate: 'Quarterly',
      frequency: 'quarterly',
    },
  ],
  
  notes: [
    'CPFTA (since 2009) provides DUTY-FREE access for Canadian goods - BEST access in South America',
    'Also covered by CPTPP since September 2021',
    'IGV rate is 18% (16% + 2% municipal)',
    'Excellent market access for Canadian exporters',
    'Certificate of origin required for preferential treatment',
    'Strong market for Canadian mining equipment, technology, agriculture',
  ],
  notesFr: [
    'L\'ALECP (depuis 2009) offre accès EN FRANCHISE pour biens canadiens - MEILLEUR accès en Amérique du Sud',
    'Aussi couvert par le PTPGP depuis septembre 2021',
    'Taux d\'IGV de 18% (16% + 2% municipal)',
    'Excellent accès au marché pour exportateurs canadiens',
  ],
  
  shippingDays: '10-20',
  shippingCost: 45,
  localCurrency: 'PEN',
  localCurrencySymbol: 'S/',
  deMinimisThreshold: '$200 USD',
  
  resources: [
    { name: 'CPFTA Information', url: 'https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/agr-acc/peru-perou/', description: 'Canada-Peru FTA details' },
    { name: 'SUNAT', url: 'https://www.sunat.gob.pe/', description: 'Peruvian customs and tax authority' },
  ],
};

// =====================================================
// COLOMBIA
// =====================================================
export const COLOMBIA_COMPLIANCE: CountryCompliance = {
  code: 'CO',
  name: 'Colombia',
  nameFr: 'Colombie',
  region: 'South America',
  regionFr: 'Amérique du Sud',
  hasFTA: true,
  ftaName: 'CCoFTA',
  ftaDetails: 'Canada-Colombia FTA (CCoFTA) since August 15, 2011. Progressive tariff elimination.',
  
  canadianObligations: {
    zeroRated: true,
    cersRequired: true,
    cersThreshold: 2000,
    certificateOfOrigin: true,
    certificateOfOriginForm: 'Form BSF459 - CCoFTA Certificate of Origin',
    exportPermit: false,
  },
  
  destinationObligations: [
    {
      name: 'Colombian IVA',
      nameFr: 'IVA colombienne',
      description: 'Standard rate 19%. Reduced rate 5% for essential items (agricultural machinery, bicycles, health products). Imports subject to 19% IVA at customs, recoverable for businesses.',
      descriptionFr: 'Taux standard 19%. Taux réduit 5% pour articles essentiels. Importations soumises à 19% IVA.',
      rate: '19% (standard) | 5% (reduced) | 0% (exports)',
      required: true,
    },
    {
      name: 'CCoFTA Preferential Tariffs',
      nameFr: 'Tarifs préférentiels ALEC-CO',
      description: 'Certificate of origin (Form BSF459) required for preferential treatment. 55% value test - non-originating materials cannot exceed 55% of transaction value.',
      descriptionFr: 'Certificat d\'origine requis pour traitement préférentiel. Test de valeur 55%.',
      required: true,
    },
  ],
  
  regulatoryRequirements: [
    {
      name: 'DIAN',
      nameFr: 'DIAN',
      description: 'Dirección de Impuestos y Aduanas Nacionales handles customs, tax, and VAT.',
      descriptionFr: 'La Direction des impôts et douanes nationales gère les douanes, taxes et TVA.',
      authority: 'DIAN',
      url: 'https://www.dian.gov.co/',
      required: true,
    },
    {
      name: 'INVIMA Health Products',
      nameFr: 'Produits santé INVIMA',
      description: 'Instituto Nacional de Vigilancia de Medicamentos y Alimentos regulates pharmaceuticals, food, health products.',
      descriptionFr: 'L\'Institut national de surveillance des médicaments et aliments réglemente les produits pharmaceutiques.',
      authority: 'INVIMA',
      url: 'https://www.invima.gov.co/',
      required: true,
    },
  ],
  
  annualTasks: [
    {
      id: 'co-ccofta-docs',
      name: 'CCoFTA Documentation Review',
      nameFr: 'Révision documentation ALEC-CO',
      description: 'Maintain Form BSF459 certificates of origin.',
      descriptionFr: 'Maintenir les certificats d\'origine Formulaire BSF459.',
      dueDate: 'Quarterly',
      frequency: 'quarterly',
    },
  ],
  
  notes: [
    'CCoFTA (since 2011) provides preferential tariff treatment',
    'IVA standard rate 19%, reduced rate 5% for essentials',
    'Certificate of origin (Form BSF459) required',
    '55% value test for rules of origin',
    'Strong market for Canadian mining, energy, technology sectors',
    'DIAN administers all customs and tax matters',
  ],
  notesFr: [
    'L\'ALEC-CO (depuis 2011) offre un traitement tarifaire préférentiel',
    'Taux IVA standard 19%, taux réduit 5% pour essentiels',
    'Certificat d\'origine (Formulaire BSF459) requis',
    'Test de valeur 55% pour règles d\'origine',
  ],
  
  shippingDays: '10-20',
  shippingCost: 45,
  localCurrency: 'COP',
  localCurrencySymbol: '$',
  deMinimisThreshold: '$200 USD',
  
  resources: [
    { name: 'CCoFTA Information', url: 'https://www.international.gc.ca/trade-commerce/trade-agreements-accords-commerciaux/agr-acc/colombia-colombie/', description: 'Canada-Colombia FTA details' },
    { name: 'Form BSF459', url: 'https://www.cbsa-asfc.gc.ca/publications/forms-formulaires/bsf459-eng.html', description: 'CCoFTA Certificate of Origin form' },
    { name: 'DIAN', url: 'https://www.dian.gov.co/', description: 'Colombian customs and tax authority' },
  ],
};

// =====================================================
// ALL COUNTRIES MAP
// =====================================================
export const ALL_COUNTRY_COMPLIANCE: Record<string, CountryCompliance> = {
  CA: CANADA_COMPLIANCE,
  US: USA_COMPLIANCE,
  EU: EU_COMPLIANCE,
  GB: UK_COMPLIANCE,
  JP: JAPAN_COMPLIANCE,
  AU: AUSTRALIA_COMPLIANCE,
  MX: MEXICO_COMPLIANCE,
  AE: UAE_COMPLIANCE,
  SA: SAUDI_COMPLIANCE,
  IL: ISRAEL_COMPLIANCE,
  CL: CHILE_COMPLIANCE,
  PE: PERU_COMPLIANCE,
  CO: COLOMBIA_COMPLIANCE,
};

// Helper functions
export function getCountryCompliance(code: string): CountryCompliance | null {
  return ALL_COUNTRY_COMPLIANCE[code] || null;
}

export function getAllCountriesWithCompliance(): CountryCompliance[] {
  return Object.values(ALL_COUNTRY_COMPLIANCE);
}

export function getCountriesByRegion(region: string): CountryCompliance[] {
  return Object.values(ALL_COUNTRY_COMPLIANCE).filter(c => c.region === region);
}

export function getCountriesWithFTA(): CountryCompliance[] {
  return Object.values(ALL_COUNTRY_COMPLIANCE).filter(c => c.hasFTA);
}

export function getCountriesRequiringCERS(): CountryCompliance[] {
  return Object.values(ALL_COUNTRY_COMPLIANCE).filter(c => c.canadianObligations.cersRequired);
}
