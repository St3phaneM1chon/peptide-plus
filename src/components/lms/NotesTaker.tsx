'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslations } from '@/hooks/useTranslations';

// ── Types ────────────────────────────────────────────────────

export interface NoteEntry {
  id: string;
  content: string;
  /** HTML content for rich text rendering */
  htmlContent: string;
  timestamp: Date;
  /** Optional link to lesson position (e.g. video timestamp or section) */
  lessonPosition?: string;
  isCollapsed: boolean;
}

export interface NotesTakerProps {
  lessonId: string;
  courseId: string;
  initialNotes?: NoteEntry[];
  onSave?: (notes: NoteEntry[]) => void;
  /** Open Aurelia widget with context */
  onAskAurelia?: (noteContent: string) => void;
}

type FormatAction = 'bold' | 'italic' | 'list' | 'highlight';

// ── Helpers ─────────────────────────────────────────────────

function generateId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function textToHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/==(.+?)==/g, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n/g, '<br>');
}

// ── Component ───────────────────────────────────────────────

export default function NotesTaker({
  lessonId,
  courseId,
  initialNotes = [],
  onSave,
  onAskAurelia,
}: NotesTakerProps) {
  const { t } = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState<NoteEntry[]>(initialNotes);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasUnsaved, setHasUnsaved] = useState(false);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Auto-save (debounced 30s) ─────────────────────────────

  useEffect(() => {
    if (hasUnsaved) {
      saveTimerRef.current = setTimeout(() => {
        onSave?.(notes);
        setHasUnsaved(false);
      }, 30000);
    }
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [hasUnsaved, notes, onSave]);

  // Save on unmount if unsaved
  useEffect(() => {
    return () => {
      if (hasUnsaved) {
        onSave?.(notes);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Filtered notes ────────────────────────────────────────

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(n => n.content.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  // ── Actions ───────────────────────────────────────────────

  const handleAddNote = useCallback(() => {
    const now = new Date();
    const newNote: NoteEntry = {
      id: generateId(),
      content: '',
      htmlContent: '',
      timestamp: now,
      isCollapsed: false,
    };
    setNotes(prev => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    setEditContent('');
    setHasUnsaved(true);
    // Focus editor after render
    setTimeout(() => editorRef.current?.focus(), 100);
  }, []);

  const handleSaveNote = useCallback(() => {
    if (!activeNoteId) return;
    setNotes(prev =>
      prev.map(n =>
        n.id === activeNoteId
          ? { ...n, content: editContent, htmlContent: textToHtml(editContent) }
          : n
      )
    );
    setActiveNoteId(null);
    setEditContent('');
    setHasUnsaved(true);
  }, [activeNoteId, editContent]);

  const handleEditNote = useCallback((note: NoteEntry) => {
    setActiveNoteId(note.id);
    setEditContent(note.content);
    setTimeout(() => editorRef.current?.focus(), 100);
  }, []);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (activeNoteId === id) {
      setActiveNoteId(null);
      setEditContent('');
    }
    setHasUnsaved(true);
  }, [activeNoteId]);

  const handleToggleCollapse = useCallback((id: string) => {
    setNotes(prev =>
      prev.map(n =>
        n.id === id ? { ...n, isCollapsed: !n.isCollapsed } : n
      )
    );
  }, []);

  const handleManualSave = useCallback(() => {
    if (activeNoteId) handleSaveNote();
    onSave?.(notes);
    setHasUnsaved(false);
  }, [activeNoteId, handleSaveNote, notes, onSave]);

  const handleExport = useCallback(() => {
    const text = notes
      .map(n => {
        const ts = n.timestamp instanceof Date ? n.timestamp : new Date(n.timestamp);
        return `[${ts.toLocaleString()}]\n${n.content}\n`;
      })
      .join('\n---\n\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notes-${courseId}-${lessonId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes, courseId, lessonId]);

  // ── Format actions ────────────────────────────────────────

  const applyFormat = useCallback((action: FormatAction) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = editContent.slice(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (action) {
      case 'bold':
        replacement = selected ? `**${selected}**` : '****';
        cursorOffset = selected ? 0 : -2;
        break;
      case 'italic':
        replacement = selected ? `*${selected}*` : '**';
        cursorOffset = selected ? 0 : -1;
        break;
      case 'highlight':
        replacement = selected ? `==${selected}==` : '====';
        cursorOffset = selected ? 0 : -2;
        break;
      case 'list':
        replacement = selected ? `\n- ${selected}` : '\n- ';
        cursorOffset = 0;
        break;
    }

    const newContent = editContent.slice(0, start) + replacement + editContent.slice(end);
    setEditContent(newContent);

    // Restore cursor position
    setTimeout(() => {
      if (textarea) {
        const newPos = start + replacement.length + cursorOffset;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }
    }, 0);
  }, [editContent]);

  const handleAskAurelia = useCallback(() => {
    const content = activeNoteId
      ? editContent
      : notes.length > 0
        ? notes[0].content
        : '';
    onAskAurelia?.(content);
  }, [activeNoteId, editContent, notes, onAskAurelia]);

  // ── Keyboard shortcuts ────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      applyFormat('bold');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      applyFormat('italic');
    } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleManualSave();
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
      e.preventDefault();
      applyFormat('highlight');
    }
  }, [applyFormat, handleManualSave]);

  // ── Toggle button (when panel is closed) ──────────────────

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-4 rounded-l-xl shadow-lg hover:bg-indigo-700 transition-colors"
        aria-label={t('learn.notesTaker.open')}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span className="text-xs font-medium writing-mode-vertical hidden sm:block" style={{ writingMode: 'vertical-rl' }}>
          {t('learn.notesTaker.notes')}
        </span>
        {notes.length > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-yellow-400 text-gray-900 rounded-full text-[10px] font-bold flex items-center justify-center">
            {notes.length}
          </span>
        )}
      </button>
    );
  }

  // ── Sidebar Panel ─────────────────────────────────────────

  return (
    <div
      ref={panelRef}
      className="fixed right-0 top-0 bottom-0 z-40 w-full sm:w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-300"
      role="complementary"
      aria-label={t('learn.notesTaker.title')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <h3 className="text-sm font-bold text-gray-900">{t('learn.notesTaker.title')}</h3>
          {hasUnsaved && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title={t('learn.notesTaker.unsaved')} />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onAskAurelia && (
            <button
              onClick={handleAskAurelia}
              className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-100 transition-colors"
              aria-label={t('learn.notesTaker.askAurelia')}
              title={t('learn.notesTaker.askAurelia')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            </button>
          )}
          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label={t('learn.notesTaker.export')}
            title={t('learn.notesTaker.export')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>
          <button
            onClick={handleManualSave}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label={t('learn.notesTaker.save')}
            title={t('learn.notesTaker.save')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label={t('learn.notesTaker.close')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('learn.notesTaker.searchPlaceholder')}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 rounded-lg border border-gray-200 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            aria-label={t('learn.notesTaker.searchPlaceholder')}
          />
        </div>
      </div>

      {/* Add Note button */}
      <div className="px-4 py-2">
        <button
          onClick={handleAddNote}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-indigo-300 text-indigo-600 font-medium text-sm hover:bg-indigo-50 hover:border-indigo-400 transition-colors"
          aria-label={t('learn.notesTaker.addNote')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('learn.notesTaker.addNote')}
        </button>
      </div>

      {/* Editor (when active) */}
      {activeNoteId && (
        <div className="px-4 py-2 border-b border-gray-200 bg-gray-50">
          {/* Formatting toolbar */}
          <div className="flex items-center gap-1 mb-2">
            <button
              onClick={() => applyFormat('bold')}
              className="w-7 h-7 rounded flex items-center justify-center text-gray-600 hover:bg-gray-200 font-bold text-sm"
              aria-label={t('learn.notesTaker.formatBold')}
              title="Ctrl+B"
            >
              B
            </button>
            <button
              onClick={() => applyFormat('italic')}
              className="w-7 h-7 rounded flex items-center justify-center text-gray-600 hover:bg-gray-200 italic text-sm"
              aria-label={t('learn.notesTaker.formatItalic')}
              title="Ctrl+I"
            >
              I
            </button>
            <button
              onClick={() => applyFormat('list')}
              className="w-7 h-7 rounded flex items-center justify-center text-gray-600 hover:bg-gray-200"
              aria-label={t('learn.notesTaker.formatList')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
              </svg>
            </button>
            <button
              onClick={() => applyFormat('highlight')}
              className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-200"
              aria-label={t('learn.notesTaker.formatHighlight')}
              title="Ctrl+H"
            >
              <span className="w-4 h-4 rounded-sm bg-yellow-300 border border-yellow-400" />
            </button>
            <div className="flex-1" />
            <button
              onClick={handleSaveNote}
              className="px-3 py-1 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              {t('learn.notesTaker.done')}
            </button>
          </div>

          <textarea
            ref={editorRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-32 text-sm bg-white border border-gray-200 rounded-lg p-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none font-mono transition-all"
            placeholder={t('learn.notesTaker.editorPlaceholder')}
            aria-label={t('learn.notesTaker.editorPlaceholder')}
          />
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {filteredNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <p className="text-sm">{t('learn.notesTaker.noNotes')}</p>
            <p className="text-xs mt-1">{t('learn.notesTaker.noNotesHint')}</p>
          </div>
        )}

        {filteredNotes.map(note => {
          const ts = note.timestamp instanceof Date ? note.timestamp : new Date(note.timestamp);
          const isEditing = activeNoteId === note.id;

          return (
            <div
              key={note.id}
              className={`rounded-xl border transition-all ${
                isEditing
                  ? 'border-indigo-300 bg-indigo-50'
                  : 'border-gray-200 bg-white hover:shadow-sm'
              }`}
            >
              {/* Note header */}
              <div className="flex items-center justify-between px-3 py-2">
                <button
                  onClick={() => handleToggleCollapse(note.id)}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600"
                  aria-label={note.isCollapsed ? t('learn.notesTaker.expand') : t('learn.notesTaker.collapse')}
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${note.isCollapsed ? '' : 'rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span>{ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
                <div className="flex items-center gap-1">
                  {!isEditing && (
                    <button
                      onClick={() => handleEditNote(note)}
                      className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      aria-label={t('learn.notesTaker.edit')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    aria-label={t('learn.notesTaker.delete')}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Note body */}
              {!note.isCollapsed && note.content && !isEditing && (
                <div
                  className="px-3 pb-3 text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: note.htmlContent || textToHtml(note.content) }}
                />
              )}

              {/* Lesson position marker */}
              {note.lessonPosition && (
                <div className="px-3 pb-2">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
                    </svg>
                    {note.lessonPosition}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{t('learn.notesTaker.totalNotes', { count: notes.length })}</span>
          <span className="flex items-center gap-1">
            {hasUnsaved ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {t('learn.notesTaker.unsaved')}
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                {t('learn.notesTaker.saved')}
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
