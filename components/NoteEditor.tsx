'use client';

import { useState, useCallback } from 'react';
import { ImagePlus, Tag, X, Loader2, Folder, Flag } from 'lucide-react';
import ImageUploader from './ImageUploader';
import TiptapEditor from './TiptapEditor';
import { api } from '@/lib/api';
import { cn, isEmptyHtml } from '@/lib/utils';
import { IMPORTANCE_CONFIG } from '@/lib/importance';
import type { CategoryDTO, NoteDTO, NoteImportance } from '@/lib/types';

interface NoteEditorProps {
  initialNote?: NoteDTO | null;
  categories: CategoryDTO[];
  onSaved: (note: NoteDTO, isEdit: boolean) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

/**
 * 笔记编辑器
 * - 文本区自适应高度
 * - 多图上传
 * - 标签输入（回车添加）
 * - 分类选择
 * - 创建/编辑双模式
 */
export default function NoteEditor({
  initialNote,
  categories,
  onSaved,
  onCancel,
  autoFocus = false,
}: NoteEditorProps) {
  const isEdit = !!initialNote;
  const [content, setContent] = useState(initialNote?.content || '');
  const [images, setImages] = useState<string[]>(initialNote?.images || []);
  const [tags, setTags] = useState<string[]>(initialNote?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(
    initialNote?.categoryId || null
  );
  const [importance, setImportance] = useState<NoteImportance | null>(
    initialNote?.importance || null
  );
  const [saving, setSaving] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  // Tiptap 空内容默认为 <p></p>，保存时归一化为空字符串
  const normalizedContent = isEmptyHtml(content) ? '' : content;

  // 粘贴图片（Tiptap 编辑器内粘贴时统一处理）
  const handlePaste = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    try {
      const { urls } = await api.uploadImages(imageFiles);
      setImages((prev) => [...prev, ...urls]);
    } catch (err: any) {
      alert(err.message);
    }
  }, []);

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput('');
  };

  const canSave = normalizedContent.length > 0 || images.length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (isEdit && initialNote) {
        const { note } = await api.updateNote(initialNote.id, {
          content: normalizedContent,
          images,
          tags,
          categoryId,
          importance,
        });
        onSaved(note, true);
      } else {
        const { note } = await api.createNote({
          content: normalizedContent,
          images,
          tags,
          categoryId,
          importance,
        });
        onSaved(note, false);
        // 清空表单
        setContent('');
        setImages([]);
        setTags([]);
        setCategoryId(null);
        setImportance(null);
      }
    } catch (e: any) {
      alert(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4 animate-fade-in">
      <TiptapEditor
        value={content}
        onChange={setContent}
        placeholder="写下此刻的想法..."
        autoFocus={autoFocus}
        onPasteImage={handlePaste}
      />

      {(images.length > 0 || showUploader) && (
        <div className="mt-3">
          <ImageUploader value={images} onChange={setImages} />
        </div>
      )}

      {/* 标签 */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Tag size={13} className="text-ink-400" />
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-50 text-accent-700 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={() => setTags(tags.filter((x) => x !== t))}
              className="hover:text-accent-900"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          placeholder={tags.length === 0 ? '添加标签' : ''}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-ink-700 placeholder:text-ink-400 focus:outline-none"
        />
      </div>

      {/* 底部工具栏 */}
      <div className="mt-3 flex items-center justify-between pt-3 border-t border-ink-100">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUploader(true)}
            className="p-1.5 rounded hover:bg-ink-100 text-ink-500"
            title="添加图片"
          >
            <ImagePlus size={16} />
          </button>

          {/* 分类选择 */}
          <div className="flex items-center gap-1 ml-1">
            <Folder size={14} className="text-ink-400" />
            <select
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="text-xs text-ink-700 bg-transparent border-0 focus:outline-none cursor-pointer"
            >
              <option value="">未分类</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 重要等级选择 */}
          <div className="flex items-center gap-1 ml-3">
            <Flag size={14} className="text-ink-400" />
            <select
              value={importance || ''}
              onChange={(e) =>
                setImportance(
                  (e.target.value as NoteImportance) || null
                )
              }
              className="text-xs text-ink-700 bg-transparent border-0 focus:outline-none cursor-pointer"
            >
              <option value="">无</option>
              <option value="important">
                🔵 重要
              </option>
              <option value="very_important">
                🩷 极重要
              </option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-sm text-ink-600 hover:text-ink-800"
            >
              取消
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              canSave && !saving
                ? 'bg-ink-900 text-white hover:bg-ink-700'
                : 'bg-ink-200 text-ink-400 cursor-not-allowed'
            )}
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? '保存' : '发布'}
          </button>
        </div>
      </div>
    </div>
  );
}
