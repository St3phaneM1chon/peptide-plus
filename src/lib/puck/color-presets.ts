/**
 * Color Presets — Professional color combinations for the page builder
 */

export interface ColorPreset {
  id: string;
  name: string;
  background: string;
  text: string;
  accent: string;
  category: 'dark' | 'light' | 'gradient' | 'brand';
}

export const COLOR_PRESETS: ColorPreset[] = [
  // Dark themes
  { id: 'midnight', name: 'Minuit', background: '#0f172a', text: '#ffffff', accent: '#3b82f6', category: 'dark' },
  { id: 'charcoal', name: 'Charbon', background: '#1a1a2e', text: '#ffffff', accent: '#6366f1', category: 'dark' },
  { id: 'obsidian', name: 'Obsidienne', background: '#0c0a09', text: '#ffffff', accent: '#f59e0b', category: 'dark' },
  { id: 'forest-night', name: 'Forêt nocturne', background: '#064e3b', text: '#ffffff', accent: '#34d399', category: 'dark' },
  { id: 'wine', name: 'Vin', background: '#4c1d95', text: '#ffffff', accent: '#a78bfa', category: 'dark' },

  // Light themes
  { id: 'snow', name: 'Neige', background: '#ffffff', text: '#1a1a2e', accent: '#2563eb', category: 'light' },
  { id: 'cream', name: 'Crème', background: '#fef7ee', text: '#422006', accent: '#f59e0b', category: 'light' },
  { id: 'mint', name: 'Menthe', background: '#ecfdf5', text: '#064e3b', accent: '#059669', category: 'light' },
  { id: 'lavender', name: 'Lavande', background: '#f5f3ff', text: '#3b0764', accent: '#7c3aed', category: 'light' },
  { id: 'sky', name: 'Ciel', background: '#f0f9ff', text: '#0c4a6e', accent: '#0ea5e9', category: 'light' },

  // Gradients
  { id: 'sunset', name: 'Coucher de soleil', background: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)', text: '#ffffff', accent: '#ffffff', category: 'gradient' },
  { id: 'ocean', name: 'Océan', background: 'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)', text: '#ffffff', accent: '#ffffff', category: 'gradient' },
  { id: 'aurora', name: 'Aurore boréale', background: 'linear-gradient(135deg, #312e81 0%, #059669 100%)', text: '#ffffff', accent: '#ffffff', category: 'gradient' },
  { id: 'flamingo', name: 'Flamant', background: 'linear-gradient(135deg, #be185d 0%, #7c3aed 100%)', text: '#ffffff', accent: '#ffffff', category: 'gradient' },
  { id: 'ember', name: 'Braise', background: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)', text: '#ffffff', accent: '#ffffff', category: 'gradient' },

  // Brand
  { id: 'koraline', name: 'Koraline', background: '#0f172a', text: '#ffffff', accent: '#6366f1', category: 'brand' },
  { id: 'attitudes', name: 'Attitudes VIP', background: '#1e293b', text: '#ffffff', accent: '#2563eb', category: 'brand' },
];

export function getPresetsByCategory(category: string): ColorPreset[] {
  return COLOR_PRESETS.filter(p => p.category === category);
}

export function getPresetById(id: string): ColorPreset | undefined {
  return COLOR_PRESETS.find(p => p.id === id);
}
