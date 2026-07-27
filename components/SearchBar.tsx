'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  placeholder?: string;
}

/**
 * 顶部搜索框
 * - 输入即时同步受控状态
 * - 回车触发 onSubmit（跳转到搜索结果页）
 * - Cmd/Ctrl + K 全局聚焦
 */
export default function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = '搜索笔记...',
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="relative flex-1 max-w-md">
      <Search
        size={15}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit(value);
          if (e.key === 'Escape') {
            onChange('');
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        className={cn(
          'w-full pl-9 pr-9 py-2 text-sm rounded-md border border-ink-200 bg-white',
          'placeholder:text-ink-400 text-ink-800',
          'focus:border-accent-500 focus:ring-2 focus:ring-accent-100'
        )}
      />
      {value && (
        <button
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-400 hover:text-ink-700 hover:bg-ink-100"
        >
          <X size={14} />
        </button>
      )}
      <kbd className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-400 px-1.5 py-0.5 border border-ink-200 rounded pointer-events-none">
        {value ? '↵' : '⌘K'}
      </kbd>
    </div>
  );
}
