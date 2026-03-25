/**
 * PROVINCIAL DATA — Pan-Canadian Insurance Regulation Reference
 * Complete structured data for all 13 provinces/territories.
 */

// ── Types ──

export type ProvinceCode = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'NT' | 'NU' | 'ON' | 'PE' | 'QC' | 'SK' | 'YT';
export type LegalRegime = 'COMMON_LAW' | 'CIVIL_CODE';
export type AutoInsuranceType = 'PUBLIC' | 'PRIVATE' | 'HYBRID';

export interface ProvinceRegulation {
  code: ProvinceCode;
  name: { en: string; fr: string };
  legalRegime: LegalRegime;
  insuranceRegulator: { name: string; acronym: string; website: string };
  intermediaryRegulator: { name: string; acronym: string; website: string };
  legislation: string[];
  preLicensing: { life: string; general: string };
  continuingEducation: { hours: number; period: string; details: string };
  autoInsurance: { type: AutoInsuranceType; provider?: string; details: string };
  workersComp: { name: string; acronym: string; website: string };
  privacyLaw: string;
  particularities: string[];
}

export interface FederalRegulator {
  name: string;
  acronym: { en: string; fr: string };
  role: string;
  website: string;
  keyLegislation: string[];
}

export interface GovernmentProgram {
  name: { en: string; fr: string };
  acronym: { en: string; fr: string };
  type: 'FEDERAL' | 'PROVINCIAL' | 'JOINT';
  description: string;
  applicableProvinces: ProvinceCode[] | 'ALL';
  website: string;
}

export interface IndustryBody {
  name: { en: string; fr: string };
  acronym: { en: string; fr: string };
  type: 'REGULATOR' | 'SRO' | 'ASSOCIATION' | 'PROTECTION';
  role: string;
  website: string;
}

// ── Province Data ──
// EVERY province must have COMPLETE, ACCURATE data.
// FIX P3: Added metadata for data provenance tracking
export const PROVINCIAL_DATA_VERSION = '2026-03-24';
export const PROVINCIAL_DATA_SOURCE = 'CanLII, provincial regulator websites, CCIR harmonization reports';

