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
  '#FFFFFF',
];

export const PRESET_HIGHLIGHTS = [
  '#F87171',
  '#FB923C',
  '#FACC15',
  '#4ADE80',
  '#22D3EE',
  '#60A5FA',
  '#A78BFA',
  '#F472B6',
  '#000000',
];

/** 行内样式预设：一键应用加粗 + 文字色 + 背景色 */
export interface TextStylePreset {
  name: string;
  bg: string;
  color: string;
}

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  { name: '白字红底', bg: '#EF4444', color: '#FFFFFF' },
  { name: '白字绿底', bg: '#22C55E', color: '#FFFFFF' },
  { name: '白字紫底', bg: '#8B5CF6', color: '#FFFFFF' },
  { name: '白字黑底', bg: '#1F2937', color: '#FFFFFF' },
  { name: '黑字黄底', bg: '#FACC15', color: '#1F2937' },
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

interface TextStylePopoverProps {
  presets: TextStylePreset[];
  onSelect: (preset: TextStylePreset) => void;
  children: React.ReactNode;
  title?: string;
}

/** 行内样式预设弹出器：加粗 + 文字色 + 背景色 一键组合 */
export function TextStylePopover({
  presets,
  onSelect,
  children,
  title = '样式预设',
}: TextStylePopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'p-1.5 rounded transition-colors',
          open
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
          <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 p-2.5 rounded-lg border border-ink-200 bg-white shadow-lg min-w-[140px]">
            <div className="text-[11px] text-ink-400 mb-1.5 px-0.5">{title}</div>
            <div className="flex flex-col gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                  }}
                  className="px-2 py-1 rounded-md text-[12px] font-bold text-left hover:opacity-85 transition-opacity border border-transparent hover:border-ink-200"
                  style={{ backgroundColor: p.bg, color: p.color }}
                  title={p.name}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
