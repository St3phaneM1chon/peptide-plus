/**
 * Font Presets — Curated Google Font pairs for the page builder
 */

export interface FontPreset {
  id: string;
  name: string;
  heading: string;
  body: string;
  googleImport: string;
  style: 'modern' | 'classic' | 'elegant' | 'playful' | 'minimal' | 'bold';
}

export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'system',
    name: 'Système (par défaut)',
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    googleImport: '',
    style: 'modern',
  },
  {
    id: 'inter',
    name: 'Inter — Moderne',
    heading: '"Inter", sans-serif',
    body: '"Inter", sans-serif',
    googleImport: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    style: 'modern',
  },
  {
    id: 'playfair-inter',
    name: 'Playfair + Inter — Élégant',
    heading: '"Playfair Display", serif',
    body: '"Inter", sans-serif',
    googleImport: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Playfair+Display:wght@600;700;800&display=swap',
    style: 'elegant',
  },
  {
    id: 'poppins',
    name: 'Poppins — Amical',
    heading: '"Poppins", sans-serif',
    body: '"Poppins", sans-serif',
    googleImport: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
    style: 'playful',
  },
  {
    id: 'dm-sans',
    name: 'DM Sans — Minimal',
    heading: '"DM Sans", sans-serif',
    body: '"DM Sans", sans-serif',
    googleImport: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
    style: 'minimal',
  },
  {
    id: 'montserrat',
    name: 'Montserrat — Audacieux',
    heading: '"Montserrat", sans-serif',
    body: '"Montserrat", sans-serif',
    googleImport: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap',
    style: 'bold',
  },
  {
    id: 'merriweather-source',
    name: 'Merriweather + Source Sans — Classique',
    heading: '"Merriweather", serif',
    body: '"Source Sans 3", sans-serif',
    googleImport: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Source+Sans+3:wght@400;500;600&display=swap',
    style: 'classic',
  },
  {
    id: 'raleway',
    name: 'Raleway — Sophistiqué',
    heading: '"Raleway", sans-serif',
    body: '"Raleway", sans-serif',
    googleImport: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap',
    style: 'elegant',
  },
];

export function getFontPresetById(id: string): FontPreset | undefined {
  return FONT_PRESETS.find(p => p.id === id);
}