export const PROVINCES: ProvinceRegulation[] = [
  // ALBERTA
  {
    code: 'AB',
    name: { en: 'Alberta', fr: 'Alberta' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Alberta Superintendent of Insurance', acronym: 'ASI', website: 'https://www.alberta.ca/superintendent-of-insurance' },
    intermediaryRegulator: { name: 'Alberta Insurance Council', acronym: 'AIC', website: 'https://www.abcouncil.ab.ca' },
    legislation: [
      'Insurance Act (Alberta)',
      'Fair Practices Regulation (Alberta)',
      'Automobile Insurance Premiums Regulation',
      'Minor Injury Regulation',
      'Unfair Practices Regulation',
      'Accident Insurance Benefits Regulation',
      'Personal Information Protection Act (PIPA Alberta)',
      'Employment Pension Plans Act',
    ],
    preLicensing: { life: 'Life licence qualification program (LLQP) + provincial exam', general: 'General insurance essentials (GIE) + provincial exam' },
    continuingEducation: { hours: 15, period: 'annual', details: '15 CE credits per year, minimum 3 in ethics' },
    autoInsurance: { type: 'PRIVATE', details: 'Private competitive market with government rate caps' },
    workersComp: { name: 'Workers\' Compensation Board - Alberta', acronym: 'WCB-AB', website: 'https://www.wcb.ab.ca' },
    privacyLaw: 'Personal Information Protection Act (PIPA Alberta)',
    particularities: [
      'Rate cap on auto insurance premiums',
      'Direct compensation for property damage since 2020',
      'Minor Injury Regulation caps soft tissue claims',
      'No-fault accident benefits (Section B)',
    ],
  },
  // BRITISH COLUMBIA
  {
    code: 'BC',
    name: { en: 'British Columbia', fr: 'Colombie-Britannique' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'BC Financial Services Authority', acronym: 'BCFSA', website: 'https://www.bcfsa.ca' },
    intermediaryRegulator: { name: 'Insurance Council of British Columbia', acronym: 'ICBC-Council', website: 'https://www.insurancecouncilofbc.com' },
    legislation: [
      'Financial Institutions Act (BC)',
      'Insurance Act (BC)',
      'Insurance (Vehicle) Act',
      'Insurance (Motor Vehicle) Act Regulations',
      'Insurance Council of British Columbia Act',
      'Personal Information Protection Act (PIPA BC)',
      'Pension Benefits Standards Act (BC)',
      'Wills, Estates and Succession Act (WESA)',
    ],
    preLicensing: { life: 'LLQP + provincial exam', general: 'Level 1, 2, or 3 general insurance licensing' },
    continuingEducation: { hours: 15, period: 'biennial', details: '15 CE credits per 2-year licensing period' },
    autoInsurance: { type: 'PUBLIC', provider: 'ICBC (Insurance Corporation of British Columbia)', details: 'Enhanced Care coverage (no-fault since May 2021), mandatory basic through ICBC, optional through private' },
    workersComp: { name: 'WorkSafeBC', acronym: 'WSBC', website: 'https://www.worksafebc.com' },
    privacyLaw: 'Personal Information Protection Act (PIPA BC)',
    particularities: [
      'ICBC provides mandatory basic auto insurance (public monopoly)',
      'Enhanced Care model (no-fault) since May 1, 2021',
      'Optional/excess auto coverage available from private insurers',
      'Separate licensing levels for general insurance (1, 2, 3)',
      'Travel insurance requires separate authorization',
    ],
  },
  // MANITOBA
  {
    code: 'MB',
    name: { en: 'Manitoba', fr: 'Manitoba' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Manitoba Financial Services Agency', acronym: 'MFSA', website: 'https://www.mfsa.ca' },
    intermediaryRegulator: { name: 'Insurance Council of Manitoba', acronym: 'ICM', website: 'https://www.icm.mb.ca' },
    legislation: [
      'The Insurance Act (Manitoba)',
      'The Insurance Agents and Adjusters Regulation',
      'Manitoba Public Insurance Corporation Act',
      'Personal Injury Protection Plan (PIPP) Regulation',
      'Pension Benefits Act (Manitoba)',
      'The Workers Compensation Act (Manitoba)',
      'The Powers of Attorney Act (Manitoba)',
    ],
    preLicensing: { life: 'LLQP + provincial exam', general: 'General insurance exam through ICM' },
    continuingEducation: { hours: 30, period: 'biennial', details: '30 CE credits per 2-year cycle' },
    autoInsurance: { type: 'PUBLIC', provider: 'Manitoba Public Insurance (MPI)', details: 'Autopac: mandatory basic coverage through MPI, extension products available' },
    workersComp: { name: 'Workers Compensation Board of Manitoba', acronym: 'WCB-MB', website: 'https://www.wcb.mb.ca' },
    privacyLaw: 'PIPEDA (federal) applies — no provincial equivalent',
    particularities: [
      'MPI (Autopac) provides mandatory basic auto insurance',
      'Personal Injury Protection Plan (PIPP) — no-fault for auto injuries',
      'Extension auto coverage available from MPI (not private)',
      'Hail insurance available through MPI',
    ],
  },
  // NEW BRUNSWICK
  {
    code: 'NB',
    name: { en: 'New Brunswick', fr: 'Nouveau-Brunswick' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Financial and Consumer Services Commission', acronym: 'FCNB', website: 'https://www.fcnb.ca' },
    intermediaryRegulator: { name: 'Financial and Consumer Services Commission', acronym: 'FCNB', website: 'https://www.fcnb.ca' },
    legislation: [
      'Insurance Act (New Brunswick)',
      'Insurance Intermediaries Act (NB)',
      'Automobile Insurance Compensation Act (NB)',
      'Service New Brunswick Act',
      'Pension Benefits Act (NB)',
      'Wills Act (NB)',
      'Family Services Act (NB)',
    ],
    preLicensing: { life: 'LLQP + provincial exam', general: 'General insurance licensing program + exam' },
    continuingEducation: { hours: 15, period: 'annual', details: '15 CE credits per year' },
    autoInsurance: { type: 'PRIVATE', details: 'Private competitive market, minor injury cap reform' },
    workersComp: { name: 'WorkSafeNB', acronym: 'WSNB', website: 'https://www.worksafenb.ca' },
    privacyLaw: 'PIPEDA (federal) applies',
    particularities: [
      'Bilingual province (English and French official languages)',
      'Minor injury definition reform in auto insurance',
      'Section D tort coverage available',
      'FCNB regulates both insurance and securities',
    ],
  },
  // NEWFOUNDLAND AND LABRADOR
  {
    code: 'NL',
    name: { en: 'Newfoundland and Labrador', fr: 'Terre-Neuve-et-Labrador' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-NL', website: 'https://www.gov.nl.ca/dgsnl' },
    intermediaryRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-NL', website: 'https://www.gov.nl.ca/dgsnl' },
    legislation: [
      'Insurance Companies Act (NL)',
      'Insurance Contracts Act (NL)',
      'Automobile Insurance Act (NL)',
      'Accident and Sickness Insurance Act (NL)',
      'Pension Benefits Act (NL)',
      'Workplace Health, Safety and Compensation Act (NL)',
    ],
    preLicensing: { life: 'LLQP + provincial exam', general: 'General insurance licensing program + exam' },
    continuingEducation: { hours: 15, period: 'annual', details: '15 CE credits per year' },
    autoInsurance: { type: 'PRIVATE', details: 'Private market, no-fault accident benefits (Section B)' },
    workersComp: { name: 'WorkplaceNL', acronym: 'WNL', website: 'https://workplacenl.ca' },
    privacyLaw: 'PIPEDA (federal) applies',
    particularities: [
      'Small market, limited insurer competition',
      'Public Utilities Board reviews auto rate filings',
      'Cap on minor injuries in auto claims',
    ],
  },
  // NOVA SCOTIA
  {
    code: 'NS',
    name: { en: 'Nova Scotia', fr: 'Nouvelle-Ecosse' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-NS', website: 'https://www.novascotia.ca/finance/en/home/insurance.aspx' },
    intermediaryRegulator: { name: 'Insurance Council of Nova Scotia', acronym: 'ICNS', website: 'https://www.icns.ca' },
    legislation: [
      'Insurance Act (Nova Scotia)',
      'Insurance Agents and Brokers Licensing Regulations',
      'Minor Injury Cap Regulations (NS)',
      'Pension Benefits Act (NS)',
      'Workers\' Compensation Act (NS)',
      'Wills Act (NS)',
      'Testators\' Family Maintenance Act (NS)',
    ],
    preLicensing: { life: 'LLQP + provincial exam', general: 'General insurance qualifications + exam' },
    continuingEducation: { hours: 15, period: 'annual', details: '15 CE credits per year' },
    autoInsurance: { type: 'PRIVATE', details: 'Private market, Nova Scotia Utility and Review Board reviews rates' },
    workersComp: { name: 'Workers\' Compensation Board of Nova Scotia', acronym: 'WCB-NS', website: 'https://www.wcb.ns.ca' },
    privacyLaw: 'PIPEDA (federal) applies',
    particularities: [
      'Nova Scotia Utility and Review Board (NSUARB) approves auto rates',
      'Cap on non-pecuniary damages for minor injuries',
      'Diagnostic and Treatment Protocols for auto injuries',
    ],
  },
  // NORTHWEST TERRITORIES
  {
    code: 'NT',
    name: { en: 'Northwest Territories', fr: 'Territoires du Nord-Ouest' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-NT', website: 'https://www.fin.gov.nt.ca' },
    intermediaryRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-NT', website: 'https://www.fin.gov.nt.ca' },
    legislation: [
      'Insurance Act (NWT)',
      'Workers\' Compensation Act (NWT & NU)',
      'Pension Benefits Standards Regulations (NWT)',
    ],
    preLicensing: { life: 'LLQP or equivalent recognized program', general: 'General insurance licensing or equivalent' },
    continuingEducation: { hours: 0, period: 'N/A', details: 'No mandatory CE requirements currently' },
    autoInsurance: { type: 'PRIVATE', details: 'Private market, limited competition due to small population' },
    workersComp: { name: 'Workers\' Safety and Compensation Commission', acronym: 'WSCC', website: 'https://www.wscc.nt.ca' },
    privacyLaw: 'PIPEDA (federal) applies',
    particularities: [
      'Very small market — few local insurers',
      'WSCC shared with Nunavut',
      'Extreme climate considerations for property insurance',
    ],
  },
  // NUNAVUT
  {
    code: 'NU',
    name: { en: 'Nunavut', fr: 'Nunavut' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-NU', website: 'https://www.gov.nu.ca' },
    intermediaryRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-NU', website: 'https://www.gov.nu.ca' },
    legislation: [
      'Insurance Act (Nunavut)',
      'Workers\' Compensation Act (NWT & NU)',
    ],
    preLicensing: { life: 'LLQP or equivalent recognized program', general: 'General insurance licensing or equivalent' },
    continuingEducation: { hours: 0, period: 'N/A', details: 'No mandatory CE requirements currently' },
    autoInsurance: { type: 'PRIVATE', details: 'Private market, very limited availability' },
    workersComp: { name: 'Workers\' Safety and Compensation Commission', acronym: 'WSCC', website: 'https://www.wscc.nt.ca' },
    privacyLaw: 'PIPEDA (federal) applies',
    particularities: [
      'Newest territory (1999), insurance framework inherited from NWT',
      'WSCC shared with Northwest Territories',
      'Very limited local insurance infrastructure',
      'Many residents rely on government-provided benefits',
    ],
  },
  // ONTARIO
  {
    code: 'ON',
    name: { en: 'Ontario', fr: 'Ontario' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Financial Services Regulatory Authority of Ontario', acronym: 'FSRA', website: 'https://www.fsrao.ca' },
    intermediaryRegulator: { name: 'Registered Insurance Brokers of Ontario', acronym: 'RIBO', website: 'https://www.ribo.com' },
    legislation: [
      'Insurance Act (Ontario)',
      'Financial Services Regulatory Authority of Ontario Act',
      'Statutory Accident Benefits Schedule (SABS)',
      'Compulsory Automobile Insurance Act (Ontario)',
      'Registered Insurance Brokers Act (Ontario)',
      'Pension Benefits Act (Ontario)',
      'Workplace Safety and Insurance Act (Ontario)',
      'Succession Law Reform Act (Ontario)',
      'Ontario Human Rights Code (insurance provisions)',
      'Life Insurance Beneficiary Designation Regulations',
    ],
    preLicensing: { life: 'LLQP + Ontario-specific content + provincial exam', general: 'RIBO licensing program (for brokers) or OTL general insurance agent exam' },
    continuingEducation: { hours: 30, period: 'biennial', details: '30 CE credits per 2-year cycle, minimum 3 in management/ethics for brokers (RIBO)' },
    autoInsurance: { type: 'PRIVATE', details: 'Private competitive market, mandatory no-fault statutory accident benefits (SABS)' },
    workersComp: { name: 'Workplace Safety and Insurance Board', acronym: 'WSIB', website: 'https://www.wsib.ca' },
    privacyLaw: 'PIPEDA (federal) applies + Freedom of Information and Protection of Privacy Act (FIPPA)',
    particularities: [
      'Largest insurance market in Canada (~40% of premiums)',
      'FSRA replaced FSCO as regulator in 2019',
      'RIBO separately regulates insurance brokers',
      'Statutory Accident Benefits Schedule (SABS) mandatory no-fault benefits',
      'Dispute Resolution via Licence Appeal Tribunal (LAT)',
      'Auto insurance includes mandatory uninsured motorist coverage',
      'Take-All-Comers rule for auto insurance',
    ],
  },
  // PRINCE EDWARD ISLAND
  {
    code: 'PE',
    name: { en: 'Prince Edward Island', fr: 'Ile-du-Prince-Edouard' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-PE', website: 'https://www.princeedwardisland.ca' },
    intermediaryRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-PE', website: 'https://www.princeedwardisland.ca' },
    legislation: [
      'Insurance Act (PEI)',
      'Insurance Agents, Brokers and Adjusters Regulations (PEI)',
      'Automobile Insurance Contract Regulations (PEI)',
      'Workers Compensation Act (PEI)',
      'Pension Benefits Act (PEI)',
    ],
    preLicensing: { life: 'LLQP + provincial exam', general: 'General insurance licensing program + exam' },
    continuingEducation: { hours: 15, period: 'annual', details: '15 CE credits per year' },
    autoInsurance: { type: 'PRIVATE', details: 'Private market, Island Regulatory and Appeals Commission reviews rates' },
    workersComp: { name: 'Workers Compensation Board of PEI', acronym: 'WCB-PE', website: 'https://www.wcb.pe.ca' },
    privacyLaw: 'PIPEDA (federal) applies',
    particularities: [
      'Smallest province — limited insurance market',
      'IRAC (Island Regulatory and Appeals Commission) reviews auto rates',
      'Minor injury cap on auto claims',
    ],
  },
  // QUEBEC
  {
    code: 'QC',
    name: { en: 'Quebec', fr: 'Quebec' },
    legalRegime: 'CIVIL_CODE',
    insuranceRegulator: { name: 'Autorite des marches financiers', acronym: 'AMF', website: 'https://lautorite.qc.ca' },
    intermediaryRegulator: { name: 'Autorite des marches financiers / Chambre de la securite financiere', acronym: 'AMF/CSF', website: 'https://www.chambresf.com' },
    legislation: [
      'Loi sur la distribution de produits et services financiers (LDPSF)',
      'Loi sur les assureurs du Quebec',
      'Code civil du Quebec (Livre 5 — Obligations, Titre 3 — Assurances)',
      'Code de deontologie de la Chambre de la securite financiere (CDCSF)',
      'Loi sur l\'Autorite des marches financiers',
      'Loi sur l\'assurance automobile du Quebec',
      'Loi sur les accidents du travail et les maladies professionnelles (LATMP)',
      'Loi sur le regime de rentes du Quebec (RRQ)',
      'Loi sur les regimes complementaires de retraite',
      'Loi sur les regimes volontaires d\'epargne-retraite (RVER)',
      'Loi concernant le cadre juridique des technologies de l\'information (Loi 25)',
    ],
    preLicensing: { life: 'Programme de qualification en assurance de personnes (PQAP) — 4 examens AMF: F-111 Deontologie, F-311 Assurance vie, F-312 Acc. maladie, F-313 Fonds distincts', general: 'Programme de qualification en assurance de dommages — examens AMF via CHAD' },
    continuingEducation: { hours: 30, period: 'biennial (UFC)', details: '30 UFC (unites de formation continue) par cycle de 2 ans, dont minimum en conformite et deontologie' },
    autoInsurance: { type: 'HYBRID', provider: 'SAAQ (Societe de l\'assurance automobile du Quebec)', details: 'SAAQ couvre blessures corporelles (no-fault pur). Assureurs prives couvrent dommages materiels et responsabilite civile.' },
    workersComp: { name: 'Commission des normes, de l\'equite, de la sante et de la securite du travail', acronym: 'CNESST', website: 'https://www.cnesst.gouv.qc.ca' },
    privacyLaw: 'Loi sur la protection des renseignements personnels dans le secteur prive (Loi 25) + Loi sur l\'acces aux documents des organismes publics',
    particularities: [
      'SEULE province avec le Code civil (pas common law)',
      'SAAQ couvre les blessures corporelles auto (regime public no-fault pur)',
      'Chambre de la securite financiere (CSF) encadre les representants en assurance de personnes',
      'Chambre de l\'assurance de dommages (CHAD) encadre les representants en dommages',
      'PQAP: 4 examens obligatoires pour l\'assurance de personnes',
      'UFC: formation continue obligatoire (30 heures / 2 ans)',
      'IVAC: Indemnisation des victimes d\'actes criminels',
      'Regime de rentes du Quebec (RRQ) au lieu du CPP federal',
      'RQAP: Regime quebecois d\'assurance parentale (au lieu de l\'AE)',
      'Patrimoine familial et regime matrimonial affectent l\'assurance vie',
      'Insaisissabilite des prestations d\'assurance sous certaines conditions',
      'Loi 25 — obligations strictes de protection des renseignements personnels',
    ],
  },
  // SASKATCHEWAN
  {
    code: 'SK',
    name: { en: 'Saskatchewan', fr: 'Saskatchewan' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Financial and Consumer Affairs Authority of Saskatchewan', acronym: 'FCAA', website: 'https://www.fcaa.gov.sk.ca' },
    intermediaryRegulator: { name: 'General Insurance Council of Saskatchewan / Life Insurance Council of Saskatchewan', acronym: 'GICS/LICS', website: 'https://www.skcouncil.sk.ca' },
    legislation: [
      'The Saskatchewan Insurance Act',
      'The Automobile Accident Insurance Act',
      'The Saskatchewan Government Insurance Act',
      'The Insurance Premiums Tax Act',
      'The Pension Benefits Act (SK)',
      'The Workers\' Compensation Act (SK)',
      'The Wills Act (SK)',
    ],
    preLicensing: { life: 'LLQP + provincial exam', general: 'General insurance licensing through GICS' },
    continuingEducation: { hours: 24, period: 'biennial', details: '24 CE credits per 2-year licensing cycle' },
    autoInsurance: { type: 'PUBLIC', provider: 'Saskatchewan Government Insurance (SGI)', details: 'SGI provides mandatory basic auto (no-fault). Extension coverage available through SGI CANADA (private arm).' },
    workersComp: { name: 'Workers\' Compensation Board of Saskatchewan', acronym: 'WCB-SK', website: 'https://www.wcbsask.com' },
    privacyLaw: 'PIPEDA (federal) applies',
    particularities: [
      'SGI provides mandatory basic auto insurance (public)',
      'SGI CANADA provides extension/optional coverage (Crown corporation)',
      'No-fault Personal Injury Protection Plan (PIPP)',
      'Crop insurance through Saskatchewan Crop Insurance Corporation',
      'Separate Life and General insurance councils',
    ],
  },
  // YUKON
  {
    code: 'YT',
    name: { en: 'Yukon', fr: 'Yukon' },
    legalRegime: 'COMMON_LAW',
    insuranceRegulator: { name: 'Office of the Superintendent of Insurance', acronym: 'OSI-YT', website: 'https://yukon.ca/en/doing-business/licensing/insurance' },
    intermediaryRegulator: { name: 'Insurance Council of Yukon', acronym: 'ICY', website: 'https://yukon.ca' },
    legislation: [
      'Insurance Act (Yukon)',
      'Motor Vehicles Act (Yukon) — insurance provisions',
      'Workers\' Compensation Act (Yukon)',
    ],
    preLicensing: { life: 'LLQP or equivalent recognized program', general: 'General insurance licensing or equivalent' },
    continuingEducation: { hours: 0, period: 'N/A', details: 'No mandatory CE requirements currently' },
    autoInsurance: { type: 'PRIVATE', details: 'Private market, limited competition' },
    workersComp: { name: 'Yukon Workers\' Compensation Health and Safety Board', acronym: 'YWCHSB', website: 'https://wcb.yk.ca' },
    privacyLaw: 'PIPEDA (federal) applies',
    particularities: [
      'Small northern market with limited insurer availability',
      'Climate and remoteness factors affect insurance availability and pricing',
      'Cross-border considerations with BC and Alaska',
    ],
  },
];

// ── Federal Regulators ──

export const FEDERAL_REGULATORS: FederalRegulator[] = [
  {
    name: 'Office of the Superintendent of Financial Institutions',
    acronym: { en: 'OSFI', fr: 'BSIF' },
    role: 'Prudential regulator of federally incorporated insurers, banks, and pension plans. Sets capital adequacy and solvency standards.',
    website: 'https://www.osfi-bsif.gc.ca',
    keyLegislation: ['Insurance Companies Act (federal)', 'Office of the Superintendent of Financial Institutions Act'],
  },
  {
    name: 'Financial Transactions and Reports Analysis Centre of Canada',
    acronym: { en: 'FINTRAC', fr: 'CANAFE' },
    role: 'Anti-money laundering and anti-terrorist financing intelligence unit. Insurance agents and brokers are reporting entities.',
    website: 'https://fintrac-canafe.gc.ca',
    keyLegislation: ['Proceeds of Crime (Money Laundering) and Terrorist Financing Act (PCMLTFA/LRPCFAT)'],
  },
  {
    name: 'Financial Consumer Agency of Canada',
    acronym: { en: 'FCAC', fr: 'ACFC' },
    role: 'Protects consumers of financial products. Oversees market conduct of federally regulated financial institutions.',
    website: 'https://www.canada.ca/en/financial-consumer-agency.html',
    keyLegislation: ['Financial Consumer Agency of Canada Act', 'Bank Act (consumer provisions)'],
  },
  {
    name: 'Canada Deposit Insurance Corporation',
    acronym: { en: 'CDIC', fr: 'SADC' },
    role: 'Protects eligible deposits at member institutions. Not directly insurance-related but part of financial safety net.',
    website: 'https://www.cdic.ca',
    keyLegislation: ['Canada Deposit Insurance Corporation Act'],
  },
  {
    name: 'Canada Revenue Agency',
    acronym: { en: 'CRA', fr: 'ARC' },
    role: 'Tax administration. Key for insurance taxation: exempt/non-exempt policies, RRSP, TFSA, prescribed annuities, disposition rules.',
    website: 'https://www.canada.ca/en/revenue-agency.html',
    keyLegislation: ['Income Tax Act (Canada)', 'Income Tax Regulations'],
  },
  {
    name: 'Office of the Privacy Commissioner of Canada',
    acronym: { en: 'OPC', fr: 'CPVP' },
    role: 'Oversees PIPEDA compliance. Personal information protection relevant to insurance underwriting and claims.',
    website: 'https://www.priv.gc.ca',
    keyLegislation: ['Personal Information Protection and Electronic Documents Act (PIPEDA)'],
  },
];

// ── Government Programs ──

export const GOVERNMENT_PROGRAMS: GovernmentProgram[] = [
  {
    name: { en: 'Canada Pension Plan', fr: 'Regime de pensions du Canada' },
    acronym: { en: 'CPP', fr: 'RPC' },
    type: 'FEDERAL',
    description: 'Mandatory contributory pension plan providing retirement, disability, and survivor benefits. All provinces except Quebec (which has QPP/RRQ).',
    applicableProvinces: ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'SK', 'YT'],
    website: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp.html',
  },
  {
    name: { en: 'Quebec Pension Plan', fr: 'Regime de rentes du Quebec' },
    acronym: { en: 'QPP', fr: 'RRQ' },
    type: 'PROVINCIAL',
    description: 'Quebec\'s equivalent of CPP. Mandatory contributory pension with retirement, disability, and survivor benefits. Managed by Retraite Quebec.',
    applicableProvinces: ['QC'],
    website: 'https://www.retraitequebec.gouv.qc.ca',
  },
  {
    name: { en: 'Old Age Security', fr: 'Securite de la vieillesse' },
    acronym: { en: 'OAS', fr: 'SV' },
    type: 'FEDERAL',
    description: 'Universal pension for Canadians 65+ based on years of residence. Includes Guaranteed Income Supplement (GIS) for low-income seniors.',
    applicableProvinces: 'ALL',
    website: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security.html',
  },
  {
    name: { en: 'Guaranteed Income Supplement', fr: 'Supplement de revenu garanti' },
    acronym: { en: 'GIS', fr: 'SRG' },
    type: 'FEDERAL',
    description: 'Non-taxable monthly payment for low-income OAS pensioners. Means-tested supplement.',
    applicableProvinces: 'ALL',
    website: 'https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/guaranteed-income-supplement.html',
  },
  {
    name: { en: 'Employment Insurance', fr: 'Assurance-emploi' },
    acronym: { en: 'EI', fr: 'AE' },
    type: 'FEDERAL',
    description: 'Federal program providing temporary income support to unemployed workers, maternity/parental benefits, sickness benefits, and compassionate care. Quebec has its own parental insurance (QPIP/RQAP).',
    applicableProvinces: 'ALL',
    website: 'https://www.canada.ca/en/services/benefits/ei.html',
  },
  {
    name: { en: 'Quebec Parental Insurance Plan', fr: 'Regime quebecois d\'assurance parentale' },
    acronym: { en: 'QPIP', fr: 'RQAP' },
    type: 'PROVINCIAL',
    description: 'Quebec\'s own maternity, paternity, parental, and adoption benefits. Replaces EI maternity/parental for Quebec residents. Generally more generous than federal EI.',
    applicableProvinces: ['QC'],
    website: 'https://www.rqap.gouv.qc.ca',
  },
  {
    name: { en: 'Workers\' Compensation (Pan-Canadian)', fr: 'Indemnisation des accidents du travail' },
    acronym: { en: 'WC', fr: 'CNESST/WCB' },
    type: 'JOINT',
    description: 'Each province/territory has its own workers\' compensation board providing no-fault workplace injury and illness coverage. Employers pay premiums; workers receive benefits without suing.',
    applicableProvinces: 'ALL',
    website: 'https://www.awcbc.org',
  },
  {
    name: { en: 'ICBC Auto Insurance', fr: 'Assurance auto ICBC' },
    acronym: { en: 'ICBC', fr: 'ICBC' },
    type: 'PROVINCIAL',
    description: 'British Columbia\'s public auto insurance provider. Enhanced Care (no-fault) since May 2021. Mandatory basic coverage through ICBC, optional excess through private insurers.',
    applicableProvinces: ['BC'],
    website: 'https://www.icbc.com',
  },
  {
    name: { en: 'Saskatchewan Government Insurance', fr: 'Saskatchewan Government Insurance' },
    acronym: { en: 'SGI', fr: 'SGI' },
    type: 'PROVINCIAL',
    description: 'Saskatchewan\'s public auto insurer. Mandatory basic (no-fault PIPP). Extension coverage through SGI CANADA (Crown corp). Also provides licensing and registration.',
    applicableProvinces: ['SK'],
    website: 'https://www.sgi.sk.ca',
  },
  {
    name: { en: 'Manitoba Public Insurance', fr: 'Societe d\'assurance publique du Manitoba' },
    acronym: { en: 'MPI', fr: 'MPI' },
    type: 'PROVINCIAL',
    description: 'Manitoba\'s public auto insurer (Autopac). Mandatory basic coverage (no-fault PIPP). Extension products available through MPI only (no private auto in MB).',
    applicableProvinces: ['MB'],
    website: 'https://www.mpi.mb.ca',
  },
  {
    name: { en: 'SAAQ Auto Insurance (Quebec)', fr: 'Societe de l\'assurance automobile du Quebec' },
    acronym: { en: 'SAAQ', fr: 'SAAQ' },
    type: 'PROVINCIAL',
    description: 'Quebec\'s public auto injury insurer. Pure no-fault for bodily injuries. Private insurers handle property damage and civil liability. Unique hybrid model in Canada.',
    applicableProvinces: ['QC'],
    website: 'https://saaq.gouv.qc.ca',
  },
  {
    name: { en: 'Crime Victims Compensation (Quebec)', fr: 'Indemnisation des victimes d\'actes criminels' },
    acronym: { en: 'IVAC', fr: 'IVAC' },
    type: 'PROVINCIAL',
    description: 'Quebec program compensating victims of criminal acts. Covers medical expenses, income replacement, rehabilitation, and funeral expenses.',
    applicableProvinces: ['QC'],
    website: 'https://www.ivac.qc.ca',
  },
  {
    name: { en: 'Registered Disability Savings Plan', fr: 'Regime enregistre d\'epargne-invalidite' },
    acronym: { en: 'RDSP', fr: 'REEI' },
    type: 'FEDERAL',
    description: 'Tax-sheltered savings plan for persons with disabilities eligible for the Disability Tax Credit. Government matching grants (CDSG) and bonds (CDSB).',
    applicableProvinces: 'ALL',
    website: 'https://www.canada.ca/en/revenue-agency/services/tax/individuals/topics/registered-disability-savings-plan-rdsp.html',
  },
  {
    name: { en: 'Provincial Social Assistance', fr: 'Aide sociale provinciale' },
    acronym: { en: 'SA', fr: 'AS' },
    type: 'PROVINCIAL',
    description: 'Each province/territory provides last-resort financial assistance. Programs vary widely (e.g., Ontario Works, QC Aide sociale, BC Income Assistance). Affects insurance needs analysis.',
    applicableProvinces: 'ALL',
    website: 'https://www.canada.ca/en/services/benefits/provincial.html',
  },
  {
    name: { en: 'Provincial Disability Programs', fr: 'Programmes provinciaux d\'invalidite' },
    acronym: { en: 'PDP', fr: 'PPD' },
    type: 'PROVINCIAL',
    description: 'Programs like ODSP (Ontario), PWD (BC), AISH (Alberta) provide income support for persons with severe disabilities. Interact with private disability insurance.',
    applicableProvinces: 'ALL',
    website: 'https://www.canada.ca/en/services/benefits/disability.html',
  },
];

// ── Industry Bodies ──

export const INDUSTRY_BODIES: IndustryBody[] = [
  {
    name: { en: 'Canadian Council of Insurance Regulators', fr: 'Conseil canadien des responsables de la reglementation d\'assurance' },
    acronym: { en: 'CCIR', fr: 'CCRRA' },
    type: 'REGULATOR',
    role: 'Forum of provincial/territorial insurance regulators. Harmonizes regulatory standards across Canada. Issues joint guidelines (e.g., Total Cost of Client directive).',
    website: 'https://www.ccir-ccrra.org',
  },
  {
    name: { en: 'Canadian Insurance Services Regulatory Organizations', fr: 'Organismes canadiens de reglementation en assurance' },
    acronym: { en: 'CISRO', fr: 'OCRA' },
    type: 'REGULATOR',
    role: 'Forum of provincial/territorial insurance intermediary regulators. Harmonizes licensing, CE requirements, and conduct standards for agents and brokers.',
    website: 'https://www.cisro-ocra.com',
  },
  {
    name: { en: 'Canadian Life and Health Insurance Association', fr: 'Association canadienne des compagnies d\'assurances de personnes' },
    acronym: { en: 'CLHIA', fr: 'ACCAP' },
    type: 'ASSOCIATION',
    role: 'Industry association representing life and health insurers. Issues guideline documents (CLHIA Guidelines LD2, LD7, LD10). Advocates for the industry.',
    website: 'https://www.clhia.ca',
  },
  {
    name: { en: 'Insurance Bureau of Canada', fr: 'Bureau d\'assurance du Canada' },
    acronym: { en: 'IBC', fr: 'BAC' },
    type: 'ASSOCIATION',
    role: 'National association representing property and casualty (P&C) insurers. Auto, home, business insurance advocacy and consumer information.',
    website: 'https://www.ibc.ca',
  },
  {
    name: { en: 'Advocis — The Financial Advisors Association of Canada', fr: 'Advocis — L\'Association des conseillers financiers du Canada' },
    acronym: { en: 'Advocis', fr: 'Advocis' },
    type: 'ASSOCIATION',
    role: 'Professional association for financial advisors and insurance professionals. Provides CE, designations (CLU, CHS, CFP), and advocacy.',
    website: 'https://www.advocis.ca',
  },
  {
    name: { en: 'FP Canada', fr: 'FP Canada' },
    acronym: { en: 'FPC', fr: 'FPC' },
    type: 'SRO',
    role: 'Professional body for Certified Financial Planners (CFP) and Qualified Associate Financial Planners (QAFP). Sets education, exam, ethics, and CE standards.',
    website: 'https://www.fpcanada.ca',
  },
  {
    name: { en: 'Canadian Securities Institute', fr: 'Institut canadien des valeurs mobilieres' },
    acronym: { en: 'CSI', fr: 'ICVM' },
    type: 'ASSOCIATION',
    role: 'Provides education and certification for financial services (securities, insurance, wealth management). Offers LLQP, CFA prep, and other programs.',
    website: 'https://www.csi.ca',
  },
  {
    name: { en: 'Insurance Institute of Canada', fr: 'Institut d\'assurance du Canada' },
    acronym: { en: 'IIC', fr: 'IAC' },
    type: 'ASSOCIATION',
    role: 'Education and professional development for P&C insurance. Designations: CIP (Chartered Insurance Professional), FCIP (Fellow). Offers CE programs.',
    website: 'https://www.insuranceinstitute.ca',
  },
  {
    name: { en: 'Assuris', fr: 'Assuris' },
    acronym: { en: 'Assuris', fr: 'Assuris' },
    type: 'PROTECTION',
    role: 'Not-for-profit policyholder protection corporation for life and health insurance. If a member insurer fails, Assuris protects policyholders\' benefits.',
    website: 'https://www.assuris.ca',
  },
  {
    name: { en: 'Property and Casualty Insurance Compensation Corporation', fr: 'Societe d\'indemnisation en matiere d\'assurances IARD' },
    acronym: { en: 'PACICC', fr: 'SIMA' },
    type: 'PROTECTION',
    role: 'Protects P&C insurance policyholders if a member insurer becomes insolvent. Covers auto, home, and commercial insurance.',
    website: 'https://www.pacicc.ca',
  },
  {
    name: { en: 'OmbudService for Life & Health Insurance', fr: 'Ombudsman des assurances de personnes' },
    acronym: { en: 'OLHI', fr: 'OAP' },
    type: 'SRO',
    role: 'Independent dispute resolution service for consumers with life and health insurance complaints. Free service, non-binding recommendations.',
    website: 'https://www.olhi.ca',
  },
  {
    name: { en: 'General Insurance OmbudService', fr: 'Service de conciliation en assurance de dommages' },
    acronym: { en: 'GIO', fr: 'SCAD' },
    type: 'SRO',
    role: 'Dispute resolution for property and casualty insurance complaints. Works with consumers and insurers to reach fair resolution.',
    website: 'https://www.giocanada.org',
  },
  {
    name: { en: 'Canadian Investment Regulatory Organization', fr: 'Organisme canadien de reglementation des investissements' },
    acronym: { en: 'CIRO', fr: 'OCRI' },
    type: 'SRO',
    role: 'Self-regulatory organization overseeing investment dealers and mutual fund dealers. Relevant for segregated fund advisors and dual-licensed professionals.',
    website: 'https://www.ciro.ca',
  },
  {
    name: { en: 'Canadian Securities Administrators', fr: 'Autorites canadiennes en valeurs mobilieres' },
    acronym: { en: 'CSA', fr: 'ACVM' },
    type: 'REGULATOR',
    role: 'Umbrella organization of all provincial/territorial securities regulators. Coordinates harmonized securities regulation. Relevant for segregated funds.',
    website: 'https://www.securities-administrators.ca',
  },
  {
    name: { en: 'Medical Information Bureau', fr: 'Bureau des renseignements medicaux' },
    acronym: { en: 'MIB', fr: 'BRM' },
    type: 'ASSOCIATION',
    role: 'Shared database of medical information used in life/health insurance underwriting. Prevents fraud and omissions in applications.',
    website: 'https://www.mib.com',
  },
];

// ── Utility Functions ──

export function getProvinceRegulation(code: string): ProvinceRegulation | undefined {
  return PROVINCES.find(p => p.code === code.toUpperCase());
}

export function getApplicableLaws(provinceCode: string, topic?: string): string[] {
  const province = getProvinceRegulation(provinceCode);
  if (!province) return [];

  // Always include provincial legislation
  const laws = [...province.legislation];

  // Add federal laws that are always relevant
  laws.push('PIPEDA / Loi sur la protection des renseignements personnels');
  laws.push('Income Tax Act / Loi de l\'impot sur le revenu');
  laws.push('PCMLTFA / LRPCFAT (anti-money laundering)');

  // Add topic-specific laws
  if (topic) {
    const lower = topic.toLowerCase();
    if (lower.includes('auto') || lower.includes('vehicle') || lower.includes('voiture')) {
      if (province.autoInsurance.provider) {
        laws.push(`${province.autoInsurance.provider} legislation`);
      }
      if (province.legalRegime === 'COMMON_LAW') {
        laws.push('Common law: duty of care, negligence, contributory negligence');
      }
    }
    if (lower.includes('work') || lower.includes('travail') || lower.includes('injury')) {
      laws.push(`${province.workersComp.name} Act`);
    }
    if (lower.includes('pension') || lower.includes('retraite') || lower.includes('retirement')) {
      if (provinceCode === 'QC') {
        laws.push('Loi sur le regime de rentes du Quebec');
        laws.push('Loi sur les regimes complementaires de retraite');
      } else {
        laws.push('Canada Pension Plan Act');
        laws.push('Pension Benefits Standards Act (federal)');
      }
    }
    if (lower.includes('vie') || lower.includes('life') || lower.includes('benefici')) {
      if (province.legalRegime === 'COMMON_LAW') {
        laws.push('Common law: insurable interest, utmost good faith (uberrimae fidei)');
        laws.push('Uniform Life Insurance Act (model legislation)');
      } else {
        laws.push('Code civil du Quebec — Titre 3 Assurances (art. 2389-2504)');
      }
    }
    if (lower.includes('succession') || lower.includes('testament') || lower.includes('estate') || lower.includes('will')) {
      if (province.legalRegime === 'COMMON_LAW') {
        laws.push('Provincial Wills Act / Succession Law Reform Act');
        laws.push('Dependants\' Relief legislation');
      } else {
        laws.push('Code civil du Quebec — Livre 3 Successions');
      }
    }
    if (lower.includes('contrat') || lower.includes('contract') || lower.includes('obligation')) {
      if (province.legalRegime === 'COMMON_LAW') {
        laws.push('Common law of contracts: offer, acceptance, consideration, privity');
      } else {
        laws.push('Code civil du Quebec — Livre 5 Obligations');
      }
    }
    if (lower.includes('fraud') || lower.includes('blanchiment') || lower.includes('laundering')) {
      laws.push('Proceeds of Crime (Money Laundering) and Terrorist Financing Act');
      laws.push('Criminal Code of Canada — fraud provisions');
    }
  }

  return laws;
}

export function getProvincePrograms(provinceCode: string): GovernmentProgram[] {
  const code = provinceCode.toUpperCase() as ProvinceCode;
  return GOVERNMENT_PROGRAMS.filter(p =>
    p.applicableProvinces === 'ALL' ||
    (Array.isArray(p.applicableProvinces) && p.applicableProvinces.includes(code))
  );
}

/** Returns the provincial context string for Aurelia's system prompt */
export function buildProvincialContext(provinceCode: string): string {
  const province = getProvinceRegulation(provinceCode);
  if (!province) return '';

  const parts: string[] = [];
  parts.push(`Province de l'etudiant: ${province.name.fr} (${province.code})`);
  parts.push(`Regime juridique: ${province.legalRegime === 'CIVIL_CODE' ? 'Code civil du Quebec' : 'Common law'}`);
  parts.push(`Regulateur: ${province.insuranceRegulator.name} (${province.insuranceRegulator.acronym})`);
  parts.push(`Regulateur intermediaires: ${province.intermediaryRegulator.name} (${province.intermediaryRegulator.acronym})`);
  parts.push(`Legislation applicable: ${province.legislation.join(', ')}`);
  parts.push(`Auto-assurance: ${province.autoInsurance.type} — ${province.autoInsurance.details}`);
  parts.push(`Workers' comp: ${province.workersComp.name} (${province.workersComp.acronym})`);
  parts.push(`Loi sur la vie privee: ${province.privacyLaw}`);

  if (province.particularities.length > 0) {
    parts.push(`Particularites: ${province.particularities.join('; ')}`);
  }

  return parts.join('\n');
}
