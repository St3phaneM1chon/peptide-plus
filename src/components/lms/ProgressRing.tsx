'use client';

/**
 * PROGRESS RING — Dark Glass Premium Circular Progress
 * =====================================================
 * SVG-based ring with gradient stroke (indigo→cyan).
 * Glass track background, monospace center text.
 *
 * Usage:
 *   <ProgressRing progress={75} size="md" showPercent />
 *   <ProgressRing progress={42} size="lg" color="blue" label="Quiz" />
 */

interface ProgressRingProps {
  /** Progress value from 0 to 100 */
  progress: number;
  /** Ring size preset */
  size?: 'sm' | 'md' | 'lg';
  /** Color override. "auto" derives from progress thresholds. */
  color?: 'green' | 'blue' | 'yellow' | 'red' | 'auto';
  /** Optional text label rendered inside the ring */
  label?: string;
  /** Show numeric percentage inside the ring */
  showPercent?: boolean;
}

const SIZE_CONFIG = {
  sm: { diameter: 40, stroke: 3, fontSize: 'text-[10px]', labelSize: 'text-[8px]' },
  md: { diameter: 64, stroke: 4, fontSize: 'text-sm', labelSize: 'text-[10px]' },
  lg: { diameter: 96, stroke: 5, fontSize: 'text-lg', labelSize: 'text-xs' },
} as const;

// Gradient stop colors keyed by resolved color
const GRADIENT_MAP: Record<string, { start: string; end: string }> = {
  green:  { start: '#10b981', end: '#14b8a6' },  // emerald→teal
  blue:   { start: '#6366f1', end: '#06b6d4' },  // indigo→cyan
  yellow: { start: '#f59e0b', end: '#f97316' },  // amber→orange
  red:    { start: '#f43f5e', end: '#ef4444' },   // rose→red
};

function resolveColor(progress: number): string {
  if (progress >= 80) return 'green';
  if (progress >= 50) return 'yellow';
  return 'red';
}

export default function ProgressRing({
  progress,
  size = 'md',
  color = 'auto',
  label,
  showPercent = false,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, progress));
  const resolvedColor = color === 'auto' ? resolveColor(clamped) : color;
  const gradient = GRADIENT_MAP[resolvedColor];
  const { diameter, stroke, fontSize, labelSize } = SIZE_CONFIG[size];

  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = diameter / 2;

  // Unique gradient ID per instance (using color + size to avoid collisions)
  const gradientId = `progress-ring-${resolvedColor}-${size}`;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: diameter, height: diameter }}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ? `${label}: ${Math.round(clamped)}%` : `${Math.round(clamped)}%`}
    >
      <svg
        width={diameter}
        height={diameter}
        className="transform -rotate-90"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={gradient.start} />
            <stop offset="100%" stopColor={gradient.end} />
          </linearGradient>
        </defs>
        {/* Background track — glass-style */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="rgba(255, 255, 255, 0.08)"
        />
        {/* Progress arc — gradient stroke */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke={`url(#${gradientId})`}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>

      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercent && (
          <span
            className={`font-semibold ${fontSize} leading-none`}
            style={{ color: 'var(--k-text-primary)', fontFamily: 'var(--k-font-mono)' }}
          >
            {Math.round(clamped)}%
          </span>
        )}
        {label && (
          <span
            className={`${labelSize} leading-tight mt-0.5 truncate max-w-[80%] text-center`}
            style={{ color: 'var(--k-text-tertiary)' }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}
