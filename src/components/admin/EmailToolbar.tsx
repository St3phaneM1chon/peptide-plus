'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Undo2, Redo2, Eraser, Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, IndentIncrease, IndentDecrease,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link2, Unlink, ImagePlus, Smile, ChevronDown,
  Highlighter, Palette, Paperclip, Loader2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  /** Show attachment button + handler */
  onAttach?: () => void;
  uploading?: boolean;
  /** Extra content to render at the end of the toolbar (e.g. variable insertion) */
  trailing?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FONT_FAMILIES = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', sans-serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
];

const FONT_SIZES = [
  { label: '8', value: '1' },
  { label: '10', value: '2' },
  { label: '12', value: '3' },
  { label: '14', value: '4' },
  { label: '18', value: '5' },
  { label: '24', value: '6' },
  { label: '36', value: '7' },
];

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#B7B7B7', '#CCCCCC', '#D9D9D9', '#FFFFFF',
  '#980000', '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#4A86E8', '#0000FF',
  '#9900FF', '#FF00FF', '#E6B8AF', '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3',
  '#C9DAF8', '#CFE2F3', '#D9D2E9', '#EAD1DC',
];

const HIGHLIGHT_COLORS = [
  '#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FF0000', '#0000FF',
  '#FFC000', '#92D050', '#00B0F0', '#7030A0', '#FF6699', '#FFD966',
  'transparent',
];

const EMOJIS = [
  '😀', '😊', '😂', '🥰', '😎', '🤔', '👍', '👋',
  '❤️', '🔥', '⭐', '✅', '🎉', '💡', '📧', '📎',
  '🚀', '💪', '🙏', '👏', '🎯', '💯', '⚡', '🌟',
  '📌', '🔔', '💬', '📝', '🏆', '🤝', '💼', '📊',
];

