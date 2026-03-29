'use client';

/**
 * PuckEditor — Visual Page Builder for Koraline
 *
 * Wraps @measured/puck with Koraline's component config,
 * handles data conversion (legacy ↔ Puck format),
 * and provides save/publish functionality.
 *
 * Features: responsive preview, undo/redo, autosave, keyboard shortcuts
 */

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Puck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import '@/styles/puck-overrides.css';
import { puckConfig, EMPTY_PUCK_DATA } from '@/lib/puck/puck-config';
import { toPuckData, puckToKoraline } from '@/lib/puck/converters';

interface PuckEditorProps {
  initialData?: unknown;
  onSave: (sections: Array<{ id: string; type: string; data: Record<string, unknown> }>, publish?: boolean) => void;
  pageTitle?: string;
}

// Responsive preview viewports
const VIEWPORTS = [
  { width: 375, height: 'auto' as const, label: 'Mobile', icon: '📱' },
  { width: 768, height: 'auto' as const, label: 'Tablette', icon: '📲' },
  { width: 1280, height: 'auto' as const, label: 'Bureau', icon: '🖥️' },
];

export default function PuckEditor({ initialData, onSave, pageTitle }: PuckEditorProps) {
  const [hasChanges, setHasChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const lastDataRef = useRef<Data | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Convert initial data to Puck format
  const data = useMemo<Data>(() => {
    if (!initialData) return EMPTY_PUCK_DATA;
    return toPuckData(initialData);
  }, [initialData]);

  // Derive section count
  const sectionCount = lastDataRef.current?.content?.length ?? data.content?.length ?? 0;

  // Handle publish
  const handlePublish = useCallback(
    (puckData: Data) => {
      const koralineSections = puckToKoraline(puckData);
      onSave(koralineSections, true);
      setHasChanges(false);
      setLastSaved(new Date());
    },
    [onSave]
  );

  // Draft save
  const handleDraftSave = useCallback(
    (puckData: Data) => {
      setSaving(true);
      const koralineSections = puckToKoraline(puckData);
      onSave(koralineSections, false);
      setHasChanges(false);
      setLastSaved(new Date());
      setTimeout(() => setSaving(false), 500);
    },
    [onSave]
  );

  // Track changes + autosave after 30s
  const handleChange = useCallback((newData: Data) => {
    lastDataRef.current = newData;
    setHasChanges(true);

    // Clear previous autosave timer
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    // Schedule autosave in 30s
    autosaveTimerRef.current = setTimeout(() => {
      if (lastDataRef.current) {
        setSaving(true);
        const sections = puckToKoraline(lastDataRef.current);
        onSave(sections, false);
        setHasChanges(false);
        setLastSaved(new Date());
        setTimeout(() => setSaving(false), 500);
      }
    }, 30000);
  }, [onSave]);

  // Cleanup autosave timer
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  // Warn on close with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  // Keyboard shortcuts: ⌘S = draft, ⌘⇧S = publish, ⌘Z/⌘Y handled by Puck natively
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (lastDataRef.current && hasChanges) {
          if (e.shiftKey) {
            handlePublish(lastDataRef.current);
          } else {
            handleDraftSave(lastDataRef.current);
          }
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hasChanges, handlePublish, handleDraftSave]);

  // Relative time display
  const savedAgo = lastSaved ? getRelativeTime(lastSaved) : null;

  return (
    <div className="puck-editor-wrapper" style={{ height: '100vh' }}>
      {/* Status bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 pointer-events-none">
        {saving ? (
          <div className="px-4 py-2 bg-blue-500/90 text-white text-sm rounded-full shadow-lg backdrop-blur-sm flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Sauvegarde...
          </div>
        ) : hasChanges ? (
          <div className="px-4 py-2 bg-amber-500/90 text-white text-sm rounded-full shadow-lg backdrop-blur-sm">
            ⌘S brouillon · ⌘⇧S publier
          </div>
        ) : savedAgo ? (
          <div className="px-4 py-2 bg-emerald-600/80 text-white text-sm rounded-full shadow-lg backdrop-blur-sm flex items-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-300 rounded-full" />
            Sauvegardé {savedAgo}
          </div>
        ) : null}
        <div className="px-3 py-1.5 bg-zinc-800/80 text-zinc-300 text-xs rounded-full backdrop-blur-sm">
          {sectionCount} section{sectionCount !== 1 ? 's' : ''}
        </div>
      </div>

      <Puck
        config={puckConfig}
        data={data}
        onPublish={handlePublish}
        onChange={handleChange}
        headerTitle={pageTitle || 'Éditeur de page'}
        headerPath="/admin/contenu"
        viewports={VIEWPORTS}
      />
    </div>
  );
}

function getRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'à l\'instant';
  if (seconds < 60) return `il y a ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}min`;
  return `il y a ${Math.floor(minutes / 60)}h`;
}
