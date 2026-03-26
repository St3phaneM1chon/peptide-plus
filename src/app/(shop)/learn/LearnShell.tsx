'use client';

import { useEffect, useState } from 'react';

function getAmbientGradient(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) {
    // Morning: warm sunrise
    return 'radial-gradient(ellipse at 80% 20%, rgba(251,191,36,0.04) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(244,63,94,0.03) 0%, transparent 50%)';
  }
  if (hour >= 12 && hour < 18) {
    // Afternoon: cool productive
    return 'radial-gradient(ellipse at 70% 30%, rgba(99,102,241,0.05) 0%, transparent 60%), radial-gradient(ellipse at 30% 70%, rgba(6,182,212,0.04) 0%, transparent 50%)';
  }
  if (hour >= 18 && hour < 24) {
    // Evening: deep focus
    return 'radial-gradient(ellipse at 60% 40%, rgba(139,92,246,0.04) 0%, transparent 60%), radial-gradient(ellipse at 40% 60%, rgba(99,102,241,0.03) 0%, transparent 50%)';
  }
  // Night: ultra minimal
  return 'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.02) 0%, transparent 60%)';
}

export default function LearnShell({ children }: { children: React.ReactNode }) {
  const [gradient, setGradient] = useState('');

  useEffect(() => {
    setGradient(getAmbientGradient());
    const interval = setInterval(() => setGradient(getAmbientGradient()), 60_000 * 15);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--k-bg-base)] text-[var(--k-text-primary)]">
      <div
        className="fixed inset-0 pointer-events-none transition-opacity duration-[3000ms]"
        style={{ background: gradient }}
        aria-hidden="true"
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
