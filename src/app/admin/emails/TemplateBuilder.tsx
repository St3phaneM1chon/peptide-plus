'use client';

import { useState, useCallback, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Type, Image, ShoppingBag, MousePointer, Minus, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { addCSRFHeader } from '@/lib/csrf';

export interface TemplateBlock {
  id: string;
  type: 'header' | 'text' | 'image' | 'product_grid' | 'cta' | 'divider' | 'footer';
  content: Record<string, string>;
}

interface TemplateBuilderProps {
  /** Template ID for updating an existing template. If absent, creates a new one. */
  templateId?: string | null;
  /** Initial blocks loaded from an existing template */
  initialBlocks?: TemplateBlock[];
  /** Called after a successful save with the saved template data */
  onSaved?: (template: { id: string; name: string }) => void;
}

const BLOCK_TYPES = [
  { type: 'header', label: 'En-tete', icon: Type, defaultContent: { text: 'Titre de votre email', align: 'center' } },
  { type: 'text', label: 'Texte', icon: Type, defaultContent: { text: 'Votre texte ici...', align: 'left' } },
  { type: 'image', label: 'Image', icon: Image, defaultContent: { url: '', alt: 'Image', width: '100%' } },
  { type: 'product_grid', label: 'Grille produits', icon: ShoppingBag, defaultContent: { count: '4', title: 'Nos recommandations' } },
  { type: 'cta', label: 'Bouton CTA', icon: MousePointer, defaultContent: { text: 'Acheter maintenant', url: 'https://biocyclepeptides.com', color: '#059669' } },
  { type: 'divider', label: 'Separateur', icon: Minus, defaultContent: {} },
] as const;

/** Compile an array of TemplateBlocks into email-safe HTML */
function blocksToHtml(blocks: TemplateBlock[]): string {
  const parts = blocks.map((block) => {
    switch (block.type) {
      case 'header':
        return `<h2 style="text-align:${block.content.align || 'center'};font-size:24px;font-weight:700;margin:16px 0;">${escapeHtml(block.content.text || '')}</h2>`;
      case 'text':
        return `<p style="text-align:${block.content.align || 'left'};white-space:pre-wrap;margin:12px 0;">${escapeHtml(block.content.text || '').replace(/\n/g, '<br/>')}</p>`;
      case 'image':
        if (block.content.url) {
          return `<div style="text-align:center;margin:16px 0;"><img src="${escapeAttr(block.content.url)}" alt="${escapeAttr(block.content.alt || '')}" style="max-width:${block.content.width || '100%'};height:auto;" /></div>`;
        }
        return '';
      case 'product_grid': {
        const count = Math.min(Math.max(parseInt(block.content.count) || 4, 1), 8);
        const title = escapeHtml(block.content.title || '');
        let html = title ? `<h3 style="text-align:center;margin:16px 0;">${title}</h3>` : '';
        html += '<table width="100%" cellpadding="8" cellspacing="0" style="margin:12px 0;"><tr>';
        for (let i = 0; i < count; i++) {
          html += `<td style="text-align:center;background:#f1f5f9;border-radius:8px;padding:16px;">Produit ${i + 1}</td>`;
        }
        html += '</tr></table>';
        return html;
      }
      case 'cta':
        return `<div style="text-align:center;padding:16px;"><a href="${escapeAttr(block.content.url || '#')}" style="background:${block.content.color || '#059669'};color:#ffffff;padding:12px 32px;border-radius:8px;font-weight:600;display:inline-block;text-decoration:none;">${escapeHtml(block.content.text || 'Click')}</a></div>`;
      case 'divider':
        return '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />';
      case 'footer':
        return `<div style="text-align:center;font-size:12px;color:#94a3b8;padding:16px 0;">${escapeHtml(block.content.text || '')}</div>`;
      default:
        return '';
    }
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:20px;">${parts.join('\n')}</body></html>`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Try to parse block JSON from the textContent field of a template */
export function parseBlocksFromTextContent(textContent: string | null | undefined): TemplateBlock[] | null {
  if (!textContent) return null;
  try {
    const parsed = JSON.parse(textContent);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type && parsed[0].content) {
      return parsed as TemplateBlock[];
    }
  } catch {
    // Not block JSON - regular text content
  }
  return null;
}

const DEFAULT_BLOCKS: TemplateBlock[] = [
  { id: '1', type: 'header', content: { text: 'BioCycle Peptides', align: 'center' } },
  { id: '2', type: 'text', content: { text: 'Bonjour {{firstName}},\n\nDecouvrez nos dernieres nouveautes!', align: 'left' } },
  { id: '3', type: 'cta', content: { text: 'Voir les produits', url: 'https://biocyclepeptides.com/products', color: '#059669' } },
];

export default function TemplateBuilder({ templateId, initialBlocks, onSaved }: TemplateBuilderProps) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>(initialBlocks ?? DEFAULT_BLOCKS);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSubject, setTemplateSubject] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Load existing template blocks when templateId is provided
  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    setLoadingTemplate(true);
    fetch(`/api/admin/emails/${templateId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data?.template) return;
        const tpl = data.template;
        setTemplateName(tpl.name || '');
        setTemplateSubject(tpl.subject || '');
        // Try to parse blocks from textContent
        const loadedBlocks = parseBlocksFromTextContent(tpl.textContent);
        if (loadedBlocks) {
          setBlocks(loadedBlocks);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load template');
      })
      .finally(() => { if (!cancelled) setLoadingTemplate(false); });
    return () => { cancelled = true; };
  }, [templateId]);

  // Update blocks when initialBlocks prop changes
  useEffect(() => {
    if (initialBlocks) setBlocks(initialBlocks);
  }, [initialBlocks]);

  const addBlock = useCallback((type: string) => {
    const blockType = BLOCK_TYPES.find(b => b.type === type);
    if (!blockType) return;
    const newBlock: TemplateBlock = {
      id: Date.now().toString(36),
      type: type as TemplateBlock['type'],
      content: { ...blockType.defaultContent },
    };
    setBlocks(prev => [...prev, newBlock]);
    setSelectedBlock(newBlock.id);
  }, []);

  const removeBlock = useCallback((id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlock === id) setSelectedBlock(null);
  }, [selectedBlock]);

  const updateBlockContent = useCallback((id: string, key: string, value: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: { ...b.content, [key]: value } } : b));
  }, []);

  const moveBlock = useCallback((id: string, direction: 'up' | 'down') => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }, []);

  /** Save template to backend: POST for new, PATCH for existing */
  const handleSave = useCallback(async () => {
    if (!templateId && !templateName.trim()) {
      toast.error('Veuillez entrer un nom de template');
      return;
    }

    setSaving(true);
    try {
      const compiledHtml = blocksToHtml(blocks);
      const blocksJson = JSON.stringify(blocks);

      // Extract variable names from block text ({{varName}} patterns)
      const varSet = new Set<string>();
      blocks.forEach(b => {
        Object.values(b.content).forEach(val => {
          const matches = val.matchAll(/\{\{(\w+(?:\.\w+)?)\}\}/g);
          for (const m of matches) varSet.add(m[1]);
        });
      });

      if (templateId) {
        // Update existing template
        const res = await fetch(`/api/admin/emails/${templateId}`, {
          method: 'PATCH',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            htmlContent: compiledHtml,
            textContent: blocksJson,
            variables: Array.from(varSet),
            ...(templateSubject ? { subject: templateSubject } : {}),
            ...(templateName ? { name: templateName } : {}),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update template');
        }

        const data = await res.json();
        toast.success('Template mis a jour');
        onSaved?.({ id: data.template.id, name: data.template.name });
      } else {
        // Create new template
        const res = await fetch('/api/admin/emails', {
          method: 'POST',
          headers: addCSRFHeader({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            name: templateName.trim(),
            subject: templateSubject.trim() || templateName.trim(),
            htmlContent: compiledHtml,
            textContent: blocksJson,
            variables: Array.from(varSet),
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create template');
        }

        const data = await res.json();
        toast.success('Template cree avec succes');
        onSaved?.({ id: data.template.id, name: data.template.name });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }, [blocks, templateId, templateName, templateSubject, onSaved]);

  const renderBlockPreview = (block: TemplateBlock) => {
    switch (block.type) {
      case 'header':
        return <h2 style={{ textAlign: (block.content.align as 'left' | 'center' | 'right') || 'center', fontSize: '24px', fontWeight: 700 }}>{block.content.text}</h2>;
      case 'text':
        return <p style={{ textAlign: (block.content.align as 'left' | 'center' | 'right') || 'left', whiteSpace: 'pre-wrap' }}>{block.content.text}</p>;
      case 'image':
        return block.content.url ? <img src={block.content.url} alt={block.content.alt} style={{ maxWidth: '100%' }} /> : <div className="h-32 bg-slate-100 rounded flex items-center justify-center text-slate-400">Image placeholder</div>;
      case 'product_grid':
        return <div className="grid grid-cols-4 gap-2 py-4">{Array.from({ length: Number(block.content.count) || 4 }).map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded flex items-center justify-center text-xs text-slate-400">Produit {i + 1}</div>)}</div>;
      case 'cta':
        return <div style={{ textAlign: 'center', padding: '16px' }}><span style={{ background: block.content.color || '#059669', color: 'white', padding: '12px 32px', borderRadius: '8px', fontWeight: 600, display: 'inline-block' }}>{block.content.text}</span></div>;
      case 'divider':
        return <hr className="border-slate-200 my-4" />;
      default:
        return <div className="text-slate-400 text-sm">Block: {block.type}</div>;
    }
  };

  if (loadingTemplate) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
        <span className="ml-2 text-sm text-slate-500">Chargement du template...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Template name & subject fields (for new or editing) */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Nom du template</label>
          <input
            type="text"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
            placeholder="ex: welcome-new-customer"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Sujet de l&apos;email</label>
          <input
            type="text"
            value={templateSubject}
            onChange={e => setTemplateSubject(e.target.value)}
            placeholder="ex: Bienvenue chez BioCycle Peptides!"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-400 focus:border-sky-400"
          />
        </div>
      </div>

      <div className="flex gap-6 min-h-[600px]">
        {/* Block Palette */}
        <div className="w-48 flex-shrink-0">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Blocs</h3>
          <div className="space-y-2">
            {BLOCK_TYPES.map(bt => (
              <button
                key={bt.type}
                onClick={() => addBlock(bt.type)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-sky-50 hover:border-sky-300 transition-colors"
              >
                <bt.icon className="w-4 h-4" />
                {bt.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setPreviewMode(!previewMode)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200">
              <Eye className="w-4 h-4" /> {previewMode ? 'Editer' : 'Apercu'}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full mt-2 px-3 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {saving ? 'Sauvegarde...' : (templateId ? 'Mettre a jour' : 'Sauvegarder')}
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-slate-100 rounded-xl p-6">
          <div className="max-w-[600px] mx-auto bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {blocks.length === 0 ? (
              <div className="py-20 text-center text-slate-400">
                <Plus className="w-8 h-8 mx-auto mb-2" />
                <p>Ajoutez des blocs pour construire votre template</p>
              </div>
            ) : (
              blocks.map((block) => (
                <div
                  key={block.id}
                  className={`relative group ${selectedBlock === block.id ? 'ring-2 ring-sky-400' : ''} ${!previewMode ? 'hover:ring-1 hover:ring-slate-300 cursor-pointer' : ''}`}
                  onClick={() => !previewMode && setSelectedBlock(block.id)}
                >
                  {!previewMode && (
                    <div className="absolute -start-10 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                      <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up'); }} className="p-1 bg-white shadow rounded text-slate-400 hover:text-slate-600">
                        <GripVertical className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }} className="p-1 bg-white shadow rounded text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="px-6 py-4">
                    {renderBlockPreview(block)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Properties Panel */}
        {selectedBlock && !previewMode && (
          <div className="w-64 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Proprietes</h3>
            {(() => {
              const block = blocks.find(b => b.id === selectedBlock);
              if (!block) return null;
              return (
                <div className="space-y-3">
                  {Object.entries(block.content).map(([key, val]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-slate-500 mb-1 capitalize">{key}</label>
                      {key === 'text' && String(val).length > 50 ? (
                        <textarea
                          value={val}
                          onChange={e => updateBlockContent(block.id, key, e.target.value)}
                          rows={4}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-400 focus:border-sky-400"
                        />
                      ) : (
                        <input
                          type="text"
                          value={val}
                          onChange={e => updateBlockContent(block.id, key, e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-1 focus:ring-sky-400 focus:border-sky-400"
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
