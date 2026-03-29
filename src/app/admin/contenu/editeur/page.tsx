'use client';

/**
 * Visual Page Editor — Puck-based WYSIWYG page builder
 *
 * Route: /admin/contenu/editeur?id=PAGE_ID
 * - New page: /admin/contenu/editeur (no id param)
 * - Edit existing: /admin/contenu/editeur?id=pg1
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pageId = searchParams.get('id');
  const templateParam = searchParams.get('template');
  const aiParam = searchParams.get('ai');

  const [page, setPage] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

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

  // Save handler — called by PuckEditor on publish
  const handleSave = useCallback(async (sections: Array<{ id: string; type: string; data: Record<string, unknown> }>) => {
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
        isPublished: true,
        sections: JSON.stringify(sections),
      };

      const res = await fetch(url, {
        method,
        headers: { ...addCSRFHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success('Page sauvegardée et publiée!');

        // Update page ID if new
        if (!page.id && data.page?.id) {
          setPage(prev => prev ? { ...prev, id: data.page.id } : prev);
          // Update URL without reload
          window.history.replaceState(null, '', `/admin/contenu/editeur?id=${data.page.id}`);
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
      <PuckEditor
        initialData={page.sections}
        onSave={handleSave}
        pageTitle={page.title}
      />
    </div>
  );
}

/**
 * Get template data for pre-built templates
 */
