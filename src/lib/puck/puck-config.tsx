/**
 * Puck Page Builder Configuration — Koraline Suite
 *
 * 30+ composants organisés en 6 catégories.
 * Chaque composant a des fields visuels (color picker, spacing, animation).
 */

import type { Config, Data } from '@measured/puck';

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
    label: 'Couleur de fond (hex)',
  },
  textColor: {
    type: 'text' as const,
    label: 'Couleur du texte (hex)',
  },
};

// ── Component render wrapper with animation ────────────────────
function withAnimation(
  content: React.ReactNode,
  animation: unknown = 'none',
  paddingTop: unknown = '4rem',
  paddingBottom: unknown = '4rem',
  backgroundColor?: unknown,
  textColor?: unknown
) {
  const style: React.CSSProperties = {
    paddingTop: String(paddingTop || '4rem'),
    paddingBottom: String(paddingBottom || '4rem'),
    backgroundColor: backgroundColor ? String(backgroundColor) : undefined,
    color: textColor ? String(textColor) : undefined,
  };

  const animStr = String(animation || 'none');
  const animClass = animStr !== 'none'
    ? `animate-${animStr}`
    : '';

  return (
    <section className={`w-full ${animClass}`} style={style}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {content}
      </div>
    </section>
  );
}

// ── Puck Configuration ─────────────────────────────────────────

