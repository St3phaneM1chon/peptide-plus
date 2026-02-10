/**
 * PEPTIDE CHEMISTRY DATA
 * Chemical properties, sequences, storage instructions, and research summaries
 * Based on industry standards from PeptideSciences, NCRP, etc.
 */

export interface PeptideChemistry {
  slug: string;
  casNumber?: string;
  molecularFormula?: string;
  molecularWeight?: number;
  sequence?: string;
  synonyms?: string[];
  appearance?: string;
  solubility?: string;
  storage?: {
    lyophilized: string;
    reconstituted: string;
    temperature: string;
  };
  reconstitution?: {
    solvent: string;
    volume: string;
    notes: string;
  };
  researchSummary?: string;
  mechanism?: string;
  references?: {
    title: string;
    url?: string;
    pubmedId?: string;
  }[];
  coaAvailable?: boolean;
  hplcPurity?: number;
  msPurity?: number;
}

export const peptideChemistryData: Record<string, PeptideChemistry> = {
  'bpc-157': {
    slug: 'bpc-157',
    casNumber: '137525-51-0',
    molecularFormula: 'C62H98N16O22',
    molecularWeight: 1419.53,
    sequence: 'Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val',
    synonyms: ['Body Protection Compound-157', 'BPC-15', 'PL 14736', 'Bepecin'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in water, bacteriostatic water, or 0.9% saline',
    storage: {
      lyophilized: 'Store at -20°C for long-term storage (up to 24 months)',
      reconstituted: 'Store at 2-8°C for up to 30 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water (BAC Water)',
      volume: '1-2ml per 5mg vial',
      notes: 'Add solvent slowly along the vial wall. Do not shake vigorously. Swirl gently until dissolved.',
    },
    researchSummary: `BPC-157 (Body Protection Compound-157) is a pentadecapeptide composed of 15 amino acids, derived from a protective protein found in human gastric juice. Research has shown BPC-157 exhibits potent protective and healing properties in various animal models.

Key Research Areas:
• Gastrointestinal healing and protection
• Tendon, ligament, and muscle repair
• Wound healing acceleration
• Neuroprotective effects
• Angiogenesis promotion

BPC-157 has demonstrated stability in human gastric juice and has shown remarkable regenerative properties in preclinical studies.`,
    mechanism: 'BPC-157 is believed to work through multiple pathways including upregulation of growth hormone receptors, promotion of angiogenesis via VEGF pathways, and modulation of nitric oxide system.',
    references: [
      { title: 'Sikiric P, et al. "Pentadecapeptide BPC 157 and its effects in the healing of various tissues"', pubmedId: '28831251' },
      { title: 'Chang CH, et al. "The promoting effect of pentadecapeptide BPC 157 on tendon healing"', pubmedId: '21030672' },
    ],
    coaAvailable: true,
    hplcPurity: 99.83,
  },

  'tb-500': {
    slug: 'tb-500',
    casNumber: '77591-33-4',
    molecularFormula: 'C212H350N56O78S',
    molecularWeight: 4963.44,
    sequence: 'Ac-Ser-Asp-Lys-Pro-Asp-Met-Ala-Glu-Ile-Glu-Lys-Phe-Asp-Lys-Ser-Lys-Leu-Lys-Lys-Thr-Glu-Thr-Gln-Glu-Lys-Asn-Pro-Leu-Pro-Ser-Lys-Glu-Thr-Ile-Glu-Gln-Glu-Lys-Gln-Ala-Gly-Glu-Ser',
    synonyms: ['Thymosin Beta-4', 'Tβ4', 'TB4', 'TMSB4X'],
    appearance: 'White to off-white lyophilized powder',
    solubility: 'Soluble in bacteriostatic water or sterile water',
    storage: {
      lyophilized: 'Store at -20°C for optimal stability (up to 24 months)',
      reconstituted: 'Store at 2-8°C for up to 14 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water (BAC Water)',
      volume: '2ml per 5mg vial',
      notes: 'Reconstitute slowly. Allow powder to dissolve completely before use. Do not freeze reconstituted solution.',
    },
    researchSummary: `TB-500 is a synthetic version of Thymosin Beta-4, a naturally occurring 43-amino acid peptide present in all human and animal cells except red blood cells. It plays a crucial role in cell migration, differentiation, and tissue repair.

Key Research Areas:
• Wound healing and tissue regeneration
• Cardiac tissue protection
• Hair follicle stem cell migration
• Anti-inflammatory effects
• Blood vessel growth

TB-500 has been studied extensively in veterinary medicine, particularly in equine applications for injury recovery.`,
    mechanism: 'TB-500 promotes cell migration by binding to and sequestering actin, regulating cytoskeletal organization. It upregulates cell-building proteins such as actin and promotes angiogenesis.',
    references: [
      { title: 'Goldstein AL, et al. "Thymosin beta4: a multi-functional regenerative peptide"', pubmedId: '22330812' },
    ],
    coaAvailable: true,
    hplcPurity: 99.43,
  },

  'semaglutide': {
    slug: 'semaglutide',
    casNumber: '910463-68-2',
    molecularFormula: 'C187H291N45O59',
    molecularWeight: 4113.58,
    synonyms: ['Ozempic', 'Wegovy', 'Rybelsus', 'GLP-1 Analog'],
    appearance: 'White to off-white powder',
    solubility: 'Soluble in water and phosphate buffer',
    storage: {
      lyophilized: 'Store at -20°C protected from light',
      reconstituted: 'Store at 2-8°C for up to 28 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water or Sterile Water',
      volume: '2ml per 5mg vial',
      notes: 'Protect from light. Do not shake. Allow to reach room temperature before reconstitution.',
    },
    researchSummary: `Semaglutide is a GLP-1 (glucagon-like peptide-1) receptor agonist that mimics the effects of the naturally occurring incretin hormone GLP-1. It has been approved for clinical use in type 2 diabetes and weight management.

Key Research Areas:
• Glycemic control and insulin secretion
• Appetite regulation and weight loss
• Cardiovascular health
• Neuroprotective potential
• Metabolic syndrome

Semaglutide has demonstrated significant efficacy in clinical trials for both diabetes management and weight loss.`,
    mechanism: 'Semaglutide activates GLP-1 receptors, stimulating glucose-dependent insulin secretion, suppressing glucagon release, slowing gastric emptying, and reducing appetite through central nervous system effects.',
    references: [
      { title: 'Wilding JPH, et al. "Once-Weekly Semaglutide in Adults with Overweight or Obesity"', pubmedId: '33567185' },
    ],
    coaAvailable: true,
    hplcPurity: 99.39,
  },

  'tirzepatide': {
    slug: 'tirzepatide',
    casNumber: '2023788-19-2',
    molecularFormula: 'C225H348N48O68',
    molecularWeight: 4813.45,
    synonyms: ['Mounjaro', 'Zepbound', 'LY3298176', 'Dual GIP/GLP-1 Agonist'],
    appearance: 'White to off-white lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C protected from light',
      reconstituted: 'Store at 2-8°C for up to 21 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 10mg vial',
      notes: 'Handle with care. Allow powder to dissolve completely. Avoid repeated freeze-thaw cycles.',
    },
    researchSummary: `Tirzepatide is a novel dual GIP (glucose-dependent insulinotropic polypeptide) and GLP-1 receptor agonist. It represents a new class of incretin-based therapeutics with enhanced efficacy compared to single-receptor agonists.

Key Research Areas:
• Superior glycemic control
• Significant weight reduction
• Improved insulin sensitivity
• Cardiovascular benefits
• Metabolic optimization

Clinical trials have shown tirzepatide to produce unprecedented weight loss results compared to other incretin-based therapies.`,
    mechanism: 'Tirzepatide activates both GIP and GLP-1 receptors, producing synergistic effects on glucose metabolism, appetite suppression, and energy expenditure. The dual mechanism provides enhanced metabolic benefits.',
    coaAvailable: true,
    hplcPurity: 99.74,
  },

  'retatrutide': {
    slug: 'retatrutide',
    casNumber: '2381089-83-2',
    molecularFormula: 'C256H381N67O76S',
    molecularWeight: 5590.2,
    synonyms: ['LY3437943', 'Triple Agonist', 'GGG Agonist'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 14 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 10mg vial',
      notes: 'Reconstitute carefully. This is a large molecule requiring gentle handling.',
    },
    researchSummary: `Retatrutide is a triple agonist targeting GIP, GLP-1, and glucagon receptors simultaneously. This innovative approach aims to maximize metabolic benefits through activation of three complementary pathways.

Key Research Areas:
• Maximum weight loss potential
• Enhanced glucagon-mediated lipolysis
• Improved glucose homeostasis
• Energy expenditure increase
• Metabolic disease treatment

Early clinical data suggests retatrutide may produce the most significant weight loss of any incretin-based therapy studied to date.`,
    mechanism: 'By activating GIP, GLP-1, and glucagon receptors together, retatrutide produces complementary effects: improved insulin secretion, appetite suppression, enhanced fat oxidation, and increased energy expenditure.',
    coaAvailable: true,
    hplcPurity: 99.30,
  },

  'ipamorelin': {
    slug: 'ipamorelin',
    casNumber: '170851-70-4',
    molecularFormula: 'C38H49N9O5',
    molecularWeight: 711.85,
    sequence: 'Aib-His-D-2Nal-D-Phe-Lys-NH2',
    synonyms: ['NNC 26-0161', 'GHRP', 'Growth Hormone Releasing Peptide'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 21 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '1ml per 5mg vial',
      notes: 'Standard reconstitution. Stable at refrigerator temperature.',
    },
    researchSummary: `Ipamorelin is a selective growth hormone secretagogue (GHS) and ghrelin mimetic. It stimulates growth hormone release with minimal effect on cortisol, prolactin, or other hormones.

Key Research Areas:
• Selective GH release
• Bone density improvement
• Muscle mass increase
• Fat reduction
• Anti-aging research

Ipamorelin is considered one of the most selective GH secretagogues, making it valuable for research applications requiring specific GH pathway activation.`,
    mechanism: 'Ipamorelin binds to ghrelin/growth hormone secretagogue receptors (GHS-R) in the pituitary, stimulating the release of growth hormone in a pulsatile manner similar to natural GH secretion.',
    coaAvailable: true,
    hplcPurity: 99.50,
  },

  'epithalon': {
    slug: 'epithalon',
    casNumber: '307297-39-8',
    molecularFormula: 'C14H22N4O9',
    molecularWeight: 390.35,
    sequence: 'Ala-Glu-Asp-Gly',
    synonyms: ['Epitalon', 'Epithalone', 'AGAG', 'Telomerase Activator'],
    appearance: 'White powder',
    solubility: 'Soluble in water and bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 30 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 10mg vial',
      notes: 'Simple tetrapeptide. Very stable in solution.',
    },
    researchSummary: `Epithalon (Epitalon) is a synthetic tetrapeptide based on the naturally occurring epithalamin, a polypeptide produced by the pineal gland. It is primarily researched for its potential effects on telomerase activation.

Key Research Areas:
• Telomere elongation
• Cellular longevity
• Circadian rhythm regulation
• Melatonin production
• Anti-aging mechanisms

Epithalon has shown promising results in extending telomere length in cell culture studies, suggesting potential applications in longevity research.`,
    mechanism: 'Epithalon is proposed to activate telomerase, the enzyme responsible for maintaining telomere length. It may also influence pineal gland function and melatonin synthesis.',
    coaAvailable: true,
    hplcPurity: 99.20,
  },

  'selank': {
    slug: 'selank',
    casNumber: '129954-34-3',
    molecularFormula: 'C33H57N11O9',
    molecularWeight: 751.87,
    sequence: 'Thr-Lys-Pro-Arg-Pro-Gly-Pro',
    synonyms: ['TP-7', 'Selanc', 'Anxiolytic Peptide'],
    appearance: 'White lyophilized powder',
    solubility: 'Freely soluble in water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 21 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water or Sterile Water',
      volume: '1ml per 5mg vial',
      notes: 'Can also be used intranasally when reconstituted appropriately.',
    },
    researchSummary: `Selank is a synthetic analog of the naturally occurring immunomodulatory peptide tuftsin. Developed in Russia, it has been studied for its anxiolytic and nootropic properties.

Key Research Areas:
• Anxiety reduction
• Cognitive enhancement
• Memory improvement
• Immune modulation
• Neuroprotection

Selank has been approved in Russia as an anxiolytic medication and continues to be researched for cognitive and immune-related applications.`,
    mechanism: 'Selank modulates the expression of brain-derived neurotrophic factor (BDNF), influences GABAergic neurotransmission, and affects the balance of Th1/Th2 cytokines in the immune system.',
    coaAvailable: true,
    hplcPurity: 99.10,
  },

  'semax': {
    slug: 'semax',
    casNumber: '80714-61-0',
    molecularFormula: 'C37H51N9O10S',
    molecularWeight: 813.92,
    sequence: 'Met-Glu-His-Phe-Pro-Gly-Pro',
    synonyms: ['ACTH 4-10', 'Semax Acetate', 'Nootropic Peptide'],
    appearance: 'White to off-white powder',
    solubility: 'Soluble in water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 14 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 10mg vial',
      notes: 'Often used intranasally. Reconstitute appropriately for intended route.',
    },
    researchSummary: `Semax is a synthetic analog of ACTH (4-10), a fragment of adrenocorticotropic hormone. Developed in Russia, it lacks the hormonal effects of ACTH while retaining nootropic and neuroprotective properties.

Key Research Areas:
• Cognitive enhancement
• Neuroprotection
• Stroke recovery
• Memory improvement
• Learning enhancement

Semax has been approved in Russia for various neurological conditions and continues to be studied for its cognitive-enhancing effects.`,
    mechanism: 'Semax affects BDNF expression, modulates serotonergic and dopaminergic systems, and has been shown to enhance neuronal survival and plasticity. It does not activate adrenal steroidogenesis.',
    coaAvailable: true,
    hplcPurity: 99.30,
  },

  'pt-141': {
    slug: 'pt-141',
    casNumber: '32780-32-8',
    molecularFormula: 'C50H68N14O10',
    molecularWeight: 1025.18,
    sequence: 'Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-OH',
    synonyms: ['Bremelanotide', 'PT141', 'Melanocortin Agonist'],
    appearance: 'White to off-white powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C protected from light',
      reconstituted: 'Store at 2-8°C for up to 14 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 10mg vial',
      notes: 'Protect from light at all times. Store in dark container after reconstitution.',
    },
    researchSummary: `PT-141 (Bremelanotide) is a synthetic melanocortin peptide that activates melanocortin receptors in the brain. It has been FDA-approved (as Vyleesi) for the treatment of hypoactive sexual desire disorder in premenopausal women.

Key Research Areas:
• Sexual dysfunction
• Melanocortin pathway
• Central nervous system effects
• Arousal mechanisms
• Hormonal regulation

PT-141 is unique among sexual health treatments as it works through the nervous system rather than the vascular system.`,
    mechanism: 'PT-141 activates melanocortin-4 (MC4R) and melanocortin-1 (MC1R) receptors in the central nervous system, leading to increased sexual arousal and desire through neurological pathways.',
    coaAvailable: true,
    hplcPurity: 99.40,
  },

  'melanotan-2': {
    slug: 'melanotan-2',
    casNumber: '121062-08-6',
    molecularFormula: 'C50H69N15O9',
    molecularWeight: 1024.18,
    sequence: 'Ac-Nle-cyclo[Asp-His-D-Phe-Arg-Trp-Lys]-NH2',
    synonyms: ['Melanotan II', 'MT-2', 'MT2', 'Melanotropin'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C protected from light',
      reconstituted: 'Store at 2-8°C for up to 21 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 10mg vial',
      notes: 'Light sensitive. Keep in amber vial or wrap in foil after reconstitution.',
    },
    researchSummary: `Melanotan II is a synthetic analog of alpha-melanocyte stimulating hormone (α-MSH). It was originally developed at the University of Arizona for potential use as a sunless tanning agent.

Key Research Areas:
• Melanogenesis and tanning
• Sexual function
• Appetite regulation
• UV protection
• Skin pigmentation

MT-2 has been studied for various applications related to melanocortin receptor activation.`,
    mechanism: 'Melanotan II activates melanocortin receptors (particularly MC1R and MC4R), stimulating melanin production in melanocytes and affecting various physiological processes including appetite and sexual function.',
    coaAvailable: true,
    hplcPurity: 99.73,
  },

  'ghk-cu': {
    slug: 'ghk-cu',
    casNumber: '49557-75-7',
    molecularFormula: 'C14H23CuN5O4',
    molecularWeight: 403.92,
    sequence: 'Gly-His-Lys:Cu',
    synonyms: ['Copper Peptide', 'GHK-Copper', 'Copper Tripeptide-1'],
    appearance: 'Blue powder',
    solubility: 'Freely soluble in water',
    storage: {
      lyophilized: 'Store at -20°C or 2-8°C',
      reconstituted: 'Store at 2-8°C for up to 60 days',
      temperature: '-20°C or 2-8°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Sterile Water or appropriate cosmetic base',
      volume: '5-10ml per 50mg for topical use',
      notes: 'Very stable peptide. Can be used in various formulations including creams and serums.',
    },
    researchSummary: `GHK-Cu (Copper Peptide) is a naturally occurring tripeptide with a high affinity for copper(II) ions. It is found in human plasma, saliva, and urine, and decreases with age.

Key Research Areas:
• Wound healing
• Skin regeneration
• Hair growth
• Collagen synthesis
• Anti-aging effects

GHK-Cu is widely used in cosmetic formulations and has been extensively researched for its regenerative properties.`,
    mechanism: 'GHK-Cu acts through multiple pathways: promoting collagen and glycosaminoglycan synthesis, attracting immune and stem cells to areas of tissue damage, and modulating gene expression related to tissue repair.',
    coaAvailable: true,
    hplcPurity: 99.50,
  },

  'nad-plus': {
    slug: 'nad-plus',
    casNumber: '53-84-9',
    molecularFormula: 'C21H27N7O14P2',
    molecularWeight: 663.43,
    synonyms: ['Nicotinamide Adenine Dinucleotide', 'NAD', 'Coenzyme I', 'DPN'],
    appearance: 'White to yellow powder',
    solubility: 'Soluble in water',
    storage: {
      lyophilized: 'Store at -20°C protected from light and moisture',
      reconstituted: 'Store at 2-8°C for up to 7 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Sterile Water or Saline',
      volume: '10ml per 500mg',
      notes: 'Very sensitive to degradation. Prepare fresh solutions when possible. Protect from light.',
    },
    researchSummary: `NAD+ (Nicotinamide Adenine Dinucleotide) is a coenzyme found in all living cells. It plays a crucial role in energy metabolism, DNA repair, and cellular signaling. NAD+ levels decline with age.

Key Research Areas:
• Cellular energy metabolism
• Sirtuin activation
• DNA repair mechanisms
• Aging and longevity
• Neuroprotection

NAD+ supplementation and its precursors (NMN, NR) are major areas of longevity research.`,
    mechanism: 'NAD+ is essential for redox reactions in metabolism, serving as an electron carrier. It also serves as a substrate for sirtuins (anti-aging proteins) and PARP enzymes (DNA repair).',
    coaAvailable: true,
    hplcPurity: 99.00,
  },

  'cjc-1295': {
    slug: 'cjc-1295',
    casNumber: '863288-34-0',
    molecularFormula: 'C152H252N44O42',
    molecularWeight: 3367.97,
    sequence: 'Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg-NH2',
    synonyms: ['CJC-1295 No DAC', 'Mod GRF 1-29', 'Modified GRF', 'GHRH Analog'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 21 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 2mg vial',
      notes: 'Standard reconstitution. Often combined with GHRP peptides in research.',
    },
    researchSummary: `CJC-1295 is a synthetic analog of growth hormone-releasing hormone (GHRH). The "no DAC" version has a shorter half-life compared to the DAC (Drug Affinity Complex) version.

Key Research Areas:
• Growth hormone release stimulation
• Muscle mass and recovery
• Fat metabolism
• Anti-aging research
• Sleep quality improvement

CJC-1295 is often researched in combination with GHRP peptides (Ipamorelin, GHRP-2, GHRP-6) for synergistic effects.`,
    mechanism: 'CJC-1295 binds to GHRH receptors in the pituitary gland, stimulating the release of growth hormone in a pulsatile manner that mimics natural GH secretion patterns.',
    references: [
      { title: 'Teichman SL, et al. "Prolonged stimulation of growth hormone (GH) and insulin-like growth factor I secretion by CJC-1295"', pubmedId: '16352683' },
    ],
    coaAvailable: true,
    hplcPurity: 99.21,
  },

  'ghrp-6': {
    slug: 'ghrp-6',
    casNumber: '87616-84-0',
    molecularFormula: 'C46H56N12O6',
    molecularWeight: 873.01,
    sequence: 'His-D-Trp-Ala-Trp-D-Phe-Lys-NH2',
    synonyms: ['Growth Hormone Releasing Peptide-6', 'GHRP-6', 'SKF-110679'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 21 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 5mg vial',
      notes: 'Known to stimulate appetite. Often combined with CJC-1295 or other GHRH analogs.',
    },
    researchSummary: `GHRP-6 is one of the first generation growth hormone releasing peptides. It acts on the ghrelin receptor to stimulate growth hormone release.

Key Research Areas:
• Growth hormone secretion
• Appetite stimulation
• Muscle mass increase
• Fat reduction
• Cytoprotective effects

GHRP-6 is known for its pronounced appetite-stimulating effects, which distinguishes it from other GHRPs like Ipamorelin.`,
    mechanism: 'GHRP-6 acts as a ghrelin mimetic, binding to the growth hormone secretagogue receptor (GHS-R) and stimulating GH release. It also increases ghrelin levels, leading to appetite stimulation.',
    coaAvailable: true,
    hplcPurity: 99.35,
  },

  'ghrp-2': {
    slug: 'ghrp-2',
    casNumber: '158861-67-7',
    molecularFormula: 'C45H55N9O6',
    molecularWeight: 817.97,
    sequence: 'D-Ala-D-2Nal-Ala-Trp-D-Phe-Lys-NH2',
    synonyms: ['Growth Hormone Releasing Peptide-2', 'GHRP-2', 'KP-102', 'Pralmorelin'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 21 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 5mg vial',
      notes: 'More potent than GHRP-6 with less appetite stimulation. Often stacked with GHRH analogs.',
    },
    researchSummary: `GHRP-2 is considered one of the most potent growth hormone releasing peptides. It has a stronger GH release effect than GHRP-6 but causes less appetite stimulation.

Key Research Areas:
• Potent GH release
• Body composition improvement
• Sleep quality
• Anti-aging
• Recovery enhancement

GHRP-2 is often considered a good balance between efficacy and side effects among the GHRP family.`,
    mechanism: 'GHRP-2 acts as a synthetic ghrelin agonist, binding to GHS-R1a receptors in the pituitary and hypothalamus to stimulate growth hormone release.',
    coaAvailable: true,
    hplcPurity: 99.42,
  },

  'hexarelin': {
    slug: 'hexarelin',
    casNumber: '140703-51-1',
    molecularFormula: 'C47H58N12O6',
    molecularWeight: 887.04,
    sequence: 'His-D-2-Me-Trp-Ala-Trp-D-Phe-Lys-NH2',
    synonyms: ['Hexarelin Acetate', 'Examorelin', 'HEX'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 14 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 2mg vial',
      notes: 'Most potent GHRP for GH release. May cause desensitization with prolonged use.',
    },
    researchSummary: `Hexarelin is considered the most potent growth hormone releasing peptide in terms of GH release. It has been studied for various therapeutic applications.

Key Research Areas:
• Maximum GH release potential
• Cardioprotective effects
• Muscle preservation
• Anti-aging research
• Wound healing

Hexarelin has shown unique cardioprotective properties not seen in other GHRPs.`,
    mechanism: 'Hexarelin is a potent synthetic hexapeptide that stimulates GH release by acting on both the pituitary and hypothalamus. It also has direct cardiac effects independent of GH.',
    coaAvailable: true,
    hplcPurity: 99.28,
  },

  'sermorelin': {
    slug: 'sermorelin',
    casNumber: '86168-78-7',
    molecularFormula: 'C149H246N44O42S',
    molecularWeight: 3357.93,
    sequence: 'Tyr-Ala-Asp-Ala-Ile-Phe-Thr-Asn-Ser-Tyr-Arg-Lys-Val-Leu-Gly-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Met-Ser-Arg-NH2',
    synonyms: ['Sermorelin Acetate', 'GRF 1-29', 'GHRH 1-29', 'Geref'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 14 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 2mg vial',
      notes: 'FDA-approved for diagnostic use. Often combined with GHRP peptides.',
    },
    researchSummary: `Sermorelin is the shortest fully functional fragment of GHRH. It was FDA-approved for treating growth hormone deficiency in children and is used diagnostically to assess pituitary function.

Key Research Areas:
• Growth hormone deficiency treatment
• Anti-aging research
• Sleep quality improvement
• Body composition
• Cognitive function

Sermorelin is often preferred for its natural-like GH stimulation pattern and established safety profile.`,
    mechanism: 'Sermorelin binds to GHRH receptors on pituitary somatotrophs, stimulating the synthesis and release of endogenous growth hormone in a physiological pulsatile manner.',
    references: [
      { title: 'Walker RF. "Sermorelin: a better approach to management of adult-onset growth hormone insufficiency?"', pubmedId: '16441764' },
    ],
    coaAvailable: true,
    hplcPurity: 99.15,
  },

  'tesamorelin': {
    slug: 'tesamorelin',
    casNumber: '218949-48-5',
    molecularFormula: 'C221H366N72O67S',
    molecularWeight: 5135.87,
    sequence: 'Trans-3-hexenoic acid-Tyr-Ala-Asp-Ala-Ile-Phe-Thr-Asn-Ser-Tyr-Arg-Lys-Val-Leu-Gly-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg-NH2',
    synonyms: ['Tesamorelin Acetate', 'Egrifta', 'TH9507', 'GHRH Analog'],
    appearance: 'White to off-white lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at 2-8°C',
      reconstituted: 'Use immediately or store at 2-8°C for up to 24 hours',
      temperature: '2-8°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Sterile Water for Injection',
      volume: '2ml per 2mg vial',
      notes: 'FDA-approved medication (Egrifta). Handle with care, less stable than other peptides.',
    },
    researchSummary: `Tesamorelin is an FDA-approved GHRH analog used for the treatment of HIV-associated lipodystrophy. It has a modified structure for improved stability.

Key Research Areas:
• HIV-associated lipodystrophy (FDA approved)
• Visceral fat reduction
• Cognitive function in aging
• Metabolic syndrome
• Non-alcoholic fatty liver disease

Tesamorelin is unique among GHRH analogs for its FDA approval status and proven efficacy in reducing visceral adipose tissue.`,
    mechanism: 'Tesamorelin is a stabilized analog of GHRH that binds to and activates GHRH receptors, stimulating growth hormone synthesis and release from the anterior pituitary.',
    references: [
      { title: 'Falutz J, et al. "Metabolic effects of a growth hormone-releasing factor in patients with HIV"', pubmedId: '17895322' },
    ],
    coaAvailable: true,
    hplcPurity: 99.60,
  },

  'aod-9604': {
    slug: 'aod-9604',
    casNumber: '221231-10-3',
    molecularFormula: 'C78H123N23O23S2',
    molecularWeight: 1815.08,
    sequence: 'Tyr-Leu-Arg-Ile-Val-Gln-Cys-Arg-Ser-Val-Glu-Gly-Ser-Cys-Gly-Phe',
    synonyms: ['AOD9604', 'Anti-Obesity Drug 9604', 'hGH Fragment 177-191', 'Tyr-hGH Frag 176-191'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 21 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 5mg vial',
      notes: 'Fragment of hGH responsible for fat metabolism. Does not affect IGF-1 or blood glucose.',
    },
    researchSummary: `AOD-9604 is a modified fragment of human growth hormone (hGH) encompassing the C-terminal region responsible for the lipolytic (fat-burning) activity of hGH.

Key Research Areas:
• Fat metabolism and lipolysis
• Weight management
• Cartilage regeneration
• Osteoarthritis (TGA approved in Australia)
• Metabolic research

AOD-9604 is unique in that it provides the fat-metabolizing benefits of hGH without affecting blood glucose or promoting growth.`,
    mechanism: 'AOD-9604 mimics the way natural growth hormone regulates fat metabolism but without the adverse effects on blood sugar or growth. It stimulates lipolysis and inhibits lipogenesis.',
    coaAvailable: true,
    hplcPurity: 99.33,
  },

  'mots-c': {
    slug: 'mots-c',
    casNumber: '1627580-64-6',
    molecularFormula: 'C101H152N28O22S2',
    molecularWeight: 2174.64,
    sequence: 'Met-Arg-Trp-Gln-Glu-Met-Gly-Tyr-Ile-Phe-Tyr-Pro-Arg-Lys-Leu-Arg',
    synonyms: ['MOTS-c', 'Mitochondrial ORF of the Twelve S rRNA type-c', 'Mitochondrial-Derived Peptide'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 14 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 5mg vial',
      notes: 'Mitochondrial-derived peptide. Handle with care to maintain activity.',
    },
    researchSummary: `MOTS-c is a mitochondrial-derived peptide encoded in the 12S rRNA region of mitochondrial DNA. It is a key regulator of metabolic homeostasis and has gained significant research interest.

Key Research Areas:
• Metabolic regulation
• Exercise mimetic effects
• Insulin sensitivity
• Aging and longevity
• Obesity and diabetes research

MOTS-c represents a new class of signaling molecules that link mitochondrial function to metabolic regulation.`,
    mechanism: 'MOTS-c activates AMPK pathway and regulates the folate-methionine cycle, affecting cellular metabolism. It promotes glucose uptake and improves insulin sensitivity.',
    references: [
      { title: 'Lee C, et al. "The mitochondrial-derived peptide MOTS-c promotes metabolic homeostasis and reduces obesity and insulin resistance"', pubmedId: '25738459' },
    ],
    coaAvailable: true,
    hplcPurity: 99.18,
  },

  'thymosin-alpha-1': {
    slug: 'thymosin-alpha-1',
    casNumber: '62304-98-7',
    molecularFormula: 'C129H215N33O55',
    molecularWeight: 3108.29,
    sequence: 'Ac-Ser-Asp-Ala-Ala-Val-Asp-Thr-Ser-Ser-Glu-Ile-Thr-Thr-Lys-Asp-Leu-Lys-Glu-Lys-Lys-Glu-Val-Val-Glu-Glu-Ala-Glu-Asn-OH',
    synonyms: ['Tα1', 'Ta1', 'Thymalfasin', 'Zadaxin'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in sterile water or saline',
    storage: {
      lyophilized: 'Store at 2-8°C',
      reconstituted: 'Store at 2-8°C for up to 7 days',
      temperature: '2-8°C',
    },
    reconstitution: {
      solvent: 'Sterile Water or Normal Saline',
      volume: '1ml per 1.6mg vial',
      notes: 'Approved medication in several countries. Handle under sterile conditions.',
    },
    researchSummary: `Thymosin Alpha-1 is a naturally occurring thymic peptide that plays a crucial role in immune system regulation. It is approved in over 35 countries for various conditions.

Key Research Areas:
• Immune system modulation
• Hepatitis B and C treatment (approved)
• Cancer immunotherapy
• Vaccine enhancement
• Chronic infections

Thymosin Alpha-1 is one of the most clinically validated peptides with extensive human trial data.`,
    mechanism: 'Thymosin Alpha-1 enhances T-cell function, promotes T-cell differentiation, and modulates cytokine production. It acts primarily on dendritic cells to influence immune response.',
    references: [
      { title: 'Tuthill C, et al. "Thymalfasin: biological properties and clinical applications"', pubmedId: '20186259' },
    ],
    coaAvailable: true,
    hplcPurity: 99.45,
  },

  'll-37': {
    slug: 'll-37',
    casNumber: '154947-66-7',
    molecularFormula: 'C205H340N60O53',
    molecularWeight: 4493.33,
    sequence: 'Leu-Leu-Gly-Asp-Phe-Phe-Arg-Lys-Ser-Lys-Glu-Lys-Ile-Gly-Lys-Glu-Phe-Lys-Arg-Ile-Val-Gln-Arg-Ile-Lys-Asp-Phe-Leu-Arg-Asn-Leu-Val-Pro-Arg-Thr-Glu-Ser',
    synonyms: ['LL-37', 'CAP-18', 'Cathelicidin', 'hCAP18/LL-37'],
    appearance: 'White to off-white powder',
    solubility: 'Soluble in water, may require sonication',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 7 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Sterile Water',
      volume: '1ml per 5mg vial',
      notes: 'Antimicrobial peptide. May require gentle warming or sonication to fully dissolve.',
    },
    researchSummary: `LL-37 is the only human cathelicidin antimicrobial peptide. It is part of the innate immune system and has broad-spectrum antimicrobial and immunomodulatory activities.

Key Research Areas:
• Antimicrobial activity
• Wound healing
• Anti-biofilm properties
• Immunomodulation
• Cancer research

LL-37 represents a promising area for developing new antimicrobial therapies.`,
    mechanism: 'LL-37 disrupts bacterial membranes and has immunomodulatory effects including chemotaxis of immune cells, wound healing promotion, and modulation of inflammatory responses.',
    coaAvailable: true,
    hplcPurity: 98.75,
  },

  'kpv': {
    slug: 'kpv',
    casNumber: '67727-97-3',
    molecularFormula: 'C16H30N6O4',
    molecularWeight: 370.45,
    sequence: 'Lys-Pro-Val',
    synonyms: ['KPV', 'Alpha-MSH Fragment', 'α-MSH (11-13)', 'Anti-inflammatory Tripeptide'],
    appearance: 'White powder',
    solubility: 'Freely soluble in water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 30 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water or Sterile Water',
      volume: '2ml per 5mg vial',
      notes: 'Very small tripeptide with high stability. Can also be used orally in research.',
    },
    researchSummary: `KPV is a tripeptide fragment of alpha-melanocyte stimulating hormone (α-MSH) that retains the anti-inflammatory properties without melanotropic effects.

Key Research Areas:
• Anti-inflammatory effects
• Gut inflammation (IBD research)
• Wound healing
• Antimicrobial properties
• Skin inflammation

KPV is increasingly researched for inflammatory bowel conditions due to its potent anti-inflammatory effects.`,
    mechanism: 'KPV exerts anti-inflammatory effects by inhibiting NF-κB activation and reducing pro-inflammatory cytokine production. It does not act on melanocortin receptors.',
    coaAvailable: true,
    hplcPurity: 99.55,
  },

  'dsip': {
    slug: 'dsip',
    casNumber: '62568-57-4',
    molecularFormula: 'C35H48N10O15',
    molecularWeight: 848.81,
    sequence: 'Trp-Ala-Gly-Gly-Asp-Ala-Ser-Gly-Glu',
    synonyms: ['Delta Sleep-Inducing Peptide', 'DSIP', 'Sleep Peptide'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in water and bacteriostatic water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 14 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Bacteriostatic Water',
      volume: '2ml per 5mg vial',
      notes: 'Research peptide for sleep studies. Evening administration typical in research protocols.',
    },
    researchSummary: `DSIP (Delta Sleep-Inducing Peptide) was first isolated from rabbit brain and has been studied for its effects on sleep architecture, stress response, and various physiological processes.

Key Research Areas:
• Sleep quality and architecture
• Stress and anxiety
• Pain modulation
• Hormone regulation
• Alcohol and drug withdrawal

DSIP shows promise in research related to sleep disorders and stress-related conditions.`,
    mechanism: 'DSIP appears to promote delta wave sleep (deep sleep) and may modulate cortisol levels and stress responses. Its exact mechanism is still under investigation.',
    coaAvailable: true,
    hplcPurity: 99.12,
  },

  'follistatin-344': {
    slug: 'follistatin-344',
    casNumber: 'N/A',
    molecularFormula: 'C1546H2432N412O466S21',
    molecularWeight: 35133.13,
    synonyms: ['Follistatin 344', 'FS-344', 'FST344', 'Activin-binding Protein'],
    appearance: 'White lyophilized powder',
    solubility: 'Soluble in sterile water',
    storage: {
      lyophilized: 'Store at -20°C',
      reconstituted: 'Store at 2-8°C for up to 7 days',
      temperature: '-20°C (lyophilized) / 2-8°C (reconstituted)',
    },
    reconstitution: {
      solvent: 'Sterile Water',
      volume: '1ml per 1mg vial',
      notes: 'Large protein - handle gently. Do not shake. Aliquot if not using entire vial.',
    },
    researchSummary: `Follistatin-344 is a naturally occurring protein that binds and neutralizes members of the TGF-β superfamily, particularly myostatin (GDF-8) and activins.

Key Research Areas:
• Muscle growth and regeneration
• Myostatin inhibition
• Fertility research
• Tissue repair
• Metabolic disorders

Follistatin-344 is one of the most studied proteins for potential muscle-enhancing applications.`,
    mechanism: 'Follistatin binds to and inhibits activins, myostatin, and other TGF-β family members, leading to reduced negative regulation of muscle growth and other tissue-specific effects.',
    coaAvailable: true,
    hplcPurity: 98.50,
  },
};

// Helper function to get chemistry data by product slug
export function getPeptideChemistry(slug: string): PeptideChemistry | undefined {
  return peptideChemistryData[slug];
}

// Get all available COA peptides
export function getPeptidesWithCOA(): string[] {
  return Object.keys(peptideChemistryData).filter(
    slug => peptideChemistryData[slug].coaAvailable
  );
}

// Reconstitution calculator
export interface ReconstitutionResult {
  volumePerDose: number;
  totalDoses: number;
  concentration: number;
}

export function calculateReconstitution(
  peptideMg: number,
  waterMl: number,
  desiredDoseMcg: number
): ReconstitutionResult {
  const totalMcg = peptideMg * 1000;
  const concentrationMcgPerMl = totalMcg / waterMl;
  const volumePerDose = desiredDoseMcg / concentrationMcgPerMl;
  const totalDoses = totalMcg / desiredDoseMcg;

  return {
    volumePerDose: Math.round(volumePerDose * 100) / 100,
    totalDoses: Math.floor(totalDoses),
    concentration: Math.round(concentrationMcgPerMl * 100) / 100,
  };
}
