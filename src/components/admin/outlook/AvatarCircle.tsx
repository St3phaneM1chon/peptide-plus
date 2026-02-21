'use client';

import Image from 'next/image';

const AVATAR_COLORS = [
  'bg-sky-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-amber-600',
  'bg-rose-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-orange-600',
  'bg-pink-600',
  'bg-cyan-600',
  'bg-lime-600',
  'bg-fuchsia-600',
] as const;

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

const sizeMap = {
  sm: { container: 'w-7 h-7', text: 'text-[10px]', image: 28 },
  md: { container: 'w-9 h-9', text: 'text-xs', image: 36 },
  lg: { container: 'w-11 h-11', text: 'text-sm', image: 44 },
} as const;

interface AvatarCircleProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarCircle({ name, imageUrl, size = 'md', className = '' }: AvatarCircleProps) {
  const { container, text, image: imgSize } = sizeMap[size];
  const colorIndex = hashName(name) % AVATAR_COLORS.length;
  const bgColor = AVATAR_COLORS[colorIndex];
  const initials = getInitials(name);

  if (imageUrl) {
    return (
      <div
        className={`${container} rounded-full overflow-hidden flex-shrink-0 ${className}`}
      >
        <Image
          src={imageUrl}
          alt={name}
          width={imgSize}
          height={imgSize}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${container} ${bgColor} rounded-full flex items-center justify-center flex-shrink-0 ${className}`}
    >
      <span className={`${text} font-semibold text-white leading-none`}>
        {initials}
      </span>
    </div>
  );
}
