'use client';

import { Flag } from 'lucide-react';
import { IMPORTANCE_CONFIG } from '@/lib/importance';
import { cn } from '@/lib/utils';
import type { NoteImportance } from '@/lib/types';

interface ImportanceBadgeProps {
  importance: NoteImportance | null;
  size?: 'sm' | 'md';
}

export default function ImportanceBadge({
  importance,
  size = 'sm',
}: ImportanceBadgeProps) {
  if (!importance) return null;

  const cfg = IMPORTANCE_CONFIG[importance];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      )}
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <Flag
        size={size === 'sm' ? 10 : 12}
        fill="currentColor"
        stroke="currentColor"
        style={{ color: cfg.text }}
      />
      {cfg.label}
    </span>
  );
}
