'use client';

import { useState } from 'react';
import { Palette, Type, Image, Copy, Check } from 'lucide-react';
import { useI18n } from '@/i18n/client';
import { toast } from 'sonner';

export default function BrandKitPage() {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  const colors = [
    { nameKey: 'colorPrimary', hex: '#059669', usageKey: 'usageButtons' },
    { nameKey: 'colorPrimaryDark', hex: '#047857', usageKey: 'usageHover' },
    { nameKey: 'colorSecondary', hex: '#0ea5e9', usageKey: 'usageInfo' },
    { nameKey: 'colorAccent', hex: '#8b5cf6', usageKey: 'usagePremium' },
    { nameKey: 'colorBackground', hex: '#f8fafc', usageKey: 'usageBackground' },
    { nameKey: 'colorText', hex: '#1e293b', usageKey: 'usageText' },
    { nameKey: 'colorMuted', hex: '#64748b', usageKey: 'usageMuted' },
    { nameKey: 'colorError', hex: '#ef4444', usageKey: 'usageError' },
    { nameKey: 'colorWarning', hex: '#f59e0b', usageKey: 'usageWarning' },
    { nameKey: 'colorSuccess', hex: '#10b981', usageKey: 'usageSuccess' },
  ];

  const fonts = [
    { nameKey: 'fontHeadings', family: 'Inter', weight: '700', size: '24-36px', sample: 'BioCycle Peptides' },
    { nameKey: 'fontBody', family: 'Inter', weight: '400', size: '14-16px', sample: 'Peptides de recherche de haute qualité' },
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
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Palette className="w-6 h-6 text-purple-600" />
          {t('admin.media.brandKit.title')}
        </h1>
        <p className="text-slate-500">{t('admin.media.brandKit.subtitle')}</p>
      </div>

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
