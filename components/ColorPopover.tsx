'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PRESET_COLORS = [
  '#000000',
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#6B7280',
];

export const PRESET_HIGHLIGHTS = [
  '#FEE2E2',
  '#FFEDD5',
  '#FEF9C3',
  '#DCFCE7',
  '#CFFAFE',
  '#DBEAFE',
  '#EDE9FE',
  '#FCE7F3',
  '#E5E7EB',
];

interface ColorPopoverProps {
  colors: string[];
  onSelect: (color: string) => void;
  onClear?: () => void;
  children: React.ReactNode;
  title?: string;
  active?: boolean;
}

export default function ColorPopover({
  colors,
  onSelect,
  onClear,
  children,
  title,
  active,
}: ColorPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'p-1.5 rounded transition-colors',
          open || active
            ? 'bg-ink-800 text-white'
            : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
        )}
        title={title}
      >
        {children}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 p-2 rounded-lg border border-ink-200 bg-white shadow-lg min-w-[180px]">
            {title && (
              <div className="text-[11px] text-ink-400 mb-1.5 px-1">{title}</div>
            )}
            <div className="grid grid-cols-5 gap-1">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onSelect(color);
                    setOpen(false);
                  }}
                  className="w-6 h-6 rounded-full border border-ink-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
            {onClear && (
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 text-xs text-ink-500 hover:bg-ink-100 rounded"
              >
                <X size={10} />
                清除
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
