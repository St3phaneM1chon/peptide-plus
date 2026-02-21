'use client';

import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';

// Map article slugs to related product pages
const articleProductMap: Record<string, { slug: string; name: string }[]> = {
  'bpc-157-research-overview': [
    { slug: 'bpc-157', name: 'BPC-157' },
  ],
  'tb500-healing-peptide': [
    { slug: 'tb-500', name: 'TB-500' },
  ],
  'glp1-agonists-explained': [
    { slug: 'semaglutide', name: 'Semaglutide' },
    { slug: 'tirzepatide', name: 'Tirzepatide' },
    { slug: 'retatrutide', name: 'Retatrutide' },
  ],
  'how-to-reconstitute-peptides': [
    { slug: 'bac-water', name: 'Bacteriostatic Water' },
  ],
  'peptide-calculator-guide': [
    { slug: 'bac-water', name: 'Bacteriostatic Water' },
  ],
};

// Article content data
const articlesContent: Record<string, {
  title: string;
  category: string;
  readTime: string;
  author: string;
  date: string;
  content: string;
}> = {
  'what-are-peptides': {
    title: 'What Are Peptides? A Beginner\'s Guide',
    category: 'Education',
    readTime: '5 min read',
    author: 'Peptide Plus+ Research Team',
    date: 'January 15, 2026',
    content: `
## Introduction to Peptides

Peptides are short chains of amino acids linked by peptide bonds. They are essentially smaller versions of proteins, typically containing between 2 and 50 amino acids. When chains exceed 50 amino acids, they are generally referred to as proteins.

## How Are Peptides Different from Proteins?

The main difference between peptides and proteins is size. Peptides are smaller and have simpler structures, while proteins are larger and more complex. However, both are made up of amino acids and play crucial roles in biological functions.

### Key Differences:
- **Size**: Peptides contain 2-50 amino acids; proteins have 50+ amino acids
- **Structure**: Peptides have simpler structures; proteins have complex 3D folding
- **Function**: Both serve as signaling molecules, but proteins often have structural roles

## Types of Peptides

### Signal Peptides
These direct the transport of proteins within cells and help proteins reach their proper destinations.

### Neuropeptides
Found in neural tissue, these peptides act as neurotransmitters or modulate neurological functions.

### Peptide Hormones
Include insulin, growth hormone releasing peptides (GHRPs), and others that regulate various physiological processes.

### Antimicrobial Peptides
Part of the innate immune response, these peptides help fight off bacterial infections.

## Why Are Peptides Important for Research?

Peptides have become essential tools in scientific research because:

1. **Specific Actions**: They can target specific receptors with high precision
2. **Natural Compounds**: Many are naturally occurring in the body
3. **Diverse Applications**: From drug development to understanding biological mechanisms
4. **Lower Side Effects**: Generally show fewer side effects than larger molecules

## Common Research Peptides

### BPC-157
A pentadecapeptide studied for its regenerative properties in tissue healing research.

### TB-500
Thymosin Beta-4, researched for its role in tissue repair and recovery.

### GLP-1 Agonists
Including semaglutide and tirzepatide, studied for metabolic research.

### Growth Hormone Secretagogues
Like ipamorelin and sermorelin, researched for their effects on growth hormone release.

## Conclusion

Peptides represent a fascinating and rapidly growing area of scientific research. Their diverse functions and high specificity make them valuable tools for researchers across many disciplines. As our understanding of peptide biology grows, so too does their potential for advancing scientific knowledge.

---

*This article is for educational purposes only. Always consult qualified professionals for research guidance.*
    `,
  },
  'how-to-reconstitute-peptides': {
    title: 'How to Reconstitute Peptides: Step-by-Step Guide',
    category: 'How-To',
    readTime: '7 min read',
    author: 'Peptide Plus+ Research Team',
    date: 'January 10, 2026',
    content: `
## Why Proper Reconstitution Matters

Reconstitution is the process of dissolving lyophilized (freeze-dried) peptides into a liquid solution. Proper technique is crucial for:

- Maintaining peptide integrity
- Ensuring accurate research results
- Preventing bacterial contamination
- Maximizing peptide stability

## What You'll Need

### Required Materials:
- Lyophilized peptide vial
- Bacteriostatic water (BAC water) - preferred
- Sterile syringes with needles
- Alcohol swabs
- Clean workspace

### Why Bacteriostatic Water?

Bacteriostatic water contains 0.9% benzyl alcohol, which:
- Prevents bacterial growth
- Allows for multiple uses from the same vial
- Extends the shelf life of reconstituted peptides

**Note:** Sterile water can also be used but must be used immediately as it doesn't contain preservatives.

## Step-by-Step Reconstitution

### Step 1: Prepare Your Workspace
- Work in a clean, well-lit area
- Wash hands thoroughly
- Gather all materials

### Step 2: Calculate Your Volume
Use this formula:

\`\`\`
Peptide amount (mg) × 1000 = Total mcg
Total mcg ÷ Desired concentration (mcg/ml) = Volume of water (ml)
\`\`\`

**Example:** 10mg peptide, wanting 500mcg/0.1ml concentration:
- 10mg × 1000 = 10,000 mcg
- 10,000 ÷ 5,000 = 2ml of BAC water

### Step 3: Sterilize Everything
- Wipe the rubber stopper of both vials with alcohol swabs
- Let dry for 30 seconds

### Step 4: Add Solvent Carefully
1. Draw the calculated amount of BAC water into your syringe
2. Insert needle through the rubber stopper
3. **CRITICAL:** Aim the stream at the SIDE of the vial, not directly on the powder
4. Release slowly, letting water run down the glass wall

### Step 5: Let It Dissolve
- Do NOT shake the vial
- Gently swirl or rotate
- Let sit for a few minutes if needed
- The solution should become clear

### Step 6: Store Properly
- Place in refrigerator (2-8°C)
- Keep away from light
- Use within 14-30 days (varies by peptide)

## Common Mistakes to Avoid

❌ **Spraying water directly on the powder** - This can denature the peptide

❌ **Shaking vigorously** - Can cause protein denaturation

❌ **Using too little water** - Creates an overly concentrated solution

❌ **Freezing reconstituted peptides** - Never freeze; it destroys the structure

❌ **Contaminating the stopper** - Always sterilize before inserting needle

## Storage Guidelines

| State | Temperature | Duration |
|-------|-------------|----------|
| Lyophilized | -20°C | 24+ months |
| Lyophilized | 2-8°C | 3-6 months |
| Reconstituted | 2-8°C | 14-30 days |
| Reconstituted | Room temp | NOT recommended |

## Troubleshooting

### Solution is cloudy
- May indicate contamination or degradation
- Do not use; start with a new vial

### Powder won't dissolve
- Let sit longer (up to 30 minutes)
- Gently swirl periodically
- Try slight warming (room temperature only)

### White particles visible
- Could be undissolved peptide or contamination
- Gently swirl again
- If persists, do not use

---

*For research purposes only. Follow your institution's guidelines and protocols.*
    `,
  },
  'peptide-storage-guide': {
    title: 'Peptide Storage: Best Practices for Researchers',
    category: 'How-To',
    readTime: '4 min read',
    author: 'Peptide Plus+ Research Team',
    date: 'January 8, 2026',
    content: `
## Why Proper Storage Matters

Peptides are sensitive biological molecules that can degrade when exposed to improper conditions. Proper storage is essential for:

- Maintaining peptide activity and potency
- Extending shelf life
- Ensuring reproducible research results
- Protecting your investment

## Lyophilized (Powder) Peptide Storage

### Optimal Conditions
- **Temperature:** -20°C (freezer) for long-term storage
- **Light:** Keep in original amber vial or wrap in foil
- **Humidity:** Keep vial sealed to prevent moisture absorption
- **Duration:** Up to 24 months at -20°C

### What to Avoid
❌ Room temperature storage
❌ Direct sunlight or UV exposure
❌ Repeated freeze-thaw cycles
❌ Humid environments

## Reconstituted Peptide Storage

### Optimal Conditions
- **Temperature:** 2-8°C (refrigerator) - NEVER freeze
- **Light:** Protect from light
- **Duration:** 14-30 days (varies by peptide)

### Why Not Freeze Reconstituted Peptides?
Freezing causes ice crystal formation that damages protein structure, concentration changes, and denaturation.

## Signs of Peptide Degradation

⚠️ **Cloudy solution** - Possible contamination
⚠️ **Color change** - Oxidation or degradation
⚠️ **Precipitate at bottom** - Peptide falling out
⚠️ **Unusual odor** - Bacterial contamination

## Summary Table

| Peptide State | Temperature | Duration |
|--------------|-------------|----------|
| Lyophilized (long-term) | -20°C | 24 months |
| Lyophilized (short-term) | 2-8°C | 1-3 months |
| Reconstituted | 2-8°C | 14-30 days |

---

*Proper storage protects your research investment.*
    `,
  },
  'understanding-coa-documents': {
    title: 'Understanding Certificate of Analysis (COA) Documents',
    category: 'Education',
    readTime: '6 min read',
    author: 'Peptide Plus+ Research Team',
    date: 'January 5, 2026',
    content: `
## What is a Certificate of Analysis?

A Certificate of Analysis (COA) is an official document providing detailed testing results for a specific batch of peptides. It verifies quality and helps researchers confirm products meet specifications.

## Key Components of a COA

### 1. HPLC Analysis
- **Purity percentage:** 95%+ standard; 99%+ premium
- **Chromatogram:** Visual representation of purity
- Main peak = Your peptide; Small peaks = Impurities

### 2. Mass Spectrometry (MS)
- **Theoretical MW:** Expected molecular weight
- **Observed MW:** Actual measured weight
- **Difference:** Should be <1 Da

### 3. Additional Information
- Batch/Lot number
- Manufacturing and expiration dates
- Physical appearance
- Storage recommendations

## How to Interpret Purity Results

**99%+:** Excellent - suitable for sensitive research
**95-98%:** Standard - acceptable for most applications
**<95%:** Lower quality - may affect results

## Red Flags to Watch For

⚠️ Missing COA
⚠️ Generic COA (same for multiple batches)
⚠️ No batch number
⚠️ Inconsistent molecular weight
⚠️ No chromatogram provided

---

*Always review COAs before using peptides in research.*
    `,
  },
  'bpc-157-research-overview': {
    title: 'BPC-157 Research Overview: What Scientists Have Discovered',
    category: 'Research',
    readTime: '10 min read',
    author: 'Peptide Plus+ Research Team',
    date: 'January 3, 2026',
    content: `
## Introduction to BPC-157

BPC-157 (Body Protection Compound-157) is a pentadecapeptide consisting of 15 amino acids, derived from a protective protein found in human gastric juice.

**Sequence:** Gly-Glu-Pro-Pro-Pro-Gly-Lys-Pro-Ala-Asp-Asp-Ala-Gly-Leu-Val
**CAS Number:** 137525-51-0
**Molecular Weight:** 1419.53 Da

## Key Research Areas

### 1. Gastrointestinal Healing
- Accelerated healing of GI tract injuries
- Protection against NSAID-induced damage
- Anti-inflammatory effects

### 2. Tendon and Ligament Repair
- Accelerated healing in transection models
- Improved collagen organization
- Enhanced mechanical properties

### 3. Wound Healing
- Accelerated skin wound closure
- Improved burn healing
- Enhanced vascularization

### 4. Neuroprotection
- Peripheral nerve regeneration
- CNS protection research
- Dopaminergic system interactions

## Proposed Mechanisms

- Upregulation of growth hormone receptors
- Enhanced expression of growth factors (EGF, VEGF)
- Interaction with nitric oxide system
- Promotion of angiogenesis

## Scientific References

1. Sikiric P, et al. "Pentadecapeptide BPC 157 and its effects in the healing of various tissues"
2. Chang CH, et al. "The promoting effect of pentadecapeptide BPC 157 on tendon healing"

---

*For educational purposes only. BPC-157 is sold for research use only.*
    `,
  },
  'glp1-agonists-explained': {
    title: 'GLP-1 Agonists Explained: Semaglutide, Tirzepatide & Retatrutide',
    category: 'Research',
    readTime: '12 min read',
    author: 'Peptide Plus+ Research Team',
    date: 'January 1, 2026',
    content: `
## Introduction to GLP-1 Agonists

GLP-1 (Glucagon-Like Peptide-1) agonists mimic the effects of the naturally occurring incretin hormone GLP-1, playing a crucial role in glucose homeostasis and appetite regulation.

## Semaglutide

**CAS Number:** 910463-68-2
**Half-life:** ~7 days (weekly dosing)

### Research Findings (STEP Trials)
- Average weight loss: 15-17%
- Improved glycemic control
- Cardiovascular benefits

## Tirzepatide (Dual GIP/GLP-1 Agonist)

**CAS Number:** 2023788-19-2
**Mechanism:** Activates both GLP-1 and GIP receptors

### Research Results (SURMOUNT Trials)
- Weight loss up to 22%
- Superior to GLP-1 monotherapy

## Retatrutide (Triple Agonist)

**CAS Number:** 2381089-83-2
**Mechanism:** GIP + GLP-1 + Glucagon receptors

### Early Results
- Weight loss up to 24% at highest doses
- Enhanced fat oxidation from glucagon component

## Comparison

| Feature | Semaglutide | Tirzepatide | Retatrutide |
|---------|-------------|-------------|-------------|
| Receptors | GLP-1 | GIP + GLP-1 | GIP + GLP-1 + Glucagon |
| Max Weight Loss | ~17% | ~22% | ~24% |

---

*For educational and research purposes only.*
    `,
  },
  'tb500-healing-peptide': {
    title: 'TB-500: The Healing Peptide in Research',
    category: 'Research',
    readTime: '8 min read',
    author: 'Peptide Plus+ Research Team',
    date: 'December 28, 2025',
    content: `
## What is TB-500?

TB-500 (Thymosin Beta-4) is a 43-amino acid peptide occurring naturally in almost all human and animal cells, playing a crucial role in tissue regeneration and repair.

**CAS Number:** 77591-33-4
**Molecular Weight:** 4963.44 Da

## Natural Functions

### Actin Regulation
- Sequesters monomeric actin
- Controls cell motility and migration
- Essential for cytoskeletal organization

### Wound Healing
- Promotes keratinocyte migration
- Enhances angiogenesis
- Reduces inflammation

## Research Applications

### Wound Healing
- Accelerated wound closure
- Enhanced re-epithelialization
- Improved granulation tissue

### Tendon and Ligament
- Improved tendon healing
- Enhanced collagen deposition
- Better mechanical properties

### Cardiac Research
- Post-infarction recovery models
- Myocardial protection studies

## TB-500 vs. BPC-157

| Aspect | TB-500 | BPC-157 |
|--------|--------|---------|
| Size | 43 amino acids | 15 amino acids |
| Origin | Thymus-derived | Gastric juice |
| Focus | Systemic healing | Localized healing |

---

*TB-500 is sold for research purposes only.*
    `,
  },
  'peptide-calculator-guide': {
    title: 'How to Use a Peptide Calculator for Reconstitution',
    category: 'How-To',
    readTime: '5 min read',
    author: 'Peptide Plus+ Research Team',
    date: 'December 25, 2025',
    content: `
## Why Use a Peptide Calculator?

Proper reconstitution requires accurate calculations. A peptide calculator simplifies this and prevents errors.

## The Core Formula

**Concentration = Peptide Amount (mcg) ÷ Volume of Water (ml)**

## Example Calculation

### Given:
- Peptide vial: 10mg
- Desired dose: 250mcg
- Desired volume: 0.1ml per injection

### Steps:
1. Convert: 10mg × 1000 = 10,000mcg
2. Concentration needed: 250mcg ÷ 0.1ml = 2,500mcg/ml
3. Water volume: 10,000 ÷ 2,500 = **4ml BAC water**
4. Total doses: 10,000 ÷ 250 = 40 doses

## Quick Reference Chart

| Peptide | BAC Water | Result per 0.1ml |
|---------|-----------|------------------|
| 5mg + 1ml | | 500mcg |
| 5mg + 2ml | | 250mcg |
| 10mg + 2ml | | 500mcg |
| 10mg + 4ml | | 250mcg |

## Reading Insulin Syringes

- 100 unit syringe = 1ml total
- 10 units = 0.1ml
- 50 units = 0.5ml

---

*Use our online Peptide Calculator for automatic calculations!*
    `,
  },
};

