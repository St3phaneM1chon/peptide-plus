/**
 * PAGE ACCESSIBILITÉ
 */

export const metadata = {
  title: 'Accessibilité | Formations Pro',
  description: 'Notre engagement pour rendre notre plateforme accessible à tous.',
};

export default function AccessibilityPage() {
  const lastUpdated = '21 janvier 2026';

  return (
    <div style={{ backgroundColor: 'var(--gray-100)' }}>
      {/* Hero */}
      <section
        style={{
          backgroundColor: 'var(--gray-500)',
          color: 'white',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '24px' }}>♿</span>
          <h1 style={{ fontSize: '42px', fontWeight: 700, marginBottom: '24px' }}>
            Accessibilité
          </h1>
          <p style={{ fontSize: '18px', opacity: 0.9, lineHeight: 1.7 }}>
            Nous nous engageons à rendre notre plateforme accessible à tous, 
            quelles que soient leurs capacités.
          </p>
        </div>
      </section>

      {/* Content */}
      <section style={{ padding: '64px 24px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '48px' }}>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)', marginBottom: '32px' }}>
              Dernière mise à jour: {lastUpdated}
            </p>

            <div style={{ fontSize: '15px', color: 'var(--gray-500)', lineHeight: 1.8 }}>
              <Section title="Notre engagement">
                <p>
                  {process.env.NEXT_PUBLIC_SITE_NAME || 'Formations Pro'} s'engage à garantir l'accessibilité numérique 
                  de sa plateforme conformément aux normes WCAG 2.1 niveau AA. Nous travaillons continuellement 
                  à améliorer l'expérience utilisateur pour tous.
                </p>
              </Section>

              <Section title="Conformité actuelle">
                <p>
                  Notre plateforme vise la conformité avec les normes suivantes:
                </p>
                <ul>
                  <li><strong>WCAG 2.1 niveau AA</strong> - Web Content Accessibility Guidelines</li>
                  <li><strong>Section 508</strong> - US Rehabilitation Act</li>
                  <li><strong>EN 301 549</strong> - Norme européenne d'accessibilité</li>
                </ul>
              </Section>

              <Section title="Fonctionnalités d'accessibilité">
                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>
                  Navigation
                </h3>
                <ul>
                  <li>Navigation complète au clavier</li>
                  <li>Liens d'évitement vers le contenu principal</li>
                  <li>Structure de titres logique (h1-h6)</li>
                  <li>Indicateurs de focus visibles</li>
                </ul>

                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>
                  Contenu visuel
                </h3>
                <ul>
                  <li>Textes alternatifs pour les images</li>
                  <li>Contraste de couleurs suffisant (ratio 4.5:1 minimum)</li>
                  <li>Possibilité d'agrandir le texte jusqu'à 200%</li>
                  <li>Interface adaptée aux préférences de réduction de mouvement</li>
                </ul>

                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>
                  Contenu multimédia
                </h3>
                <ul>
                  <li>Sous-titres sur toutes les vidéos</li>
                  <li>Transcriptions textuelles disponibles</li>
                  <li>Contrôles de lecture accessibles</li>
                  <li>Pas de lecture automatique avec son</li>
                </ul>

                <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '20px', marginBottom: '12px' }}>
                  Formulaires
                </h3>
                <ul>
                  <li>Labels associés à tous les champs</li>
                  <li>Messages d'erreur clairs et descriptifs</li>
                  <li>Indications sur les champs obligatoires</li>
                  <li>Temps suffisant pour compléter les actions</li>
                </ul>
              </Section>

              <Section title="Technologies d'assistance">
                <p>
                  Notre plateforme est compatible avec les technologies d'assistance suivantes:
                </p>
                <ul>
                  <li><strong>Lecteurs d'écran:</strong> NVDA, JAWS, VoiceOver</li>
                  <li><strong>Navigation vocale:</strong> Dragon NaturallySpeaking</li>
                  <li><strong>Loupes d'écran:</strong> ZoomText, Windows Magnifier</li>
                  <li><strong>Contrôle alternatif:</strong> Switch Control, Eye tracking</li>
                </ul>
              </Section>

              <Section title="Navigateurs supportés">
                <ul>
                  <li>Google Chrome (dernières 2 versions)</li>
                  <li>Mozilla Firefox (dernières 2 versions)</li>
                  <li>Apple Safari (dernières 2 versions)</li>
                  <li>Microsoft Edge (dernières 2 versions)</li>
                </ul>
              </Section>

              <Section title="Limitations connues">
                <p>
                  Malgré nos efforts, certains contenus peuvent présenter des limitations:
                </p>
                <ul>
                  <li>Certains PDF anciens peuvent ne pas être entièrement accessibles</li>
                  <li>Certains contenus tiers (intégrations) peuvent avoir une accessibilité variable</li>
                </ul>
                <p style={{ marginTop: '16px' }}>
                  Nous travaillons activement à résoudre ces problèmes. Si vous rencontrez 
                  des difficultés, contactez-nous pour obtenir le contenu dans un format alternatif.
                </p>
              </Section>

              <Section title="Signaler un problème">
                <p>
                  Si vous rencontrez des difficultés d'accessibilité sur notre plateforme, 
                  nous vous invitons à nous contacter:
                </p>
                <ul style={{ listStyle: 'none', padding: 0, marginTop: '16px' }}>
                  <li>📧 <a href="mailto:accessibilite@formationspro.com" style={{ color: 'var(--gray-500)' }}>accessibilite@formationspro.com</a></li>
                  <li>📞 {process.env.NEXT_PUBLIC_PHONE || '1-800-XXX-XXXX'}</li>
                </ul>
                <p style={{ marginTop: '16px' }}>
                  Veuillez inclure:
                </p>
                <ul>
                  <li>L'URL de la page concernée</li>
                  <li>Une description du problème rencontré</li>
                  <li>La technologie d'assistance utilisée (si applicable)</li>
                </ul>
              </Section>

              <Section title="Plan d'amélioration">
                <p>
                  Nous nous engageons à améliorer continuellement l'accessibilité de notre plateforme:
                </p>
                <ul>
                  <li>Audits d'accessibilité trimestriels</li>
                  <li>Formation de nos équipes aux bonnes pratiques</li>
                  <li>Tests utilisateurs avec des personnes en situation de handicap</li>
                  <li>Mise à jour des contenus existants</li>
                </ul>
              </Section>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px', color: 'var(--gray-500)' }}>
        {title}
      </h2>
      {children}
      <style jsx>{`
        ul { padding-left: 20px; margin: 8px 0; }
        li { margin-bottom: 8px; }
      `}</style>
    </section>
  );
}
