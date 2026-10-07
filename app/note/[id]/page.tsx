'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Star,
  Pencil,
  Trash2,
  Pin,
  Check,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { NoteDTO, CategoryDTO } from '@/lib/types';
import {
  cn,
  formatFullTime,
  formatTwitterTime,
} from '@/lib/utils';
import NoteEditor from '@/components/NoteEditor';
import NoteSocial from '@/components/NoteSocial';
import RepostedOriginal from '@/components/RepostedOriginal';
import RichTextRenderer from '@/components/RichTextRenderer';
import ImageLightbox from '@/components/ImageLightbox';
import ImportanceBadge from '@/components/ImportanceBadge';
import ImportanceButton from '@/components/ImportanceButton';
import RelatedNotes from '@/components/RelatedNotes';
import type { NoteImportance } from '@/lib/types';

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromKnowledge = searchParams.get('from') === 'knowledge';
  const areaId = searchParams.get('areaId');
  const highlightQuery = searchParams.get('q') || undefined;
  const [note, setNote] = useState<NoteDTO | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ note }, { categories: cats }] = await Promise.all([
        api.getNote(id),
        api.listCategories(),
      ]);
      setNote(note);
      setCategories(cats);
    } catch (e: any) {
      if (e.message?.includes('不存在')) {
        // 笔记已删除
        router.push('/');
        return;
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTogglePin = async () => {
    if (!note) return;
    try {
      // 详情页不携带视图上下文，默认操作「全部笔记」置顶
      const { note: updated } = await api.updateNote(note.id, {
        pinned: !note.pinned,
        scope: 'all',
      });
      setNote(updated);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleToggleFav = async () => {
    if (!note) return;
    try {
      const { note: updated } = await api.updateNote(note.id, {
        isFavorite: !note.isFavorite,
      });
      setNote(updated);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleUpdateImportance = async (next: NoteImportance | null) => {
    if (!note) return;
    try {
      const { note: updated } = await api.updateNote(note.id, {
        importance: next,
      });
      setNote(updated);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async () => {
    if (!note) return;
    setDeleting(true);
    try {
      await api.deleteNote(note.id);
      router.push('/');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (!note) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-ink-400">
        <p className="mb-4">笔记不存在</p>
        <Link href="/" className="text-accent-600 hover:underline">
          返回首页
        </Link>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-screen">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <button
              onClick={() => setEditing(false)}
              className="p-2 -ml-2 rounded-md hover:bg-ink-100 text-ink-600"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="text-sm text-ink-600">编辑笔记</span>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <NoteEditor
            initialNote={note}
            categories={categories}
            onSaved={(n) => {
              setNote(n);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </main>
      </div>
    );
  }

  const isEdited =
    new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() >
    1000;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {fromKnowledge && areaId ? (
            <Link
              href={`/knowledge/areas/${areaId}`}
              className="inline-flex items-center gap-1.5 p-2 -ml-2 rounded-md hover:bg-ink-100 text-accent-600"
            >
              <ArrowLeft size={18} />
              <span className="text-sm hidden sm:inline">返回知识层级</span>
            </Link>
          ) : (
            <Link
              href="/"
              onClick={(e) => {
                e.preventDefault();
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/');
                }
              }}
              className="inline-flex items-center gap-1.5 p-2 -ml-2 rounded-md hover:bg-ink-100 text-ink-600"
            >
              <ArrowLeft size={18} />
              <span className="text-sm hidden sm:inline">返回</span>
            </Link>
          )}
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleTogglePin}
              className={cn(
                'p-2 rounded-md hover:bg-ink-100 transition-colors',
                note.pinned
                  ? 'text-accent-600'
                  : 'text-ink-500 hover:text-ink-700'
              )}
              title={note.pinned ? '取消置顶' : '置顶'}
            >
              <Pin
                size={16}
                fill={note.pinned ? 'currentColor' : 'none'}
              />
            </button>
            <button
              onClick={handleToggleFav}
              className={cn(
                'p-2 rounded-md hover:bg-ink-100 transition-colors',
                note.isFavorite
                  ? 'text-amber-500'
                  : 'text-ink-500 hover:text-ink-700'
              )}
              title={note.isFavorite ? '取消收藏' : '收藏'}
            >
              <Star
                size={16}
                fill={note.isFavorite ? 'currentColor' : 'none'}
              />
            </button>
            <ImportanceButton
              value={note?.importance || null}
              onChange={handleUpdateImportance}
              size="md"
            />
            <button
              onClick={() => setEditing(true)}
              className="p-2 rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-700"
              title="改写"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setConfirmingDelete(true)}
              className="p-2 rounded-md text-ink-500 hover:bg-red-50 hover:text-red-500"
              title="删除"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <article className="animate-fade-in">
          {/* 元信息条 */}
          <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
            <ImportanceBadge importance={note.importance} />
            {note.pinned && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-50 text-accent-700">
                <Pin size={10} fill="currentColor" />
                置顶
              </span>
            )}
            {note.category && (
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${note.category.color}15`,
                  color: note.category.color,
                }}
              >
                {note.category.icon && (
                (note.category.icon || '').trim().startsWith('/') ? (
                  <img
                    src={note.category.icon.trim()}
                    alt=""
                    className="w-3.5 h-3.5 rounded-full object-cover inline-block align-middle"
                  />
                ) : (
                  <span>{note.category.icon}</span>
                )
              )}
                {note.category.name}
              </span>
            )}
            {note.isFavorite && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                <Star size={10} fill="currentColor" />
                收藏
              </span>
            )}
          </div>

          {/* 正文 */}
          {note.content && (
            <RichTextRenderer content={note.content} highlightQuery={highlightQuery} />
          )}

          {/* 图片（大图展示，非九宫格） */}
          {note.images.length > 0 && (
            <div className="mt-6 space-y-3">
              {note.images.map((url, idx) => (
                <button
                key={url + idx}
                onClick={() => setLightboxIndex(idx)}
                className="block w-full relative rounded-lg overflow-hidden bg-ink-50 hover:opacity-95 transition-opacity"
                style={{ aspectRatio: 'auto' }}
              >
                <Image
                  src={url}
                  alt=""
                  width={1200}
                  height={800}
                  sizes="(max-width: 768px) 100vw, 768px"
                  quality={90}
                  className="w-full h-auto"
                />
              </button>
              ))}
            </div>
          )}

          {/* 标签 */}
          {note.tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-1.5">
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

          {/* 转发：原文引用块 */}
          {note.repostOf && (
            <div className="mt-6">
              <h4 className="text-xs font-medium text-ink-500 mb-2">转发自</h4>
              <RepostedOriginal note={note.repostOf} />
            </div>
          )}

          {/* 时间信息：推特风格 */}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
            <span
              className="hover:underline cursor-help"
              title={`创建于 ${formatFullTime(note.createdAt)}`}
            >
              {formatTwitterTime(note.createdAt)}
            </span>
            {isEdited && (
              <>
                <span className="text-ink-300">·</span>
                <span
                  className="hover:underline cursor-help"
                  title={`编辑于 ${formatFullTime(note.updatedAt)}`}
                >
                  编辑于 {formatTwitterTime(note.updatedAt)}
                </span>
              </>
            )}
          </div>

          {/* 社交互动区 */}
          <div className="mt-5">
            <NoteSocial note={note} onUpdate={setNote} defaultOpenComments />
          </div>

          {/* 相关笔记 */}
          <RelatedNotes noteId={note.id} />
        </article>
      </main>

      {/* 删除确认 */}
      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={14} className="text-red-500" />
              </div>
              <h3 className="font-medium text-ink-900">确认删除</h3>
            </div>
            <p className="text-sm text-ink-600 mb-4">
              删除后无法恢复。确定要删除这条笔记吗？
            </p>
            <div className="flex items-center justify-end gap-2">
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

      {/* 图片大图 */}
      <ImageLightbox
        images={note.images}
        currentIndex={lightboxIndex ?? 0}
        isOpen={lightboxIndex !== null}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </div>
  );
}
