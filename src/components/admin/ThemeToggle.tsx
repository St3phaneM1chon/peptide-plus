'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('admin-theme');
    // Dark-first: default to dark unless explicitly set to light
    if (stored === 'light') {
      setDark(false);
      document.documentElement.classList.remove('dark');
    } else {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
    setMounted(true);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('admin-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('admin-theme', 'light');
      }
      return next;
    });
  }, []);

  // Render placeholder until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        className="p-1.5 rounded-md text-[var(--k-text-tertiary)] hover:text-[var(--k-text-secondary)] hover:bg-[var(--k-glass-thin)] transition-colors"
        aria-label="Mode sombre"
        title="Mode sombre"
      >
        <Moon className="w-4.5 h-4.5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-md text-[var(--k-text-tertiary)] hover:text-[var(--k-text-secondary)] hover:bg-[var(--k-glass-thin)] transition-colors"
      aria-label={dark ? 'Mode clair' : 'Mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
    >
      {dark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
    </button>
  );
}
