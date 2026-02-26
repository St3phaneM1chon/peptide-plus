// SEC-FIX: Migrated to withAdminGuard for consistent auth + CSRF + rate limiting
import { NextRequest, NextResponse } from 'next/server';
import { withAdminGuard } from '@/lib/admin-api-guard';
import { logger } from '@/lib/logger';

export const POST = withAdminGuard(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const { productName, category, attributes, language = 'fr' } = body as {
      productName: string;
      category?: string;
      attributes?: Record<string, string>;
      language?: string;
    };

    if (!productName) {
      return NextResponse.json({ error: 'Nom du produit requis' }, { status: 400 });
    }

    // Generate description using templates (no external API dependency)
    const attrList = attributes ? Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
    const catContext = category ? ` dans la categorie ${category}` : '';

    const descriptions = {
      fr: {
        short: `${productName}${catContext} - Peptide de recherche de haute qualite. ${attrList ? `Caracteristiques: ${attrList}.` : ''} Certificat d'analyse disponible.`,
        full: `Decouvrez ${productName}, un peptide de recherche${catContext} soigneusement synthetise selon les normes les plus strictes de l'industrie. ${attrList ? `\n\nSpecifications: ${attrList}` : ''}\n\nChaque lot est accompagne d'un certificat d'analyse (COA) et d'un rapport HPLC attestant de la purete du produit. Stockage recommande: refrigere a -20\u00b0C.\n\nA usage de recherche uniquement.`,
        meta: `${productName} - Peptide de recherche haute qualite | BioCycle Peptides`,
        metaDesc: `Achetez ${productName}${catContext}. Purete certifiee, COA inclus. Livraison rapide au Canada. BioCycle Peptides.`,
      },
      en: {
        short: `${productName}${catContext ? ` in ${category}` : ''} - High-quality research peptide. ${attrList ? `Features: ${attrList}.` : ''} Certificate of Analysis included.`,
        full: `Discover ${productName}, a research peptide${catContext ? ` in ${category}` : ''} carefully synthesized to the highest industry standards. ${attrList ? `\n\nSpecifications: ${attrList}` : ''}\n\nEach batch includes a Certificate of Analysis (COA) and HPLC report confirming product purity. Recommended storage: refrigerated at -20\u00b0C.\n\nFor research use only.`,
        meta: `${productName} - High Quality Research Peptide | BioCycle Peptides`,
        metaDesc: `Buy ${productName}${catContext ? ` in ${category}` : ''}. Certified purity, COA included. Fast shipping in Canada. BioCycle Peptides.`,
      },
    };

    const result = descriptions[language as keyof typeof descriptions] || descriptions.fr;

    return NextResponse.json({
      shortDescription: result.short,
      fullDescription: result.full,
      metaTitle: result.meta,
      metaDescription: result.metaDesc,
      language,
    });
  } catch (error) {
    logger.error('AI describe error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
