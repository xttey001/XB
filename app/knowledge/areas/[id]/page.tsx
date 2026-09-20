'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Bookmark,
  FileText,
  Sparkles,
  Check,
} from 'lucide-react';

/* ==================== 类型 ==================== */

const STATUS_LABELS: Record<string, { label: string; color: string; weight: number }> = {
  unknown: { label: '未接触', color: 'bg-ink-100 text-ink-500', weight: 0 },
  aware: { label: '了解', color: 'bg-blue-100 text-blue-600', weight: 30 },
  can_use: { label: '会用', color: 'bg-emerald-100 text-emerald-600', weight: 70 },
  mastered: { label: '精通', color: 'bg-purple-100 text-purple-600', weight: 100 },
};

type CatNode = {
  id: string;
  name: string;
  icon: string | null;
  noteCount: number;
  progressStatus: string;
  isParent: boolean;
  progressPct: number;
  children: CatNode[];
};

type Area = {
  id: string;
  name: string;
  icon: string | null;
  color: string;
  description: string | null;
  areaProgressStatus: string;
  totalNotes: number;
  totalCategories: number;
  totalLeaves: number;
  progressPct: number;
  masteredCount: number;
  canUseCount: number;
  awareCount: number;
  unknownCount: number;
  categories: CatNode[];
};

type NoteItem = {
  id: string;
  content: string;
  createdAt: string;
  category: { id: string; name: string } | null;
  isFavorite: boolean;
  importance: string | null;
  likeCount: number;
  commentCount: number;
};

/* ==================== 主页面 ==================== */

