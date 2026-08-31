'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Star,
  Flag,
  LayoutList,
  Folder as FolderIcon,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  Pin,
  Heart,
  Repeat,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { CategoryDTO } from '@/lib/types';

interface CategorySidebarProps {
  categories: CategoryDTO[];
  selected: { type: 'all' | 'favorite' | 'important' | 'veryImportant' | 'liked' | 'reposted' | 'category' | 'tag' | 'allPinned' | 'reviewed'; id?: string; label?: string };
  onSelect: (sel: CategorySidebarProps['selected']) => void;
  onCategoriesChange: () => void;
  /** 外部触发重新加载重要笔记数量（如增删改笔记后递增） */
  refreshKey?: number;
}

const PRESET_COLORS = [
  '#6B7280', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6',
];

const PRESET_ICONS = [
  // 火影人物 (简约头像)
  '/icons/naruto/kakashi.jpg', '/icons/naruto/itachi.jpg', '/icons/naruto/naruto.jpg', '/icons/naruto/madara.jpg', '/icons/naruto/pain.jpg', '/icons/naruto/hinata.jpg', '/icons/naruto/minato.jpg', '/icons/naruto/deidara.jpg',
  // 卡通
  '🧸', '🍭', '🎈',
  // 动物
  '🐶', '🐼', '🐰', '🦁', '🐾', '🦋', '🐧', '🦄', '🐬',
  // 学习 & 思考
  '💡', '📚', '📖', '🔬', '🧠', '🎓',
  // 生活 & 健康
  '🏠', '🍳', '🛒', '🚗', '✈️', '🏥', '💊', '🚀', '🏛️',
  // 娱乐 & 创作
  '🎵', '🎮', '🎬', '🎨', '🎉', '⚽',
  // 财务 & 时间
  '💰', '📈', '📅', '⏰', '💵',
  // 标记
  '⭐', '❤️', '✅', '⚡', '📢', '🚫', '💯', '⚠️', '❤️‍🩹', '❓',
  // 自然 & 哲学
  '☯️', '🌙', '☀️', '🌏', '🌀', '🌈', '💫', '🪐', '🌠', '☄️', '🌌', '❄️', '🌸',
];

