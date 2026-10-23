import React from 'react';
import { cn } from '@/lib/utils';
import {
  Code,
  Palette,
  Users,
  GraduationCap,
  Briefcase,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';

const categoryIcons = {
  Tech: Code,
  Design: Palette,
  Social: Users,
  Education: GraduationCap,
  Business: Briefcase,
  Productivity: Zap,
  CleanTech: Sparkles,
  Other: Layers,
};

// 8 curated tokenized hues mapping to CSS variables defined in index.css
const TILE_HUES = [0, 1, 2, 3, 4, 5, 6, 7];

export function getTileHueIndex(seed) {
  if (typeof seed === 'number') {
    return Math.abs(seed) % 8;
  }
  if (typeof seed === 'string') {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) % 8;
  }
  return 0;
}

export function CoverTile({
  imageUrl,
  title = '',
  category = 'Tech',
  seed,
  size = 'md', // 'sm' (48px), 'md' (56px), 'lg' (72px)
  className,
}) {
  const hueIdx = getTileHueIndex(seed ?? title ?? category);

  // Derive initials (e.g. "DevPulse" -> "DP", "TinyStatic" -> "TS", "GitResume" -> "GR")
  const getInitials = (text) => {
    if (!text) return 'IP';
    const words = text.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    // If single word with camelCase (like DevPulse)
    const upper = text.match(/[A-Z]/g);
    if (upper && upper.length >= 2) {
      return (upper[0] + upper[1]).toUpperCase();
    }
    return text.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(title);
  const Icon = categoryIcons[category] || Sparkles;

  const sizeClasses = {
    sm: 'w-12 h-12 text-xs rounded-[10px]',
    md: 'w-12 h-12 sm:w-14 sm:h-14 text-sm sm:text-base rounded-[10px]',
    lg: 'w-16 h-16 sm:w-18 sm:h-18 text-lg sm:text-xl rounded-[10px]',
  };

  if (imageUrl) {
    return (
      <div
        className={cn(
          'relative overflow-hidden shrink-0 border border-border bg-surface-muted select-none flex items-center justify-center',
          sizeClasses[size] || sizeClasses.md,
          className
        )}
      >
        <img
          src={imageUrl}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    );
  }

  // Tokenized style using CSS variables: --tile-N-bg and --tile-N-ink
  const style = {
    backgroundColor: `var(--tile-${hueIdx}-bg)`,
    color: `var(--tile-${hueIdx}-ink)`,
  };

  return (
    <div
      style={style}
      className={cn(
        'relative shrink-0 border border-border select-none flex flex-col items-center justify-center font-bold font-sans tracking-tight transition-transform duration-150',
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      aria-hidden="true"
    >
      <span>{initials}</span>
    </div>
  );
}
