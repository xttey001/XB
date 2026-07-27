'use client';

import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { CategoryDTO } from '@/lib/types';

interface CategorySidebarProps {
  categories: CategoryDTO[];
  selected: { type: 'all' | 'favorite' | 'important' | 'category' | 'tag'; id?: string; label?: string };
  onSelect: (sel: CategorySidebarProps['selected']) => void;
  onCategoriesChange: () => void;
  /** 外部触发重新加载重要笔记数量（如增删改笔记后递增） */
  refreshKey?: number;
}

const PRESET_COLORS = [
  '#6B7280', '#0EA5E9', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6',
];

const PRESET_ICONS = ['📁', '💡', '📚', '🎯', '✨', '🔬', '🎨', '🏠', '💊', '✈️'];

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
  const [newIcon, setNewIcon] = useState('📁');
  const [savingCreate, setSavingCreate] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [editIcon, setEditIcon] = useState('📁');
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [importantCount, setImportantCount] = useState<number | null>(null);

  // 加载重要笔记合并数量（重要 + 极重要）
  useEffect(() => {
    let cancelled = false;
    api
      .listNotes({ importance: 'important,very_important', limit: 1 })
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
      setNewIcon('📁');
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
    setEditIcon(c.icon || '📁');
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

  return (
    <aside className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
      <div className="space-y-1">
        <SidebarItem
          active={selected.type === 'all'}
          onClick={() => onSelect({ type: 'all' })}
          icon={<LayoutList size={15} />}
          label="全部笔记"
        />
        <SidebarItem
          active={selected.type === 'favorite'}
          onClick={() => onSelect({ type: 'favorite' })}
          icon={<Star size={15} />}
          label="收藏"
        />
        <SidebarItem
          active={selected.type === 'important'}
          onClick={() => onSelect({ type: 'important' })}
          icon={<Flag size={15} />}
          label="重要"
          count={importantCount}
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
                    'w-6 h-6 rounded text-sm',
                    newIcon === i ? 'bg-accent-100' : 'hover:bg-ink-100'
                  )}
                >
                  {i}
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
                          'w-6 h-6 rounded text-sm',
                          editIcon === i ? 'bg-accent-100' : 'hover:bg-ink-100'
                        )}
                      >
                        {i}
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

            return (
              <div
                key={c.id}
                className={cn(
                  'group flex items-center justify-between rounded-md',
                  isActive ? 'bg-accent-50' : 'hover:bg-ink-100'
                )}
              >
                <button
                  onClick={() => onSelect({ type: 'category', id: c.id, label: c.name })}
                  className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm text-left min-w-0"
                >
                  <span className="text-sm flex-shrink-0">{c.icon || '📁'}</span>
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
                  {movingId === c.id ? (
                    <Loader2 size={11} className="animate-spin text-ink-400" />
                  ) : (
                    <>
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