function getTemplateData(template: string): unknown[] {
  const templates: Record<string, unknown[]> = {
    business: [
      { id: 's1', type: 'hero', data: { title: 'Votre entreprise', subtitle: 'Solutions professionnelles adaptées à vos besoins', ctaText: 'Découvrir', ctaUrl: '#services', variant: 'centered', animation: 'fadeIn' } },
      { id: 's2', type: 'features', data: { title: 'Nos services', columns: '3', items: [{ icon: '💼', title: 'Conseil', description: 'Expertise stratégique' }, { icon: '🔧', title: 'Solutions', description: 'Sur mesure' }, { icon: '📊', title: 'Résultats', description: 'Mesurables' }], animation: 'slideUp' } },
      { id: 's3', type: 'stats', data: { items: [{ value: '500+', label: 'Clients' }, { value: '99%', label: 'Satisfaction' }, { value: '15+', label: 'Années' }], animation: 'fadeIn' } },
      { id: 's4', type: 'testimonials', data: { title: 'Témoignages', items: [{ quote: 'Service exceptionnel!', author: 'Marie L.', role: 'CEO' }], animation: 'fadeIn' } },
      { id: 's5', type: 'cta', data: { title: 'Prêt à commencer?', subtitle: 'Contactez-nous dès aujourd\'hui', buttonText: 'Nous contacter', buttonUrl: '#contact', animation: 'fadeIn', backgroundColor: '#2563eb', textColor: '#ffffff' } },
    ],
    landing: [
      { id: 's1', type: 'hero', data: { title: 'Le meilleur produit pour votre business', subtitle: 'Essayez gratuitement pendant 14 jours', ctaText: 'Essai gratuit', ctaUrl: '#', ctaSecondaryText: 'Voir la démo', variant: 'centered', animation: 'fadeIn' } },
      { id: 's2', type: 'features', data: { title: 'Pourquoi nous choisir', columns: '3', items: [{ icon: '⚡', title: 'Rapide', description: 'Résultats en minutes' }, { icon: '🛡️', title: 'Fiable', description: '99.9% uptime' }, { icon: '🎯', title: 'Précis', description: 'IA avancée' }], animation: 'slideUp' } },
      { id: 's3', type: 'pricing_table', data: { title: 'Forfaits', plans: [{ name: 'Starter', price: '29$', period: '/mois', features: '5 utilisateurs\n10 GB\nSupport email', ctaText: 'Commencer', highlighted: 'false' }, { name: 'Pro', price: '79$', period: '/mois', features: '25 utilisateurs\n100 GB\nSupport prioritaire\nAPI', ctaText: 'Essai gratuit', highlighted: 'true' }], animation: 'slideUp' } },
      { id: 's4', type: 'faq_accordion', data: { title: 'Questions fréquentes', items: [{ question: 'Puis-je annuler à tout moment?', answer: 'Oui, sans frais.' }], animation: 'fadeIn' } },
      { id: 's5', type: 'cta', data: { title: 'Lancez-vous maintenant', buttonText: 'Commencer gratuitement', buttonUrl: '#', animation: 'fadeIn', backgroundColor: '#059669', textColor: '#ffffff' } },
    ],
    portfolio: [
      { id: 's1', type: 'hero', data: { title: 'Mon Portfolio', subtitle: 'Créateur passionné', ctaText: 'Voir mes projets', variant: 'centered', animation: 'fadeIn' } },
      { id: 's2', type: 'gallery', data: { title: 'Projets récents', columns: '3', images: [{ url: '', alt: 'Projet 1' }, { url: '', alt: 'Projet 2' }, { url: '', alt: 'Projet 3' }, { url: '', alt: 'Projet 4' }, { url: '', alt: 'Projet 5' }, { url: '', alt: 'Projet 6' }], animation: 'fadeIn' } },
      { id: 's3', type: 'text_image', data: { title: 'À propos', content: 'Je suis un créateur passionné avec 10 ans d\'expérience.', layout: 'imageRight', animation: 'slideUp' } },
      { id: 's4', type: 'contact_form', data: { title: 'Me contacter', subtitle: 'Discutons de votre projet', animation: 'fadeIn' } },
    ],
    restaurant: [
      { id: 's1', type: 'hero', data: { title: 'Bienvenue chez nous', subtitle: 'Cuisine authentique depuis 1990', ctaText: 'Réserver', variant: 'fullscreen', animation: 'fadeIn', backgroundColor: '#1a1a2e', textColor: '#ffffff' } },
      { id: 's2', type: 'features', data: { title: 'Notre Menu', columns: '3', items: [{ icon: '🥗', title: 'Entrées', description: 'À partir de 12$' }, { icon: '🥩', title: 'Plats', description: 'À partir de 24$' }, { icon: '🍰', title: 'Desserts', description: 'À partir de 9$' }], animation: 'slideUp' } },
      { id: 's3', type: 'gallery', data: { title: 'Notre ambiance', columns: '4', images: [{ url: '', alt: 'Salle' }, { url: '', alt: 'Cuisine' }, { url: '', alt: 'Terrasse' }, { url: '', alt: 'Bar' }], animation: 'fadeIn' } },
      { id: 's4', type: 'map', data: { title: 'Nous trouver', embedUrl: '', height: '350', animation: 'none' } },
    ],
    ecommerce: [
      { id: 's1', type: 'hero', data: { title: 'Découvrez nos produits', subtitle: 'Livraison gratuite dès 75$', ctaText: 'Voir la boutique', ctaUrl: '/shop', variant: 'centered', animation: 'fadeIn' } },
      { id: 's2', type: 'featured_products', data: { title: 'Meilleures ventes', limit: 4, animation: 'slideUp' } },
      { id: 's3', type: 'features', data: { title: 'Pourquoi acheter chez nous', columns: '4', items: [{ icon: '🚚', title: 'Livraison rapide', description: '2-5 jours' }, { icon: '↩️', title: 'Retours gratuits', description: '30 jours' }, { icon: '🔒', title: 'Paiement sécurisé', description: 'SSL 256-bit' }, { icon: '💬', title: 'Support 24/7', description: 'Chat & téléphone' }], animation: 'slideUp' } },
      { id: 's4', type: 'newsletter', data: { title: 'Restez informé', subtitle: '10% de rabais sur votre première commande', buttonText: 'S\'inscrire', animation: 'fadeIn', backgroundColor: '#f8fafc' } },
    ],
  };

  return templates[template] || [];
}