const LINE_HEIGHTS = [
  { label: '1.0', value: '1' },
  { label: '1.15', value: '1.15' },
  { label: '1.5', value: '1.5' },
  { label: '2.0', value: '2' },
  { label: '2.5', value: '2.5' },
  { label: '3.0', value: '3' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function execCmd(cmd: string, value?: string) {
  document.execCommand(cmd, false, value);
}

/** Tiny dropdown wrapper — closes on outside click */
function Dropdown({ trigger, children, align = 'left' }: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div className={`absolute top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      )}
    </div>
  );
}

// Toolbar button with optional active state detection
function TBtn({ onClick, title, children, className = '' }: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

function Separator() {
  return <div className="w-px h-5 bg-slate-300 mx-0.5 flex-shrink-0" />;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function EmailToolbar({ editorRef, onAttach, uploading, trailing }: EmailToolbarProps) {
  const [currentFont, setCurrentFont] = useState('Arial');
  const [currentSize, setCurrentSize] = useState('3');

  const refocus = useCallback(() => {
    editorRef.current?.focus();
  }, [editorRef]);

  const exec = useCallback((cmd: string, value?: string) => {
    // Focus editor BEFORE executing command — block-level commands like
    // insertUnorderedList / insertOrderedList require the contentEditable
    // element to have focus and a valid selection, otherwise they silently fail.
    editorRef.current?.focus();
    execCmd(cmd, value);
  }, [editorRef]);

  const handleFontFamily = (font: string) => {
    exec('fontName', font);
    setCurrentFont(font.split(',')[0].replace(/'/g, ''));
  };

  const handleFontSize = (size: string) => {
    exec('fontSize', size);
    setCurrentSize(size);
  };

  const handleTextColor = (color: string) => {
    exec('foreColor', color);
  };

  const handleHighlight = (color: string) => {
    if (color === 'transparent') {
      exec('removeFormat');
    } else {
      exec('hiliteColor', color);
    }
  };

  const handleLink = () => {
    const sel = window.getSelection();
    const hasSelection = sel && sel.toString().length > 0;
    if (!hasSelection) {
      // Check if cursor is inside a link
      const anchor = sel?.anchorNode?.parentElement?.closest('a');
      if (anchor) {
        exec('unlink');
        return;
      }
    }
    const url = prompt('URL du lien:', 'https://');
    if (url) exec('createLink', url);
  };

  const handleImage = () => {
    const url = prompt('URL de l\'image:');
    if (url) exec('insertImage', url);
  };

  const handleEmoji = (emoji: string) => {
    exec('insertText', emoji);
  };

  const handleLineHeight = (value: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let block = range.startContainer as HTMLElement;
    if (block.nodeType === Node.TEXT_NODE) block = block.parentElement!;
    const parent = block.closest('p, div, li, h1, h2, h3, h4, h5, h6, blockquote') as HTMLElement;
    if (parent) {
      parent.style.lineHeight = value;
    }
    refocus();
  };

  const iconSize = 'w-4 h-4';
  const iconColor = 'text-slate-600';

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-slate-200 bg-slate-50/80 flex-shrink-0 flex-wrap" onMouseDown={(e) => { if ((e.target as HTMLElement).closest('input')) return; e.preventDefault(); }}>
      {/* Undo / Redo */}
      <TBtn onClick={() => exec('undo')} title="Annuler (Ctrl+Z)">
        <Undo2 className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('redo')} title="Rétablir (Ctrl+Y)">
        <Redo2 className={`${iconSize} ${iconColor}`} />
      </TBtn>

      <Separator />

      {/* Font Family */}
      <Dropdown trigger={
        <button type="button" className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded min-w-[100px] justify-between" title="Police">
          <span className="truncate">{currentFont}</span>
          <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
        </button>
      }>
        <div className="py-1 w-48">
          {FONT_FAMILIES.map(f => (
            <button
              key={f.value}
              onClick={() => handleFontFamily(f.value)}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100"
              style={{ fontFamily: f.value }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Font Size */}
      <Dropdown trigger={
        <button type="button" className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded min-w-[48px] justify-between" title="Taille">
          <span>{FONT_SIZES.find(s => s.value === currentSize)?.label || '12'}</span>
          <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
        </button>
      }>
        <div className="py-1 w-20">
          {FONT_SIZES.map(s => (
            <button
              key={s.value}
              onClick={() => handleFontSize(s.value)}
              className={`block w-full text-left px-3 py-1 text-sm hover:bg-slate-100 ${currentSize === s.value ? 'bg-slate-100 font-semibold' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Dropdown>

      <Separator />

      {/* Clear Formatting */}
      <TBtn onClick={() => exec('removeFormat')} title="Effacer la mise en forme">
        <Eraser className={`${iconSize} ${iconColor}`} />
      </TBtn>

      {/* Highlight Color */}
      <Dropdown trigger={
        <button type="button" className="p-1.5 rounded hover:bg-slate-200 flex items-center gap-0.5" title="Couleur de surlignage">
          <Highlighter className={`${iconSize} ${iconColor}`} />
          <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
        </button>
      }>
        <div className="p-2 grid grid-cols-7 gap-1 w-[180px]">
          {HIGHLIGHT_COLORS.map(c => (
            <button
              key={c}
              onClick={() => handleHighlight(c)}
              className="w-5 h-5 rounded border border-slate-300 hover:scale-110 transition-transform"
              style={{ backgroundColor: c === 'transparent' ? '#fff' : c }}
              title={c === 'transparent' ? 'Aucun' : c}
            >
              {c === 'transparent' && <span className="text-[8px] text-red-400 font-bold">✕</span>}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Text Color */}
      <Dropdown trigger={
        <button type="button" className="p-1.5 rounded hover:bg-slate-200 flex items-center gap-0.5" title="Couleur du texte">
          <Palette className={`${iconSize} ${iconColor}`} />
          <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
        </button>
      }>
        <div className="p-2 grid grid-cols-10 gap-1 w-[240px]">
          {TEXT_COLORS.map(c => (
            <button
              key={c}
              onClick={() => handleTextColor(c)}
              className="w-5 h-5 rounded border border-slate-200 hover:scale-110 transition-transform"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </Dropdown>

      <Separator />

      {/* Bold / Italic / Underline / Strikethrough */}
      <TBtn onClick={() => exec('bold')} title="Gras (Ctrl+B)">
        <Bold className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('italic')} title="Italique (Ctrl+I)">
        <Italic className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('underline')} title="Souligné (Ctrl+U)">
        <Underline className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('strikeThrough')} title="Barré">
        <Strikethrough className={`${iconSize} ${iconColor}`} />
      </TBtn>

      <Separator />

      {/* Lists */}
      <TBtn onClick={() => exec('insertUnorderedList')} title="Liste à puces">
        <List className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('insertOrderedList')} title="Liste numérotée">
        <ListOrdered className={`${iconSize} ${iconColor}`} />
      </TBtn>

      <Separator />

      {/* Indent / Outdent */}
      <TBtn onClick={() => exec('outdent')} title="Diminuer le retrait">
        <IndentDecrease className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('indent')} title="Augmenter le retrait">
        <IndentIncrease className={`${iconSize} ${iconColor}`} />
      </TBtn>

      <Separator />

      {/* Alignment */}
      <TBtn onClick={() => exec('justifyLeft')} title="Aligner à gauche">
        <AlignLeft className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('justifyCenter')} title="Centrer">
        <AlignCenter className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('justifyRight')} title="Aligner à droite">
        <AlignRight className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('justifyFull')} title="Justifier">
        <AlignJustify className={`${iconSize} ${iconColor}`} />
      </TBtn>

      {/* Line Height */}
      <Dropdown trigger={
        <button type="button" className="p-1.5 rounded hover:bg-slate-200 flex items-center gap-0.5" title="Interligne">
          <svg className={`${iconSize} ${iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="21" y1="6" x2="11" y2="6" /><line x1="21" y1="12" x2="11" y2="12" /><line x1="21" y1="18" x2="11" y2="18" />
            <polyline points="4 8 7 5 7 19 4 16" />
          </svg>
          <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
        </button>
      }>
        <div className="py-1 w-24">
          {LINE_HEIGHTS.map(lh => (
            <button
              key={lh.value}
              onClick={() => handleLineHeight(lh.value)}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              {lh.label}
            </button>
          ))}
        </div>
      </Dropdown>

      <Separator />

      {/* Link */}
      <TBtn onClick={handleLink} title="Lien (Ctrl+K)">
        <Link2 className={`${iconSize} ${iconColor}`} />
      </TBtn>
      <TBtn onClick={() => exec('unlink')} title="Supprimer le lien">
        <Unlink className={`${iconSize} ${iconColor}`} />
      </TBtn>

      {/* Image */}
      <TBtn onClick={handleImage} title="Insérer une image">
        <ImagePlus className={`${iconSize} ${iconColor}`} />
      </TBtn>

      {/* Emoji */}
      <Dropdown trigger={
        <button type="button" className="p-1.5 rounded hover:bg-slate-200" title="Emoji">
          <Smile className={`${iconSize} ${iconColor}`} />
        </button>
      } align="right">
        <div className="p-2 grid grid-cols-8 gap-1 w-[240px]">
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => handleEmoji(e)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-base"
              title={e}
            >
              {e}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* Attachment (optional) */}
      {onAttach && (
        <>
          <Separator />
          <TBtn onClick={onAttach} title="Pièce jointe" className={uploading ? 'opacity-50 pointer-events-none' : ''}>
            {uploading ? (
              <Loader2 className={`${iconSize} ${iconColor} animate-spin`} />
            ) : (
              <Paperclip className={`${iconSize} ${iconColor}`} />
            )}
          </TBtn>
        </>
      )}

      {/* Trailing content (variables, etc.) */}
      {trailing && (
        <>
          <div className="flex-1" />
          {trailing}
        </>
      )}
    </div>
  );
}

export default EmailToolbar;
