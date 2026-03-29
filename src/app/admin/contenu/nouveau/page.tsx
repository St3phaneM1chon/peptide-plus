'use client';

/**
 * New Page — Template Selection
 * Route: /admin/contenu/nouveau
 *
 * Displays a visual gallery of 25 templates.
 * Clicking a template opens the Puck editor with that template pre-loaded.
 */

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, Layout, ArrowLeft } from 'lucide-react';
import { PAGE_TEMPLATES, getTemplateCategories } from '@/lib/puck/templates';

export default function NewPageTemplatePicker() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAi, setShowAi] = useState(false);

  const categories = useMemo(() => getTemplateCategories(), []);

  const filtered = useMemo(() => {
    return PAGE_TEMPLATES.filter(t => {
      if (category && t.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [search, category]);

  const handleSelect = (id: string) => {
    router.push(`/admin/contenu/editeur?template=${id}`);
  };

  const handleAi = () => {
    if (aiPrompt.trim()) {
      router.push(`/admin/contenu/editeur?ai=${encodeURIComponent(aiPrompt)}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/admin/contenu')} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold">Créer une nouvelle page</h1>
          <p className="text-zinc-500 mt-1">Choisissez un template ou laissez l&apos;IA créer votre page</p>
        </div>
      </div>

      {/* AI Generator */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-8 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Aurelia IA — Créez avec l&apos;intelligence artificielle</h2>
            <p className="text-sm text-zinc-500">Décrivez votre page et l&apos;IA la génère instantanément</p>
          </div>
        </div>
        {!showAi ? (
          <button
            onClick={() => setShowAi(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-blue-700 transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 inline mr-2" />
            Créer avec l&apos;IA
          </button>
        ) : (
          <div className="flex gap-3">
            <input
              type="text"
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAi()}
              placeholder="Ex: Un site pour mon salon de coiffure à Montréal avec nos services, tarifs et prise de rendez-vous..."
              className="flex-1 px-5 py-3 border rounded-xl text-sm bg-white dark:bg-zinc-800"
              autoFocus
            />
            <button
              onClick={handleAi}
              disabled={!aiPrompt.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium disabled:opacity-50"
            >
              Générer
            </button>
          </div>
        )}
      </div>

      {/* Search & Categories */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un template..."
            className="w-full pl-11 pr-4 py-3 border rounded-xl text-sm bg-white dark:bg-zinc-800"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategory(null)}
            className={`px-4 py-2.5 text-sm rounded-xl whitespace-nowrap font-medium transition-colors ${
              !category ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200'
            }`}
          >
            Tous ({PAGE_TEMPLATES.length})
          </button>
          {categories.map(cat => {
            const count = PAGE_TEMPLATES.filter(t => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-4 py-2.5 text-sm rounded-xl whitespace-nowrap font-medium transition-colors ${
                  category === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {filtered.map(template => (
          <button
            key={template.id}
            onClick={() => handleSelect(template.id)}
            className="group text-left border rounded-2xl overflow-hidden hover:ring-2 hover:ring-blue-500 hover:shadow-lg transition-all bg-white dark:bg-zinc-900"
          >
            <div className="aspect-[4/3] bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center relative overflow-hidden">
              <span className="text-6xl group-hover:scale-125 transition-transform duration-300">
                {template.thumbnail}
              </span>
              <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 transition-colors" />
              <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1 bg-blue-600 text-white text-xs px-2.5 py-1 rounded-full">
                  <Layout className="w-3 h-3" />
                  Utiliser
                </div>
              </div>
            </div>
            <div className="p-4 space-y-1.5">
              <h3 className="font-semibold text-sm group-hover:text-blue-600 transition-colors">{template.name}</h3>
              <p className="text-xs text-zinc-500 line-clamp-1">{template.description}</p>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>{template.category}</span>
                <span>{template.sections.length} sections</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-lg font-medium text-zinc-400">Aucun template trouvé</p>
          <p className="text-sm text-zinc-400 mt-2">Essayez avec l&apos;IA pour créer un design unique!</p>
        </div>
      )}
    </div>
  );
}
