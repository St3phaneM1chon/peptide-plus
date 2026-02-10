export const dynamic = 'force-dynamic';
/**
 * PAGE ACCESSIBILITÉ
 */

export const metadata = {
  title: 'Accessibilité | Peptide Plus+',
  description: 'Notre engagement pour rendre notre plateforme accessible à tous.',
};

export default function AccessibilityPage() {
  const lastUpdated = '21 janvier 2026';

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <section className="bg-gray-900 text-white py-20 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="text-5xl block mb-6">♿</span>
          <h1 className="text-4xl font-bold mb-6">Accessibilité</h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            Nous nous engageons à rendre notre plateforme accessible à tous,
            conformément aux normes WCAG 2.1 niveau AA.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-8">
          <p className="text-sm text-gray-400 mb-8">
            Dernière mise à jour: {lastUpdated}
          </p>

          <div className="space-y-10 text-gray-600">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Notre engagement</h2>
              <p>
                Peptide Plus+ s'engage à garantir l'accessibilité numérique de sa plateforme 
                conformément aux normes WCAG 2.1 niveau AA.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Conformité</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>WCAG 2.1 niveau AA</strong> - Web Content Accessibility Guidelines</li>
                <li><strong>Section 508</strong> - US Rehabilitation Act</li>
                <li><strong>EN 301 549</strong> - Norme européenne d'accessibilité</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Mesures prises</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Navigation au clavier complète</li>
                <li>Textes alternatifs pour toutes les images</li>
                <li>Contraste de couleurs conforme WCAG 2.1 AA</li>
                <li>Structure sémantique HTML5</li>
                <li>Compatibilité avec les lecteurs d'écran</li>
                <li>Tailles de police ajustables</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contact</h2>
              <p>
                Si vous rencontrez des difficultés d'accessibilité sur notre site,
                n'hésitez pas à nous contacter à{' '}
                <a href="mailto:support@biocyclepeptides.com" className="text-blue-600 hover:underline">
                  support@biocyclepeptides.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
