'use client';

import type { LucideIcon } from 'lucide-react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-[#6366f1] to-[#818cf8] text-white hover:from-[#5558e6] hover:to-[#7580f2] active:from-[#4f52d9] active:to-[#6d78ec] border-transparent shadow-sm',
  secondary: 'bg-white/10 text-[var(--k-text-secondary)] hover:bg-white/15 active:bg-white/20 border-[var(--k-border-subtle)] shadow-sm',
  ghost: 'bg-transparent text-[var(--k-text-secondary)] hover:bg-white/10 active:bg-white/15 border-transparent',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border-transparent shadow-sm',
  outline: 'bg-transparent text-[var(--k-text-secondary)] hover:bg-white/5 border-[var(--k-border-subtle)]',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 min-h-[36px] px-3 text-xs gap-1.5',
  md: 'h-9 min-h-[40px] px-4 text-sm gap-2',
  lg: 'h-10 min-h-[44px] px-5 text-sm gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  loading,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-medium rounded-lg border
        transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4" />
      ) : null}
      {children}
      {IconRight && !loading && <IconRight className="w-4 h-4" />}
    </button>
  );
}
