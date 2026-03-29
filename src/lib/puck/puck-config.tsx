/**
 * Puck Page Builder Configuration — Koraline Suite
 *
 * 30+ composants organisés en 6 catégories.
 * Chaque composant a des fields visuels (color picker, spacing, animation).
 */

import React from 'react';
import { DropZone, type Config, type Data } from '@measured/puck';
import DOMPurify from 'isomorphic-dompurify';
import { ImagePickerField } from './fields/ImagePickerField';

// ── Animation presets ──────────────────────────────────────────
export const ANIMATION_OPTIONS = [
  { label: 'Aucune', value: 'none' },
  { label: 'Fondu', value: 'fadeIn' },
  { label: 'Glisser vers le haut', value: 'slideUp' },
  { label: 'Glisser depuis la gauche', value: 'slideLeft' },
  { label: 'Glisser depuis la droite', value: 'slideRight' },
  { label: 'Zoom', value: 'scale' },
  { label: 'Rebond', value: 'bounce' },
  { label: 'Parallaxe', value: 'parallax' },
  { label: 'Rotation', value: 'rotateIn' },
  { label: 'Flou → Net', value: 'blur' },
];

// ── Common field definitions ───────────────────────────────────
const commonFields = {
  animation: {
    type: 'select' as const,
    label: 'Animation',
    options: ANIMATION_OPTIONS,
  },
  paddingTop: {
    type: 'select' as const,
    label: 'Espacement haut',
    options: [
      { label: 'Aucun', value: '0' },
      { label: 'Petit', value: '2rem' },
      { label: 'Moyen', value: '4rem' },
      { label: 'Grand', value: '6rem' },
      { label: 'Très grand', value: '8rem' },
    ],
  },
  paddingBottom: {
    type: 'select' as const,
    label: 'Espacement bas',
    options: [
      { label: 'Aucun', value: '0' },
      { label: 'Petit', value: '2rem' },
      { label: 'Moyen', value: '4rem' },
      { label: 'Grand', value: '6rem' },
      { label: 'Très grand', value: '8rem' },
    ],
  },
  backgroundColor: {
    type: 'text' as const,
    label: 'Couleur de fond (hex ou gradient)',
  },
  textColor: {
    type: 'text' as const,
    label: 'Couleur du texte (hex)',
  },
  borderRadius: {
    type: 'select' as const,
    label: 'Coins arrondis',
    options: [
      { label: 'Aucun', value: '0' },
      { label: 'Léger', value: '0.5rem' },
      { label: 'Moyen', value: '1rem' },
      { label: 'Grand', value: '1.5rem' },
      { label: 'Très grand', value: '2rem' },
    ],
  },
  hideOnMobile: {
    type: 'radio' as const,
    label: 'Masquer sur mobile',
    options: [
      { label: 'Non', value: 'false' },
      { label: 'Oui', value: 'true' },
    ],
  },
};

