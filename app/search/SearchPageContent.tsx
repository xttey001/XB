'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Search as SearchIcon, Inbox } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.listCategories().then(({ categories }) => setCategories(categories));
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setNotes([]);
      return;
    }
    setLoading(true);
    try {
      const { notes } = await api.listNotes({ q: q.trim() });
      setNotes(notes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSubmittedQuery(initialQ);
    doSearch(initialQ);
  }, [initialQ, doSearch]);

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
            onChange={setQuery}
            onSubmit={handleSubmit}
            placeholder="输入关键词搜索..."
          />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-ink-600">
          <SearchIcon size={14} className="text-ink-400" />
          {submittedQuery ? (
            <>
              关键词{' '}
              <span className="font-medium text-ink-900">
                &quot;{submittedQuery}&quot;
              </span>{' '}
              的搜索结果 · {notes.length} 条
            </>
          ) : (
            <span className="text-ink-400">输入关键词开始搜索</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-ink-400">
            <Loader2 className="animate-spin" size={18} />
          </div>
        ) : notes.length === 0 && submittedQuery ? (
          <div className="flex flex-col items-center justify-center py-20 text-ink-400">
            <Inbox size={40} strokeWidth={1.2} />
            <p className="mt-3 text-sm">没有找到匹配的笔记</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                categories={categories}
                onUpdated={(n) =>
                  setNotes((prev) => prev.map((x) => (x.id === n.id ? n : x)))
                }
                onDeleted={(id) =>
                  setNotes((prev) => prev.filter((x) => x.id !== id))
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
