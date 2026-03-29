'use client';

/**
 * Template Gallery — Modal for selecting a page template when creating a new page.
 * Shows 25 industry-specific templates with preview thumbnails, section preview tooltip,
 * category badges, and full keyboard navigation.
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, FileText, Tag } from 'lucide-react';
import { PAGE_TEMPLATES, PageTemplate, getTemplateCategories } from '@/lib/puck/templates';
import { Modal } from '@/components/admin/Modal';
import { Button } from '@/components/admin/Button';

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
}

/** Human-readable labels for Puck section types */
const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero',
  stats: 'Statistiques',
  features: 'Fonctionnalités',
  testimonials: 'Témoignages',
  cta: 'Appel à l\'action',
  gallery: 'Galerie',
  team: 'Équipe',
  pricing_table: 'Tarifs',
  faq_accordion: 'FAQ',
  contact_form: 'Formulaire contact',
  map: 'Carte',
  text_image: 'Texte + Image',
  newsletter: 'Infolettre',
  logo_carousel: 'Logos clients',
  featured_products: 'Produits vedettes',
  video_embed: 'Vidéo',
  timeline: 'Chronologie',
  blog_posts: 'Articles de blog',
  accordion: 'Accordéon',
  tabs: 'Onglets',
  banner: 'Bannière',
  divider: 'Séparateur',
  rich_text: 'Texte enrichi',
};

