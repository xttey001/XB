'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Search as SearchIcon, Inbox } from 'lucide-react';
import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';
import { api } from '@/lib/api';
import type { NoteDTO, CategoryDTO } from '@/lib/types';
import NoteCard from '@/components/NoteCard';
import SearchBar from '@/components/SearchBar';

export default function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [submittedQuery, setSubmittedQuery] = useState(initialQ);
  const [notes, setNotes] = useState<NoteDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [fuseReady, setFuseReady] = useState(false);

  const allNotesRef = useRef<NoteDTO[]>([]);
  const fuseRef = useRef<Fuse<NoteDTO> | null>(null);
  const fuseOptionsRef = useRef<IFuseOptions<NoteDTO>>({});

  // 初始化：拉全量 notes + categories，构建 Fuse 索引
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.listAllNotes(),
      api.listCategories(),
    ]).then(([{ notes: all }, { categories: cats }]) => {
      if (cancelled) return;
      allNotesRef.current = all;
      setCategories(cats);
      const opts: IFuseOptions<NoteDTO> = {
        keys: ['title', 'summary', 'content', 'tags', 'categoryName'],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
      };
      fuseOptionsRef.current = opts;
      fuseRef.current = new Fuse(all, opts);
      setFuseReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Fuse.js 搜索
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) { setNotes([]); return; }
    if (!fuseRef.current) return;
    const results = fuseRef.current.search(q.trim());
    const sorted = results
      .sort((a: FuseResult<NoteDTO>, b: FuseResult<NoteDTO>) => (a.score ?? 1) - (b.score ?? 1))
      .slice(0, 200)
      .map((r: FuseResult<NoteDTO>) => r.item);
    setNotes(sorted);
  }, []);

  // 实时搜索 debounce（输入 250ms 后自动搜）
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSearch = useCallback((q: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setSubmittedQuery(q.trim());
      doSearch(q);
    }, 250);
  }, [doSearch]);

  // URL 变化 → 触发搜索
  useEffect(() => {
    setSubmittedQuery(initialQ);
    if (fuseReady) doSearch(initialQ);
  }, [initialQ, fuseReady, doSearch]);

  // 输入 → 实时搜；回车 → 跳 URL
  const handleChange = (v: string) => {
    setQuery(v);
    debouncedSearch(v);
  };

  const handleSubmit = (v: string) => {
    const q = v.trim();
    setSubmittedQuery(q);
    router.push(`/search?q=${encodeURIComponent(q)}`);
    doSearch(q);
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link
            href="/"
            className="p-2 -ml-2 rounded-md hover:bg-ink-100 text-ink-600"
            title="返回"
          >
            <ArrowLeft size={18} />
          </Link>
          <SearchBar
            value={query}
            onChange={handleChange}
            onSubmit={handleSubmit}
            placeholder="实时搜索（Fuzzy）..."
          />
          {!fuseReady && (
            <Loader2 className="animate-spin text-ink-400" size={14} />
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-ink-600">
          <SearchIcon size={14} className="text-ink-400" />
          {submittedQuery ? (
            <>
              Fuzzy 搜索{' '}
              <span className="font-medium text-ink-900">
                &quot;{submittedQuery}&quot;
              </span>{' '}
              · {notes.length} 条结果（共 {allNotesRef.current.length} 条笔记）
            </>
          ) : (
            <span className="text-ink-400">输入即搜 · Fuzzy 匹配 · 按回车同步 URL</span>
          )}
        </div>

        {!fuseReady ? (
          <div className="flex items-center justify-center py-16 text-ink-400">
            <Loader2 className="animate-spin mr-2" size={16} />
            加载索引中...
          </div>
        ) : notes.length === 0 && submittedQuery ? (
          <div className="flex flex-col items-center justify-center py-20 text-ink-400">
            <Inbox size={40} strokeWidth={1.2} />
            <p className="mt-3 text-sm">没有找到匹配的笔记（试试换个关键词？）</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                categories={categories}
                highlightQuery={submittedQuery}
                onUpdated={(n) =>
                  setNotes((prev) => prev.map((x) => (x.id === n.id ? n : x)))
                }
                onDeleted={(id) => {
                  setNotes((prev) => prev.filter((x) => x.id !== id));
                  allNotesRef.current = allNotesRef.current.filter((x) => x.id !== id);
                  if (fuseRef.current) {
                    fuseRef.current = new Fuse(allNotesRef.current, fuseOptionsRef.current);
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