// ── CSS value sanitizer — prevents expression() and url() injection ──
function sanitizeCSSValue(val: string | undefined): string | undefined {
  if (!val) return undefined;
  // Only allow hex colors, rgb(), hsl(), gradient(), and common CSS values
  const dangerous = /expression\s*\(|javascript:|data:|url\s*\(\s*['"]?(?!https?:\/\/)/i;
  if (dangerous.test(val)) return undefined;
  return val;
}

// ── Component render wrapper with animation ────────────────────
function withAnimation(
  content: React.ReactNode,
  animation: unknown = 'none',
  paddingTop: unknown = '4rem',
  paddingBottom: unknown = '4rem',
  backgroundColor?: unknown,
  textColor?: unknown,
  borderRadius?: unknown,
  hideOnMobile?: unknown
) {
  const bgStr = sanitizeCSSValue(backgroundColor ? String(backgroundColor) : undefined);
  const txtStr = sanitizeCSSValue(textColor ? String(textColor) : undefined);
  const isGradient = bgStr && (bgStr.includes('gradient') || bgStr.includes('linear-') || bgStr.includes('radial-'));
  const style: React.CSSProperties = {
    paddingTop: String(paddingTop || '4rem'),
    paddingBottom: String(paddingBottom || '4rem'),
    ...(isGradient ? { background: bgStr } : { backgroundColor: bgStr }),
    color: txtStr,
    borderRadius: borderRadius ? String(borderRadius) : undefined,
  };

  const animStr = String(animation || 'none');

  const mobileHidden = String(hideOnMobile) === 'true';

  return (
    <section
      className={`w-full relative ${mobileHidden ? 'hidden sm:block' : ''}`}
      style={style}
      data-animation={animStr}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {content}
      </div>
      <div className="absolute top-2 right-2 flex items-center gap-1 pointer-events-none">
        {mobileHidden && (
          <div className="px-2 py-0.5 bg-orange-500/80 text-white text-[10px] rounded-full opacity-60">
            📱 Masqué mobile
          </div>
        )}
        {animStr !== 'none' && (
          <div className="px-2 py-0.5 bg-purple-600/80 text-white text-[10px] rounded-full opacity-60">
            ✨ {animStr}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Puck Configuration ─────────────────────────────────────────

export const puckConfig: Config = {
  categories: {
    contenu: {
      title: 'Contenu',
      components: ['Hero', 'Features', 'CTA', 'TextImage', 'Text', 'Heading', 'RichText', 'CustomHTML', 'Banner', 'ProcessSteps'],
    },
    media: {
      title: 'Média',
      components: ['Gallery', 'Video', 'ImageSlider', 'BackgroundVideo'],
    },
    commerce: {
      title: 'Commerce',
      components: ['FeaturedProducts', 'FeaturedCourses', 'PricingTable', 'ProductGrid'],
    },
    interactif: {
      title: 'Interactif',
      components: ['FAQ', 'ContactForm', 'Newsletter', 'Map', 'Countdown', 'Tabs', 'Accordion'],
    },
    donnees: {
      title: 'Données',
      components: ['Team', 'Testimonials', 'Stats', 'LogoCarousel', 'SocialLinks'],
    },
    mise_en_page: {
      title: 'Mise en page',
      components: ['Spacer', 'Divider', 'Columns', 'Container', 'Section'],
    },
  },
  components: {
    // ═══════════════════════════════════════════
    // CONTENU
    // ═══════════════════════════════════════════
    Hero: {
      label: 'Hero',
      fields: {
        title: { type: 'text', label: 'Titre' },
        subtitle: { type: 'textarea', label: 'Sous-titre' },
        ctaText: { type: 'text', label: 'Bouton CTA' },
        ctaUrl: { type: 'text', label: 'URL du CTA' },
        ctaSecondaryText: { type: 'text', label: 'Bouton secondaire' },
        ctaSecondaryUrl: { type: 'text', label: 'URL secondaire' },
        backgroundImage: {
          type: 'custom',
          label: 'Image de fond',
          render: ({ value, onChange }: { value: unknown; onChange: (val: string) => void }) => (
            <ImagePickerField value={value as string} onChange={onChange} />
          ),
        },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Centré', value: 'centered' },
            { label: 'Gauche', value: 'left' },
            { label: 'Split (image droite)', value: 'split' },
            { label: 'Plein écran', value: 'fullscreen' },
            { label: 'Gradient animé', value: 'gradient' },
            { label: 'Verre dépoli', value: 'glass' },
            { label: 'Particules', value: 'particles' },
          ],
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Développez votre activité avec une présence en ligne qui convertit',
        subtitle: 'Plus de 500 entreprises nous font confiance. Découvrez comment nous pouvons transformer votre vision en réalité.',
        ctaText: 'Commencer gratuitement',
        ctaUrl: '#',
        ctaSecondaryText: '',
        ctaSecondaryUrl: '',
        backgroundImage: '',
        variant: 'centered',
        animation: 'fadeIn',
        paddingTop: '6rem',
        paddingBottom: '6rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, subtitle, ctaText, ctaUrl, ctaSecondaryText, ctaSecondaryUrl, backgroundImage, variant, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const isCenter = variant !== 'left';
        const bgStyle: React.CSSProperties = {};
        if (backgroundImage && (backgroundImage.startsWith('https://') || backgroundImage.startsWith('/'))) {
          bgStyle.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${encodeURI(backgroundImage)})`;
          bgStyle.backgroundSize = 'cover';
          bgStyle.backgroundPosition = 'center';
        }
        if (variant === 'gradient' && !backgroundImage) {
          bgStyle.background = `linear-gradient(135deg, ${backgroundColor || '#312e81'} 0%, #1e40af 50%, #0f766e 100%)`;
          bgStyle.backgroundSize = '200% 200%';
          bgStyle.animation = 'heroGradientShift 8s ease infinite';
        }
        if (variant === 'fullscreen') {
          bgStyle.minHeight = '80vh';
          bgStyle.display = 'flex';
          bgStyle.alignItems = 'center';
          bgStyle.justifyContent = 'center';
        }
        if (variant === 'glass') {
          bgStyle.position = 'relative';
          bgStyle.overflow = 'hidden';
        }
        if (variant === 'particles') {
          bgStyle.position = 'relative';
          bgStyle.overflow = 'hidden';
        }

        const textContent = (
          <>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">{title}</h1>
            {subtitle ? <p className="text-xl md:text-2xl opacity-80 max-w-3xl mx-auto">{String(subtitle)}</p> : null}
          </>
        );

        // Glass variant: text in a frosted glass card
        if (variant === 'glass') {
          return withAnimation(
            <div className="text-center space-y-6 rounded-xl relative py-8" style={bgStyle}>
              <div className="relative z-10 max-w-3xl mx-auto p-10 rounded-2xl backdrop-blur-xl" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}>
                {textContent}
                <div className={`flex flex-wrap gap-4 justify-center pt-6`}>
                  {ctaText ? <a href={ctaUrl || '#'} className="px-8 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl font-semibold hover:bg-white/30 transition-all shadow-lg">{ctaText}</a> : null}
                  {ctaSecondaryText ? <a href={ctaSecondaryUrl || '#'} className="px-8 py-4 border border-white/30 rounded-xl font-semibold hover:bg-white/10 transition-colors">{ctaSecondaryText}</a> : null}
                </div>
              </div>
            </div>,
            animation, paddingTop, paddingBottom, backgroundColor, textColor
          );
        }

        // Particles variant: floating dots behind text
        if (variant === 'particles') {
          return withAnimation(
            <div className="text-center space-y-6 rounded-xl relative py-8" style={bgStyle}>
              {/* Animated particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-full opacity-20"
                    style={{
                      width: `${4 + Math.random() * 8}px`,
                      height: `${4 + Math.random() * 8}px`,
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      background: `hsl(${220 + Math.random() * 40}, 80%, 70%)`,
                      animation: `float ${3 + Math.random() * 4}s ease-in-out infinite alternate`,
                      animationDelay: `${Math.random() * 3}s`,
                    }}
                  />
                ))}
              </div>
              <div className="relative z-10">
                {textContent}
                <div className={`flex flex-wrap gap-4 justify-center pt-6`}>
                  {ctaText ? <a href={ctaUrl || '#'} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg">{ctaText}</a> : null}
                  {ctaSecondaryText ? <a href={ctaSecondaryUrl || '#'} className="px-8 py-4 border-2 border-current rounded-xl font-semibold hover:bg-white/10 transition-colors">{ctaSecondaryText}</a> : null}
                </div>
              </div>
              <style>{`@keyframes float { 0% { transform: translateY(0) scale(1); } 100% { transform: translateY(-20px) scale(1.2); } }`}</style>
            </div>,
            animation, paddingTop, paddingBottom, backgroundColor, textColor
          );
        }

        return withAnimation(
          <div className={`${isCenter ? 'text-center' : 'text-left'} space-y-6 rounded-xl`} style={bgStyle}>
            {textContent}
            <div className={`flex flex-wrap gap-4 ${isCenter ? 'justify-center' : ''} pt-4`}>
              {ctaText && (
                <a href={ctaUrl || '#'} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl">
                  {ctaText}
                </a>
              )}
              {ctaSecondaryText && (
                <a href={ctaSecondaryUrl || '#'} className="px-8 py-4 border-2 border-current rounded-xl font-semibold hover:bg-white/10 transition-colors">
                  {ctaSecondaryText}
                </a>
              )}
            </div>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        );
      },
    },

    Features: {
      label: 'Fonctionnalités',
      fields: {
        title: { type: 'text', label: 'Titre' },
        subtitle: { type: 'text', label: 'Sous-titre' },
        columns: {
          type: 'select',
          label: 'Colonnes',
          options: [
            { label: '2 colonnes', value: '2' },
            { label: '3 colonnes', value: '3' },
            { label: '4 colonnes', value: '4' },
          ],
        },
        items: {
          type: 'array',
          label: 'Fonctionnalités',
          arrayFields: {
            icon: { type: 'text', label: 'Emoji/Icône' },
            title: { type: 'text', label: 'Titre' },
            description: { type: 'textarea', label: 'Description' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Tout ce qu\'il vous faut pour réussir',
        subtitle: 'Des outils pensés pour votre croissance, dès le premier jour',
        columns: '3',
        items: [
          { icon: '🚀', title: 'Rapide', description: 'Performance optimisée pour votre entreprise.' },
          { icon: '🔒', title: 'Sécurisé', description: 'Protection de vos données garantie.' },
          { icon: '💡', title: 'Intuitif', description: 'Interface simple et agréable à utiliser.' },
        ],
        animation: 'slideUp',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, subtitle, columns, items, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const cols = columns === '4' ? 'md:grid-cols-4' : columns === '2' ? 'md:grid-cols-2' : 'md:grid-cols-3';
        const featureItems = (items as Array<{ icon: string; title: string; description: string }>) || [];
        return withAnimation(
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">{String(title)}</h2>
              {subtitle ? <p className="text-lg opacity-70">{String(subtitle)}</p> : null}
            </div>
            <div className={`grid ${cols} gap-8`}>
              {featureItems.map((item, i) => (
                <div key={i} className="text-center space-y-4 p-6 rounded-xl bg-white/50 dark:bg-white/5 border border-zinc-200 dark:border-zinc-700 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300 group">
                  <div className="w-14 h-14 mx-auto rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-sm opacity-70 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    CTA: {
      label: 'Appel à l\'action',
      fields: {
        title: { type: 'text', label: 'Titre' },
        subtitle: { type: 'text', label: 'Sous-titre' },
        buttonText: { type: 'text', label: 'Texte du bouton' },
        buttonUrl: { type: 'text', label: 'URL' },
        buttonStyle: {
          type: 'select',
          label: 'Style du bouton',
          options: [
            { label: 'Blanc sur couleur', value: 'white' },
            { label: 'Bordure blanche', value: 'outline' },
            { label: 'Gradient', value: 'gradient' },
          ],
        },
        secondaryText: { type: 'text', label: 'Bouton secondaire' },
        secondaryUrl: { type: 'text', label: 'URL secondaire' },
        ...commonFields,
      },
      defaultProps: {
        title: 'Prêt à passer à l\'action?',
        subtitle: 'Rejoignez des centaines d\'entreprises qui nous font confiance',
        buttonText: 'Démarrer maintenant',
        buttonUrl: '#',
        buttonStyle: 'white',
        secondaryText: '',
        secondaryUrl: '',
        animation: 'fadeIn',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '#2563eb',
        textColor: '#ffffff',
      },
      render: ({ title, subtitle, buttonText, buttonUrl, buttonStyle, secondaryText, secondaryUrl, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const btnClasses: Record<string, string> = {
          white: 'bg-white text-blue-600 hover:bg-zinc-100 shadow-lg',
          outline: 'border-2 border-white text-white hover:bg-white/10',
          gradient: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600 shadow-lg',
        };
        return withAnimation(
          <div className="text-center space-y-6 rounded-2xl">
            <h2 className="text-3xl md:text-4xl font-bold">{title}</h2>
            {subtitle ? <p className="text-xl opacity-90 max-w-2xl mx-auto">{String(subtitle)}</p> : null}
            <div className="flex flex-wrap gap-4 justify-center">
              {buttonText ? (
                <a href={buttonUrl || '#'} className={`inline-block px-10 py-4 rounded-xl font-bold text-lg transition-all ${btnClasses[buttonStyle] || btnClasses.white}`}>
                  {buttonText}
                </a>
              ) : null}
              {secondaryText ? (
                <a href={secondaryUrl || '#'} className="inline-block px-10 py-4 border-2 border-white/50 rounded-xl font-semibold text-lg hover:bg-white/10 transition-colors">
                  {secondaryText}
                </a>
              ) : null}
            </div>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        );
      },
    },

    TextImage: {
      label: 'Texte + Image',
      fields: {
        title: { type: 'text', label: 'Titre' },
        content: { type: 'textarea', label: 'Contenu' },
        imageUrl: {
          type: 'custom',
          label: 'Image',
          render: ({ value, onChange }: { value: unknown; onChange: (val: string) => void }) => (
            <ImagePickerField value={value as string} onChange={onChange} />
          ),
        },
        imageAlt: { type: 'text', label: 'Texte alternatif' },
        layout: {
          type: 'select',
          label: 'Disposition',
          options: [
            { label: 'Image à droite', value: 'imageRight' },
            { label: 'Image à gauche', value: 'imageLeft' },
          ],
        },
        ctaText: { type: 'text', label: 'Bouton CTA (optionnel)' },
        ctaUrl: { type: 'text', label: 'URL du CTA' },
        ...commonFields,
      },
      defaultProps: {
        title: 'Une équipe passionnée à votre service',
        content: 'Depuis plus de 10 ans, nous accompagnons les entreprises québécoises dans leur croissance numérique. Notre approche personnalisée et notre expertise technique font la différence.',
        imageUrl: '',
        imageAlt: '',
        layout: 'imageRight',
        ctaText: '',
        ctaUrl: '',
        animation: 'slideUp',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, content, imageUrl, imageAlt, layout, ctaText, ctaUrl, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className={`grid md:grid-cols-2 gap-12 items-center`}>
            <div className={`space-y-5 ${layout === 'imageLeft' ? 'md:order-2' : ''}`}>
              <h2 className="text-3xl font-bold">{title}</h2>
              <p className="text-lg opacity-80 leading-relaxed whitespace-pre-wrap">{content}</p>
              {ctaText ? (
                <a href={ctaUrl || '#'} className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                  {ctaText}
                </a>
              ) : null}
            </div>
            <div className={layout === 'imageLeft' ? 'md:order-1' : ''}>
              {imageUrl ? (
                <img src={imageUrl} alt={imageAlt || title} className="w-full rounded-2xl shadow-lg" loading="lazy" />
              ) : (
                <div className="w-full aspect-video bg-zinc-200 dark:bg-zinc-700 rounded-2xl flex items-center justify-center text-zinc-400 text-4xl">
                  📷
                </div>
              )}
            </div>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    Text: {
      label: 'Bloc de texte',
      fields: {
        content: { type: 'textarea', label: 'Contenu' },
        align: {
          type: 'select',
          label: 'Alignement',
          options: [
            { label: 'Gauche', value: 'left' },
            { label: 'Centre', value: 'center' },
            { label: 'Droite', value: 'right' },
          ],
        },
        fontSize: {
          type: 'select',
          label: 'Taille du texte',
          options: [
            { label: 'Petit', value: 'text-sm' },
            { label: 'Normal', value: 'text-base' },
            { label: 'Grand', value: 'text-lg' },
            { label: 'Très grand', value: 'text-xl' },
          ],
        },
        maxWidth: {
          type: 'select',
          label: 'Largeur max',
          options: [
            { label: 'Pleine', value: '100%' },
            { label: 'Large', value: '900px' },
            { label: 'Moyenne', value: '700px' },
            { label: 'Étroite', value: '500px' },
          ],
        },
        ...commonFields,
      },
      defaultProps: {
        content: 'Votre contenu ici...',
        align: 'left',
        fontSize: 'text-lg',
        maxWidth: '700px',
        animation: 'none',
        paddingTop: '2rem',
        paddingBottom: '2rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ content, align, fontSize, maxWidth, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div style={{ maxWidth, margin: align === 'center' ? '0 auto' : undefined, textAlign: align as 'left' | 'center' | 'right' }}>
            <p className={`${fontSize || 'text-lg'} leading-relaxed whitespace-pre-wrap`}>{content}</p>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    Heading: {
      label: 'Titre',
      fields: {
        text: { type: 'text', label: 'Texte' },
        level: {
          type: 'select',
          label: 'Niveau',
          options: [
            { label: 'H1 — Principal', value: 'h1' },
            { label: 'H2 — Section', value: 'h2' },
            { label: 'H3 — Sous-section', value: 'h3' },
          ],
        },
        align: {
          type: 'select',
          label: 'Alignement',
          options: [
            { label: 'Gauche', value: 'left' },
            { label: 'Centre', value: 'center' },
          ],
        },
        decoration: {
          type: 'select',
          label: 'Décoration',
          options: [
            { label: 'Aucune', value: 'none' },
            { label: 'Ligne sous le titre', value: 'underline' },
            { label: 'Accent coloré', value: 'accent' },
            { label: 'Badge au-dessus', value: 'badge' },
          ],
        },
        subtitle: { type: 'text', label: 'Sous-titre (optionnel)' },
        ...commonFields,
      },
      defaultProps: { text: 'Titre de section', level: 'h2', align: 'center', decoration: 'none', subtitle: '', animation: 'none', paddingTop: '2rem', paddingBottom: '1rem', backgroundColor: '', textColor: '' },
      render: ({ text, level, align, decoration, subtitle, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const sizes: Record<string, string> = { h1: 'text-4xl md:text-5xl', h2: 'text-3xl md:text-4xl', h3: 'text-2xl md:text-3xl' };
        const Tag = level as 'h1' | 'h2' | 'h3';
        return withAnimation(
          <div className="space-y-3" style={{ textAlign: align as 'left' | 'center' }}>
            {decoration === 'badge' && (
              <span className="inline-block px-4 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium rounded-full">
                {subtitle || '✦'}
              </span>
            )}
            <Tag className={`${sizes[level] || sizes.h2} font-bold`}>{text}</Tag>
            {decoration === 'underline' && (
              <div className={`h-1 w-16 bg-blue-600 rounded-full ${align === 'center' ? 'mx-auto' : ''}`} />
            )}
            {decoration === 'accent' && (
              <div className={`h-1 w-24 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full ${align === 'center' ? 'mx-auto' : ''}`} />
            )}
            {subtitle && decoration !== 'badge' ? <p className="text-lg opacity-70">{subtitle}</p> : null}
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        );
      },
    },

    RichText: {
      label: 'Texte riche (HTML)',
      fields: {
        html: { type: 'textarea', label: 'Contenu HTML' },
        ...commonFields,
      },
      defaultProps: { html: '<p>Votre contenu riche ici...</p>', animation: 'none', paddingTop: '2rem', paddingBottom: '2rem', backgroundColor: '', textColor: '' },
      render: ({ html, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="prose prose-lg dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html || '') }} />,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    CustomHTML: {
      label: 'HTML personnalisé',
      fields: {
        code: { type: 'textarea', label: 'Code HTML/CSS/JS' },
        ...commonFields,
      },
      defaultProps: { code: '<div style="text-align:center;padding:2rem;">Votre code personnalisé ici</div>', animation: 'none', paddingTop: '0', paddingBottom: '0', backgroundColor: '', textColor: '' },
      render: ({ code, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(code || '', { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target'] }) }} />,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    Banner: {
      label: 'Bannière d\'annonce',
      fields: {
        text: { type: 'text', label: 'Texte' },
        linkText: { type: 'text', label: 'Texte du lien' },
        linkUrl: { type: 'text', label: 'URL du lien' },
        variant: {
          type: 'select',
          label: 'Style',
          options: [
            { label: 'Info (bleu)', value: 'info' },
            { label: 'Succès (vert)', value: 'success' },
            { label: 'Attention (jaune)', value: 'warning' },
            { label: 'Promo (violet)', value: 'promo' },
            { label: 'Gradient', value: 'gradient' },
          ],
        },
      },
      defaultProps: {
        text: '🎉 Offre spéciale — 20% de rabais cette semaine!',
        linkText: 'En profiter →',
        linkUrl: '#',
        variant: 'promo',
      },
      render: ({ text, linkText, linkUrl, variant }: Record<string, string>) => {
        const styles: Record<string, string> = {
          info: 'bg-blue-600 text-white',
          success: 'bg-emerald-600 text-white',
          warning: 'bg-amber-500 text-amber-950',
          promo: 'bg-gradient-to-r from-purple-600 to-blue-600 text-white',
          gradient: 'bg-gradient-to-r from-rose-500 via-purple-500 to-blue-500 text-white',
        };
        return (
          <div className={`w-full py-3 px-6 text-center text-sm font-medium flex items-center justify-center gap-3 ${styles[variant] || styles.promo}`} role="banner">
            <span className="flex-1">{text}</span>
            {linkText ? (
              <a href={linkUrl || '#'} className="underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity whitespace-nowrap">
                {linkText}
              </a>
            ) : null}
            <button className="opacity-60 hover:opacity-100 text-lg leading-none" aria-label="Fermer la bannière">×</button>
          </div>
        );
      },
    },

    ProcessSteps: {
      label: 'Étapes / Processus',
      fields: {
        title: { type: 'text', label: 'Titre' },
        subtitle: { type: 'text', label: 'Sous-titre' },
        steps: {
          type: 'array',
          label: 'Étapes',
          arrayFields: {
            icon: { type: 'text', label: 'Emoji/Icône' },
            title: { type: 'text', label: 'Titre' },
            description: { type: 'textarea', label: 'Description' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Comment ça fonctionne',
        subtitle: 'Un processus simple en quelques étapes',
        steps: [
          { icon: '1️⃣', title: 'Consultation', description: 'Discutons de vos besoins et objectifs.' },
          { icon: '2️⃣', title: 'Proposition', description: 'Nous élaborons une solution sur mesure.' },
          { icon: '3️⃣', title: 'Réalisation', description: 'Notre équipe met en œuvre le projet.' },
          { icon: '4️⃣', title: 'Livraison', description: 'Votre projet est livré avec formation.' },
        ],
        animation: 'slideUp',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, subtitle, steps, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const stepList = (steps as Array<{ icon: string; title: string; description: string }>) || [];
        return withAnimation(
          <div className="space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">{String(title)}</h2>
              {subtitle ? <p className="text-lg opacity-70">{String(subtitle)}</p> : null}
            </div>
            <div className="relative max-w-4xl mx-auto">
              {/* Connecting line */}
              <div className="hidden md:block absolute top-16 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-300 dark:via-blue-700 to-transparent" />
              <div className="grid md:grid-cols-4 gap-8 relative">
                {stepList.map((step, i) => (
                  <div key={i} className="text-center space-y-3 relative">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 flex items-center justify-center text-2xl relative z-10 bg-white dark:bg-zinc-900">
                      {step.icon}
                    </div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm opacity-70 leading-relaxed">{step.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    // ═══════════════════════════════════════════
    // MÉDIA
    // ═══════════════════════════════════════════
    Gallery: {
      label: 'Galerie d\'images',
      fields: {
        title: { type: 'text', label: 'Titre' },
        columns: {
          type: 'select',
          label: 'Colonnes',
          options: [
            { label: '2 colonnes', value: '2' },
            { label: '3 colonnes', value: '3' },
            { label: '4 colonnes', value: '4' },
          ],
        },
        images: {
          type: 'array',
          label: 'Images',
          arrayFields: {
            url: { type: 'text', label: 'URL de l\'image' },
            alt: { type: 'text', label: 'Description' },
            caption: { type: 'text', label: 'Légende' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Galerie',
        columns: '3',
        images: [
          { url: '', alt: 'Image 1', caption: '' },
          { url: '', alt: 'Image 2', caption: '' },
          { url: '', alt: 'Image 3', caption: '' },
        ],
        animation: 'fadeIn',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, columns, images, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const cols = columns === '4' ? 'md:grid-cols-4' : columns === '2' ? 'md:grid-cols-2' : 'md:grid-cols-3';
        const imgs = (images as Array<{ url: string; alt: string; caption: string }>) || [];
        return withAnimation(
          <div className="space-y-6" role="region" aria-label={String(title || 'Galerie')}>
            {title ? <h2 className="text-3xl font-bold text-center">{String(title)}</h2> : null}
            <div className={`grid ${cols} gap-4`} role="list">
              {imgs.map((img, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl cursor-pointer focus-within:ring-2 focus-within:ring-blue-500" role="listitem" tabIndex={0}>
                  {img.url ? (
                    <img src={img.url} alt={img.alt} className="w-full aspect-square object-cover group-hover:scale-110 transition-transform duration-500 ease-out" loading="lazy" />
                  ) : (
                    <div className="w-full aspect-square bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-400 text-3xl">📷</div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
                    <span className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">🔍</span>
                  </div>
                  {img.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-sm translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      {img.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    Video: {
      label: 'Vidéo',
      fields: {
        title: { type: 'text', label: 'Titre' },
        videoUrl: { type: 'text', label: 'URL YouTube/Vimeo' },
        aspectRatio: {
          type: 'select',
          label: 'Format',
          options: [
            { label: '16:9', value: '56.25%' },
            { label: '4:3', value: '75%' },
            { label: '1:1', value: '100%' },
          ],
        },
        ...commonFields,
      },
      defaultProps: { title: '', videoUrl: '', aspectRatio: '56.25%', animation: 'fadeIn', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '', textColor: '' },
      render: ({ title, videoUrl, aspectRatio, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        let embedUrl = videoUrl || '';
        if (embedUrl.includes('youtube.com/watch')) {
          try {
            const vid = new URL(embedUrl).searchParams.get('v');
            embedUrl = vid ? `https://www.youtube.com/embed/${vid}` : '';
          } catch { embedUrl = ''; }
        } else if (embedUrl.includes('youtu.be/')) {
          embedUrl = embedUrl.replace('youtu.be/', 'www.youtube.com/embed/');
        } else if (embedUrl.includes('youtube.com/shorts/')) {
          embedUrl = embedUrl.replace('youtube.com/shorts/', 'youtube.com/embed/');
        } else if (embedUrl.includes('vimeo.com/') && !embedUrl.includes('player.vimeo.com')) {
          const vid = embedUrl.match(/vimeo\.com\/(\d+)/)?.[1];
          embedUrl = vid ? `https://player.vimeo.com/video/${vid}` : embedUrl;
        }
        return withAnimation(
          <div className="space-y-4">
            {title ? <h2 className="text-3xl font-bold text-center">{String(title)}</h2> : null}
            <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ paddingBottom: aspectRatio }}>
              {embedUrl ? (
                <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" referrerPolicy="no-referrer" title={title || 'Vidéo intégrée'} />
              ) : (
                <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-400">🎬 Ajoutez une URL vidéo</div>
              )}
            </div>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        );
      },
    },

    ImageSlider: {
      label: 'Carrousel d\'images',
      fields: {
        images: {
          type: 'array',
          label: 'Images',
          arrayFields: {
            url: { type: 'text', label: 'URL' },
            alt: { type: 'text', label: 'Description' },
          },
        },
        autoPlay: { type: 'radio', label: 'Défilement auto', options: [{ label: 'Oui', value: 'true' }, { label: 'Non', value: 'false' }] },
        ...commonFields,
      },
      defaultProps: {
        images: [{ url: '', alt: 'Slide 1' }, { url: '', alt: 'Slide 2' }],
        autoPlay: 'true',
        animation: 'none',
        paddingTop: '0',
        paddingBottom: '0',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ images, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const slides = (images as Array<{ url: string; alt: string }>) || [];
        return withAnimation(
          <div className="relative overflow-hidden rounded-xl">
            {slides.length > 0 && slides[0].url ? (
              <img src={slides[0].url} alt={slides[0].alt} className="w-full aspect-[21/9] object-cover" />
            ) : (
              <div className="w-full aspect-[21/9] bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-400">🖼️ Ajoutez des images au carrousel</div>
            )}
            {slides.length > 1 && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {slides.map((_, i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-white' : 'bg-white/40'}`} />
                ))}
              </div>
            )}
            {slides.length > 1 && (
              <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-4 pointer-events-none">
                <div className="w-10 h-10 bg-black/30 rounded-full flex items-center justify-center text-white text-lg backdrop-blur-sm">‹</div>
                <div className="w-10 h-10 bg-black/30 rounded-full flex items-center justify-center text-white text-lg backdrop-blur-sm">›</div>
              </div>
            )}
            <p className="text-center text-xs opacity-40 mt-2">{slides.length} slides — Carrousel interactif sur le site public</p>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    BackgroundVideo: {
      label: 'Vidéo de fond',
      fields: {
        title: { type: 'text', label: 'Titre superposé' },
        subtitle: { type: 'textarea', label: 'Sous-titre' },
        videoUrl: { type: 'text', label: 'URL vidéo (MP4 ou YouTube)' },
        overlayOpacity: {
          type: 'select',
          label: 'Opacité de l\'overlay',
          options: [
            { label: 'Léger (30%)', value: '0.3' },
            { label: 'Moyen (50%)', value: '0.5' },
            { label: 'Sombre (70%)', value: '0.7' },
            { label: 'Très sombre (85%)', value: '0.85' },
          ],
        },
        ctaText: { type: 'text', label: 'Bouton CTA' },
        ctaUrl: { type: 'text', label: 'URL du CTA' },
        height: {
          type: 'select',
          label: 'Hauteur',
          options: [
            { label: 'Moyenne (400px)', value: '400px' },
            { label: 'Grande (600px)', value: '600px' },
            { label: 'Plein écran', value: '80vh' },
          ],
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Votre message percutant',
        subtitle: 'Captivez vos visiteurs avec une vidéo de fond immersive',
        videoUrl: '',
        overlayOpacity: '0.5',
        ctaText: 'En savoir plus',
        ctaUrl: '#',
        height: '600px',
        animation: 'fadeIn',
        paddingTop: '0',
        paddingBottom: '0',
        backgroundColor: '#0f172a',
        textColor: '#ffffff',
      },
      render: ({ title, subtitle, videoUrl, overlayOpacity, ctaText, ctaUrl, height, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="relative overflow-hidden rounded-xl flex items-center justify-center" style={{ minHeight: height || '600px', background: backgroundColor || '#0f172a' }}>
            {videoUrl ? (
              <div className="absolute inset-0">
                {videoUrl.includes('.mp4') || videoUrl.includes('.webm') ? (
                  <video autoPlay muted loop playsInline className="w-full h-full object-cover">
                    <source src={videoUrl} type="video/mp4" />
                  </video>
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                    🎬 La vidéo YouTube sera intégrée sur le site public
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
            )}
            <div className="absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${overlayOpacity || '0.5'})` }} />
            <div className="relative z-10 text-center space-y-6 px-6 max-w-3xl">
              <h2 className="text-4xl md:text-5xl font-bold" style={{ color: textColor || '#ffffff' }}>{title}</h2>
              {subtitle ? <p className="text-xl opacity-80">{String(subtitle)}</p> : null}
              {ctaText ? (
                <a href={ctaUrl || '#'} className="inline-block px-8 py-4 bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl font-semibold text-lg hover:bg-white/30 transition-all">
                  {ctaText}
                </a>
              ) : null}
            </div>
          </div>,
          animation, paddingTop, paddingBottom, '', textColor
        ),
    },

    // ═══════════════════════════════════════════
    // COMMERCE
    // ═══════════════════════════════════════════
    FeaturedProducts: {
      label: 'Produits vedettes',
      fields: {
        title: { type: 'text', label: 'Titre' },
        limit: { type: 'number', label: 'Nombre de produits', min: 1, max: 12 },
        ...commonFields,
      },
      defaultProps: { title: 'Nos produits', limit: 4, animation: 'slideUp', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '', textColor: '' },
      render: ({ title, limit, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) =>
        withAnimation(
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <div className="grid md:grid-cols-4 gap-6">
              {Array.from({ length: limit as number || 4 }).map((_, i) => (
                <div key={i} className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-4xl">🛍️</div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold">Produit {i + 1}</h3>
                    <p className="text-blue-600 font-bold">$XX.XX</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm opacity-50">Les produits réels s&apos;afficheront automatiquement depuis votre catalogue</p>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        ),
    },

    PricingTable: {
      label: 'Tableau de prix',
      fields: {
        title: { type: 'text', label: 'Titre' },
        subtitle: { type: 'text', label: 'Sous-titre' },
        showBillingToggle: {
          type: 'radio',
          label: 'Afficher toggle mensuel/annuel',
          options: [
            { label: 'Oui', value: 'true' },
            { label: 'Non', value: 'false' },
          ],
        },
        plans: {
          type: 'array',
          label: 'Plans',
          arrayFields: {
            name: { type: 'text', label: 'Nom du plan' },
            price: { type: 'text', label: 'Prix' },
            period: { type: 'text', label: 'Période' },
            features: { type: 'textarea', label: 'Fonctionnalités (une par ligne)' },
            ctaText: { type: 'text', label: 'Bouton' },
            highlighted: { type: 'radio', label: 'Mis en avant', options: [{ label: 'Oui', value: 'true' }, { label: 'Non', value: 'false' }] },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Nos forfaits',
        subtitle: 'Choisissez le plan qui convient à votre entreprise',
        showBillingToggle: 'false',
        plans: [
          { name: 'Essentiel', price: '29$', period: '/mois', features: 'Site web\nBlog\n5 pages', ctaText: 'Choisir', highlighted: 'false' },
          { name: 'Pro', price: '79$', period: '/mois', features: 'Tout Essentiel\nE-commerce\nCRM\n50 pages', ctaText: 'Choisir', highlighted: 'true' },
          { name: 'Enterprise', price: '199$', period: '/mois', features: 'Tout Pro\nAPI\nSupport prioritaire\nPages illimitées', ctaText: 'Contacter', highlighted: 'false' },
        ],
        animation: 'slideUp',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, subtitle, showBillingToggle, plans, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const planList = (plans as Array<{ name: string; price: string; period: string; features: string; ctaText: string; highlighted: string }>) || [];
        return withAnimation(
          <div className="space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-bold">{String(title)}</h2>
              {subtitle ? <p className="text-lg opacity-70 max-w-2xl mx-auto">{String(subtitle)}</p> : null}
              {showBillingToggle === 'true' && (
                <div className="inline-flex items-center gap-3 bg-zinc-100 dark:bg-zinc-800 rounded-full p-1 mt-4">
                  <button className="px-4 py-2 rounded-full bg-white dark:bg-zinc-700 shadow-sm text-sm font-medium">Mensuel</button>
                  <button className="px-4 py-2 rounded-full text-sm font-medium opacity-60">Annuel (-20%)</button>
                </div>
              )}
            </div>
            <div className={`grid gap-6 max-w-5xl mx-auto ${planList.length === 2 ? 'md:grid-cols-2' : planList.length === 4 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
              {planList.map((plan, i) => {
                const isHighlighted = plan.highlighted === 'true';
                return (
                  <div key={i} className={`rounded-2xl p-8 relative ${isHighlighted ? 'bg-gradient-to-b from-blue-600 to-blue-700 text-white ring-4 ring-blue-300 scale-105 shadow-xl' : 'bg-white dark:bg-zinc-800 border hover:shadow-lg transition-shadow'} space-y-6`}>
                    {isHighlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full shadow-sm">
                        POPULAIRE
                      </div>
                    )}
                    <h3 className="text-xl font-semibold">{plan.name}</h3>
                    <div>
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="opacity-70">{plan.period}</span>
                    </div>
                    <ul className="space-y-2">
                      {plan.features.split('\n').filter(Boolean).map((f, j) => (
                        <li key={j} className="flex items-center gap-2">
                          <span>✓</span> {f}
                        </li>
                      ))}
                    </ul>
                    <button className={`w-full py-3 rounded-lg font-semibold ${isHighlighted ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                      {plan.ctaText}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    ProductGrid: {
      label: 'Grille de produits (live)',
      fields: {
        title: { type: 'text', label: 'Titre' },
        category: { type: 'text', label: 'Catégorie (slug)' },
        limit: { type: 'number', label: 'Nombre max', min: 1, max: 24 },
        ...commonFields,
      },
      defaultProps: { title: 'Boutique', category: '', limit: 8, animation: 'fadeIn', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '', textColor: '' },
      render: ({ title, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) =>
        withAnimation(
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <p className="text-center opacity-50">Les produits de votre catalogue s&apos;afficheront ici automatiquement</p>
            <div className="grid md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="border rounded-lg p-4 text-center">
                  <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded mb-3 flex items-center justify-center text-3xl">🛒</div>
                  <p className="font-medium">Produit {i}</p>
                </div>
              ))}
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        ),
    },

    FeaturedCourses: {
      label: 'Formations vedettes',
      fields: {
        title: { type: 'text', label: 'Titre' },
        limit: { type: 'number', label: 'Nombre de formations', min: 1, max: 12 },
        ...commonFields,
      },
      defaultProps: { title: 'Nos formations', limit: 3, animation: 'slideUp', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '', textColor: '' },
      render: ({ title, limit, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) =>
        withAnimation(
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {Array.from({ length: limit as number || 3 }).map((_, i) => (
                <div key={i} className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="aspect-video bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-4xl">🎓</div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold">Formation {i + 1}</h3>
                    <p className="text-sm opacity-60">Description de la formation</p>
                    <p className="text-emerald-600 font-bold">$XX.XX</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-sm opacity-50">Les formations réelles s&apos;afficheront depuis votre module LMS</p>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        ),
    },

    // ═══════════════════════════════════════════
    // INTERACTIF
    // ═══════════════════════════════════════════
    FAQ: {
      label: 'FAQ / Questions',
      fields: {
        title: { type: 'text', label: 'Titre' },
        items: {
          type: 'array',
          label: 'Questions',
          arrayFields: {
            question: { type: 'text', label: 'Question' },
            answer: { type: 'textarea', label: 'Réponse' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Questions fréquentes',
        items: [
          { question: 'Comment commencer?', answer: 'Inscrivez-vous et suivez notre guide de démarrage.' },
          { question: 'Combien ça coûte?', answer: 'Consultez notre page de tarification pour les détails.' },
        ],
        animation: 'fadeIn',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, items, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const faqs = (items as Array<{ question: string; answer: string }>) || [];
        return withAnimation(
          <div className="space-y-6 max-w-3xl mx-auto" role="region" aria-label="Questions fréquentes">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="border rounded-xl overflow-hidden group" open={i === 0}>
                  <summary className="p-5 font-semibold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                    <span>{faq.question}</span>
                    <span className="text-zinc-400 group-open:rotate-180 transition-transform" aria-hidden="true">▼</span>
                  </summary>
                  <div className="px-5 pb-5 text-sm opacity-80 border-t border-zinc-100 dark:border-zinc-800 pt-4">{faq.answer}</div>
                </details>
              ))}
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    ContactForm: {
      label: 'Formulaire de contact',
      fields: {
        title: { type: 'text', label: 'Titre' },
        subtitle: { type: 'text', label: 'Sous-titre' },
        successMessage: { type: 'text', label: 'Message de succès' },
        formStyle: {
          type: 'select',
          label: 'Style',
          options: [
            { label: 'Classique', value: 'classic' },
            { label: 'Minimal', value: 'minimal' },
            { label: 'Carte', value: 'card' },
          ],
        },
        ...commonFields,
      },
      defaultProps: { title: 'Contactez-nous', subtitle: 'Nous vous répondrons dans les plus brefs délais', successMessage: 'Merci! Nous vous répondrons rapidement.', formStyle: 'card', animation: 'fadeIn', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '', textColor: '' },
      render: ({ title, subtitle, successMessage, formStyle, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const wrapperClass =
          formStyle === 'card'
            ? 'border border-zinc-200 dark:border-zinc-700 rounded-2xl p-6 shadow-sm space-y-4'
            : formStyle === 'classic'
            ? 'bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-6 space-y-4'
            : 'space-y-4';
        const inputClass = 'w-full px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
        return withAnimation(
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold">{title}</h2>
              {subtitle ? <p className="opacity-70 mt-2">{String(subtitle)}</p> : null}
            </div>
            <div className={wrapperClass}>
              <div className="grid md:grid-cols-2 gap-4">
                <input placeholder="Votre nom" className={inputClass} disabled />
                <input placeholder="votre@email.com" type="email" className={inputClass} disabled />
              </div>
              <input placeholder="Sujet" className={inputClass} disabled />
              <textarea placeholder="Votre message..." rows={5} className={inputClass} disabled />
              <button className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition" disabled>Envoyer</button>
            </div>
            {successMessage ? <p className="text-center text-xs opacity-50 italic">{String(successMessage)}</p> : null}
            <p className="text-center text-xs opacity-40">Le formulaire fonctionnel sera connecté à votre CRM automatiquement</p>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        );
      },
    },

    Newsletter: {
      label: 'Newsletter',
      fields: {
        title: { type: 'text', label: 'Titre' },
        subtitle: { type: 'text', label: 'Sous-titre' },
        buttonText: { type: 'text', label: 'Texte du bouton' },
        disclaimer: { type: 'text', label: 'Mention légale' },
        ...commonFields,
      },
      defaultProps: { title: 'Restez informé', subtitle: 'Recevez nos dernières nouvelles', buttonText: 'S\'abonner', disclaimer: 'En vous inscrivant, vous acceptez notre politique de confidentialité.', animation: 'fadeIn', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '#f8fafc', textColor: '' },
      render: ({ title, subtitle, buttonText, disclaimer, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <h2 className="text-3xl font-bold">{title}</h2>
            {subtitle ? <p className="opacity-70">{String(subtitle)}</p> : null}
            <div className="flex gap-2">
              <input placeholder="votre@email.com" className="flex-1 px-4 py-3 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" disabled />
              <button className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition whitespace-nowrap" disabled>{buttonText}</button>
            </div>
            {disclaimer ? <p className="text-xs opacity-40 mt-2">{String(disclaimer)}</p> : null}
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    Map: {
      label: 'Carte Google Maps',
      fields: {
        title: { type: 'text', label: 'Titre' },
        embedUrl: { type: 'text', label: 'URL embed Google Maps' },
        height: { type: 'text', label: 'Hauteur (px)' },
        ...commonFields,
      },
      defaultProps: { title: '', embedUrl: '', height: '400', animation: 'none', paddingTop: '2rem', paddingBottom: '2rem', backgroundColor: '', textColor: '' },
      render: ({ title, embedUrl, height, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="space-y-4">
            {title ? <h2 className="text-3xl font-bold text-center">{String(title)}</h2> : null}
            {embedUrl ? (
              <iframe src={embedUrl.startsWith('https://') ? embedUrl : ''} className="w-full rounded-xl" style={{ height: `${height}px` }} allowFullScreen loading="lazy" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" title={title || 'Carte'} />
            ) : (
              <div className="w-full rounded-xl bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center" style={{ height: `${height}px` }}>
                📍 Ajoutez une URL Google Maps embed
              </div>
            )}
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    Countdown: {
      label: 'Compte à rebours',
      fields: {
        title: { type: 'text', label: 'Titre' },
        targetDate: { type: 'text', label: 'Date cible (YYYY-MM-DD)' },
        ...commonFields,
      },
      defaultProps: { title: 'Lancement dans', targetDate: '2026-12-31', animation: 'fadeIn', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '#1e293b', textColor: '#ffffff' },
      render: ({ title, targetDate, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const target = new Date(targetDate || '2026-12-31').getTime();
        const now = Date.now();
        const diff = Math.max(0, target - now);
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        return withAnimation(
          <div className="text-center space-y-8">
            <h2 className="text-3xl font-bold">{title}</h2>
            <div className="flex justify-center gap-8">
              {[
                { value: days, label: 'Jours' },
                { value: hours, label: 'Heures' },
                { value: minutes, label: 'Minutes' },
                { value: seconds, label: 'Secondes' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="text-5xl font-bold tabular-nums bg-white/10 rounded-xl w-20 h-20 flex items-center justify-center">{item.value}</div>
                  <div className="text-sm opacity-70 mt-2">{item.label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs opacity-40">Le compte à rebours se mettra à jour en temps réel sur le site public</p>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        );
      },
    },

    Tabs: {
      label: 'Onglets',
      fields: {
        tabs: {
          type: 'array',
          label: 'Onglets',
          arrayFields: {
            title: { type: 'text', label: 'Titre' },
            content: { type: 'textarea', label: 'Contenu' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        tabs: [
          { title: 'Onglet 1', content: 'Contenu du premier onglet' },
          { title: 'Onglet 2', content: 'Contenu du deuxième onglet' },
        ],
        animation: 'none',
        paddingTop: '2rem',
        paddingBottom: '2rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ tabs, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const tabList = (tabs as Array<{ title: string; content: string }>) || [];
        return withAnimation(
          <div className="space-y-4">
            <div className="flex border-b overflow-x-auto">
              {tabList.map((tab, i) => (
                <button key={i} className={`px-6 py-3 font-medium whitespace-nowrap transition-colors ${i === 0 ? 'border-b-2 border-blue-600 text-blue-600' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
                  {tab.title}
                </button>
              ))}
            </div>
            <div className="space-y-4">
              {tabList.map((tab, i) => (
                <div key={i} className={`p-4 ${i === 0 ? '' : 'hidden'}`} data-tab-index={i}>
                  <p className="whitespace-pre-wrap">{String(tab.content)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs opacity-40 text-center">Les onglets seront interactifs sur le site public</p>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    Accordion: {
      label: 'Accordéon',
      fields: {
        items: {
          type: 'array',
          label: 'Éléments',
          arrayFields: {
            title: { type: 'text', label: 'Titre' },
            content: { type: 'textarea', label: 'Contenu' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        items: [
          { title: 'Section 1', content: 'Contenu de la section 1' },
          { title: 'Section 2', content: 'Contenu de la section 2' },
        ],
        animation: 'none',
        paddingTop: '2rem',
        paddingBottom: '2rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ items, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const accItems = (items as Array<{ title: string; content: string }>) || [];
        return withAnimation(
          <div className="space-y-2 max-w-3xl mx-auto">
            {accItems.map((item, i) => (
              <details key={i} className="border rounded-lg group overflow-hidden" open={i === 0}>
                <summary className="p-4 font-medium cursor-pointer flex items-center justify-between list-none [&::-webkit-details-marker]:hidden hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  <span>{item.title}</span>
                  <span className="text-zinc-400 group-open:rotate-180 transition-transform text-sm">▼</span>
                </summary>
                <div className="px-4 pb-4 opacity-80 border-t border-zinc-100 dark:border-zinc-800 pt-3">{item.content}</div>
              </details>
            ))}
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    // ═══════════════════════════════════════════
    // DONNÉES
    // ═══════════════════════════════════════════
    Team: {
      label: 'Équipe',
      fields: {
        title: { type: 'text', label: 'Titre' },
        members: {
          type: 'array',
          label: 'Membres',
          arrayFields: {
            name: { type: 'text', label: 'Nom' },
            role: { type: 'text', label: 'Rôle' },
            imageUrl: { type: 'text', label: 'Photo (URL)' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Notre équipe',
        members: [
          { name: 'Jean Tremblay', role: 'PDG', imageUrl: '' },
          { name: 'Marie Lavoie', role: 'CTO', imageUrl: '' },
          { name: 'Pierre Gagnon', role: 'Design', imageUrl: '' },
        ],
        animation: 'slideUp',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, members, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const team = (members as Array<{ name: string; role: string; imageUrl: string }>) || [];
        return withAnimation(
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <div className="grid md:grid-cols-3 gap-8">
              {team.map((m, i) => (
                <div key={i} className="text-center space-y-3 group p-6 rounded-xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 hover:shadow-lg transition-all duration-300">
                  <div className="relative mx-auto w-32 h-32">
                    {m.imageUrl ? (
                      <img src={m.imageUrl} alt={m.name} className="w-32 h-32 rounded-full object-cover ring-4 ring-zinc-100 dark:ring-zinc-800 group-hover:ring-blue-100 dark:group-hover:ring-blue-900/30 transition-all" />
                    ) : (
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 flex items-center justify-center text-4xl ring-4 ring-zinc-100 dark:ring-zinc-800">👤</div>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg">{m.name}</h3>
                  <p className="opacity-70 text-sm">{m.role}</p>
                </div>
              ))}
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    Testimonials: {
      label: 'Témoignages',
      fields: {
        title: { type: 'text', label: 'Titre' },
        layout: {
          type: 'select',
          label: 'Disposition',
          options: [
            { label: 'Grille (2 colonnes)', value: 'grid' },
            { label: 'Centré (une par une)', value: 'centered' },
            { label: 'Grande citation', value: 'hero' },
          ],
        },
        items: {
          type: 'array',
          label: 'Témoignages',
          arrayFields: {
            quote: { type: 'textarea', label: 'Citation' },
            author: { type: 'text', label: 'Auteur' },
            role: { type: 'text', label: 'Rôle / Entreprise' },
            rating: { type: 'select', label: 'Note', options: [
              { label: '5 étoiles', value: '5' },
              { label: '4 étoiles', value: '4' },
              { label: '3 étoiles', value: '3' },
            ] },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Ce que nos clients disent',
        layout: 'grid',
        items: [
          { quote: 'Koraline a transformé notre façon de travailler!', author: 'Marie L.', role: 'CEO, TechCo', rating: '5' },
          { quote: 'Le meilleur investissement pour notre entreprise.', author: 'Pierre G.', role: 'Fondateur, StartupXYZ', rating: '5' },
        ],
        animation: 'fadeIn',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '#f8fafc',
        textColor: '',
      },
      render: ({ title, layout, items, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const testimonials = (items as Array<{ quote: string; author: string; role: string; rating?: string }>) || [];
        const layoutStr = String(layout || 'grid');

        if (layoutStr === 'hero' && testimonials.length > 0) {
          const t = testimonials[0];
          return withAnimation(
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold">{String(title)}</h2>
              <div className="text-5xl opacity-20">&ldquo;</div>
              <blockquote className="text-2xl md:text-3xl font-medium italic leading-relaxed -mt-8">
                {t.quote}
              </blockquote>
              {t.rating ? <div className="text-amber-400 text-xl" aria-label={`Note: ${t.rating} sur 5`}>{'★'.repeat(Number(t.rating))}{'☆'.repeat(5 - Number(t.rating))}</div> : null}
              <footer className="mt-4">
                <p className="font-semibold text-lg">{t.author}</p>
                <p className="opacity-70">{t.role}</p>
              </footer>
            </div>,
            animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
          );
        }

        const gridClass = layoutStr === 'centered' ? 'max-w-2xl mx-auto space-y-6' : 'grid md:grid-cols-2 gap-8 max-w-4xl mx-auto';

        return withAnimation(
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <div className={gridClass}>
              {testimonials.map((t, i) => (
                <blockquote key={i} className="bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-sm border space-y-4 hover:shadow-lg transition-shadow">
                  {t.rating ? <div className="text-amber-400" aria-label={`Note: ${t.rating} sur 5`}>{'★'.repeat(Number(t.rating))}{'☆'.repeat(5 - Number(t.rating))}</div> : null}
                  <p className="text-lg italic leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                  <footer className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {t.author.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.author}</p>
                      <p className="text-xs opacity-70">{t.role}</p>
                    </div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    Stats: {
      label: 'Statistiques',
      fields: {
        items: {
          type: 'array',
          label: 'Statistiques',
          arrayFields: {
            value: { type: 'text', label: 'Valeur' },
            label: { type: 'text', label: 'Label' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        items: [
          { value: '500+', label: 'Clients' },
          { value: '99%', label: 'Satisfaction' },
          { value: '24/7', label: 'Support' },
          { value: '11', label: 'Modules' },
        ],
        animation: 'slideUp',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ items, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const stats = (items as Array<{ value: string; label: string }>) || [];
        return withAnimation(
          <div className={`grid grid-cols-2 gap-8 ${stats.length === 3 ? 'md:grid-cols-3' : stats.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-4'}`}>
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-blue-600">{s.value}</div>
                <div className="text-sm opacity-70 mt-2">{s.label}</div>
              </div>
            ))}
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    LogoCarousel: {
      label: 'Logos partenaires',
      fields: {
        title: { type: 'text', label: 'Titre' },
        logos: {
          type: 'array',
          label: 'Logos',
          arrayFields: {
            url: { type: 'text', label: 'URL du logo' },
            name: { type: 'text', label: 'Nom' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Ils nous font confiance',
        logos: [
          { url: '', name: 'Partenaire 1' },
          { url: '', name: 'Partenaire 2' },
          { url: '', name: 'Partenaire 3' },
          { url: '', name: 'Partenaire 4' },
        ],
        animation: 'fadeIn',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '#f8fafc',
        textColor: '',
      },
      render: ({ title, logos, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const logoList = (logos as Array<{ url: string; name: string }>) || [];
        return withAnimation(
          <div className="space-y-6">
            {title ? <h2 className="text-xl font-semibold text-center opacity-50">{String(title)}</h2> : null}
            <div className="flex flex-wrap justify-center items-center gap-12 py-4">
              {logoList.map((logo, i) => (
                <div key={i} className="grayscale hover:grayscale-0 transition-all duration-300 opacity-40 hover:opacity-100 hover:scale-110">
                  {logo.url ? (
                    <img src={logo.url} alt={logo.name} className="h-12 object-contain" loading="lazy" />
                  ) : (
                    <div className="w-28 h-12 bg-zinc-200 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-xs font-medium px-3">{logo.name}</div>
                  )}
                </div>
              ))}
            </div>
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
    },

    SocialLinks: {
      label: 'Réseaux sociaux',
      fields: {
        title: { type: 'text', label: 'Titre' },
        facebook: { type: 'text', label: 'Facebook URL' },
        instagram: { type: 'text', label: 'Instagram URL' },
        twitter: { type: 'text', label: 'X (Twitter) URL' },
        linkedin: { type: 'text', label: 'LinkedIn URL' },
        tiktok: { type: 'text', label: 'TikTok URL' },
        youtube: { type: 'text', label: 'YouTube URL' },
        ...commonFields,
      },
      defaultProps: { title: 'Suivez-nous', facebook: '', instagram: '', twitter: '', linkedin: '', tiktok: '', youtube: '', animation: 'none', paddingTop: '2rem', paddingBottom: '2rem', backgroundColor: '', textColor: '' },
      render: ({ title, facebook, instagram, twitter, linkedin, tiktok, youtube, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const links = [
          { url: facebook, icon: '📘', label: 'Facebook' },
          { url: instagram, icon: '📷', label: 'Instagram' },
          { url: twitter, icon: '🐦', label: 'X / Twitter' },
          { url: linkedin, icon: '💼', label: 'LinkedIn' },
          { url: tiktok, icon: '🎵', label: 'TikTok' },
          { url: youtube, icon: '▶️', label: 'YouTube' },
        ].filter(l => l.url);
        const displayLinks = links.length > 0 ? links : [
          { url: '#', icon: '📘', label: 'Facebook' },
          { url: '#', icon: '📷', label: 'Instagram' },
          { url: '#', icon: '🐦', label: 'X' },
          { url: '#', icon: '💼', label: 'LinkedIn' },
        ];
        return withAnimation(
          <div className="text-center space-y-4">
            {title ? <h2 className="text-xl font-semibold">{String(title)}</h2> : null}
            <div className="flex justify-center gap-6 text-3xl">
              {displayLinks.map((link, i) => (
                <a key={i} href={link.url || '#'} target="_blank" rel="noopener noreferrer" aria-label={link.label} className="hover:scale-110 transition-transform cursor-pointer">
                  {link.icon}
                </a>
              ))}
            </div>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        );
      },
    },

    // ═══════════════════════════════════════════
    // MISE EN PAGE
    // ═══════════════════════════════════════════
    Spacer: {
      label: 'Espace',
      fields: {
        height: {
          type: 'select',
          label: 'Hauteur',
          options: [
            { label: 'Petit (1rem)', value: '1rem' },
            { label: 'Moyen (2rem)', value: '2rem' },
            { label: 'Grand (4rem)', value: '4rem' },
            { label: 'Très grand (6rem)', value: '6rem' },
            { label: 'Énorme (8rem)', value: '8rem' },
          ],
        },
      },
      defaultProps: { height: '2rem' },
      render: ({ height }: Record<string, string>) => (
        <div style={{ height }} className="relative group">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed border-zinc-300/30 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-zinc-200/50 dark:bg-zinc-700/50 text-[10px] text-zinc-400 rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {height}
          </div>
        </div>
      ),
    },

    Divider: {
      label: 'Séparateur',
      fields: {
        style: {
          type: 'select',
          label: 'Style',
          options: [
            { label: 'Ligne simple', value: 'solid' },
            { label: 'Pointillés', value: 'dotted' },
            { label: 'Tirets', value: 'dashed' },
            { label: 'Gradient', value: 'gradient' },
          ],
        },
        ...commonFields,
      },
      defaultProps: { style: 'solid', animation: 'none', paddingTop: '1rem', paddingBottom: '1rem', backgroundColor: '', textColor: '' },
      render: ({ style: divStyle, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          divStyle === 'gradient'
            ? <div className="h-px bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-600 to-transparent" />
            : <hr className="border-zinc-200 dark:border-zinc-700" style={{ borderStyle: divStyle }} />,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    Columns: {
      label: 'Colonnes',
      fields: {
        layout: {
          type: 'select',
          label: 'Disposition',
          options: [
            { label: '2 colonnes (50/50)', value: '1fr 1fr' },
            { label: '2 colonnes (33/66)', value: '1fr 2fr' },
            { label: '2 colonnes (66/33)', value: '2fr 1fr' },
            { label: '3 colonnes', value: '1fr 1fr 1fr' },
            { label: '4 colonnes', value: '1fr 1fr 1fr 1fr' },
          ],
        },
        gap: {
          type: 'select',
          label: 'Espacement',
          options: [
            { label: 'Petit', value: '1rem' },
            { label: 'Moyen', value: '2rem' },
            { label: 'Grand', value: '3rem' },
          ],
        },
        ...commonFields,
      },
      defaultProps: { layout: '1fr 1fr', gap: '2rem', animation: 'none', paddingTop: '2rem', paddingBottom: '2rem', backgroundColor: '', textColor: '' },
      render: ({ layout, gap, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const colCount = layout.split(' ').length;
        return withAnimation(
          <div style={{ display: 'grid', gridTemplateColumns: layout, gap }}>
            {Array.from({ length: colCount }).map((_, i) => (
              <div key={i} className="min-h-[100px]">
                <DropZone zone={`column-${i}`} />
              </div>
            ))}
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        );
      },
    },

    Container: {
      label: 'Conteneur',
      fields: {
        maxWidth: {
          type: 'select',
          label: 'Largeur max',
          options: [
            { label: 'Pleine', value: '100%' },
            { label: 'Large (1280px)', value: '1280px' },
            { label: 'Moyenne (960px)', value: '960px' },
            { label: 'Étroite (720px)', value: '720px' },
          ],
        },
        ...commonFields,
      },
      defaultProps: { maxWidth: '960px', animation: 'none', paddingTop: '2rem', paddingBottom: '2rem', backgroundColor: '#f8fafc', textColor: '' },
      render: ({ maxWidth, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div style={{ maxWidth, margin: '0 auto' }} className="rounded-xl min-h-[150px]">
            <DropZone zone="container-content" />
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    Section: {
      label: 'Section (pleine largeur)',
      fields: {
        fullWidth: {
          type: 'radio',
          label: 'Pleine largeur',
          options: [
            { label: 'Oui', value: 'true' },
            { label: 'Non (max 1280px)', value: 'false' },
          ],
        },
        ...commonFields,
      },
      defaultProps: { fullWidth: 'false', animation: 'none', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '', textColor: '' },
      render: ({ fullWidth, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className={fullWidth === 'true' ? 'w-full' : 'max-w-7xl mx-auto'}>
            <DropZone zone="section-content" />
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },
  },
};

// ── Empty Puck data ────────────────────────────────────────────
export const EMPTY_PUCK_DATA: Data = {
  content: [],
  root: { props: {} },
};

export default puckConfig;
