'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('admin-theme');
    if (stored === 'dark') {
      setDark(true);
      document.documentElement.classList.add('dark');
    }
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

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg text-slate-600 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-700 transition-colors"
      aria-label={dark ? 'Mode clair' : 'Mode sombre'}
      title={dark ? 'Mode clair' : 'Mode sombre'}
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
