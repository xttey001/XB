'use client';

import { Clock, Edit3, ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortBy } from '@/lib/api';

interface SortToggleProps {
  value: SortBy;
  onChange: (v: SortBy) => void;
}

const OPTIONS: { value: SortBy; label: string; icon: React.ReactNode }[] = [
  { value: 'createdAt', label: '创建时间', icon: <Clock size={12} /> },
  { value: 'updatedAt', label: '修改时间', icon: <Edit3 size={12} /> },
  { value: 'custom', label: '自定义', icon: <ListOrdered size={12} /> },
];

export default function SortToggle({ value, onChange }: SortToggleProps) {
  return (
    <div className="inline-flex items-center bg-ink-100 rounded-md p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-white text-ink-900 shadow-sm'
              : 'text-ink-500 hover:text-ink-700'
          )}
          title={`按${opt.label}排序`}
        >
          {opt.icon}
          <span className="hidden sm:inline">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
