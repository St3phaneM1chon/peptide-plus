/**
 * ADMIN - GESTION DES BANNIERES HERO SLIDER
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Plus,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Layers,
  Eye,
  Languages,
  Image as ImageIcon,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Modal,
  EmptyState,
  StatCard,
  FormField,
  Input,
  Textarea,
} from '@/components/admin';

const LOCALES = [
  'en','fr','es','de','it','pt','ru','zh','ko','ar','pl','sv',
  'hi','vi','tl','ta','pa','ht','gcr','ar-dz','ar-lb','ar-ma',
];

const LOCALE_LABELS: Record<string, string> = {
  en: 'English', fr: 'Fran\u00e7ais', es: 'Espa\u00f1ol', de: 'Deutsch',
  it: 'Italiano', pt: 'Portugu\u00eas', ru: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
  zh: '\u4e2d\u6587', ko: '\ud55c\uad6d\uc5b4', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
  pl: 'Polski', sv: 'Svenska', hi: '\u0939\u093f\u0928\u094d\u0926\u0940',
  vi: 'Ti\u1ebfng Vi\u1ec7t', tl: 'Tagalog', ta: '\u0ba4\u0bae\u0bbf\u0bb4\u0bcd',
  pa: '\u0a2a\u0a70\u0a1c\u0a3e\u0a2c\u0a40', ht: 'Krey\u00f2l',
  gcr: 'Kr\u00e9yol Gwiyan\u00e8', 'ar-dz': '\u0627\u0644\u062c\u0632\u0627\u0626\u0631\u064a\u0629',
  'ar-lb': '\u0627\u0644\u0644\u0628\u0646\u0627\u0646\u064a\u0629', 'ar-ma': '\u0627\u0644\u0645\u063a\u0631\u0628\u064a\u0629',
};

interface Translation {
  locale: string;
  badgeText?: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  cta2Text?: string;
  statsJson?: string;
}

interface HeroSlide {
  id: string;
  slug: string;
  mediaType: string;
  backgroundUrl: string;
  backgroundMobile?: string;
  overlayOpacity: number;
  overlayGradient?: string;
  badgeText?: string;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaStyle?: string;
  cta2Text?: string;
  cta2Url?: string;
  cta2Style?: string;
  statsJson?: string;
  sortOrder: number;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  translations: Translation[];
}

const emptySlide: Omit<HeroSlide, 'id' | 'translations'> = {
  slug: '', mediaType: 'IMAGE', backgroundUrl: '', overlayOpacity: 70,
  overlayGradient: '', badgeText: '', title: '', subtitle: '',
  ctaText: '', ctaUrl: '', ctaStyle: 'primary',
  cta2Text: '', cta2Url: '', cta2Style: 'outline',
  statsJson: '', sortOrder: 0, isActive: true,
};

export default function BannieresPage() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSlide, setEditingSlide] = useState<HeroSlide | null>(null);
  const [form, setForm] = useState<any>({ ...emptySlide });
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);

  const fetchSlides = async () => {
    try {
      const res = await fetch('/api/hero-slides');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSlides(data.slides || []);
    } catch {
      setSlides([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSlides(); }, []);

  const openCreate = () => {
    setEditingSlide(null);
    setForm({ ...emptySlide });
    setTranslations({});
    setActiveTab('general');
    setShowForm(true);
  };

  const openEdit = (slide: HeroSlide) => {
    setEditingSlide(slide);
    setForm({
      slug: slide.slug, mediaType: slide.mediaType, backgroundUrl: slide.backgroundUrl,
      backgroundMobile: slide.backgroundMobile || '', overlayOpacity: slide.overlayOpacity,
      overlayGradient: slide.overlayGradient || '', badgeText: slide.badgeText || '',
      title: slide.title, subtitle: slide.subtitle || '',
      ctaText: slide.ctaText || '', ctaUrl: slide.ctaUrl || '', ctaStyle: slide.ctaStyle || 'primary',
      cta2Text: slide.cta2Text || '', cta2Url: slide.cta2Url || '', cta2Style: slide.cta2Style || 'outline',
      statsJson: slide.statsJson || '', sortOrder: slide.sortOrder, isActive: slide.isActive,
      startDate: slide.startDate ? slide.startDate.slice(0, 16) : '',
      endDate: slide.endDate ? slide.endDate.slice(0, 16) : '',
    });
    const trMap: Record<string, Translation> = {};
    slide.translations.forEach((t) => { trMap[t.locale] = { ...t }; });
    setTranslations(trMap);
    setActiveTab('general');
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const trArray = Object.values(translations).filter((t) => t.title);
      const body = { ...form, translations: trArray };

      const url = editingSlide ? `/api/hero-slides/${editingSlide.id}` : '/api/hero-slides';
      const method = editingSlide ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Erreur');
        setSaving(false);
        return;
      }

      setShowForm(false);
      fetchSlides();
    } catch {
      alert('Erreur de connexion');
    }
    setSaving(false);
  };

  const toggleActive = async (slide: HeroSlide) => {
    await fetch(`/api/hero-slides/${slide.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !slide.isActive }),
    });
    fetchSlides();
  };

  const deleteSlide = async (id: string) => {
    if (!confirm('Supprimer cette slide ?')) return;
    await fetch(`/api/hero-slides/${id}`, { method: 'DELETE' });
    fetchSlides();
  };

  const moveSlide = async (slide: HeroSlide, direction: 'up' | 'down') => {
    const idx = slides.findIndex((s) => s.id === slide.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slides.length) return;

    const other = slides[swapIdx];
    await Promise.all([
      fetch(`/api/hero-slides/${slide.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: other.sortOrder }),
      }),
      fetch(`/api/hero-slides/${other.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: slide.sortOrder }),
      }),
    ]);
    fetchSlides();
  };

  const updateTranslation = (locale: string, field: string, value: string) => {
    setTranslations((prev) => ({
      ...prev,
      [locale]: { ...(prev[locale] || { locale, title: '' }), locale, [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  /* ---- Tab button helper ---- */
  const tabCls = (key: string, hasContent?: boolean) =>
    `px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
      activeTab === key
        ? 'border-sky-500 text-sky-700'
        : hasContent
          ? 'border-transparent text-green-600 hover:text-green-700'
          : 'border-transparent text-slate-500 hover:text-slate-700'
    }`;

  /* ---- Modal footer ---- */
  const modalFooter = (
    <>
      <Button variant="secondary" onClick={() => setShowForm(false)}>
        Annuler
      </Button>
      <Button
        variant="primary"
        loading={saving}
        disabled={!form.slug || !form.title || !form.backgroundUrl}
        onClick={handleSave}
      >
        {saving ? 'Enregistrement...' : editingSlide ? 'Mettre \u00e0 jour' : 'Cr\u00e9er'}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Hero Slider"
        subtitle="G\u00e9rez les slides du carrousel hero de la page d'accueil"
        actions={
          <Button variant="primary" icon={Plus} onClick={openCreate}>
            Nouvelle slide
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total"
          value={slides.length}
          icon={Layers}
        />
        <StatCard
          label="Actives"
          value={slides.filter((s) => s.isActive).length}
          icon={Eye}
          className="bg-emerald-50 border-emerald-200"
        />
        <StatCard
          label="Traductions"
          value={slides.reduce((acc, s) => acc + s.translations.length, 0)}
          icon={Languages}
          className="bg-sky-50 border-sky-200"
        />
      </div>

      {/* Slides List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Slides ({slides.length})</h2>
        </div>

        {slides.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                className={`p-4 flex items-center gap-4 ${!slide.isActive ? 'opacity-50' : ''}`}
              >
                {/* Order controls */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveSlide(slide, 'up')}
                    disabled={idx === 0}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveSlide(slide, 'down')}
                    disabled={idx === slides.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="w-32 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0 relative">
                  <img
                    src={slide.backgroundUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {slide.mediaType}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 truncate">{slide.title}</p>
                  <p className="text-sm text-slate-500 truncate">slug: {slide.slug}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                    <span>{slide.translations.length} traduction(s)</span>
                    {slide.ctaUrl && <span>CTA: {slide.ctaUrl}</span>}
                    <span>Ordre: {slide.sortOrder}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleActive(slide)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      slide.isActive ? 'bg-green-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        slide.isActive ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <Button size="sm" variant="secondary" icon={Pencil} onClick={() => openEdit(slide)}>
                    Modifier
                  </Button>
                  <Button size="sm" variant="danger" icon={Trash2} onClick={() => deleteSlide(slide.id)}>
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ImageIcon}
            title="Aucune slide"
            description="Cr\u00e9ez votre premi\u00e8re slide pour le hero slider."
            action={
              <Button variant="primary" icon={Plus} onClick={openCreate}>
                Nouvelle slide
              </Button>
            }
          />
        )}
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingSlide ? 'Modifier la slide' : 'Nouvelle slide'}
        size="xl"
        footer={modalFooter}
      >
        {/* Tabs */}
        <div className="border-b border-slate-200 -mx-5 px-5 -mt-5 mb-5 flex gap-1 overflow-x-auto">
          <button onClick={() => setActiveTab('general')} className={tabCls('general')}>
            G\u00e9n\u00e9ral
          </button>
          <button onClick={() => setActiveTab('media')} className={tabCls('media')}>
            M\u00e9dia &amp; Overlay
          </button>
          <button onClick={() => setActiveTab('cta')} className={tabCls('cta')}>
            CTA &amp; Stats
          </button>
          <button onClick={() => setActiveTab('schedule')} className={tabCls('schedule')}>
            Programmation
          </button>
          {LOCALES.map((loc) => (
            <button
              key={loc}
              onClick={() => setActiveTab(`lang-${loc}`)}
              className={tabCls(`lang-${loc}`, !!translations[loc]?.title)}
            >
              {loc.toUpperCase()}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Slug" required>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="research-peptides"
                />
              </FormField>
              <FormField label="Ordre">
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                />
              </FormField>
            </div>
            <FormField label="Titre (d\u00e9faut)" required>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </FormField>
            <FormField label="Sous-titre (d\u00e9faut)">
              <Textarea
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                rows={2}
              />
            </FormField>
            <FormField label="Badge">
              <Input
                value={form.badgeText}
                onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                placeholder="Research Grade Peptides"
              />
            </FormField>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-slate-300 text-sky-500 focus:ring-sky-500"
              />
              <label className="text-sm text-slate-700">Active</label>
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="space-y-4">
            <FormField label="Type de m\u00e9dia">
              <select
                value={form.mediaType}
                onChange={(e) => setForm({ ...form, mediaType: e.target.value })}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Vid\u00e9o</option>
                <option value="ANIMATION">Animation</option>
              </select>
            </FormField>
            <FormField label="URL background" required>
              <Input
                value={form.backgroundUrl}
                onChange={(e) => setForm({ ...form, backgroundUrl: e.target.value })}
                placeholder="https://images.unsplash.com/..."
              />
              {form.backgroundUrl && (
                <div className="mt-2 h-32 rounded-lg overflow-hidden bg-slate-100">
                  <img src={form.backgroundUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </FormField>
            <FormField label="URL mobile (optionnel)">
              <Input
                value={form.backgroundMobile}
                onChange={(e) => setForm({ ...form, backgroundMobile: e.target.value })}
              />
            </FormField>
            <FormField label={`Opacit\u00e9 overlay (${form.overlayOpacity}%)`}>
              <input
                type="range"
                min="0"
                max="100"
                value={form.overlayOpacity}
                onChange={(e) => setForm({ ...form, overlayOpacity: parseInt(e.target.value) })}
                className="w-full"
              />
            </FormField>
            <FormField label="Gradient (classes Tailwind)">
              <Input
                value={form.overlayGradient}
                onChange={(e) => setForm({ ...form, overlayGradient: e.target.value })}
                placeholder="from-black/80 via-black/70 to-black/60"
              />
            </FormField>
          </div>
        )}

        {/* CTA & Stats Tab */}
        {activeTab === 'cta' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-slate-900 mb-3">CTA Primaire</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Texte">
                  <Input
                    value={form.ctaText}
                    onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                    placeholder="Voir les produits"
                  />
                </FormField>
                <FormField label="URL">
                  <Input
                    value={form.ctaUrl}
                    onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                    placeholder="/shop"
                  />
                </FormField>
                <FormField label="Style">
                  <select
                    value={form.ctaStyle}
                    onChange={(e) => setForm({ ...form, ctaStyle: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="primary">Primary (orange)</option>
                    <option value="secondary">Secondary (blanc)</option>
                    <option value="outline">Outline (transparent)</option>
                  </select>
                </FormField>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-slate-900 mb-3">CTA Secondaire</h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField label="Texte">
                  <Input
                    value={form.cta2Text}
                    onChange={(e) => setForm({ ...form, cta2Text: e.target.value })}
                  />
                </FormField>
                <FormField label="URL">
                  <Input
                    value={form.cta2Url}
                    onChange={(e) => setForm({ ...form, cta2Url: e.target.value })}
                  />
                </FormField>
                <FormField label="Style">
                  <select
                    value={form.cta2Style}
                    onChange={(e) => setForm({ ...form, cta2Style: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  >
                    <option value="primary">Primary (orange)</option>
                    <option value="secondary">Secondary (blanc)</option>
                    <option value="outline">Outline (transparent)</option>
                  </select>
                </FormField>
              </div>
            </div>
            <div>
              <FormField label="Stats JSON">
                <Textarea
                  value={form.statsJson}
                  onChange={(e) => setForm({ ...form, statsJson: e.target.value })}
                  rows={4}
                  className="font-mono text-sm"
                  placeholder='[{"value":"99%+","label":"Purity"},{"value":"500+","label":"Products"}]'
                />
              </FormField>
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <FormField label="Date de d\u00e9but">
              <Input
                type="datetime-local"
                value={form.startDate || ''}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </FormField>
            <FormField label="Date de fin">
              <Input
                type="datetime-local"
                value={form.endDate || ''}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </FormField>
            <p className="text-sm text-slate-500">
              Laissez vide pour afficher la slide sans restriction de dates.
            </p>
          </div>
        )}

        {/* Language Tabs */}
        {LOCALES.map((loc) => {
          if (activeTab !== `lang-${loc}`) return null;
          const tr = translations[loc] || { locale: loc, title: '' };
          return (
            <div key={loc} className="space-y-4">
              <h3 className="font-medium text-slate-900">
                Traduction: {LOCALE_LABELS[loc] || loc} ({loc.toUpperCase()})
              </h3>
              <FormField label="Badge">
                <Input
                  value={tr.badgeText || ''}
                  onChange={(e) => updateTranslation(loc, 'badgeText', e.target.value)}
                />
              </FormField>
              <FormField label="Titre" required>
                <Input
                  value={tr.title || ''}
                  onChange={(e) => updateTranslation(loc, 'title', e.target.value)}
                />
              </FormField>
              <FormField label="Sous-titre">
                <Textarea
                  value={tr.subtitle || ''}
                  onChange={(e) => updateTranslation(loc, 'subtitle', e.target.value)}
                  rows={2}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="CTA Texte">
                  <Input
                    value={tr.ctaText || ''}
                    onChange={(e) => updateTranslation(loc, 'ctaText', e.target.value)}
                  />
                </FormField>
                <FormField label="CTA2 Texte">
                  <Input
                    value={tr.cta2Text || ''}
                    onChange={(e) => updateTranslation(loc, 'cta2Text', e.target.value)}
                  />
                </FormField>
              </div>
              <FormField label="Stats JSON">
                <Textarea
                  value={tr.statsJson || ''}
                  onChange={(e) => updateTranslation(loc, 'statsJson', e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                  placeholder='[{"value":"99%+","label":"Puret\u00e9"}]'
                />
              </FormField>
            </div>
          );
        })}
      </Modal>
    </div>
  );
}