export const puckConfig: Config = {
  categories: {
    contenu: {
      title: 'Contenu',
      components: ['Hero', 'Features', 'CTA', 'TextImage', 'Text', 'Heading', 'RichText', 'CustomHTML'],
    },
    media: {
      title: 'Média',
      components: ['Gallery', 'Video', 'ImageSlider'],
    },
    commerce: {
      title: 'Commerce',
      components: ['FeaturedProducts', 'PricingTable', 'ProductGrid'],
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
      components: ['Spacer', 'Divider', 'Columns', 'Container'],
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
        backgroundImage: { type: 'text', label: 'Image de fond (URL)' },
        variant: {
          type: 'select',
          label: 'Variante',
          options: [
            { label: 'Centré', value: 'centered' },
            { label: 'Gauche', value: 'left' },
            { label: 'Split (image droite)', value: 'split' },
            { label: 'Plein écran', value: 'fullscreen' },
            { label: 'Gradient', value: 'gradient' },
          ],
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Bienvenue sur votre site',
        subtitle: 'Créez quelque chose d\'extraordinaire avec la Suite Koraline',
        ctaText: 'Commencer',
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
      render: ({ title, subtitle, ctaText, ctaUrl, ctaSecondaryText, ctaSecondaryUrl, variant, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const isCenter = variant === 'centered' || variant === 'fullscreen' || variant === 'gradient';
        return withAnimation(
          <div className={`${isCenter ? 'text-center' : 'text-left'} space-y-6`}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">{title}</h1>
            {subtitle ? <p className="text-xl md:text-2xl opacity-80 max-w-3xl mx-auto">{String(subtitle)}</p> : null}
            <div className={`flex gap-4 ${isCenter ? 'justify-center' : ''} pt-4`}>
              {ctaText && (
                <a href={ctaUrl || '#'} className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  {ctaText}
                </a>
              )}
              {ctaSecondaryText && (
                <a href={ctaSecondaryUrl || '#'} className="px-8 py-3 border-2 border-current rounded-lg font-semibold hover:bg-black/5 transition-colors">
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
        title: 'Nos fonctionnalités',
        subtitle: 'Tout ce dont vous avez besoin',
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
                <div key={i} className="text-center space-y-3 p-6 rounded-xl bg-white/50 dark:bg-white/5 border border-zinc-200 dark:border-zinc-700">
                  <span className="text-4xl">{item.icon}</span>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-sm opacity-70">{item.description}</p>
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
        ...commonFields,
      },
      defaultProps: {
        title: 'Prêt à commencer?',
        subtitle: 'Lancez votre projet dès aujourd\'hui',
        buttonText: 'Commencer maintenant',
        buttonUrl: '#',
        animation: 'fadeIn',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '#2563eb',
        textColor: '#ffffff',
      },
      render: ({ title, subtitle, buttonText, buttonUrl, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">{title}</h2>
            {subtitle ? <p className="text-xl opacity-90">{String(subtitle)}</p> : null}
            {buttonText && (
              <a href={buttonUrl || '#'} className="inline-block px-10 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-zinc-100 transition-colors">
                {buttonText}
              </a>
            )}
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    TextImage: {
      label: 'Texte + Image',
      fields: {
        title: { type: 'text', label: 'Titre' },
        content: { type: 'textarea', label: 'Contenu' },
        imageUrl: { type: 'text', label: 'URL de l\'image' },
        imageAlt: { type: 'text', label: 'Texte alternatif' },
        layout: {
          type: 'select',
          label: 'Disposition',
          options: [
            { label: 'Image à droite', value: 'imageRight' },
            { label: 'Image à gauche', value: 'imageLeft' },
          ],
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Notre histoire',
        content: 'Nous sommes passionnés par l\'innovation et le service à nos clients.',
        imageUrl: '',
        imageAlt: '',
        layout: 'imageRight',
        animation: 'slideUp',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ title, content, imageUrl, imageAlt, layout, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className={`grid md:grid-cols-2 gap-12 items-center ${layout === 'imageLeft' ? '' : ''}`}>
            <div className={`space-y-4 ${layout === 'imageLeft' ? 'md:order-2' : ''}`}>
              <h2 className="text-3xl font-bold">{title}</h2>
              <p className="text-lg opacity-80 leading-relaxed">{content}</p>
            </div>
            <div className={layout === 'imageLeft' ? 'md:order-1' : ''}>
              {imageUrl ? (
                <img src={imageUrl} alt={imageAlt || title} className="w-full rounded-xl shadow-lg" />
              ) : (
                <div className="w-full aspect-video bg-zinc-200 dark:bg-zinc-700 rounded-xl flex items-center justify-center text-zinc-400">
                  📷 Ajoutez une image
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
        maxWidth: '700px',
        animation: 'none',
        paddingTop: '2rem',
        paddingBottom: '2rem',
        backgroundColor: '',
        textColor: '',
      },
      render: ({ content, align, maxWidth, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div style={{ maxWidth, margin: align === 'center' ? '0 auto' : undefined, textAlign: align as 'left' | 'center' | 'right' }}>
            <p className="text-lg leading-relaxed whitespace-pre-wrap">{content}</p>
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
        ...commonFields,
      },
      defaultProps: { text: 'Titre de section', level: 'h2', align: 'center', animation: 'none', paddingTop: '2rem', paddingBottom: '1rem', backgroundColor: '', textColor: '' },
      render: ({ text, level, align, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) => {
        const sizes: Record<string, string> = { h1: 'text-4xl md:text-5xl', h2: 'text-3xl md:text-4xl', h3: 'text-2xl md:text-3xl' };
        const Tag = level as 'h1' | 'h2' | 'h3';
        return withAnimation(
          <Tag className={`${sizes[level] || sizes.h2} font-bold`} style={{ textAlign: align as 'left' | 'center' }}>{text}</Tag>,
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
          <div className="prose prose-lg dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />,
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
          <div dangerouslySetInnerHTML={{ __html: code }} />,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
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
          <div className="space-y-6">
            {title ? <h2 className="text-3xl font-bold text-center">{String(title)}</h2> : null}
            <div className={`grid ${cols} gap-4`}>
              {imgs.map((img, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl">
                  {img.url ? (
                    <img src={img.url} alt={img.alt} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full aspect-square bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-400">📷</div>
                  )}
                  {img.caption && (
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 text-white text-sm">
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
        const embedUrl = videoUrl?.replace('watch?v=', 'embed/')?.replace('youtu.be/', 'youtube.com/embed/') || '';
        return withAnimation(
          <div className="space-y-4">
            {title ? <h2 className="text-3xl font-bold text-center">{String(title)}</h2> : null}
            <div className="relative w-full rounded-xl overflow-hidden shadow-lg" style={{ paddingBottom: aspectRatio }}>
              {embedUrl ? (
                <iframe src={embedUrl} className="absolute inset-0 w-full h-full" allowFullScreen />
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
          </div>,
          animation as string, paddingTop as string, paddingBottom as string, backgroundColor as string, textColor as string
        );
      },
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
      render: ({ title, plans, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const planList = (plans as Array<{ name: string; price: string; period: string; features: string; ctaText: string; highlighted: string }>) || [];
        return withAnimation(
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <div className={`grid md:grid-cols-${planList.length} gap-6 max-w-5xl mx-auto`}>
              {planList.map((plan, i) => {
                const isHighlighted = plan.highlighted === 'true';
                return (
                  <div key={i} className={`rounded-2xl p-8 ${isHighlighted ? 'bg-blue-600 text-white ring-4 ring-blue-300 scale-105' : 'bg-white dark:bg-zinc-800 border'} space-y-6`}>
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
          <div className="space-y-6 max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="border rounded-xl overflow-hidden">
                  <summary className="p-5 font-semibold cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800">{faq.question}</summary>
                  <div className="px-5 pb-5 text-sm opacity-80">{faq.answer}</div>
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
        ...commonFields,
      },
      defaultProps: { title: 'Contactez-nous', subtitle: 'Nous vous répondrons dans les plus brefs délais', animation: 'fadeIn', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '', textColor: '' },
      render: ({ title, subtitle, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold">{title}</h2>
              {subtitle ? <p className="opacity-70 mt-2">{String(subtitle)}</p> : null}
            </div>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <input placeholder="Nom" className="w-full p-3 border rounded-lg" disabled />
                <input placeholder="Email" className="w-full p-3 border rounded-lg" disabled />
              </div>
              <input placeholder="Sujet" className="w-full p-3 border rounded-lg" disabled />
              <textarea placeholder="Message" rows={4} className="w-full p-3 border rounded-lg" disabled />
              <button className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold" disabled>Envoyer</button>
            </div>
            <p className="text-center text-xs opacity-50">Le formulaire fonctionnel sera connecté à votre CRM automatiquement</p>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
    },

    Newsletter: {
      label: 'Newsletter',
      fields: {
        title: { type: 'text', label: 'Titre' },
        subtitle: { type: 'text', label: 'Sous-titre' },
        buttonText: { type: 'text', label: 'Texte du bouton' },
        ...commonFields,
      },
      defaultProps: { title: 'Restez informé', subtitle: 'Recevez nos dernières nouvelles', buttonText: 'S\'abonner', animation: 'fadeIn', paddingTop: '4rem', paddingBottom: '4rem', backgroundColor: '#f8fafc', textColor: '' },
      render: ({ title, subtitle, buttonText, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="text-center space-y-4 max-w-xl mx-auto">
            <h2 className="text-3xl font-bold">{title}</h2>
            {subtitle ? <p className="opacity-70">{String(subtitle)}</p> : null}
            <div className="flex gap-2">
              <input placeholder="votre@email.com" className="flex-1 p-3 border rounded-lg" disabled />
              <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold" disabled>{buttonText}</button>
            </div>
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
              <iframe src={embedUrl} className="w-full rounded-xl" style={{ height: `${height}px` }} allowFullScreen loading="lazy" />
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
      render: ({ title, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="text-center space-y-8">
            <h2 className="text-3xl font-bold">{title}</h2>
            <div className="flex justify-center gap-8">
              {['Jours', 'Heures', 'Minutes', 'Secondes'].map((label, i) => (
                <div key={i} className="text-center">
                  <div className="text-5xl font-bold tabular-nums">{[42, 12, 35, 8][i]}</div>
                  <div className="text-sm opacity-70 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
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
            <div className="flex border-b">
              {tabList.map((tab, i) => (
                <button key={i} className={`px-6 py-3 font-medium ${i === 0 ? 'border-b-2 border-blue-600 text-blue-600' : 'opacity-50'}`}>
                  {tab.title}
                </button>
              ))}
            </div>
            {tabList[0] ? <div className="p-4">{String(tabList[0].content)}</div> : null}
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
              <details key={i} className="border rounded-lg">
                <summary className="p-4 font-medium cursor-pointer">{item.title}</summary>
                <div className="px-4 pb-4 opacity-80">{item.content}</div>
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
                <div key={i} className="text-center space-y-3">
                  {m.imageUrl ? (
                    <img src={m.imageUrl} alt={m.name} className="w-32 h-32 rounded-full mx-auto object-cover" />
                  ) : (
                    <div className="w-32 h-32 rounded-full mx-auto bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-4xl">👤</div>
                  )}
                  <h3 className="font-semibold text-lg">{m.name}</h3>
                  <p className="opacity-70">{m.role}</p>
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
        items: {
          type: 'array',
          label: 'Témoignages',
          arrayFields: {
            quote: { type: 'textarea', label: 'Citation' },
            author: { type: 'text', label: 'Auteur' },
            role: { type: 'text', label: 'Rôle / Entreprise' },
          },
        },
        ...commonFields,
      },
      defaultProps: {
        title: 'Ce que nos clients disent',
        items: [
          { quote: 'Koraline a transformé notre façon de travailler!', author: 'Marie L.', role: 'CEO, TechCo' },
          { quote: 'Le meilleur investissement pour notre entreprise.', author: 'Pierre G.', role: 'Fondateur, StartupXYZ' },
        ],
        animation: 'fadeIn',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        backgroundColor: '#f8fafc',
        textColor: '',
      },
      render: ({ title, items, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, unknown>) => {
        const testimonials = (items as Array<{ quote: string; author: string; role: string }>) || [];
        return withAnimation(
          <div className="space-y-8">
            <h2 className="text-3xl font-bold text-center">{String(title)}</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {testimonials.map((t, i) => (
                <blockquote key={i} className="bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-sm border space-y-4">
                  <p className="text-lg italic">&ldquo;{t.quote}&rdquo;</p>
                  <footer>
                    <p className="font-semibold">{t.author}</p>
                    <p className="text-sm opacity-70">{t.role}</p>
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
          <div className={`grid grid-cols-2 md:grid-cols-${stats.length} gap-8`}>
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
            <div className="flex flex-wrap justify-center items-center gap-12">
              {logoList.map((logo, i) => (
                <div key={i} className="grayscale hover:grayscale-0 transition-all opacity-50 hover:opacity-100">
                  {logo.url ? (
                    <img src={logo.url} alt={logo.name} className="h-12 object-contain" />
                  ) : (
                    <div className="w-24 h-12 bg-zinc-200 dark:bg-zinc-700 rounded flex items-center justify-center text-xs">{logo.name}</div>
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
      render: ({ title, animation, paddingTop, paddingBottom, backgroundColor, textColor }: Record<string, string>) =>
        withAnimation(
          <div className="text-center space-y-4">
            {title ? <h2 className="text-xl font-semibold">{String(title)}</h2> : null}
            <div className="flex justify-center gap-6 text-3xl">
              <span className="hover:scale-110 transition-transform cursor-pointer">📘</span>
              <span className="hover:scale-110 transition-transform cursor-pointer">📷</span>
              <span className="hover:scale-110 transition-transform cursor-pointer">🐦</span>
              <span className="hover:scale-110 transition-transform cursor-pointer">💼</span>
              <span className="hover:scale-110 transition-transform cursor-pointer">🎵</span>
              <span className="hover:scale-110 transition-transform cursor-pointer">▶️</span>
            </div>
          </div>,
          animation, paddingTop, paddingBottom, backgroundColor, textColor
        ),
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
      render: ({ height }: Record<string, string>) => <div style={{ height }} />,
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
              <div key={i} className="min-h-[100px] border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-lg p-4 flex items-center justify-center text-sm opacity-50">
                Colonne {i + 1}
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
          <div style={{ maxWidth, margin: '0 auto' }} className="border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 min-h-[150px] flex items-center justify-center opacity-50">
            Glissez des blocs ici
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
