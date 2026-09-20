'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Plus,
  Star,
  Flag,
  LayoutList,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  Pin,
  Heart,
  Repeat,
  BookOpen,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { CategoryDTO } from '@/lib/types';

interface CategorySidebarProps {
  categories: CategoryDTO[];
  selected: { type: 'all' | 'favorite' | 'important' | 'veryImportant' | 'liked' | 'reposted' | 'category' | 'tag' | 'allPinned' | 'reviewed'; id?: string; label?: string };
  onSelect: (sel: CategorySidebarProps['selected']) => void;
  onCategoriesChange: () => void;
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
function renderIcon(icon: string, size: string = 'w-5 h-5 flex-shrink-0 text-sm') {
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

/** 扁平数组 → 两层树 */
interface TreeNode extends CategoryDTO {
  children: TreeNode[];
}

function buildTree(flat: CategoryDTO[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  flat.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (a: TreeNode, b: TreeNode) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.order !== b.order) return b.order - a.order;
    return a.createdAt.localeCompare(b.createdAt);
  };
  roots.sort(sort);
  for (const node of map.values()) node.children.sort(sort);
  return roots;
}

export default function CategorySidebar(props: CategorySidebarProps) {
  const { categories, selected, onSelect, onCategoriesChange, refreshKey = 0 } = props;

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[1]);
  const [newIcon, setNewIcon] = useState('🍥');
  const [newParentId, setNewParentId] = useState<string>('');
  const [savingCreate, setSavingCreate] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[0]);
  const [editIcon, setEditIcon] = useState('🍥');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 拖拽状态
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragHoverId, setDragHoverId] = useState<string | null>(null);
  const [dragZone, setDragZone] = useState<'top' | 'middle' | 'bottom' | null>(null);
  const draggingIdRef = useRef<string | null>(null);

  // 展开状态 — 默认折叠，用户手动展开才记住
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const tree = useMemo(() => buildTree(categories), [categories]);

  // 自动展开父分类（选中分类的父链自动展开，方便用户找到自己在哪）
  useEffect(() => {
    if (!selected.id) return;
    const chain = new Set<string>();
    let cur = categories.find((c) => c.id === selected.id);
    while (cur?.parentId) {
      chain.add(cur.parentId);
      cur = categories.find((c) => c.id === cur!.parentId);
    }
    if (chain.size > 0) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        chain.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [selected.id, categories]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ===== 计数 =====
  const counts = useMemo(() => {
    const getCount = (scope?: Record<string, any>) =>
      api.listNotes({ ...(scope as any), limit: 1 }).then(({ total }) => total).catch(() => null);
    return {
      all: getCount(),
      favorite: getCount({ favorite: true }),
      review: getCount({ scope: 'reviewed' }),
      pinned: getCount({ scope: 'allPinned' }),
      important: getCount({ importance: 'important' }),
      veryImportant: getCount({ importance: 'very_important' }),
      liked: getCount({ liked: true }),
      reposted: getCount({ reposted: true }),
    };
  }, [refreshKey]);

  const [countValues, setCountValues] = useState<Record<string, number | null>>({});
  useEffect(() => {
    Promise.all(Object.entries(counts).map(async ([k, p]) => [k, await p]))
      .then((vals) => setCountValues(Object.fromEntries(vals)))
      .catch(() => {});
  }, [counts]);

  // ===== 拖拽 =====

  const handleDragStart = (e: React.DragEvent, catId: string) => {
    draggingIdRef.current = catId;
    setDraggingId(catId);
    setDragHoverId(null);
    setDragZone(null);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', catId);
  };

  const handleDragOver = (e: React.DragEvent, catId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!draggingIdRef.current || draggingIdRef.current === catId) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = (e.clientY - rect.top) / rect.height;
    let zone: 'top' | 'middle' | 'bottom';
    if (relY < 0.25) zone = 'top';
    else if (relY > 0.75) zone = 'bottom';
    else zone = 'middle';

    setDragHoverId(catId);
    setDragZone(zone);
  };

  const handleDragLeave = (e: React.DragEvent, catId: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      if (dragHoverId === catId) {
        setDragHoverId(null);
        setDragZone(null);
      }
    }
  };

  const handleDragEnd = () => {
    draggingIdRef.current = null;
    setDraggingId(null);
    setDragHoverId(null);
    setDragZone(null);
  };

  /**
   * 执行拖拽 — 根据 zone 决定是 reparent 还是排序
   * zone=middle → 变成目标的子分类
   * zone=top/bottom → 排序（支持跨父层级：先 reparent 到 target 的 parent，再排）
   */
  const handleDrop = async (
    e: React.DragEvent,
    targetId: string,
    targetParentId: string | null,
    _siblingsInScope: CategoryDTO[]
  ) => {
    e.preventDefault();
    const dragId = draggingIdRef.current;
    const zone = dragZone;
    draggingIdRef.current = null;

    if (!dragId || !zone || dragId === targetId) {
      handleDragEnd();
      return;
    }

    const drag = categories.find((c) => c.id === dragId);
    if (!drag) { handleDragEnd(); return; }

    // 防止把自己挂到自己或自己的后代下面
    if (zone === 'middle') {
      const descendants = new Set<string>();
      const stack = [targetId];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        descendants.add(cur);
        categories.filter((c) => c.parentId === cur).forEach((c) => stack.push(c.id));
      }
      if (descendants.has(dragId)) {
        alert('不能把分类拖到自己的子分类下面');
        handleDragEnd();
        return;
      }
    }

    try {
      if (zone === 'middle') {
        // 变成目标的子分类
        const targetChildren = categories.filter((c) => c.parentId === targetId);
        const newOrder = targetChildren.length > 0
          ? Math.min(...targetChildren.map((c) => c.order)) - 10
          : 100;
        await api.updateCategory(dragId, { parentId: targetId, order: newOrder });
      } else {
        // top/bottom: 先确保 drag 和 target 在同一 parent 下
        const needReparent = (drag.parentId ?? null) !== targetParentId;
        if (needReparent) {
          await api.updateCategory(dragId, { parentId: targetParentId });
        }
        // 同层级排序 — 取该 parent 下的所有顶层分类重新算 order
        const peers = categories.filter((c) => (c.parentId ?? null) === targetParentId && c.id !== dragId);
        const targetIdx = peers.findIndex((c) => c.id === targetId);
        if (targetIdx < 0) return;
        const insertIdx = zone === 'top' ? targetIdx : targetIdx + 1;
        const reordered = [...peers.slice(0, insertIdx), drag, ...peers.slice(insertIdx)];
        const items = reordered.map((c, i) => ({ id: c.id, order: (reordered.length - i) * 10 }));
        await api.reorderCategories({ items });
      }
      onCategoriesChange();
    } catch (err: any) {
      alert(err.message || '拖拽失败');
    } finally {
      handleDragEnd();
    }
  };

  // ===== CRUD =====

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSavingCreate(true);
    try {
      await api.createCategory({
        name: newName.trim(),
        color: newColor,
        icon: newIcon,
        parentId: newParentId || undefined,
      });
      setNewName('');
      setNewColor(PRESET_COLORS[1]);
      setNewIcon('🍥');
      setNewParentId('');
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
      // 把 children 提升到父级
      const kids = categories.filter((c) => c.parentId === id);
      if (kids.length > 0) {
        const targetParent = categories.find((c) => c.id === id)?.parentId || null;
        for (const kid of kids) {
          await api.updateCategory(kid.id, { parentId: targetParent });
        }
      }
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
    try {
      const update: Partial<{ pinned: boolean; order: number }> = {
        pinned: !c.pinned,
      };
      if (!c.pinned) {
        const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order), 0);
        update.order = maxOrder + 1;
      }
      await api.updateCategory(c.id, update);
      onCategoriesChange();
    } catch (e: any) {
      alert(e.message || '置顶操作失败');
    }
  };

  // ===== 渲染 =====

  // 所有可作为 parent 的分类（创建弹框下拉用，排除自己和自己的后代）
  const availableParents = categories.filter((c) => {
    if (!editingId) return true;
    if (c.id === editingId) return false;
    // 排除自己的后代
    const descendants = new Set<string>();
    const stack = [editingId];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      descendants.add(cur);
      categories.filter((cat) => cat.parentId === cur).forEach((cat) => stack.push(cat.id));
    }
    return !descendants.has(c.id);
  });

  const renderNode = (node: TreeNode, depth: number, siblings: TreeNode[]) => {
    const isActive = selected.type === 'category' && selected.id === node.id;
    const isEditing = editingId === node.id;
    const isConfirming = confirmDeleteId === node.id;
    const isExpanded = expandedIds.has(node.id);
    const isDraggingThis = draggingId === node.id;
    const isDragOver = dragHoverId === node.id && !isDraggingThis;

    const canDrag = !isEditing && !isConfirming;
    const indentPx = depth * 14;

    return (
      <div key={node.id}>
        <div
          draggable={canDrag}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id)}
          onDragLeave={(e) => handleDragLeave(e, node.id)}
          onDrop={(e) => handleDrop(e, node.id, node.parentId ?? null, siblings)}
          className={cn(
            'group relative flex items-center rounded-md',
            canDrag && 'cursor-grab active:cursor-grabbing',
            isActive ? 'bg-accent-50' : 'hover:bg-ink-100',
            isDraggingThis && 'opacity-40'
          )}
          style={{ paddingLeft: indentPx }}
        >
          {/* 拖拽 zone 指示 */}
          {isDragOver && dragZone === 'top' && (
            <span className="absolute top-0.5 left-1 right-1 h-0.5 bg-accent-500 rounded-full pointer-events-none z-10" />
          )}
          {isDragOver && dragZone === 'bottom' && (
            <span className="absolute bottom-0.5 left-1 right-1 h-0.5 bg-accent-500 rounded-full pointer-events-none z-10" />
          )}
          {isDragOver && dragZone === 'middle' && (
            <span className="absolute inset-0 rounded-md bg-accent-100/70 border-2 border-accent-500 pointer-events-none z-10" />
          )}

          {isEditing ? (
            <div className="flex-1 m-1 p-2 rounded-md border border-ink-200 bg-ink-50 space-y-2 animate-slide-up">
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
                    className={cn('w-5 h-5 rounded-full border-2', editColor === color ? 'border-ink-800' : 'border-transparent')}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {PRESET_ICONS.map((i) => (
                  <button
                    key={i}
                    onClick={() => setEditIcon(i)}
                    className={cn('w-6 h-6 rounded text-sm flex items-center justify-center', editIcon === i ? 'bg-accent-100' : 'hover:bg-ink-100')}
                  >
                    {renderIcon(i)}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => setEditingId(null)} className="px-2 py-1 text-xs text-ink-500">取消</button>
                <button onClick={handleSaveEdit} disabled={savingEdit} className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-ink-900 text-white rounded disabled:bg-ink-300">
                  {savingEdit ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}保存
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 展开箭头 — 只有有子分类时才显示 */}
              {node.hasChildren ? (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}
                  className="p-0.5 text-ink-400 hover:text-ink-700"
                >
                  <ChevronRight size={11} className={cn('transition-transform', isExpanded && 'rotate-90')} />
                </button>
              ) : (
                <span className="w-4" />
              )}

              <button
                onClick={() => onSelect({ type: 'category', id: node.id, label: node.name })}
                className="flex-1 flex items-center gap-1.5 py-1.5 text-sm text-left min-w-0"
              >
                {renderIcon(node.icon || '/icons/naruto/kakashi.jpg', 'w-5 h-5 flex-shrink-0 text-sm')}
                <span className={cn('truncate font-medium')} style={{ color: node.color }}>
                  {node.name}
                </span>
                {(() => {
                  const nc = node._count?.notes ?? 0;
                  const cc = node.childrenCount ?? 0;
                  const label = nc > 0 && cc > 0 ? `${nc}+${cc}` : nc > 0 ? `${nc}` : cc > 0 ? `${cc}` : null;
                  if (!label) return null;
                  return <span className="ml-auto text-[10px] text-ink-400">{label}</span>;
                })()}
              </button>

              <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                {deleting && confirmDeleteId === node.id ? (
                  <Loader2 size={11} className="animate-spin text-ink-400" />
                ) : (
                  <>
                    <button
                      onClick={() => handleTogglePin(node)}
                      className={cn('p-1 rounded hover:bg-white/60', node.pinned ? 'text-accent-600' : 'text-ink-400 hover:text-ink-600')}
                      title={node.pinned ? '取消置顶' : '置顶'}
                    >
                      <Pin size={11} className={cn(node.pinned && 'fill-current')} />
                    </button>
                    <button onClick={() => startEdit(node)} className="p-1 rounded hover:bg-white/60 text-ink-400 hover:text-ink-600" title="编辑">
                      <Pencil size={11} />
                    </button>
                    <button onClick={() => setConfirmDeleteId(node.id)} className="p-1 rounded hover:bg-white/60 text-ink-400 hover:text-red-500" title="删除">
                      <Trash2 size={11} />
                    </button>
                  </>
                )}
              </div>

              {isConfirming && (
                <div className="absolute z-10 mt-1 right-0 top-full w-44 p-2 rounded-md border border-ink-200 bg-white shadow-lg text-xs">
                  <p className="mb-2 text-ink-700">删除此分类？笔记会保留但变为“未分类”，子分类会提升到上一级。</p>
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setConfirmDeleteId(null)} className="px-2 py-0.5 text-ink-500">取消</button>
                    <button onClick={() => handleDelete(node.id)} disabled={deleting} className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white rounded">
                      {deleting ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}删除
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 递归子节点 */}
        {node.hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1, node.children))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-full lg:w-64 lg:flex-shrink-0 space-y-4">
      <div className="space-y-1">
        <SidebarItem active={selected.type === 'all'} onClick={() => onSelect({ type: 'all' })} icon={<LayoutList size={15} />} label="全部笔记" count={countValues.all} />
        <SidebarItem active={selected.type === 'reviewed'} onClick={() => onSelect({ type: 'reviewed' })} icon={<BookOpen size={15} />} label="回顾" count={countValues.review} />
        <SidebarItem active={selected.type === 'allPinned'} onClick={() => onSelect({ type: 'allPinned' })} icon={<Pin size={15} />} label="置顶" count={countValues.pinned} />
        <SidebarItem active={selected.type === 'favorite'} onClick={() => onSelect({ type: 'favorite' })} icon={<Star size={15} />} label="收藏" count={countValues.favorite} />
        <SidebarItem active={selected.type === 'important'} onClick={() => onSelect({ type: 'important' })} icon={<Flag size={15} />} label="重要" count={countValues.important} />
        <SidebarItem active={selected.type === 'veryImportant'} onClick={() => onSelect({ type: 'veryImportant' })} icon={<Flag size={15} className="text-red-500" />} label="极重要" count={countValues.veryImportant} />
        <SidebarItem active={selected.type === 'liked'} onClick={() => onSelect({ type: 'liked' })} icon={<Heart size={15} />} label="点赞" count={countValues.liked} />
        <SidebarItem active={selected.type === 'reposted'} onClick={() => onSelect({ type: 'reposted' })} icon={<Repeat size={15} />} label="转发" count={countValues.reposted} />
      </div>

      <div className="pt-4 border-t border-ink-200">
        <div className="flex items-center justify-between mb-2 px-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">分类</h3>
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
                <button key={c} onClick={() => setNewColor(c)} className={cn('w-5 h-5 rounded-full border-2', newColor === c ? 'border-ink-800' : 'border-transparent')} style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {PRESET_ICONS.map((i) => (
                <button key={i} onClick={() => setNewIcon(i)} className={cn('w-6 h-6 rounded text-sm flex items-center justify-center', newIcon === i ? 'bg-accent-100' : 'hover:bg-ink-100')}>
                  {renderIcon(i)}
                </button>
              ))}
            </div>
            {/* 可选父分类 */}
            {tree.length > 0 && (
              <div>
                <label className="text-[11px] text-ink-500">作为子分类：</label>
                <select
                  value={newParentId}
                  onChange={(e) => setNewParentId(e.target.value)}
                  className="mt-1 w-full px-2 py-1 text-xs bg-white border border-ink-200 rounded"
                >
                  <option value="">— 顶层分类 —</option>
                  {categories.filter((c) => !c.parentId).map((c) => (
                    <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center justify-end gap-1 pt-1">
              <button onClick={() => setCreating(false)} className="px-2 py-1 text-xs text-ink-500">取消</button>
              <button onClick={handleCreate} disabled={!newName.trim() || savingCreate} className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-ink-900 text-white rounded disabled:bg-ink-300">
                {savingCreate && <Loader2 size={11} className="animate-spin" />}创建
              </button>
            </div>
          </div>
        )}

        <div className="space-y-0.5">
          {categories.length === 0 && !creating && (
            <p className="px-2 py-3 text-xs text-ink-400 italic">还没有分类，点击 + 创建</p>
          )}
          {tree.map((node) => renderNode(node, 0, tree))}
        </div>
      </div>
    </aside>
  );
}

function SidebarItem({
  active, onClick, icon, label, count,
}: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count?: number | null }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
        active ? 'bg-ink-900 text-white font-medium' : 'text-ink-700 hover:bg-ink-100'
      )}
    >
      <span className={active ? 'text-white' : 'text-ink-500'}>{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== null && count !== undefined && (
        <span className={cn('text-[10px]', active ? 'text-white/80' : 'text-ink-400')}>{count}</span>
      )}
    </button>
  );
}