/** 根据 icon 类型渲染图片或 emoji */
function renderIcon(icon: string, size: string = 'w-6 h-6 text-sm') {
  const v = (icon || '').trim();
  const isImg = v.startsWith('/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(v);
  if (isImg) {
    return (
      <span className={`${size} inline-flex items-center justify-center overflow-hidden rounded-full`}>
        <img src={v} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </span>
    );
  }
  return <span className={size}>{icon}</span>;
}

export default function CategorySidebar({
  categories,
  selected,
  onSelect,
  onCategoriesChange,
  refreshKey = 0,
}: CategorySidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[1]);
  const [newIcon, setNewIcon] = useState('🍥');
  const [savingCreate, setSavingCreate] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [editIcon, setEditIcon] = useState('🍥');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  // 拖拽相关状态
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dragInsertPosition, setDragInsertPosition] = useState<'top' | 'bottom' | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const [importantCount, setImportantCount] = useState<number | null>(null);
  const [veryImportantCount, setVeryImportantCount] = useState<number | null>(null);
  const [likedCount, setLikedCount] = useState<number | null>(null);
  const [repostedCount, setRepostedCount] = useState<number | null>(null);
  const [allPinnedCount, setAllPinnedCount] = useState<number | null>(null);
  const [reviewedCount, setReviewedCount] = useState<number | null>(null);
  const [allCount, setAllCount] = useState<number | null>(null);
  const [favoriteCount, setFavoriteCount] = useState<number | null>(null);

  // 加载重要笔记数量（仅 important）
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ importance: 'important', limit: 1 })
      .then(({ total }) => {
        if (!cancelled) setImportantCount(total);
      })
      .catch(() => {
        if (!cancelled) setImportantCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 加载极重要笔记数量（仅 very_important）
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ importance: 'very_important', limit: 1 })
      .then(({ total }) => {
        if (!cancelled) setVeryImportantCount(total);
      })
      .catch(() => {
        if (!cancelled) setVeryImportantCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 加载点赞数量
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ liked: true, limit: 1 })
      .then(({ total }) => {
        if (!cancelled) setLikedCount(total);
      })
      .catch(() => {
        if (!cancelled) setLikedCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 加载转发数量
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ reposted: true, limit: 1 })
      .then(({ total }) => {
        if (!cancelled) setRepostedCount(total);
      })
      .catch(() => {
        if (!cancelled) setRepostedCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 加载全局置顶数量
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ scope: 'allPinned', limit: 1 })
      .then(({ total }) => {
        if (!cancelled) setAllPinnedCount(total);
      })
      .catch(() => {
        if (!cancelled) setAllPinnedCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 加载回顾数量
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ scope: 'reviewed', limit: 1 })
      .then(({ total }) => {
        if (!cancelled) setReviewedCount(total);
      })
      .catch(() => {
        if (!cancelled) setReviewedCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 加载全部笔记数量
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ limit: 1 })
      .then(({ total }) => {
        if (!cancelled) setAllCount(total);
      })
      .catch(() => {
        if (!cancelled) setAllCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // 加载收藏数量
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ favorite: true, limit: 1 })
      .then(({ total }) => {
        if (!cancelled) setFavoriteCount(total);
      })
      .catch(() => {
        if (!cancelled) setFavoriteCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // ===== 拖拽排序 =====

  const handleDragStart = (e: React.DragEvent, catId: string) => {
    draggingIdRef.current = catId;
    setDraggingId(catId);
    setDragOverIdx(null);
    setDragInsertPosition(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', catId);
    // 让拖动的半透明项不参与 dragover 计算
    const target = e.target as HTMLElement;
    setTimeout(() => {
      target.style.opacity = '0.4';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    draggingIdRef.current = null;
    const target = e.target as HTMLElement;
    target.style.opacity = '';
    setDraggingId(null);
    setDragOverIdx(null);
    setDragInsertPosition(null);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggingIdRef.current == null) return;

    // 计算鼠标在目标项的上半部还是下半部
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const position = e.clientY < mid ? 'top' : 'bottom';

    setDragOverIdx(idx);
    setDragInsertPosition(position);
  };

  const handleDragLeave = () => {
    // 只在离开容器时清除，否则在元素间移动会闪烁
  };

  const handleDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    const dragId = draggingIdRef.current;
    const position = dragInsertPosition;
    // 立即清除 ref
    draggingIdRef.current = null;

    if (dragId == null || position == null) return;

    const dragIdx = categories.findIndex((c) => c.id === dragId);
    if (dragIdx < 0 || dragIdx === targetIdx) {
      setDraggingId(null);
      setDragOverIdx(null);
      setDragInsertPosition(null);
      return;
    }

    // 计算新位置：如果目标是上半区，插到目标前；下半区则插到目标后
    let newIdx = dragIdx;
    if (position === 'top') {
      newIdx = dragIdx < targetIdx ? targetIdx - 1 : targetIdx;
    } else {
      newIdx = dragIdx < targetIdx ? targetIdx : targetIdx + 1;
    }
    // 不能拖到自己原位
    if (newIdx === dragIdx) {
      setDraggingId(null);
      setDragOverIdx(null);
      setDragInsertPosition(null);
      return;
    }
    // 边界检查
    newIdx = Math.max(0, Math.min(categories.length - 1, newIdx));

    // 构建新的有序数组（前端先乐观更新，API 失败则刷新）
    const reordered = [...categories];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(newIdx, 0, moved);

    // 重新分配 order 值（保持间距为 10，方便以后插入）
    const items = reordered.map((c, i) => ({ id: c.id, order: (reordered.length - i) * 10 }));

    setMovingId(dragId);
    try {
      await api.reorderCategories({ items });
      onCategoriesChange();
    } catch (err: any) {
      alert(err.message || '拖拽排序失败');
    } finally {
      setMovingId(null);
      setDraggingId(null);
      setDragOverIdx(null);
      setDragInsertPosition(null);
    }
  };

  /**
   * 上移/下移分类：与相邻分类交换 order 值
   * API 排序是 order desc，所以上移=增大 order
   */
  const handleMove = async (
    catId: string,
    direction: 'up' | 'down'
  ) => {
    const idx = categories.findIndex((c) => c.id === catId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= categories.length) return;

    const a = categories[idx];
    const b = categories[swapIdx];
    setMovingId(catId);
    try {
      await api.reorderCategories({
        items: [
          { id: a.id, order: b.order },
          { id: b.id, order: a.order },
        ],
      });
      onCategoriesChange();
    } catch (e: any) {
      alert(e.message || '调整顺序失败');
    } finally {
      setMovingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSavingCreate(true);
    try {
      await api.createCategory({
        name: newName.trim(),
        color: newColor,
        icon: newIcon,
      });
      setNewName('');
      setNewColor(PRESET_COLORS[1]);
      setNewIcon('🍥');
      setCreating(false);
      onCategoriesChange();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingCreate(false);
    }
  };

  const startEdit = (c: CategoryDTO) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditColor(c.color);
    setEditIcon(c.icon || '🍥');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setSavingEdit(true);
    try {
      await api.updateCategory(editingId, {
        name: editName.trim(),
        color: editColor,
        icon: editIcon,
      });
      setEditingId(null);
      onCategoriesChange();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.deleteCategory(id);
      setConfirmDeleteId(null);
      if (selected.type === 'category' && selected.id === id) {
        onSelect({ type: 'all' });
      }
      onCategoriesChange();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePin = async (c: CategoryDTO) => {
    setPinningId(c.id);
    try {
      const update: Partial<{ pinned: boolean; order: number }> = {
        pinned: !c.pinned,
      };
      if (!c.pinned) {
        // 置顶时把 order 设为当前最大 + 1，确保排在置顶组最前面
        const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order), 0);
        update.order = maxOrder + 1;
      }
      await api.updateCategory(c.id, update);
      onCategoriesChange();
    } catch (e: any) {
      alert(e.message || '置顶操作失败');
    } finally {
      setPinningId(null);
    }
  };

  return (
    <aside className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
      <div className="space-y-1">
        <SidebarItem
          active={selected.type === 'all'}
          onClick={() => onSelect({ type: 'all' })}
          icon={<LayoutList size={15} />}
          label="全部笔记"
          count={allCount}
        />
        <SidebarItem
          active={selected.type === 'reviewed'}
          onClick={() => onSelect({ type: 'reviewed' })}
          icon={<BookOpen size={15} />}
          label="回顾"
          count={reviewedCount}
        />
        <SidebarItem
          active={selected.type === 'allPinned'}
          onClick={() => onSelect({ type: 'allPinned' })}
          icon={<Pin size={15} />}
          label="置顶"
          count={allPinnedCount}
        />
        <SidebarItem
          active={selected.type === 'favorite'}
          onClick={() => onSelect({ type: 'favorite' })}
          icon={<Star size={15} />}
          label="收藏"
          count={favoriteCount}
        />
        <SidebarItem
          active={selected.type === 'important'}
          onClick={() => onSelect({ type: 'important' })}
          icon={<Flag size={15} />}
          label="重要"
          count={importantCount}
        />
        <SidebarItem
          active={selected.type === 'veryImportant'}
          onClick={() => onSelect({ type: 'veryImportant' })}
          icon={<Flag size={15} className="text-red-500" />}
          label="极重要"
          count={veryImportantCount}
        />
        <SidebarItem
          active={selected.type === 'liked'}
          onClick={() => onSelect({ type: 'liked' })}
          icon={<Heart size={15} />}
          label="点赞"
          count={likedCount}
        />
        <SidebarItem
          active={selected.type === 'reposted'}
          onClick={() => onSelect({ type: 'reposted' })}
          icon={<Repeat size={15} />}
          label="转发"
          count={repostedCount}
        />
      </div>

      <div className="pt-4 border-t border-ink-200">
        <div className="flex items-center justify-between mb-2 px-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            分类
          </h3>
          <button
            onClick={() => setCreating(!creating)}
            className="p-1 rounded hover:bg-ink-100 text-ink-500"
            title="新建分类"
          >
            {creating ? <X size={13} /> : <Plus size={13} />}
          </button>
        </div>

        {creating && (
          <div className="mb-3 p-3 rounded-md border border-ink-200 bg-ink-50 space-y-2 animate-slide-up">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
              placeholder="分类名称"
              className="w-full px-2 py-1.5 text-sm bg-white border border-ink-200 rounded focus:border-accent-500"
            />
            <div className="flex flex-wrap gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={cn(
                    'w-5 h-5 rounded-full border-2',
                    newColor === c ? 'border-ink-800' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {PRESET_ICONS.map((i) => (
                <button
                  key={i}
                  onClick={() => setNewIcon(i)}
                  className={cn(
                    'w-6 h-6 rounded text-sm flex items-center justify-center',
                    newIcon === i ? 'bg-accent-100' : 'hover:bg-ink-100'
                  )}
                >
                  {renderIcon(i)}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-1 pt-1">
              <button
                onClick={() => setCreating(false)}
                className="px-2 py-1 text-xs text-ink-500"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim() || savingCreate}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-ink-900 text-white rounded disabled:bg-ink-300"
              >
                {savingCreate && <Loader2 size={11} className="animate-spin" />}
                创建
              </button>
            </div>
          </div>
        )}

        <div className="space-y-0.5">
          {categories.length === 0 && !creating && (
            <p className="px-2 py-3 text-xs text-ink-400 italic">
              还没有分类，点击 + 创建
            </p>
          )}
          {categories.map((c, idx) => {
            const isActive = selected.type === 'category' && selected.id === c.id;
            const isEditing = editingId === c.id;
            const isConfirming = confirmDeleteId === c.id;

            if (isEditing) {
              return (
                <div
                  key={c.id}
                  className="p-2 rounded-md border border-ink-200 bg-ink-50 space-y-2 animate-slide-up"
                >
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full px-2 py-1 text-sm bg-white border border-ink-200 rounded focus:border-accent-500"
                  />
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditColor(color)}
                        className={cn(
                          'w-5 h-5 rounded-full border-2',
                          editColor === color
                            ? 'border-ink-800'
                            : 'border-transparent'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_ICONS.map((i) => (
                      <button
                        key={i}
                        onClick={() => setEditIcon(i)}
                        className={cn(
                          'w-6 h-6 rounded text-sm flex items-center justify-center',
                          editIcon === i ? 'bg-accent-100' : 'hover:bg-ink-100'
                        )}
                      >
                        {renderIcon(i)}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 text-xs text-ink-500"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-ink-900 text-white rounded disabled:bg-ink-300"
                    >
                      {savingEdit ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Check size={11} />
                      )}
                      保存
                    </button>
                  </div>
                </div>
              );
            }

            const isDraggingThis = draggingId === c.id;
            const isDragOverThis = dragOverIdx === idx && !isDraggingThis;
            const showTopInsertLine = isDragOverThis && dragInsertPosition === 'top';
            const showBottomInsertLine = isDragOverThis && dragInsertPosition === 'bottom';
            const canDrag = !isEditing && !isConfirming && !movingId;

            return (
              <div
                key={c.id}
                draggable={canDrag}
                onDragStart={(e) => handleDragStart(e, c.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                className={cn(
                  'group flex items-center justify-between rounded-md relative',
                  canDrag && 'cursor-grab active:cursor-grabbing',
                  isActive ? 'bg-accent-50' : 'hover:bg-ink-100',
                  isDraggingThis && 'opacity-40 scale-[0.98]'
                )}
              >
                {/* 拖拽插入位置指示线 */}
                {showTopInsertLine && (
                  <span className="absolute -top-0.5 left-1 right-1 h-0.5 bg-accent-500 rounded-full pointer-events-none z-10" />
                )}
                {showBottomInsertLine && (
                  <span className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-accent-500 rounded-full pointer-events-none z-10" />
                )}
                <button
                  onClick={() => onSelect({ type: 'category', id: c.id, label: c.name })}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm text-left min-w-0"
                >
                  {renderIcon(c.icon || '/icons/naruto/kakashi.jpg', 'w-5 h-5 flex-shrink-0')}
                  <span
                    className={cn('truncate font-medium')}
                    style={{ color: c.color }}
                  >
                    {c.name}
                  </span>
                  {c._count && c._count.notes > 0 && (
                    <span className="ml-auto text-[10px] text-ink-400">
                      {c._count.notes}
                    </span>
                  )}
                </button>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                  {movingId === c.id || pinningId === c.id ? (
                    <Loader2 size={11} className="animate-spin text-ink-400" />
                  ) : (
                    <>
                      <button
                        onClick={() => handleTogglePin(c)}
                        className={cn(
                          'p-1 rounded hover:bg-white/60',
                          c.pinned
                            ? 'text-accent-600'
                            : 'text-ink-400 hover:text-ink-600'
                        )}
                        title={c.pinned ? '取消置顶' : '置顶'}
                      >
                        <Pin size={11} className={cn(c.pinned && 'fill-current')} />
                      </button>
                      <button
                        onClick={() => handleMove(c.id, 'up')}
                        disabled={idx === 0}
                        className={cn(
                          'p-0.5 rounded hover:bg-white/60',
                          idx === 0
                            ? 'text-ink-300 cursor-not-allowed'
                            : 'text-ink-400 hover:text-ink-700'
                        )}
                        title="上移"
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        onClick={() => handleMove(c.id, 'down')}
                        disabled={idx === categories.length - 1}
                        className={cn(
                          'p-0.5 rounded hover:bg-white/60',
                          idx === categories.length - 1
                            ? 'text-ink-300 cursor-not-allowed'
                            : 'text-ink-400 hover:text-ink-700'
                        )}
                        title="下移"
                      >
                        <ChevronDown size={11} />
                      </button>
                      <button
                        onClick={() => startEdit(c)}
                        className="p-1 rounded hover:bg-white/60 text-ink-400 hover:text-ink-600"
                        title="编辑"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="p-1 rounded hover:bg-white/60 text-ink-400 hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>

                {isConfirming && (
                  <div className="absolute z-10 mt-1 right-0 top-full w-40 p-2 rounded-md border border-ink-200 bg-white shadow-lg text-xs">
                    <p className="mb-2 text-ink-700">删除此分类？笔记会保留但变为&quot;未分类&quot;。</p>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-0.5 text-ink-500"
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white rounded"
                      >
                        {deleting ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Check size={10} />
                        )}
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number | null;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
        active
          ? 'bg-ink-900 text-white font-medium'
          : 'text-ink-700 hover:bg-ink-100'
      )}
    >
      <span className={active ? 'text-white' : 'text-ink-500'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== null && count !== undefined && (
        <span
          className={cn(
            'text-[10px]',
            active ? 'text-white/80' : 'text-ink-400'
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