export default function AreaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [area, setArea] = useState<Area | null>(null);
  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // 加载 Area 数据
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch('/api/knowledge/areas')
      .then((r) => r.json())
      .then((d) => {
        const areas: Area[] = d.areas || [];
        setAllAreas(areas);
        const cur = areas.find((a) => a.id === id);
        setArea(cur || null);
        // 默认选中第一个有笔记的分类
        if (cur) {
          const firstWithNotes = findFirstWithNotes(cur.categories);
          if (firstWithNotes) {
            setSelectedCatId(firstWithNotes.id);
          }
          // 默认展开所有父分类
          const parents = getAllParentIds(cur.categories);
          setExpandedParents(parents);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // 加载选中分类的笔记
  useEffect(() => {
    if (!selectedCatId) {
      setNotes([]);
      return;
    }
    setNotesLoading(true);
    fetch(`/api/knowledge/categories/${selectedCatId}/notes?includeDescendants=true&limit=100`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes || []))
      .finally(() => setNotesLoading(false));
  }, [selectedCatId]);

  const toggleParent = (pid: string) =>
    setExpandedParents((prev) => {
      const s = new Set(prev);
      s.has(pid) ? s.delete(pid) : s.add(pid);
      return s;
    });

  const selectedCat = selectedCatId ? findCatById(area?.categories || [], selectedCatId) : null;

  const updateCatStatus = async (catId: string, status: string) => {
    await fetch(`/api/knowledge/categories/${catId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressStatus: status }),
    });
    // 刷新
    const r = await fetch('/api/knowledge/areas');
    const d = await r.json();
    const areas: Area[] = d.areas || [];
    setAllAreas(areas);
    const cur = areas.find((a) => a.id === id);
    setArea(cur || null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  if (!area) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink-500 mb-2">找不到这个知识主干</p>
          <button
            onClick={() => router.push('/knowledge')}
            className="text-accent-500 text-sm hover:underline"
          >
            返回知识层级
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50 flex flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-20 border-b"
        style={{ backgroundColor: `${area.color}10` }}
      >
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => router.push('/knowledge')}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm text-ink-600 hover:bg-white/60"
          >
            <ArrowLeft size={14} />知识层级
          </button>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
            style={{ backgroundColor: `${area.color}20`, color: area.color }}
          >
            {area.icon || '📂'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-ink-800 truncate">{area.name}</h1>
              <span className="text-[10px] text-ink-400">
                {area.totalLeaves} 项 · {area.totalNotes} 条笔记
              </span>
            </div>
            {area.description && (
              <p className="text-xs text-ink-500 truncate">{area.description}</p>
            )}
          </div>

          {/* 主干切换 */}
          <select
            value={area.id}
            onChange={(e) => router.push(`/knowledge/areas/${e.target.value}`)}
            className="text-xs px-2 py-1 border border-ink-200 rounded-md bg-white"
          >
            {allAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Body: 两栏 */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* 左栏：分类树 */}
        <aside className="w-64 lg:w-72 flex-shrink-0 border-r border-ink-200 bg-white overflow-y-auto">
          <div className="p-3 border-b border-ink-100">
            {/* 整个 Area 的进度 */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-ink-500">整体进度</span>
              <span className="text-[11px] font-medium text-ink-600">
                {area.progressPct}%
              </span>
            </div>
            <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${area.progressPct}%`, backgroundColor: area.color }}
              />
            </div>
            <div className="mt-1.5 flex items-center gap-1 text-[10px]">
              {area.masteredCount > 0 && (
                <span className="bg-purple-100 text-purple-600 px-1 rounded">精通 {area.masteredCount}</span>
              )}
              {area.canUseCount > 0 && (
                <span className="bg-emerald-100 text-emerald-600 px-1 rounded">会用 {area.canUseCount}</span>
              )}
              {area.awareCount > 0 && (
                <span className="bg-blue-100 text-blue-600 px-1 rounded">了解 {area.awareCount}</span>
              )}
              {area.unknownCount > 0 && (
                <span className="bg-ink-100 text-ink-500 px-1 rounded">{area.unknownCount}</span>
              )}
            </div>
          </div>

          {/* 分类列表 */}
          <nav className="py-2">
            {area.categories.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-ink-400">
                暂无分类
              </div>
            ) : (
              area.categories.map((cat) => (
                <TreeItem
                  key={cat.id}
                  cat={cat}
                  depth={0}
                  selectedId={selectedCatId}
                  color={area.color}
                  expandedParents={expandedParents}
                  onSelect={setSelectedCatId}
                  onToggleParent={toggleParent}
                  onUpdateStatus={updateCatStatus}
                />
              ))
            )}
          </nav>
        </aside>

        {/* 右栏：笔记列表 */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6">
            {selectedCat ? (
              <>
                {/* 标题栏 */}
                <div className="mb-5 pb-4 border-b border-ink-200">
                  <div className="flex items-center gap-2 mb-1">
                    {selectedCat.isParent ? (
                      <FolderOpen size={16} style={{ color: area.color }} />
                    ) : (
                      <FileText size={16} style={{ color: area.color }} />
                    )}
                    <h2 className="text-lg font-semibold text-ink-800">{selectedCat.name}</h2>
                  </div>
                  <div className="text-xs text-ink-500">
                    {selectedCat.isParent
                      ? `共 ${countAllDescendants(selectedCat) + 1} 项分类 · `
                      : ''}
                    {selectedCat.noteCount} 条笔记
                  </div>

                  {/* 掌握程度 */}
                  {!selectedCat.isParent && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <span className="text-[11px] text-ink-400 mr-1">掌握程度:</span>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <button
                          key={k}
                          onClick={() => updateCatStatus(selectedCat.id, k)}
                          className={`text-[11px] px-2 py-0.5 rounded transition ${
                            selectedCat.progressStatus === k
                              ? `${v.color} ring-1 ring-current`
                              : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
                          }`}
                        >
                          {selectedCat.progressStatus === k && <Check size={8} className="inline mr-0.5" />}
                          {v.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 笔记列表 */}
                {notesLoading ? (
                  <div className="flex items-center justify-center py-16 text-ink-400">
                    <Loader2 className="animate-spin" size={18} />
                  </div>
                ) : notes.length === 0 ? (
                  <div className="text-center py-16 text-ink-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">这个分类下还没有笔记</p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {notes.map((n) => (
                      <NoteRow key={n.id} note={n} areaId={area.id} />
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <Folder size={40} className="mb-3 text-ink-300" />
                <p className="text-ink-500 text-sm">从左侧选择一个分类开始浏览</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ==================== 分类树节点 ==================== */

function TreeItem({
  cat,
  depth,
  selectedId,
  color,
  expandedParents,
  onSelect,
  onToggleParent,
  onUpdateStatus,
}: {
  cat: CatNode;
  depth: number;
  selectedId: string | null;
  color: string;
  expandedParents: Set<string>;
  onSelect: (id: string) => void;
  onToggleParent: (id: string) => void;
  onUpdateStatus: (catId: string, s: string) => void;
}) {
  const hasChildren = cat.isParent && cat.children.length > 0;
  const isOpen = expandedParents.has(cat.id);
  const isSelected = selectedId === cat.id;

  // 父分类的 noteCount 是自身的，我们要的是含子分类的
  const totalNotes = hasChildren ? sumDescendantNotes(cat) : cat.noteCount;

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 mx-2 rounded-md cursor-pointer transition ${
          isSelected ? 'bg-ink-100' : 'hover:bg-ink-50'
        }`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => onSelect(cat.id)}
      >
        {/* 展开箭头 */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleParent(cat.id);
            }}
            className="w-3.5 h-3.5 flex items-center justify-center text-ink-400 flex-shrink-0"
          >
            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span className="w-3.5 h-3.5 flex-shrink-0" />
        )}

        {/* 图标 */}
        {hasChildren ? (
          isOpen ? (
            <FolderOpen size={12} style={{ color }} className="flex-shrink-0" />
          ) : (
            <Folder size={12} style={{ color }} className="flex-shrink-0" />
          )
        ) : (
          <Bookmark size={11} className="text-ink-300 flex-shrink-0" />
        )}

        <span
          className={`text-[13px] truncate flex-1 ${
            isSelected ? 'font-medium text-ink-800' : 'text-ink-600'
          }`}
        >
          {cat.name}
        </span>

        <span className="text-[10px] text-ink-400 flex-shrink-0">{totalNotes}</span>
      </div>

      {/* children */}
      {hasChildren && isOpen && (
        <div>
          {cat.children.map((child) => (
            <TreeItem
              key={child.id}
              cat={child}
              depth={depth + 1}
              selectedId={selectedId}
              color={color}
              expandedParents={expandedParents}
              onSelect={onSelect}
              onToggleParent={onToggleParent}
              onUpdateStatus={onUpdateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== 笔记行 ==================== */

function NoteRow({ note, areaId }: { note: NoteItem; areaId: string }) {
  const router = useRouter();
  const preview = note.content.replace(/<[^>]+>/g, '').trim();
  const truncated = preview.length > 80 ? preview.slice(0, 80) + '…' : preview;
  const timeStr = new Date(note.createdAt).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li
      onClick={() => router.push(`/note/${note.id}?from=knowledge&areaId=${areaId}`)}
      className="group p-3 rounded-lg hover:bg-white border border-transparent hover:border-ink-200 cursor-pointer transition"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm text-ink-700 line-clamp-2 leading-relaxed">
            {truncated || <span className="text-ink-400">(空笔记)</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-ink-400">
            <span>{timeStr}</span>
            {note.category && <span>· {note.category.name}</span>}
            {note.isFavorite && <span>· ⭐</span>}
            {note.likeCount > 0 && <span>· ❤ {note.likeCount}</span>}
          </div>
        </div>
      </div>
    </li>
  );
}

/* ==================== 工具函数 ==================== */

function findCatById(cats: CatNode[], id: string): CatNode | null {
  for (const c of cats) {
    if (c.id === id) return c;
    if (c.children.length > 0) {
      const found = findCatById(c.children, id);
      if (found) return found;
    }
  }
  return null;
}

function findFirstWithNotes(cats: CatNode[]): CatNode | null {
  for (const c of cats) {
    if (c.isParent && c.children.length > 0) {
      const found = findFirstWithNotes(c.children);
      if (found) return found;
    }
    if (c.noteCount > 0) return c;
  }
  return cats[0] || null;
}

function getAllParentIds(cats: CatNode[]): Set<string> {
  const result = new Set<string>();
  function walk(list: CatNode[]) {
    for (const c of list) {
      if (c.isParent) result.add(c.id);
      walk(c.children);
    }
  }
  walk(cats);
  return result;
}

function countAllDescendants(cat: CatNode): number {
  let count = 0;
  function walk(c: CatNode) {
    count++;
    for (const child of c.children) walk(child);
  }
  walk(cat);
  return count - 1; // 去掉自己
}

function sumDescendantNotes(cat: CatNode): number {
  let sum = cat.noteCount;
  for (const child of cat.children) {
    sum += sumDescendantNotes(child);
  }
  return sum;
}
