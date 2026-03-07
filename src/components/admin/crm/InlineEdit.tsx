'use client';

import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

interface InlineEditProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  emptyText?: string;
}

export function InlineEdit({
  value,
  onSave,
  label,
  type = 'text',
  options,
  placeholder,
  emptyText = '-',
}: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  const save = async () => {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } catch {
      // keep editing on error
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-gray-500 text-sm shrink-0">{label}</span>
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {type === 'select' && options ? (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 border rounded px-1.5 py-0.5 text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
            >
              <option value="">{emptyText}</option>
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="flex-1 min-w-0 border rounded px-1.5 py-0.5 text-sm focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none"
            />
          )}
          <button onClick={save} disabled={saving} className="p-0.5 text-green-600 hover:bg-green-50 rounded">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={cancel} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between group">
      <span className="text-gray-500 text-sm">{label}</span>
      <div className="flex items-center gap-1">
        <span className="text-sm text-gray-900">{value || emptyText}</span>
        <button
          onClick={startEdit}
          className="p-0.5 text-gray-300 opacity-0 group-hover:opacity-100 hover:text-teal-600 transition-opacity"
          aria-label={`Edit ${label}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
