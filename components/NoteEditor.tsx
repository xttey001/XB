'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ImagePlus, Tag, X, Loader2, Folder, Flag, ChevronDown } from 'lucide-react';
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
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);

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
          <div className="flex items-center gap-1 ml-1 relative" ref={categoryRef}>
            <Folder size={14} className="text-ink-400" />
            <button
              type="button"
              onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              className="text-xs text-ink-700 bg-transparent border-0 focus:outline-none cursor-pointer flex items-center gap-1 hover:text-ink-900"
            >
              {selectedCategory ? (
                <span className="flex items-center gap-1">
                  {(selectedCategory.icon || '').trim().startsWith('/') ? (
                    <img src={selectedCategory.icon!.trim()} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                  ) : (
                    <span>{selectedCategory.icon}</span>
                  )}
                  {selectedCategory.name}
                </span>
              ) : (
                '未分类'
              )}
              <ChevronDown size={12} className={cn('transition-transform', categoryDropdownOpen && 'rotate-180')} />
            </button>
            {categoryDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-ink-200 rounded-lg shadow-lg py-1 min-w-[160px] max-h-[280px] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setCategoryId(null); setCategoryDropdownOpen(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-ink-50 flex items-center gap-2',
                    !categoryId && 'bg-ink-50 text-ink-900'
                  )}
                >
                  未分类
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCategoryId(c.id); setCategoryDropdownOpen(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs hover:bg-ink-50 flex items-center gap-2',
                      categoryId === c.id && 'bg-ink-50 text-ink-900'
                    )}
                  >
                    {c.icon && (c.icon || '').trim().startsWith('/') ? (
                      <img src={c.icon.trim()} alt="" className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <span className="flex-shrink-0">{c.icon}</span>
                    )}
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
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
