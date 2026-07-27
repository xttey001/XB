'use client';

import { useState, useRef, useEffect } from 'react';
import { Flag, Loader2, Check } from 'lucide-react';
import { IMPORTANCE_CONFIG, isValidImportance } from '@/lib/importance';
import { cn } from '@/lib/utils';
import type { NoteImportance } from '@/lib/types';

interface ImportanceButtonProps {
  value: NoteImportance | null;
  onChange: (value: NoteImportance | null) => void;
  loading?: boolean;
  size?: 'sm' | 'md';
}

const OPTIONS: Array<{ value: NoteImportance; label: string }> = [
  { value: 'important', label: '标为重要' },
  { value: 'very_important', label: '标为极重要' },
];

export default function ImportanceButton({
  value,
  onChange,
  loading = false,
  size = 'sm',
}: ImportanceButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const activeConfig = value ? IMPORTANCE_CONFIG[value] : null;

  const handleSelect = (next: NoteImportance | null) => {
    onChange(next);
    setOpen(false);
  };

  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        disabled={loading}
        className={cn(
          'rounded hover:bg-ink-100 transition-colors',
          size === 'sm' ? 'p-1.5' : 'p-2',
          activeConfig ? '' : 'text-ink-400 hover:text-ink-600'
        )}
        style={activeConfig ? { color: activeConfig.text } : undefined}
        title="重要等级"
      >
        {loading ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : (
          <Flag
            size={iconSize}
            fill={activeConfig ? 'currentColor' : 'none'}
            stroke="currentColor"
          />
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute right-0 z-20 w-32 rounded-md border border-ink-200 bg-white shadow-lg py-1',
            size === 'sm' ? 'top-8' : 'top-10'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {OPTIONS.map((opt) => {
            const cfg = IMPORTANCE_CONFIG[opt.value];
            const selected = value === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() =>
                  handleSelect(selected ? null : opt.value)
                }
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-ink-50 transition-colors',
                  selected && 'bg-ink-50'
                )}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: cfg.dot }}
                />
                <span className="flex-1">{opt.label}</span>
                {selected && <Check size={12} className="text-ink-600" />}
              </button>
            );
          })}
          {value && (
            <>
              <div className="my-1 border-t border-ink-100" />
              <button
                onClick={() => handleSelect(null)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left text-ink-500 hover:bg-ink-50 transition-colors"
              >
                <span className="w-2 h-2 rounded-full border border-ink-300" />
                <span>取消重要</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
