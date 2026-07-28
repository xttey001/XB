'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Star,
  Pencil,
  Trash2,
  Pin,
  Check,
  Loader2,
  ChevronUp,
  ChevronDown,
  Maximize2,
} from 'lucide-react';
import { cn, formatFullTime } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { api } from '@/lib/api';
import type { NoteDTO, CategoryDTO } from '@/lib/types';
import NoteEditor from './NoteEditor';
import NoteSocial from './NoteSocial';
import RepostedOriginal from './RepostedOriginal';
import RichTextRenderer from './RichTextRenderer';
import TwitterImageGrid from './TwitterImageGrid';
import ImportanceBadge from './ImportanceBadge';
import ImportanceButton from './ImportanceButton';
import type { NoteImportance } from '@/lib/types';

interface NoteCardProps {
  note: NoteDTO;
  categories: CategoryDTO[];
  onUpdated: (note: NoteDTO) => void;
  onDeleted: (id: string) => void;
  onReposted?: (newNote: NoteDTO) => void;
  /** 当前所在视图范围，决定置顶操作影响哪个置顶字段 */
  scope?: 'all' | 'favorite' | 'important' | 'category';
  /** 自定义排序模式下显示上移/下移按钮 */
  showOrderControls?: boolean;
  /** 排序方向，用于判断上移/下移的语义 */
  onMove?: (noteId: string, direction: 'up' | 'down') => void;
  /** 是否是第一条/最后一条（用于禁用对应按钮） */
  isFirst?: boolean;
  isLast?: boolean;
}

// 折叠时显示的最大行数（CSS line-clamp）
const COLLAPSED_LINES = 8;
// 内容超过多少字符时启用折叠
const COLLAPSE_THRESHOLD = 280;