function getSectionLabel(type: string): string {
  return SECTION_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getSectionFlow(template: PageTemplate): string {
  return template.sections.map(s => getSectionLabel(s.type)).join(' → ');
}

/** Category badge colour mapping */
const CATEGORY_COLORS: Record<string, string> = {
  'Business': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  'Marketing': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  'Créatif': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'Commerce': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Restauration': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'Services professionnels': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'Santé': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'Éducation': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  'Immobilier': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Événementiel': 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300';
}

export default function TemplateGallery({ open, onClose }: TemplateGalleryProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAi, setShowAi] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

  const gridRef = useRef<HTMLDivElement>(null);
  const categories = useMemo(() => getTemplateCategories(), []);

  const filteredTemplates = useMemo(() => {
    return PAGE_TEMPLATES.filter(t => {
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, selectedCategory]);

  // Reset focused index whenever the filtered list changes
  useEffect(() => {
    setFocusedIndex(0);
  }, [filteredTemplates]);

  const handleSelect = useCallback((templateId: string) => {
    router.push(`/admin/contenu/editeur?template=${templateId}`);
    onClose();
  }, [router, onClose]);

  const handleAiGenerate = () => {
    if (aiPrompt.trim()) {
      router.push(`/admin/contenu/editeur?ai=${encodeURIComponent(aiPrompt)}`);
      onClose();
    }
  };

  // Keyboard navigation within the grid
  const handleGridKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (filteredTemplates.length === 0) return;

    // Determine column count from CSS grid (4 on lg, 3 on md, 2 default)
    const cols = (() => {
      const el = gridRef.current;
      if (!el) return 4;
      const computed = getComputedStyle(el).gridTemplateColumns;
      return computed.split(' ').length;
    })();

    let next = focusedIndex;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        next = Math.min(focusedIndex + 1, filteredTemplates.length - 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        next = Math.max(focusedIndex - 1, 0);
        break;
      case 'ArrowDown':
        e.preventDefault();
        next = Math.min(focusedIndex + cols, filteredTemplates.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        next = Math.max(focusedIndex - cols, 0);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleSelect(filteredTemplates[focusedIndex].id);
        return;
      default:
        return;
    }

    setFocusedIndex(next);
    // Focus the button element so scroll follows
    const buttons = gridRef.current?.querySelectorAll<HTMLButtonElement>('[data-template-btn]');
    buttons?.[next]?.focus();
  }, [focusedIndex, filteredTemplates, handleSelect]);

  return (
    <Modal isOpen={open} onClose={onClose} title="Créer une nouvelle page" size="xl">
      <div className="space-y-6">
        {/* AI Section */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold">Aurelia IA — Créez avec l&apos;intelligence artificielle</h3>
          </div>
          {!showAi ? (
            <Button onClick={() => setShowAi(true)} variant="primary">
              <Sparkles className="w-4 h-4 mr-2" />
              Décrivez votre page et l&apos;IA la crée pour vous
            </Button>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAiGenerate()}
                placeholder="Ex: Un site pour mon salon de coiffure à Montréal avec tarifs et réservation..."
                className="flex-1 px-4 py-3 border rounded-lg text-sm"
                autoFocus
              />
              <Button onClick={handleAiGenerate} disabled={!aiPrompt.trim()}>
                Générer
              </Button>
            </div>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un template..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-2 text-xs rounded-lg whitespace-nowrap transition-colors ${!selectedCategory ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
            >
              Tous
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 text-xs rounded-lg whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Keyboard hint */}
        {filteredTemplates.length > 0 && (
          <p className="text-xs text-zinc-400 dark:text-zinc-500 -mt-2">
            Utilisez les touches fléchées pour naviguer · Entrée pour sélectionner · Survolez pour prévisualiser les sections
          </p>
        )}

        {/* Template Grid */}
        <div
          ref={gridRef}
          role="listbox"
          aria-label="Templates disponibles"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto pr-1"
          onKeyDown={handleGridKeyDown}
        >
          {filteredTemplates.map((template, idx) => (
            <div key={template.id} className="relative">
              <button
                data-template-btn
                role="option"
                aria-selected={idx === focusedIndex}
                onClick={() => handleSelect(template.id)}
                onMouseEnter={() => { setHoveredId(template.id); setFocusedIndex(idx); }}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setFocusedIndex(idx)}
                tabIndex={idx === focusedIndex ? 0 : -1}
                className={`group w-full text-left border rounded-xl overflow-hidden transition-all focus:outline-none ${
                  idx === focusedIndex
                    ? 'ring-2 ring-blue-500 border-blue-400 shadow-md'
                    : 'hover:ring-2 hover:ring-blue-400 hover:border-blue-300'
                }`}
              >
                {/* Thumbnail area */}
                <div className="aspect-[4/3] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center relative overflow-hidden">
                  <span className="text-5xl group-hover:scale-110 transition-transform select-none">
                    {template.thumbnail}
                  </span>
                  {/* Section count pill overlay */}
                  <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <FileText className="w-2.5 h-2.5" />
                    {template.sections.length}
                  </span>
                </div>

                {/* Card body */}
                <div className="p-3 space-y-1.5">
                  <h4 className="font-semibold text-sm leading-tight">{template.name}</h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{template.description}</p>
                  {/* Category badge */}
                  <div className="flex items-center gap-1 pt-0.5">
                    <Tag className="w-2.5 h-2.5 shrink-0 opacity-50" />
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getCategoryColor(template.category)}`}>
                      {template.category}
                    </span>
                  </div>
                </div>
              </button>

              {/* Section preview tooltip (shown on hover) */}
              {hoveredId === template.id && (
                <div
                  className="absolute z-50 bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 bg-zinc-900 text-white rounded-xl shadow-2xl p-3 pointer-events-none"
                  role="tooltip"
                >
                  {/* Arrow */}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-zinc-900" />

                  <p className="text-[11px] font-semibold text-zinc-300 mb-2 uppercase tracking-wide">
                    Structure de la page
                  </p>
                  <div className="space-y-1">
                    {template.sections.map((section, sIdx) => (
                      <div key={section.id} className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-300 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {sIdx + 1}
                        </span>
                        <span className="text-xs text-zinc-200">{getSectionLabel(section.type)}</span>
                        {sIdx < template.sections.length - 1 && (
                          <span className="ml-auto text-zinc-500 text-[10px]">↓</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-2 pt-2 border-t border-zinc-700">
                    {getSectionFlow(template)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-8 opacity-50">
            <p>Aucun template trouvé. Essayez avec l&apos;IA!</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
