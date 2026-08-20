'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  Hash,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { NoteLinkResult, NoteLinksResponse } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';

interface RelatedNotesProps {
  noteId: string;
}

/**
 * 相关笔记组件
 * 在笔记详情页底部展示：
 * - 出链（本笔记链接到的笔记）
 * - 反链（链接到本笔记的笔记）
 * - 同标签相关笔记
 */
export default function RelatedNotes({ noteId }: RelatedNotesProps) {
  const router = useRouter();
  const [data, setData] = useState<NoteLinksResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getNoteLinks(noteId);
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-ink-400">
        <Loader2 className="animate-spin" size={16} />
      </div>
    );
  }

  if (!data) return null;

  const hasAny =
    data.outgoing.length > 0 ||
    data.incoming.length > 0 ||
    data.relatedByTag.length > 0;

  if (!hasAny) return null;

  return (
    <div className="mt-8 pt-6 border-t border-ink-200">
      <h3 className="text-xl font-serif font-semibold text-ink-800 mb-4">相关笔记</h3>

      <div className="space-y-5">
        {/* 出链 */}
        {data.outgoing.length > 0 && (
          <LinkSection
            icon={<ArrowRight size={14} className="text-accent-500" />}
            title="出链"
            count={data.outgoing.length}
            notes={data.outgoing}
            noteId={noteId}
          />
        )}

        {/* 反链 */}
        {data.incoming.length > 0 && (
          <LinkSection
            icon={<ArrowLeft size={14} className="text-emerald-500" />}
            title="反链"
            count={data.incoming.length}
            notes={data.incoming}
            noteId={noteId}
          />
        )}

        {/* 同标签相关 */}
        {data.relatedByTag.length > 0 && (
          <LinkSection
            icon={<Hash size={14} className="text-amber-500" />}
            title="同标签"
            count={data.relatedByTag.length}
            notes={data.relatedByTag}
            noteId={noteId}
          />
        )}
      </div>
    </div>
  );
}

function LinkSection({
  icon,
  title,
  count,
  notes,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  notes: NoteLinkResult[];
  noteId: string;
}) {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-sm text-ink-500">
        {icon}
        <span className="font-medium">{title}</span>
        <span className="text-ink-300">·</span>
        <span>{count} 篇</span>
      </div>

      <div className="space-y-1.5">
        {notes.map((note) => (
          <button
            key={note.id}
            onClick={() => router.push(`/note/${note.id}`)}
            className="w-full text-left px-3 py-2 rounded-md bg-ink-50/50 hover:bg-ink-100 transition-colors"
          >
            <p className="text-lg text-ink-700 leading-relaxed line-clamp-2">
              {note.summary || '（空笔记）'}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[11px] text-ink-400">
                {formatRelativeTime(note.createdAt)}
              </span>
              {note.tags.length > 0 && (
                <div className="flex items-center gap-1">
                  {note.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-500"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}