'use client';

/**
 * Visual Page Editor — Puck-based WYSIWYG page builder
 *
 * Route: /admin/contenu/editeur?id=PAGE_ID
 * - New page: /admin/contenu/editeur (no id param)
 * - Edit existing: /admin/contenu/editeur?id=pg1
 */

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';
import { getTemplateById } from '@/lib/puck/templates';
import { FONT_PRESETS, getFontPresetById } from '@/lib/puck/font-presets';

// Lazy load PuckEditor (it's heavy — ~200KB)
const PuckEditor = dynamic(() => import('@/components/admin/PuckEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300">Chargement de l&apos;éditeur visuel...</p>
        <p className="text-sm text-zinc-400">Préparation des composants</p>
      </div>
    </div>
  ),
});

interface PageData {
  id?: string;
  title: string;
  slug: string;
  content: string;
  metaTitle: string;
  metaDescription: string;
  template: string;
  isPublished: boolean;
  sections: unknown;
}

export default function VisualEditorPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VisualEditorInner />
    </Suspense>
  );
}

function VisualEditorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pageId = searchParams.get('id');
  const templateParam = searchParams.get('template');
  const aiParam = searchParams.get('ai');

  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontPreset, setFontPreset] = useState('system');

  // Load existing page or create new
  useEffect(() => {
    if (pageId) {
      // Edit existing page
      fetch(`/api/admin/content/pages/${pageId}`)
        .then(res => res.json())
        .then(data => {
          if (data.page) {
            setPage(data.page);
          } else {
            toast.error('Page non trouvée');
            router.push('/admin/contenu');
          }
        })
        .catch(() => {
          toast.error('Erreur de chargement');
          router.push('/admin/contenu');
        })
        .finally(() => setLoading(false));
    } else if (aiParam) {
      // AI-generated page
      setPage({
        title: 'Page générée par IA',
        slug: `page-ai-${Date.now().toString(36)}`,
        content: '',
        metaTitle: '',
        metaDescription: '',
        template: 'sections',
        isPublished: false,
        sections: [],
      });
      setLoading(false);
      setAiGenerating(true);

      // Call AI generate API
      fetch('/api/admin/page-builder/ai-generate', {
        method: 'POST',
        headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiParam, language: 'fr' }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.sections && data.sections.length > 0) {
            setPage(prev => prev ? { ...prev, sections: data.sections } : prev);
            toast.success(`${data.sections.length} sections générées par Aurelia IA`);
          } else {
            toast.error('L\'IA n\'a pas pu générer de sections. Essayez un prompt plus détaillé.');
          }
        })
        .catch(() => toast.error('Erreur de connexion à l\'IA'))
        .finally(() => setAiGenerating(false));
    } else {
      // New page with template or blank
      setPage({
        title: 'Nouvelle page',
        slug: `page-${Date.now().toString(36)}`,
        content: '',
        metaTitle: '',
        metaDescription: '',
        template: 'sections',
        isPublished: false,
        sections: templateParam ? getTemplateData(templateParam) : [],
      });
      setLoading(false);
    }
  }, [pageId, templateParam, aiParam, router]);

  // Save handler — called by PuckEditor on publish, or ⌘S for draft
  const handleSave = useCallback(async (sections: Array<{ id: string; type: string; data: Record<string, unknown> }>, publish = true) => {
    if (!page) return;
    setSaving(true);

    try {
      const method = page.id ? 'PATCH' : 'POST';
      const url = page.id
        ? `/api/admin/content/pages/${page.id}`
        : '/api/admin/content/pages';

      const body = {
        title: page.title,
        slug: page.slug,
        content: page.content || '',
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        template: 'sections',
        isPublished: publish,
        sections: JSON.stringify(sections),
      };

      const res = await fetch(url, {
        method,
        headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(publish ? 'Page sauvegardée et publiée!' : 'Brouillon sauvegardé');

        // Update page ID if new
        if (!page.id && data.page?.id) {
          setPage(prev => prev ? { ...prev, id: data.page.id } : prev);
          // Update URL without reload
          const safeId = String(data.page.id).replace(/[^a-zA-Z0-9_-]/g, '');
          window.history.replaceState(null, '', `/admin/contenu/editeur?id=${safeId}`);
        }
      } else {
        const err = await res.json();
        toast.error(err.error?.message || 'Erreur de sauvegarde');
      }
    } catch {
      toast.error('Erreur réseau');
    } finally {
      setSaving(false);
    }
  }, [page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="h-screen overflow-hidden">
      {saving && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-500 text-white text-center py-1 text-sm">
          Sauvegarde en cours...
        </div>
      )}
      {aiGenerating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-center py-2 text-sm flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Aurelia IA génère votre page...
        </div>
      )}

      {/* Page Actions Bar */}
      <div className="fixed top-3 right-48 z-40 flex items-center gap-2">
        {page.id && page.slug && (
          <a
            href={`/p/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 shadow-lg"
            title="Voir la page publiée"
          >
            👁 Prévisualiser
          </a>
        )}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="px-3 py-1.5 bg-zinc-800 text-white text-xs rounded-lg hover:bg-zinc-700 transition-colors flex items-center gap-1.5 shadow-lg"
          title="Paramètres de la page"
          aria-expanded={showSettings}
          aria-controls="page-settings-panel"
        >
          ⚙️ Paramètres
        </button>
      </div>

      {/* Page Settings Panel */}
      {showSettings && (
        <div className="fixed top-12 right-32 z-[999] w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3" role="dialog" aria-label="Paramètres de la page">
          <h3 className="font-semibold text-sm">Paramètres de la page</h3>
          <div>
            <label className="text-xs font-medium text-zinc-500">Titre</label>
            <input
              type="text"
              value={page.title}
              onChange={e => setPage(prev => prev ? { ...prev, title: e.target.value } : prev)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-zinc-800 dark:border-zinc-700"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Slug (URL)</label>
            <div className="flex items-center mt-1">
              <span className="text-xs text-zinc-400 mr-1">/p/</span>
              <input
                type="text"
                value={page.slug}
                onChange={e => setPage(prev => prev ? { ...prev, slug: e.target.value.replace(/[^a-z0-9-]/g, '') } : prev)}
                className="flex-1 px-3 py-2 border rounded-lg text-sm dark:bg-zinc-800 dark:border-zinc-700"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Meta Title (SEO)</label>
            <input
              type="text"
              value={page.metaTitle}
              onChange={e => setPage(prev => prev ? { ...prev, metaTitle: e.target.value } : prev)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-zinc-800 dark:border-zinc-700"
              placeholder={page.title}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Meta Description (SEO)</label>
            <textarea
              value={page.metaDescription}
              onChange={e => setPage(prev => prev ? { ...prev, metaDescription: e.target.value } : prev)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-zinc-800 dark:border-zinc-700"
              rows={2}
              placeholder="Description pour les moteurs de recherche..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Typographie</label>
            <select
              value={fontPreset}
              onChange={e => setFontPreset(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg text-sm dark:bg-zinc-800 dark:border-zinc-700"
            >
              {FONT_PRESETS.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Font preset injection */}
      {(() => {
        const fp = getFontPresetById(fontPreset);
        return fp && fp.googleImport ? (
          <>
            {/* eslint-disable-next-line @next/next/no-page-custom-font */}
            <link rel="stylesheet" href={fp.googleImport} />
            <style>{`.puck-editor-wrapper { --font-heading: ${fp.heading}; --font-body: ${fp.body}; font-family: ${fp.body}; } .puck-editor-wrapper h1, .puck-editor-wrapper h2, .puck-editor-wrapper h3 { font-family: ${fp.heading}; }`}</style>
          </>
        ) : null;
      })()}

      <PuckEditor
        initialData={page.sections}
        onSave={handleSave}
        pageTitle={page.title}
      />
    </div>
  );
}

/**
 * Get template data from the central templates library (25 templates)
 */
function getTemplateData(templateId: string): unknown[] {
  const template = getTemplateById(templateId);
  return template?.sections || [];
}