export default function NoteCard({
  note,
  categories,
  onUpdated,
  onDeleted,
  onReposted,
  scope = 'all',
  showOrderControls = false,
  onMove,
  isFirst = false,
  isLast = false,
}: NoteCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingFav, setTogglingFav] = useState(false);
  const [togglingPin, setTogglingPin] = useState(false);
  const [updatingImportance, setUpdatingImportance] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // 列表优先显示摘要：summary 存在且被截断时显示纯文本摘要 + 查看全文
  // 若内容包含高亮块、标题、列表、引用、代码块、图片等富文本块，则保留完整 HTML，避免摘要丢失格式
  const hasRichBlock = /data-callout|<h[1-6]\b|<ul\b|<ol\b|<blockquote\b|<pre\b|<code\b|<img\b/i.test(
    note.content
  );
  const displaySummary =
    note.summary && note.summary.length < note.content.length && !hasRichBlock;
  const shouldCollapse =
    !displaySummary &&
    !expanded &&
    (note.content.length > COLLAPSE_THRESHOLD ||
      note.content.split('\n').length > COLLAPSED_LINES);

  const handleToggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingFav(true);
    try {
      const { note: updated } = await api.updateNote(note.id, {
        isFavorite: !note.isFavorite,
      });
      onUpdated(updated);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTogglingFav(false);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingPin(true);
    try {
      const { note: updated } = await api.updateNote(note.id, {
        pinned: !note.pinned,
        scope,
      });
      onUpdated(updated);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTogglingPin(false);
    }
  };

  const handleUpdateImportance = async (next: NoteImportance | null) => {
    setUpdatingImportance(true);
    try {
      const { note: updated } = await api.updateNote(note.id, {
        importance: next,
      });
      onUpdated(updated);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdatingImportance(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteNote(note.id);
      onDeleted(note.id);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // 点击正文区域（非按钮、非图片、非链接）跳转到详情页
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('img') ||
      target.tagName === 'A' ||
      target.tagName === 'IMG'
    ) {
      return;
    }
    router.push(`/note/${note.id}`);
  };

  if (editing) {
    return (
      <NoteEditor
        initialNote={note}
        categories={categories}
        onSaved={(n) => {
          onUpdated(n);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <article
      className={cn(
        'group relative rounded-lg border bg-white p-4 transition-colors animate-fade-in',
        note.pinned
          ? 'border-accent-300 bg-accent-50/30 hover:border-accent-400'
          : 'border-ink-200 hover:border-ink-300'
      )}
    >
      {/* 置顶标识条 */}
      {note.pinned && (
        <div className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-accent-500 text-white text-[10px] font-medium flex items-center gap-1">
          <Pin size={9} fill="currentColor" />
          置顶
        </div>
      )}

      {/* 顶部：分类徽章 + 日期/操作按钮 */}
      <div className="flex items-start justify-between mb-2 -mt-1">
        <div className="flex items-center gap-2 text-xs text-ink-500">
          {note.category && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px]"
              style={{
                backgroundColor: `${note.category.color}15`,
                color: note.category.color,
              }}
            >
              {note.category.icon && <span>{note.category.icon}</span>}
              {note.category.name}
            </span>
          )}
          <ImportanceBadge importance={note.importance} />
        </div>

        <div className="flex flex-col items-end gap-1">
          <span
            className="text-[11px] text-ink-400 whitespace-nowrap"
            title={formatFullTime(note.createdAt)}
          >
            {format(new Date(note.createdAt), 'M月d日', { locale: zhCN })}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* 自定义排序模式下的上下移动按钮 */}
          {showOrderControls && onMove && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(note.id, 'up');
                }}
                disabled={isFirst}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isFirst
                    ? 'text-ink-300 cursor-not-allowed'
                    : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700'
                )}
                title="上移"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMove(note.id, 'down');
                }}
                disabled={isLast}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  isLast
                    ? 'text-ink-300 cursor-not-allowed'
                    : 'text-ink-400 hover:bg-ink-100 hover:text-ink-700'
                )}
                title="下移"
              >
                <ChevronDown size={14} />
              </button>
              <div className="w-px h-4 bg-ink-200 mx-1" />
            </>
          )}

          <button
            onClick={handleTogglePin}
            disabled={togglingPin}
            className={cn(
              'p-1.5 rounded hover:bg-ink-100 transition-colors',
              note.pinned
                ? 'text-accent-600'
                : 'text-ink-400 hover:text-ink-600'
            )}
            title={note.pinned ? '取消置顶' : '置顶'}
          >
            {togglingPin ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Pin size={14} fill={note.pinned ? 'currentColor' : 'none'} />
            )}
          </button>
          <button
            onClick={handleToggleFav}
            disabled={togglingFav}
            className={cn(
              'p-1.5 rounded hover:bg-ink-100 transition-colors',
              note.isFavorite
                ? 'text-amber-500'
                : 'text-ink-400 hover:text-ink-600'
            )}
            title={note.isFavorite ? '取消收藏' : '收藏'}
          >
            {togglingFav ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Star
                size={14}
                fill={note.isFavorite ? 'currentColor' : 'none'}
              />
            )}
          </button>
          <ImportanceButton
            value={note.importance}
            onChange={handleUpdateImportance}
            loading={updatingImportance}
            size="sm"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            className="p-1.5 rounded text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition-colors"
            title="改写"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
            className="p-1.5 rounded text-ink-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
          </div>
        </div>
      </div>

      {/* 正文：长内容显示摘要，短内容显示完整富文本 */}
      {displaySummary ? (
        <div onClick={handleCardClick} className="cursor-pointer text-sm text-ink-800 leading-relaxed">
          {note.summary}
        </div>
      ) : (
        note.content && (
          <div
            onClick={handleCardClick}
            className={cn(
              'cursor-pointer rounded -mx-1 px-1',
              shouldCollapse && 'note-md-collapsed'
            )}
          >
            <RichTextRenderer content={note.content} />
          </div>
        )
      )}

      {/* 摘要截断或折叠时的"查看全文"按钮 */}
      {(displaySummary || shouldCollapse) && (
        <button
          onClick={() => router.push(`/note/${note.id}`)}
          className="mt-1 inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700"
        >
          <Maximize2 size={11} />
          查看全文
        </button>
      )}

      {/* 图片：Twitter 风格网格 */}
      {note.images.length > 0 && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <TwitterImageGrid images={note.images} />
        </div>
      )}

      {/* 转发：原文引用块 */}
      {note.repostOf && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <RepostedOriginal note={note.repostOf} compact />
        </div>
      )}

      {/* 标签 */}
      {note.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {note.tags.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 rounded-full bg-ink-100 text-ink-600 text-xs"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* 社交互动区 */}
      <NoteSocial note={note} onUpdate={onUpdated} onReposted={onReposted} />

      {/* 删除确认弹层 */}
      {confirmingDelete && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 backdrop-blur-sm rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <p className="text-sm text-ink-700 mb-3">确认删除这条笔记？</p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-3 py-1.5 text-sm text-ink-600 hover:text-ink-800"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                {deleting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Check size={13} />
                )}
                删除
              </button>
            </div>
          </div>
        </div>
      )}

    </article>
  );
}
