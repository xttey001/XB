'use client';

import { Clock, Edit3, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SortBy, OrderDir } from '@/lib/api';

interface SortToggleProps {
  value: SortBy;
  orderDir: OrderDir;
  onChange: (v: SortBy) => void;
  onToggleDir: () => void;
}

const OPTIONS: { value: SortBy; label: string; icon: React.ReactNode }[] = [
  { value: 'createdAt', label: '创建时间', icon: <Clock size={12} /> },
  { value: 'updatedAt', label: '修改时间', icon: <Edit3 size={12} /> },
];

export default function SortToggle({ value, orderDir, onChange, onToggleDir }: SortToggleProps) {
  return (
    <div className="inline-flex items-center gap-1">
      <div className="inline-flex items-center bg-ink-100 rounded-md p-0.5">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => {
                if (isActive) {
                  onToggleDir();
                } else {
                  onChange(opt.value);
                }
              }}
              className={cn(
                'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                isActive
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-500 hover:text-ink-700'
              )}
              title={isActive ? `点击切换${orderDir === 'desc' ? '降序（最新在前）' : '升序（最早在前）'}` : `按${opt.label}排序`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
              {isActive && (
                <ArrowUpDown
                  size={10}
                  className={cn(
                    'transition-transform',
                    orderDir === 'asc' ? 'rotate-180 text-emerald-600' : 'text-ink-400'
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
