'use client';

import { useState, useEffect } from 'react';

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hero Slider</h1>
          <p className="text-gray-500">G\u00e9rez les slides du carrousel hero de la page d&apos;accueil</p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle slide
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{slides.length}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">Actives</p>
          <p className="text-2xl font-bold text-green-700">{slides.filter((s) => s.isActive).length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">Traductions</p>
          <p className="text-2xl font-bold text-blue-700">
            {slides.reduce((acc, s) => acc + s.translations.length, 0)}
          </p>
        </div>
      </div>

      {/* Slides List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Slides ({slides.length})</h2>
        </div>

        {slides.length > 0 ? (
          <div className="divide-y divide-gray-100">
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
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveSlide(slide, 'down')}
                    disabled={idx === slides.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="w-32 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
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
                  <p className="font-medium text-gray-900 truncate">{slide.title}</p>
                  <p className="text-sm text-gray-500 truncate">slug: {slide.slug}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
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
                      slide.isActive ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                        slide.isActive ? 'right-0.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => openEdit(slide)}
                    className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm hover:bg-amber-200"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => deleteSlide(slide.id)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-400">
            Aucune slide. Cr\u00e9ez votre premi\u00e8re slide pour le hero slider.
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-8 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-4xl w-full shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingSlide ? 'Modifier la slide' : 'Nouvelle slide'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 px-6 flex gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab('general')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'general'
                    ? 'border-amber-500 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                G\u00e9n\u00e9ral
              </button>
              <button
                onClick={() => setActiveTab('media')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'media'
                    ? 'border-amber-500 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                M\u00e9dia & Overlay
              </button>
              <button
                onClick={() => setActiveTab('cta')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'cta'
                    ? 'border-amber-500 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                CTA & Stats
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'schedule'
                    ? 'border-amber-500 text-amber-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Programmation
              </button>
              {LOCALES.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setActiveTab(`lang-${loc}`)}
                  className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === `lang-${loc}`
                      ? 'border-amber-500 text-amber-700'
                      : translations[loc]?.title
                        ? 'border-transparent text-green-600 hover:text-green-700'
                        : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* General Tab */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                      <input
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        placeholder="research-peptides"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ordre</label>
                      <input
                        type="number"
                        value={form.sortOrder}
                        onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Titre (d\u00e9faut) *</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sous-titre (d\u00e9faut)</label>
                    <textarea
                      value={form.subtitle}
                      onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Badge</label>
                    <input
                      value={form.badgeText}
                      onChange={(e) => setForm({ ...form, badgeText: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                      placeholder="Research Grade Peptides"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <label className="text-sm text-gray-700">Active</label>
                  </div>
                </div>
              )}

              {/* Media Tab */}
              {activeTab === 'media' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type de m\u00e9dia</label>
                    <select
                      value={form.mediaType}
                      onChange={(e) => setForm({ ...form, mediaType: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value="IMAGE">Image</option>
                      <option value="VIDEO">Vid\u00e9o</option>
                      <option value="ANIMATION">Animation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL background *</label>
                    <input
                      value={form.backgroundUrl}
                      onChange={(e) => setForm({ ...form, backgroundUrl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                      placeholder="https://images.unsplash.com/..."
                    />
                    {form.backgroundUrl && (
                      <div className="mt-2 h-32 rounded-lg overflow-hidden bg-gray-100">
                        <img src={form.backgroundUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL mobile (optionnel)</label>
                    <input
                      value={form.backgroundMobile}
                      onChange={(e) => setForm({ ...form, backgroundMobile: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Opacit\u00e9 overlay ({form.overlayOpacity}%)
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={form.overlayOpacity}
                      onChange={(e) => setForm({ ...form, overlayOpacity: parseInt(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gradient (classes Tailwind)</label>
                    <input
                      value={form.overlayGradient}
                      onChange={(e) => setForm({ ...form, overlayGradient: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                      placeholder="from-black/80 via-black/70 to-black/60"
                    />
                  </div>
                </div>
              )}

              {/* CTA & Stats Tab */}
              {activeTab === 'cta' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">CTA Primaire</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Texte</label>
                        <input
                          value={form.ctaText}
                          onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                          placeholder="Voir les produits"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">URL</label>
                        <input
                          value={form.ctaUrl}
                          onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                          placeholder="/shop"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Style</label>
                        <select
                          value={form.ctaStyle}
                          onChange={(e) => setForm({ ...form, ctaStyle: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        >
                          <option value="primary">Primary (orange)</option>
                          <option value="secondary">Secondary (blanc)</option>
                          <option value="outline">Outline (transparent)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">CTA Secondaire</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Texte</label>
                        <input
                          value={form.cta2Text}
                          onChange={(e) => setForm({ ...form, cta2Text: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">URL</label>
                        <input
                          value={form.cta2Url}
                          onChange={(e) => setForm({ ...form, cta2Url: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Style</label>
                        <select
                          value={form.cta2Style}
                          onChange={(e) => setForm({ ...form, cta2Style: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        >
                          <option value="primary">Primary (orange)</option>
                          <option value="secondary">Secondary (blanc)</option>
                          <option value="outline">Outline (transparent)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Stats JSON</h3>
                    <textarea
                      value={form.statsJson}
                      onChange={(e) => setForm({ ...form, statsJson: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                      placeholder='[{"value":"99%+","label":"Purity"},{"value":"500+","label":"Products"}]'
                    />
                  </div>
                </div>
              )}

              {/* Schedule Tab */}
              {activeTab === 'schedule' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de d\u00e9but</label>
                    <input
                      type="datetime-local"
                      value={form.startDate || ''}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                    <input
                      type="datetime-local"
                      value={form.endDate || ''}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                    />
                  </div>
                  <p className="text-sm text-gray-500">
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
                    <h3 className="font-medium text-gray-900">
                      Traduction: {LOCALE_LABELS[loc] || loc} ({loc.toUpperCase()})
                    </h3>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Badge</label>
                      <input
                        value={tr.badgeText || ''}
                        onChange={(e) => updateTranslation(loc, 'badgeText', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Titre *</label>
                      <input
                        value={tr.title || ''}
                        onChange={(e) => updateTranslation(loc, 'title', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Sous-titre</label>
                      <textarea
                        value={tr.subtitle || ''}
                        onChange={(e) => updateTranslation(loc, 'subtitle', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">CTA Texte</label>
                        <input
                          value={tr.ctaText || ''}
                          onChange={(e) => updateTranslation(loc, 'ctaText', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">CTA2 Texte</label>
                        <input
                          value={tr.cta2Text || ''}
                          onChange={(e) => updateTranslation(loc, 'cta2Text', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Stats JSON</label>
                      <textarea
                        value={tr.statsJson || ''}
                        onChange={(e) => updateTranslation(loc, 'statsJson', e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-amber-500 focus:border-amber-500 font-mono text-sm"
                        placeholder='[{"value":"99%+","label":"Puret\u00e9"}]'
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.slug || !form.title || !form.backgroundUrl}
                className="px-6 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Enregistrement...' : editingSlide ? 'Mettre \u00e0 jour' : 'Cr\u00e9er'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
