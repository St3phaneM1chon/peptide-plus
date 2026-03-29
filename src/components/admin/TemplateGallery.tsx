'use client';

/**
 * Template Gallery — Modal for selecting a page template when creating a new page.
 * Shows 25 industry-specific templates with preview thumbnails.
 */

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, FileText } from 'lucide-react';
import { PAGE_TEMPLATES, getTemplateCategories } from '@/lib/puck/templates';
import { Modal } from '@/components/admin/Modal';
import { Button } from '@/components/admin/Button';

interface TemplateGalleryProps {
  open: boolean;
  onClose: () => void;
}

export default function TemplateGallery({ open, onClose }: TemplateGalleryProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAi, setShowAi] = useState(false);

  const categories = useMemo(() => getTemplateCategories(), []);

  const filteredTemplates = useMemo(() => {
    return PAGE_TEMPLATES.filter(t => {
      if (selectedCategory && t.category !== selectedCategory) return false;
      if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [search, selectedCategory]);

  const handleSelect = (templateId: string) => {
    router.push(`/admin/contenu/editeur?template=${templateId}`);
    onClose();
  };

  const handleAiGenerate = () => {
    if (aiPrompt.trim()) {
      // Navigate to editor with AI prompt as query param
      router.push(`/admin/contenu/editeur?ai=${encodeURIComponent(aiPrompt)}`);
      onClose();
    }
  };

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
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un template..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-2 text-xs rounded-lg whitespace-nowrap ${!selectedCategory ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}
            >
              Tous
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-2 text-xs rounded-lg whitespace-nowrap ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[50vh] overflow-y-auto">
          {filteredTemplates.map(template => (
            <button
              key={template.id}
              onClick={() => handleSelect(template.id)}
              className="group text-left border rounded-xl overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all"
            >
              <div className="aspect-[4/3] bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center">
                <span className="text-5xl group-hover:scale-110 transition-transform">
                  {template.thumbnail}
                </span>
              </div>
              <div className="p-3 space-y-1">
                <h4 className="font-semibold text-sm">{template.name}</h4>
                <p className="text-xs opacity-60 line-clamp-1">{template.description}</p>
                <div className="flex items-center gap-1 text-xs opacity-40">
                  <FileText className="w-3 h-3" />
                  {template.sections.length} sections
                </div>
              </div>
            </button>
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
