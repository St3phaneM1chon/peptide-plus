'use client';

import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function FormField({ label, htmlFor, required, error, hint, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500 ms-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-slate-400">{hint}</p>
      )}
    </div>
  );
}

// Standard text input
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      className={`
        w-full h-9 px-3 rounded-lg border text-sm text-slate-900
        placeholder-slate-400 transition-shadow
        focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
        ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}
        ${className}
      `}
      {...props}
    />
  );
}

// Standard textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={`
        w-full px-3 py-2 rounded-lg border text-sm text-slate-900
        placeholder-slate-400 transition-shadow resize-y
        focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
        ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-slate-300'}
        ${className}
      `}
      rows={4}
      {...props}
    />
  );
}
