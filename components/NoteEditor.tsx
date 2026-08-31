'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { ImagePlus, Tag, X, Loader2, Folder, Flag, ChevronDown, Calendar, Clock, Brain } from 'lucide-react';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import ImageUploader from './ImageUploader';
import TiptapEditor from './TiptapEditor';
import { api } from '@/lib/api';
import { cn, isEmptyHtml, getEbbinghausDays } from '@/lib/utils';
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
  const [reviewAt, setReviewAt] = useState<string | null>(
    initialNote?.reviewAt || null
  );
  const [reviewRepeat, setReviewRepeat] = useState<string>(
    initialNote?.reviewRepeat || 'none'
  );
  const [reviewStep, setReviewStep] = useState<number>(
    initialNote?.reviewStep ?? 0
  );
  const [showReviewMenu, setShowReviewMenu] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [importanceDropdownOpen, setImportanceDropdownOpen] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  const importanceRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (importanceRef.current && !importanceRef.current.contains(e.target as Node)) {
        setImportanceDropdownOpen(false);
      }
      if (reviewRef.current && !reviewRef.current.contains(e.target as Node)) {
        setShowReviewMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const QUICK_REVIEW_OPTIONS = [
    { label: '艾宾浩斯', getDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000), repeat: 'ebbinghaus', step: 0 },
    { label: '每天', getDate: () => new Date(Date.now() + 24 * 60 * 60 * 1000), repeat: 'daily' },
    { label: '明天', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; } },
    { label: '3 天后', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 3); return d; } },
    { label: '一周后', getDate: () => { const d = new Date(); d.setDate(d.getDate() + 7); return d; } },
    { label: '一个月后', getDate: () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; } },
  ];

  const REPEAT_OPTIONS = [
    { label: '不重复', value: 'none' },
    { label: '艾宾浩斯', value: 'ebbinghaus' },
    { label: '每天', value: 'daily' },
    { label: '每周', value: 'weekly' },
    { label: '每月', value: 'monthly' },
  ];

  const formatReviewDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    if (isToday(date)) return `今天 ${format(date, 'HH:mm', { locale: zhCN })}`;
    if (isTomorrow(date)) return `明天 ${format(date, 'HH:mm', { locale: zhCN })}`;
    if (isPast(date)) return `已逾期 ${format(date, 'M月d日', { locale: zhCN })}`;
    return format(date, 'M月d日 HH:mm', { locale: zhCN });
  };

  const hasReview = !!reviewAt;

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
          reviewAt: reviewAt,
          reviewRepeat: reviewRepeat === 'none' ? null : reviewRepeat,
          reviewStep: reviewRepeat === 'ebbinghaus' ? reviewStep : 0,
        });
        onSaved(note, true);
      } else {
        const { note } = await api.createNote({
          content: normalizedContent,
          images,
          tags,
          categoryId,
          importance,
          reviewAt: reviewAt,
          reviewRepeat: reviewRepeat === 'none' ? null : reviewRepeat,
          reviewStep: reviewRepeat === 'ebbinghaus' ? reviewStep : 0,
        });
        onSaved(note, false);
        // 清空表单
        setContent('');
        setImages([]);
        setTags([]);
        setCategoryId(null);
        setImportance(null);
        setReviewAt(null);
        setReviewRepeat('none');
        setReviewStep(0);
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
          <div className="flex items-center gap-1 ml-3 relative" ref={importanceRef}>
            <Flag size={14} className="text-ink-400" />
            <button
              type="button"
              onClick={() => setImportanceDropdownOpen(!importanceDropdownOpen)}
              className="text-xs text-ink-700 bg-transparent border-0 focus:outline-none cursor-pointer flex items-center gap-1 hover:text-ink-900"
            >
              {importance ? (
                <span style={{ color: IMPORTANCE_CONFIG[importance].text }}>
                  {IMPORTANCE_CONFIG[importance].label}
                </span>
              ) : (
                '无'
              )}
              <ChevronDown size={12} className={cn('transition-transform', importanceDropdownOpen && 'rotate-180')} />
            </button>
            {importanceDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-ink-200 rounded-lg shadow-lg py-1 min-w-[120px]">
                <button
                  type="button"
                  onClick={() => { setImportance(null); setImportanceDropdownOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-ink-50 transition-colors',
                    !importance && 'bg-ink-50'
                  )}
                >
                  <span className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    !importance ? 'bg-ink-400' : 'border border-ink-300'
                  )} />
                  <span>无</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setImportance('important'); setImportanceDropdownOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-ink-50 transition-colors',
                    importance === 'important' && 'bg-ink-50'
                  )}
                >
                  <span className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    importance === 'important' ? 'bg-[#3B82F6]' : 'border border-[#3B82F6]'
                  )} />
                  <span>重要</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setImportance('very_important'); setImportanceDropdownOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left hover:bg-ink-50 transition-colors',
                    importance === 'very_important' && 'bg-ink-50'
                  )}
                >
                  <span className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    importance === 'very_important' ? 'bg-[#EC4899]' : 'border border-[#EC4899]'
                  )} />
                  <span>极重要</span>
                </button>
              </div>
            )}
          </div>

          {/* 回顾提醒 */}
          <div className="flex items-center gap-1 ml-3 relative" ref={reviewRef}>
            <button
              type="button"
              onClick={() => setShowReviewMenu(!showReviewMenu)}
              className={cn(
                'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors border',
                hasReview
                  ? 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  : 'text-ink-500 border-ink-200 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'
              )}
              title={hasReview ? `回顾：${formatReviewDate(reviewAt!)}` : '设置回顾提醒'}
            >
              {hasReview ? (
                <Calendar size={13} className="text-emerald-600" />
              ) : (
                <Clock size={13} />
              )}
              {hasReview ? (
                <span className="font-medium">回顾</span>
              ) : (
                <span>回顾</span>
              )}
            </button>
            {showReviewMenu && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-ink-200 rounded-lg shadow-lg py-1.5 min-w-[180px]">
                {hasReview && (
                  <div className="px-3 py-1.5 text-xs text-emerald-600 font-medium bg-emerald-50 rounded mx-1 mb-1">
                    {reviewRepeat === 'ebbinghaus'
                      ? `遗忘曲线第${reviewStep + 1}步：${getEbbinghausDays(reviewStep)}天后`
                      : `当前：${formatReviewDate(reviewAt!)}`
                    }
                  </div>
                )}
                <div className="text-[10px] text-ink-400 px-3 py-0.5">快速设置</div>
                {QUICK_REVIEW_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      const d = opt.getDate();
                      setReviewAt(d.toISOString());
                      if (opt.repeat) setReviewRepeat(opt.repeat);
                      if (opt.repeat === 'ebbinghaus') setReviewStep(opt.step ?? 0);
                      setShowReviewMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-ink-700 hover:bg-ink-50 rounded flex items-center justify-between"
                  >
                    <span>{opt.label}</span>
                    {opt.repeat === 'ebbinghaus' && <Brain size={11} className="text-violet-500" />}
                    {opt.repeat === 'daily' && <span className="text-emerald-500">🔁</span>}
                  </button>
                ))}
                <div className="border-t border-ink-100 my-1" />
                <div className="px-3 py-1">
                  <div className="text-[10px] text-ink-400 mb-1">自定义时间</div>
                  <input
                    type="datetime-local"
                    onChange={(e) => {
                      if (e.target.value) {
                        setReviewAt(new Date(e.target.value).toISOString());
                      }
                    }}
                    className="w-full text-xs px-2 py-1 border border-ink-200 rounded focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="border-t border-ink-100 my-1" />
                <div className="text-[10px] text-ink-400 px-3 py-0.5">重复频率</div>
                <div className="flex flex-wrap gap-1 px-3 py-1">
                  {REPEAT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setReviewRepeat(opt.value);
                        if (opt.value === 'ebbinghaus') {
                          setReviewStep(0);
                        }
                        // 如果之前没设过 reviewAt，自动根据重复频率算一个初始日期
                        if (!hasReview && opt.value !== 'none') {
                          let d: Date;
                          if (opt.value === 'ebbinghaus') {
                            d = new Date(Date.now() + getEbbinghausDays(0) * 24 * 60 * 60 * 1000);
                          } else if (opt.value === 'daily') {
                            d = new Date(Date.now() + 24 * 60 * 60 * 1000);
                          } else if (opt.value === 'weekly') {
                            d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                          } else if (opt.value === 'biweekly') {
                            d = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
                          } else if (opt.value === 'monthly') {
                            d = new Date();
                            d.setMonth(d.getMonth() + 1);
                          } else {
                            return;
                          }
                          setReviewAt(d.toISOString());
                        }
                      }}
                      className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded',
                        reviewRepeat === opt.value
                          ? 'bg-emerald-500 text-white'
                          : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {hasReview && (
                  <div className="border-t border-ink-100 my-1" />
                )}
                {hasReview && (
                  <button
                    type="button"
                    onClick={() => {
                      setReviewAt(null);
                      setReviewRepeat('none');
                      setReviewStep(0);
                      setShowReviewMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded"
                  >
                    清除回顾提醒
                  </button>
                )}
              </div>
            )}
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
