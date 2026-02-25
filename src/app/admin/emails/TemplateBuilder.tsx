'use client';

import { useState, useCallback } from 'react';
import { Plus, GripVertical, Trash2, Type, Image, ShoppingBag, MousePointer, Minus, Eye } from 'lucide-react';

interface TemplateBlock {
  id: string;
  type: 'header' | 'text' | 'image' | 'product_grid' | 'cta' | 'divider' | 'footer';
  content: Record<string, string>;
}

const BLOCK_TYPES = [
  { type: 'header', label: 'En-tête', icon: Type, defaultContent: { text: 'Titre de votre email', align: 'center' } },
  { type: 'text', label: 'Texte', icon: Type, defaultContent: { text: 'Votre texte ici...', align: 'left' } },
  { type: 'image', label: 'Image', icon: Image, defaultContent: { url: '', alt: 'Image', width: '100%' } },
  { type: 'product_grid', label: 'Grille produits', icon: ShoppingBag, defaultContent: { count: '4', title: 'Nos recommandations' } },
  { type: 'cta', label: 'Bouton CTA', icon: MousePointer, defaultContent: { text: 'Acheter maintenant', url: 'https://biocyclepeptides.com', color: '#059669' } },
  { type: 'divider', label: 'Séparateur', icon: Minus, defaultContent: {} },
] as const;

export default function TemplateBuilder({ onSave }: { onSave?: (blocks: TemplateBlock[]) => void }) {
  const [blocks, setBlocks] = useState<TemplateBlock[]>([
    { id: '1', type: 'header', content: { text: 'BioCycle Peptides', align: 'center' } },
    { id: '2', type: 'text', content: { text: 'Bonjour {{firstName}},\n\nDécouvrez nos dernières nouveautés!', align: 'left' } },
    { id: '3', type: 'cta', content: { text: 'Voir les produits', url: 'https://biocyclepeptides.com/products', color: '#059669' } },
  ]);
  const [previewMode, setPreviewMode] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<string | null>(null);

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

  return (
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
            <Eye className="w-4 h-4" /> {previewMode ? 'Éditer' : 'Aperçu'}
          </button>
        </div>
        {onSave && (
          <button onClick={() => onSave(blocks)} className="w-full mt-2 px-3 py-2 text-sm bg-sky-600 text-white rounded-lg hover:bg-sky-700 font-medium">
            Sauvegarder
          </button>
        )}
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
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Propriétés</h3>
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
  );
}
