'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface UndoAction {
  id: string;
  description: string;
  undo: () => Promise<void> | void;
}

export function useBulkUndo() {
  const [undoStack, setUndoStack] = useState<UndoAction[]>([]);
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const pushUndo = useCallback((action: UndoAction) => {
    setUndoStack((prev) => [...prev.slice(-9), action]);

    const toastId = toast.success(action.description, {
      duration: 10000,
      action: {
        label: 'Annuler',
        onClick: async () => {
          try {
            await action.undo();
            toast.info('Action annulée');
            setUndoStack((prev) => prev.filter((a) => a.id !== action.id));
          } catch {
            toast.error('Impossible d\'annuler cette action');
          }
        },
      },
    });

    const timeout = setTimeout(() => {
      timeoutsRef.current.delete(action.id);
    }, 10000);
    timeoutsRef.current.set(action.id, timeout);

    return toastId;
  }, []);

  const clearAll = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current.clear();
    setUndoStack([]);
  }, []);

  return { pushUndo, undoStack, clearAll };
}