export default function ArticlePage() {
  const params = useParams();
  const slug = params.slug as string;

  const article = articlesContent[slug];

  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <section className="bg-gradient-to-br from-neutral-900 via-neutral-800 to-black text-white py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/learn" className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 mb-6">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Learning Center
          </Link>
          
          <span className="inline-block px-3 py-1 bg-orange-500/20 text-orange-400 text-sm font-medium rounded-full mb-4">
            {article.category}
          </span>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {article.title}
          </h1>
          
          <div className="flex flex-wrap items-center gap-4 text-neutral-400 text-sm">
            <span>{article.author}</span>
            <span>•</span>
            <span>{article.date}</span>
            <span>•</span>
            <span>{article.readTime}</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12">
          <div 
            className="prose prose-lg prose-gray max-w-none
              prose-headings:text-gray-900 prose-headings:font-bold
              prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
              prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
              prose-p:text-gray-600 prose-p:leading-relaxed
              prose-li:text-gray-600
              prose-strong:text-gray-900
              prose-code:bg-gray-100 prose-code:px-2 prose-code:py-0.5 prose-code:rounded
              prose-table:w-full prose-th:bg-gray-50 prose-th:p-3 prose-td:p-3 prose-td:border-t"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                article.content
                  .replace(/\n## /g, '\n<h2>')
                  .replace(/\n### /g, '\n<h3>')
                  .replace(/<h2>([^<]+)/g, '<h2>$1</h2>')
                  .replace(/<h3>([^<]+)/g, '<h3>$1</h3>')
                  .replace(/\n- \*\*/g, '\n<li><strong>')
                  .replace(/\*\*:/g, '</strong>:')
                  .replace(/\n❌/g, '\n<p class="text-red-600">❌')
                  .replace(/\n\n/g, '</p>\n<p>'),
                { ALLOWED_TAGS: ['h2', 'h3', 'p', 'li', 'strong', 'em', 'ul', 'ol', 'a', 'br', 'code', 'pre', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'mark', 'span', 'div'], ALLOWED_ATTR: ['class', 'href', 'target', 'rel'] }
              )
            }}
          />
        </div>

        {/* Related Products CTA */}
        {articleProductMap[slug] && articleProductMap[slug].length > 0 && (
          <div className="mt-8 p-6 bg-purple-50 border border-purple-100 rounded-lg">
            <h3 className="font-semibold text-gray-900 mb-3">Interested in {articleProductMap[slug].length === 1 ? 'this peptide' : 'these peptides'}?</h3>
            <div className="flex flex-wrap gap-3">
              {articleProductMap[slug].map((product) => (
                <Link
                  key={product.slug}
                  href={`/product/${product.slug}`}
                  className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium transition-colors"
                >
                  View {product.name}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Related Articles */}
        <div className="mt-12">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Continue Learning</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              href="/learn/what-are-peptides"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <span className="text-xs text-orange-600 font-medium">Education</span>
              <h4 className="font-semibold text-gray-900 mt-2">What Are Peptides?</h4>
            </Link>
            <Link
              href="/learn/peptide-storage-guide"
              className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <span className="text-xs text-orange-600 font-medium">How-To</span>
              <h4 className="font-semibold text-gray-900 mt-2">Peptide Storage Guide</h4>
            </Link>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 bg-orange-50 rounded-xl p-8 text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Start Your Research?</h3>
          <p className="text-gray-600 mb-6">
            Browse our collection of high-purity research peptides.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            Shop Peptides
          </Link>
        </div>
      </article>
    </div>
  );
}
