'use client';

import { useState } from 'react';
import { Palette, Type, Image, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function BrandKitPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const colors = [
    { name: 'Primary', hex: '#059669', usage: 'Boutons, liens, accents' },
    { name: 'Primary Dark', hex: '#047857', usage: 'Hover, focus' },
    { name: 'Secondary', hex: '#0ea5e9', usage: 'Informations, highlights' },
    { name: 'Accent', hex: '#8b5cf6', usage: 'Badges premium, VIP' },
    { name: 'Background', hex: '#f8fafc', usage: 'Fond principal' },
    { name: 'Text', hex: '#1e293b', usage: 'Texte principal' },
    { name: 'Muted', hex: '#64748b', usage: 'Texte secondaire' },
    { name: 'Error', hex: '#ef4444', usage: 'Erreurs, alertes critiques' },
    { name: 'Warning', hex: '#f59e0b', usage: 'Avertissements' },
    { name: 'Success', hex: '#10b981', usage: 'Confirmations, réussite' },
  ];

  const fonts = [
    { name: 'Headings', family: 'Inter', weight: '700', size: '24-36px', sample: 'BioCycle Peptides' },
    { name: 'Body', family: 'Inter', weight: '400', size: '14-16px', sample: 'Peptides de recherche de haute qualité' },
    { name: 'Captions', family: 'Inter', weight: '500', size: '11-12px', sample: 'CODE PROMO: BIOCYCLE10' },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success(`${label} copié`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Palette className="w-6 h-6 text-purple-600" />
          Kit de marque
        </h1>
        <p className="text-slate-500">Couleurs, typographies et assets de la marque BioCycle Peptides</p>
      </div>

      {/* Colors */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Palette className="w-5 h-5" /> Palette de couleurs
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {colors.map(color => (
            <div key={color.name} className="group">
              <button
                onClick={() => copyToClipboard(color.hex, color.name)}
                className="w-full aspect-square rounded-xl shadow-sm border border-slate-200 hover:ring-2 hover:ring-sky-400 transition-all relative overflow-hidden"
                style={{ backgroundColor: color.hex }}
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity">
                  {copied === color.name ? <Check className="w-6 h-6 text-white" /> : <Copy className="w-6 h-6 text-white" />}
                </div>
              </button>
              <div className="mt-2">
                <div className="text-sm font-medium text-slate-700">{color.name}</div>
                <div className="text-xs text-slate-500 font-mono">{color.hex}</div>
                <div className="text-[10px] text-slate-400">{color.usage}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Type className="w-5 h-5" /> Typographie
        </h2>
        <div className="space-y-6">
          {fonts.map(font => (
            <div key={font.name} className="flex items-start gap-6 p-4 bg-slate-50 rounded-lg">
              <div className="w-32 flex-shrink-0">
                <div className="text-sm font-semibold text-slate-700">{font.name}</div>
                <div className="text-xs text-slate-500">{font.family} {font.weight}</div>
                <div className="text-xs text-slate-400">{font.size}</div>
              </div>
              <div className="flex-1" style={{ fontFamily: font.family, fontWeight: Number(font.weight), fontSize: font.name === 'Headings' ? '28px' : font.name === 'Captions' ? '12px' : '16px' }}>
                {font.sample}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logo Guidelines */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Image className="w-5 h-5" /> Logo & Assets
        </h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-8 bg-white border border-slate-200 rounded-xl text-center">
            <div className="text-2xl font-bold text-emerald-600 mb-2">BioCycle Peptides</div>
            <div className="text-xs text-slate-400">Logo principal (fond clair)</div>
          </div>
          <div className="p-8 bg-slate-800 border border-slate-700 rounded-xl text-center">
            <div className="text-2xl font-bold text-emerald-400 mb-2">BioCycle Peptides</div>
            <div className="text-xs text-slate-400">Logo inversé (fond sombre)</div>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-500">
          <p>Zone de protection minimale: 16px autour du logo. Ne pas déformer, changer les couleurs ou ajouter d'effets.</p>
        </div>
      </div>
    </div>
  );
}
