'use client';

/**
 * Brand Kit Page — Chantier 4.3: Enhanced with API-connected editing.
 */

import { useState, useEffect } from 'react';
import { Palette, Type, Image, Copy, Check, Save, Loader2, Edit2 } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';
import { fetchWithCSRF } from '@/lib/csrf';

interface BrandKitData {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  fontHeading: string | null;
  fontBody: string | null;
  guidelines: string | null;
}

export default function BrandKitPage() {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [brandKit, setBrandKit] = useState<BrandKitData | null>(null);

  // Fetch brand kit from API
  useEffect(() => {
    fetch('/api/admin/brand-kit')
      .then((r) => r.json())
      .then((data) => {
        if (data.brandKit) setBrandKit(data.brandKit);
      })
      .catch(() => {});
  }, []);

  const saveBrandKit = async () => {
    if (!brandKit) return;
    setSaving(true);
    try {
      const res = await fetchWithCSRF('/api/admin/brand-kit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brandKit),
      });
      if (res.ok) {
        toast.success(t('admin.media.brandKit.saved') || 'Brand kit saved');
        setEditing(false);
      } else {
        toast.error(t('admin.media.brandKit.saveError') || 'Failed to save');
      }
    } catch {
      toast.error(t('admin.media.brandKit.saveError') || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const colors = [
    { nameKey: 'colorPrimary', hex: brandKit?.primaryColor || '#059669', usageKey: 'usageButtons' },
    { nameKey: 'colorPrimaryDark', hex: '#047857', usageKey: 'usageHover' },
    { nameKey: 'colorSecondary', hex: brandKit?.secondaryColor || '#0ea5e9', usageKey: 'usageInfo' },
    { nameKey: 'colorAccent', hex: brandKit?.accentColor || '#8b5cf6', usageKey: 'usagePremium' },
    { nameKey: 'colorBackground', hex: '#f8fafc', usageKey: 'usageBackground' },
    { nameKey: 'colorText', hex: '#1e293b', usageKey: 'usageText' },
    { nameKey: 'colorMuted', hex: '#64748b', usageKey: 'usageMuted' },
    { nameKey: 'colorError', hex: '#ef4444', usageKey: 'usageError' },
    { nameKey: 'colorWarning', hex: '#f59e0b', usageKey: 'usageWarning' },
    { nameKey: 'colorSuccess', hex: '#10b981', usageKey: 'usageSuccess' },
  ];

  const fonts = [
    { nameKey: 'fontHeadings', family: brandKit?.fontHeading || 'Inter', weight: '700', size: '24-36px', sample: 'BioCycle Peptides' },
    { nameKey: 'fontBody', family: brandKit?.fontBody || 'Inter', weight: '400', size: '14-16px', sample: 'Peptides de recherche de haute qualité' },
    { nameKey: 'fontCaptions', family: 'Inter', weight: '500', size: '11-12px', sample: 'CODE PROMO: BIOCYCLE10' },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(t('admin.media.brandKit.copied').replace('{label}', label) || `${label} copié`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Palette className="w-6 h-6 text-purple-600" />
            {t('admin.media.brandKit.title')}
          </h1>
          <p className="text-slate-500">{t('admin.media.brandKit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={saveBrandKit}
                disabled={saving}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('common.save') || 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Edit2 className="w-4 h-4" />
              {t('common.edit') || 'Edit'}
            </button>
          )}
        </div>
      </div>

      {/* Brand Name Editor (Chantier 4.3) */}
      {editing && brandKit && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.media.brandKit.brandName') || 'Brand Name'}</label>
              <input
                type="text"
                value={brandKit.name}
                onChange={(e) => setBrandKit({ ...brandKit, name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.media.brandKit.primaryColor') || 'Primary Color'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandKit.primaryColor || '#059669'}
                  onChange={(e) => setBrandKit({ ...brandKit, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={brandKit.primaryColor || ''}
                  onChange={(e) => setBrandKit({ ...brandKit, primaryColor: e.target.value })}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="#059669"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('admin.media.brandKit.accentColor') || 'Accent Color'}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandKit.accentColor || '#8b5cf6'}
                  onChange={(e) => setBrandKit({ ...brandKit, accentColor: e.target.value })}
                  className="w-10 h-10 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={brandKit.accentColor || ''}
                  onChange={(e) => setBrandKit({ ...brandKit, accentColor: e.target.value })}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm font-mono"
                  placeholder="#8b5cf6"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('admin.media.brandKit.guidelines') || 'Brand Guidelines'}</label>
            <textarea
              value={brandKit.guidelines || ''}
              onChange={(e) => setBrandKit({ ...brandKit, guidelines: e.target.value })}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder={t('admin.media.brandKit.guidelinesPlaceholder') || 'Brand usage guidelines, tone of voice, dos & donts...'}
            />
          </div>
        </div>
      )}

      {/* Colors */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" /> {t('admin.media.brandKit.colorsSection')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {colors.map(color => {
            const name = t(`admin.media.brandKit.${color.nameKey}`);
            return (
              <div key={color.nameKey} className="group">
                <button
                  onClick={() => copyToClipboard(color.hex, name)}
                  className="w-full aspect-square rounded-xl shadow-sm border border-slate-200 hover:ring-2 hover:ring-sky-400 transition-all relative overflow-hidden"
                  style={{ backgroundColor: color.hex }}
                >
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity">
                    {copied === name ? <Check className="w-6 h-6 text-white" /> : <Copy className="w-6 h-6 text-white" />}
                  </div>
                </button>
                <div className="mt-2">
                  <div className="text-sm font-medium text-slate-700">{name}</div>
                  <div className="text-xs text-slate-500 font-mono">{color.hex}</div>
                  <div className="text-[10px] text-slate-400">{t(`admin.media.brandKit.${color.usageKey}`)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Type className="w-5 h-5" /> {t('admin.media.brandKit.typographySection')}
        </h2>
        <div className="space-y-6">
          {fonts.map(font => (
            <div key={font.nameKey} className="flex items-start gap-6 p-4 bg-slate-50 rounded-lg">
              <div className="w-32 flex-shrink-0">
                <div className="text-sm font-semibold text-slate-700">{t(`admin.media.brandKit.${font.nameKey}`)}</div>
                <div className="text-xs text-slate-500">{font.family} {font.weight}</div>
                <div className="text-xs text-slate-400">{font.size}</div>
              </div>
              <div className="flex-1" style={{ fontFamily: font.family, fontWeight: Number(font.weight), fontSize: font.nameKey === 'fontHeadings' ? '28px' : font.nameKey === 'fontCaptions' ? '12px' : '16px' }}>
                {font.sample}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logo Guidelines */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Image className="w-5 h-5" /> {t('admin.media.brandKit.logoSection')}
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-8 bg-white border border-slate-200 rounded-xl text-center">
            <div className="text-2xl font-bold text-emerald-600 mb-2">BioCycle Peptides</div>
            <div className="text-xs text-slate-400">{t('admin.media.brandKit.logoLight')}</div>
          </div>
          <div className="p-8 bg-slate-800 border border-slate-700 rounded-xl text-center">
            <div className="text-2xl font-bold text-emerald-400 mb-2">BioCycle Peptides</div>
            <div className="text-xs text-slate-400">{t('admin.media.brandKit.logoDark')}</div>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-500">
          <p>{t('admin.media.brandKit.logoGuidelines')}</p>
        </div>
      </div>
    </div>
  );
}
