import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'OWNER' && session.user.role !== 'EMPLOYEE')) {
      return NextResponse.json({ error: 'Non autoris\u00e9' }, { status: 401 });
    }

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
    const catContext = category ? ` dans la cat\u00e9gorie ${category}` : '';

    const descriptions = {
      fr: {
        short: `${productName}${catContext} - Peptide de recherche de haute qualit\u00e9. ${attrList ? `Caract\u00e9ristiques: ${attrList}.` : ''} Certificat d'analyse disponible.`,
        full: `D\u00e9couvrez ${productName}, un peptide de recherche${catContext} soigneusement synth\u00e9tis\u00e9 selon les normes les plus strictes de l'industrie. ${attrList ? `\n\nSp\u00e9cifications: ${attrList}` : ''}\n\nChaque lot est accompagn\u00e9 d'un certificat d'analyse (COA) et d'un rapport HPLC attestant de la puret\u00e9 du produit. Stockage recommand\u00e9: r\u00e9frig\u00e9r\u00e9 \u00e0 -20\u00b0C.\n\n\u00c0 usage de recherche uniquement.`,
        meta: `${productName} - Peptide de recherche haute qualit\u00e9 | BioCycle Peptides`,
        metaDesc: `Achetez ${productName}${catContext}. Puret\u00e9 certifi\u00e9e, COA inclus. Livraison rapide au Canada. BioCycle Peptides.`,
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
    console.error('AI describe error:', error);
    return NextResponse.json({ error: 'Erreur de g\u00e9n\u00e9ration' }, { status: 500 });
  }
}
