'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, Link as LinkIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface NoteLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (noteId: string, title: string) => void;
}

export default function NoteLinkDialog({
  isOpen,
  onClose,
  onSelect,
}: NoteLinkDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 搜索笔记
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { notes } = await api.searchNotes(q);
      setResults(notes);
      setSelectedIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 防抖搜索
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    if (!query.trim()) {
      setResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => doSearch(query), 200);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query, doSearch]);

  // 打开时自动聚焦
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      onSelect(results[selectedIndex].id, results[selectedIndex].title);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* 对话框 */}
      <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-ink-200 overflow-hidden animate-fade-in">
        {/* 搜索框 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-200">
          <Search size={16} className="text-ink-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索笔记标题或内容..."
            className="flex-1 bg-transparent text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
          />
          {loading && <Loader2 size={14} className="animate-spin text-ink-400" />}
        </div>

        {/* 搜索结果 */}
        <div className="max-h-64 overflow-y-auto">
          {results.length === 0 && query.trim() && !loading && (
            <div className="px-4 py-6 text-center text-sm text-ink-400">
              未找到相关笔记
            </div>
          )}

          {results.map((note, idx) => (
            <button
              key={note.id}
              onClick={() => onSelect(note.id, note.title)}
              className={cn(
                'w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-ink-50 transition-colors',
                idx === selectedIndex && 'bg-accent-50'
              )}
            >
              <LinkIcon
                size={14}
                className="mt-0.5 shrink-0 text-accent-500"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-800 truncate">{note.title}</p>
              </div>
            </button>
          ))}

          {!query.trim() && (
            <div className="px-4 py-6 text-center text-sm text-ink-400">
              输入关键词搜索笔记
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="px-4 py-2 border-t border-ink-100 text-[11px] text-ink-400 flex items-center gap-3">
          <span>↑↓ 导航</span>
          <span>Enter 选择</span>
          <span>Esc 关闭</span>
        </div>
      </div>
    </div>
  );
}