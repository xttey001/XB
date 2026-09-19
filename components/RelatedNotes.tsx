'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  Hash,
  Loader2,
  GitBranch,
  Sparkles,
  Plus,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { NoteLinkResult, NoteLinksResponse, TopicTreeNode } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';
import NoteLinkDialog from './NoteLinkDialog';

interface RelatedNotesProps {
  noteId: string;
}

interface Suggestion {
  id: string;
  summary: string;
  tags: string[];
  categoryName: string | null;
  importance: string | null;
  reasons: string[];
  score: number;
}

/**
 * 相关笔记组件
 * 在笔记详情页底部展示：
 * - 主题树入口（以这条笔记为根）
 * - 出链（本笔记链接到的笔记）
 * - 反链（链接到本笔记的笔记）
 * - 链接推荐助手（算法推荐但还没手动链接的候选）
 */
export default function RelatedNotes({ noteId }: RelatedNotesProps) {
  const router = useRouter();
  const [data, setData] = useState<NoteLinksResponse | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, sugg] = await Promise.all([
        api.getNoteLinks(noteId),
        api.getLinkSuggestions(noteId, 4).catch(() => ({ suggestions: [] })),
      ]);
      setData(result);
      setSuggestions((sugg as any).suggestions || []);
    } catch {
      setData(null);
      setSuggestions([]);
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

  const hasManualLinks =
    data.outgoing.length > 0 || data.incoming.length > 0;
  const hasAny = hasManualLinks || suggestions.length > 0;

  // 始终渲染 RelatedNotes 区域 —— 哪怕没有链接，也要有"看主题树"入口
  // 这样用户才能从任意笔记出发向上回溯它属于哪个主题
  const showLinksSection = hasAny || data.relatedByTag.length > 0;

  return (
    <div className="mt-8 pt-6 border-t border-ink-200">
      {/* 标题 + 主题树入口 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-serif font-semibold text-ink-800">相关笔记</h3>
        <div className="flex items-center gap-2">
          {/* 手动加链接 */}
          <button
            onClick={() => setLinkDialogOpen(true)}
            className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-accent-600 px-2 py-1 rounded hover:bg-ink-50"
          >
            <Plus size={12} />
            添加链接
          </button>
          {/* 主题树入口 */}
          <button
            onClick={() => router.push(`/topic/${noteId}`)}
            className="inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 px-2 py-1 rounded hover:bg-accent-50"
          >
            <GitBranch size={12} />
            看主题树
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* 没有任何链接时，给一个引导 */}
        {!showLinksSection && (
          <div className="text-sm text-ink-400 py-2">
            还没有相关笔记。AI 自动关联正在后台运行，试试点击上方"AI 知识"看看抽取进度。
          </div>
        )}

        {/* 出链 */}
        {showLinksSection && data.outgoing.length > 0 && (
          <LinkSection
            icon={<ArrowRight size={14} className="text-accent-500" />}
            title="出链"
            count={data.outgoing.length}
            notes={data.outgoing}
          />
        )}

        {/* 反链 */}
        {data.incoming.length > 0 && (
          <LinkSection
            icon={<ArrowLeft size={14} className="text-emerald-500" />}
            title="反链"
            count={data.incoming.length}
            notes={data.incoming}
          />
        )}

        {/* 链接推荐助手 — 核心新功能 */}
        {suggestions.length > 0 && (
          <SuggestionSection
            suggestions={suggestions}
            onAdded={() => load()}
          />
        )}
      </div>

      <NoteLinkDialog
        isOpen={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        onSelect={() => {
          setLinkDialogOpen(false);
          load();
        }}
      />
    </div>
  );
}

/* ---------- 手动链接区域 ---------- */

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
            <p className="text-sm text-ink-700 leading-relaxed line-clamp-2">
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

/* ---------- 推荐链接区域 ---------- */

function SuggestionSection({
  suggestions,
  onAdded,
}: {
  suggestions: Suggestion[];
  onAdded: () => void;
}) {
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-sm">
        <Sparkles size={14} className="text-purple-500" />
        <span className="font-medium text-ink-500">链接推荐</span>
        <span className="text-ink-300">·</span>
        <span className="text-ink-500">{suggestions.length} 条候选</span>
        <span className="text-[11px] text-ink-400 ml-auto">点击可跳转查看</span>
      </div>

      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s.id}
            onClick={() => router.push(`/note/${s.id}`)}
            className="w-full text-left px-3 py-2 rounded-md border border-dashed border-purple-200 bg-purple-50/30 hover:bg-purple-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-ink-700 leading-relaxed line-clamp-2 flex-1">
                {s.summary || '（空笔记）'}
              </p>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {s.importance === 'very_important' && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded">极重要</span>
                )}
                {s.importance === 'important' && (
                  <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">重要</span>
                )}
              </div>
            </div>
            {/* 推荐理由 */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {s.reasons.map((r, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600"
                >
                  {r}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
