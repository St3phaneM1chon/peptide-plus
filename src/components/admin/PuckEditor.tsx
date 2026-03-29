'use client';

/**
 * PuckEditor — Visual Page Builder for Koraline
 *
 * Wraps @measured/puck with Koraline's component config,
 * handles data conversion (legacy ↔ Puck format),
 * and provides save/publish functionality.
 */

import React, { useCallback, useMemo } from 'react';
import { Puck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { puckConfig, EMPTY_PUCK_DATA } from '@/lib/puck/puck-config';
import { toPuckData, puckToKoraline } from '@/lib/puck/converters';

interface PuckEditorProps {
  /** Initial sections data (legacy Koraline format or Puck Data) */
  initialData?: unknown;
  /** Called when user publishes/saves */
  onSave: (sections: Array<{ id: string; type: string; data: Record<string, unknown> }>) => void;
  /** Page title for header */
  pageTitle?: string;
}

export default function PuckEditor({ initialData, onSave, pageTitle }: PuckEditorProps) {
  // Convert initial data to Puck format
  const data = useMemo<Data>(() => {
    if (!initialData) return EMPTY_PUCK_DATA;
    return toPuckData(initialData);
  }, [initialData]);

  // Handle publish — convert Puck data back to Koraline format
  const handlePublish = useCallback(
    (puckData: Data) => {
      const koralineSections = puckToKoraline(puckData);
      onSave(koralineSections);
    },
    [onSave]
  );

  return (
    <div className="puck-editor-wrapper" style={{ height: 'calc(100vh - 64px)' }}>
      <Puck
        config={puckConfig}
        data={data}
        onPublish={handlePublish}
        headerTitle={pageTitle || 'Éditeur de page'}
        headerPath="/"
      />
    </div>
  );
}
