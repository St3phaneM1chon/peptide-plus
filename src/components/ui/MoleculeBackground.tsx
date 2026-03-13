'use client';

import { useEffect, useRef } from 'react';

interface MoleculeBackgroundProps {
  className?: string;
  opacity?: number;
  count?: number;
}

export default function MoleculeBackground({
  className = '',
  opacity = 0.06,
  count = 12,
}: MoleculeBackgroundProps) {
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Generate stable random positions using index-based seed
  const molecules = Array.from({ length: count }, (_, i) => {
    const seed = (i + 1) * 7919; // prime-based pseudo-random
    const x = ((seed * 13) % 100);
    const y = ((seed * 17) % 100);
    const size = 20 + ((seed * 23) % 30);
    const delay = (i * 0.8) % 6;
    const rotation = (seed * 31) % 360;

    return { x, y, size, delay, rotation, key: i };
  });

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        style={{ opacity }}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
      >
        {molecules.map((m) => (
          <g
            key={m.key}
            transform={`translate(${m.x}, ${m.y}) rotate(${m.rotation})`}
            style={{
              animation: prefersReducedMotion.current
                ? 'none'
                : `molecule-float ${6 + m.delay}s ease-in-out ${m.delay}s infinite`,
            }}
          >
            {/* Hexagonal molecule shape */}
            <circle cx="0" cy="0" r={m.size * 0.04} fill="#238838" opacity="0.5" />
            <circle cx={m.size * 0.08} cy={m.size * 0.04} r={m.size * 0.03} fill="#319795" opacity="0.4" />
            <line
              x1="0" y1="0"
              x2={m.size * 0.08} y2={m.size * 0.04}
              stroke="#319795" strokeWidth="0.15" opacity="0.3"
            />
            <circle cx={-m.size * 0.06} cy={m.size * 0.05} r={m.size * 0.025} fill="#3182CE" opacity="0.3" />
            <line
              x1="0" y1="0"
              x2={-m.size * 0.06} y2={m.size * 0.05}
              stroke="#3182CE" strokeWidth="0.12" opacity="0.25"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
