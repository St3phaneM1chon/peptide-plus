'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Pencil } from 'lucide-react';

interface InlineEditCellProps {
  value: string | number;
  onSave: (newValue: string | number) => Promise<void> | void;
  type?: 'text' | 'number' | 'currency';
  prefix?: string;
  suffix?: string;
  className?: string;
  editable?: boolean;
}

export default function InlineEditCell({
  value,
  onSave,
  type = 'text',
  prefix = '',
  suffix = '',
  className = '',
  editable = true,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleSave = useCallback(async () => {
    if (editValue === String(value)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const newVal = type === 'number' || type === 'currency' ? Number(editValue) : editValue;
      await onSave(newVal);
      setEditing(false);
    } catch {
      setEditValue(String(value));
    } finally {
      setSaving(false);
    }
  }, [editValue, value, type, onSave]);

  const handleCancel = useCallback(() => {
    setEditValue(String(value));
    setEditing(false);
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  if (!editable) {
    return (
      <span className={className}>
        {prefix}{value}{suffix}
      </span>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {prefix && <span className="text-slate-400 text-sm">{prefix}</span>}
        <input
          ref={inputRef}
          type={type === 'currency' ? 'number' : type}
          step={type === 'currency' ? '0.01' : undefined}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={saving}
          className="w-full px-1.5 py-0.5 text-sm border border-sky-400 rounded focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white"
        />
        {suffix && <span className="text-slate-400 text-sm">{suffix}</span>}
        <button onClick={handleSave} disabled={saving} className="p-0.5 text-green-600 hover:bg-green-50 rounded" title="Save">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={handleCancel} disabled={saving} className="p-0.5 text-red-500 hover:bg-red-50 rounded" title="Cancel">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <span
      className={`group cursor-pointer hover:bg-sky-50 rounded px-1 py-0.5 inline-flex items-center gap-1 ${className}`}
      onDoubleClick={() => setEditing(true)}
      title="Double-click to edit"
    >
      {prefix}{value}{suffix}
      <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
    </span>
  );
}
