'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Bookmark,
  Sparkles,
  Check,
  Folder,
  FolderOpen,
  Layers,
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
  areaProgressStatus: string; // Area 自己的手动掌握标记
  totalNotes: number;
  totalCategories: number;
  totalLeaves: number;
  progressPct: number; // 自动汇总 + 手动覆盖
  masteredCount: number;
  canUseCount: number;
  awareCount: number;
  unknownCount: number;
  categories: CatNode[];
};

/* ==================== 主页面 ==================== */

export default function KnowledgePage() {
  const router = useRouter();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  // 哪些 Area 展开了
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  // 哪些子分类展开了
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  // 重构弹框
  const [reparentTarget, setReparentTarget] = useState<{ cat: CatNode; area: Area } | null>(null);
  // AI 子分类建议
  const [clusterSuggestions, setClusterSuggestions] = useState<{ areaId: string; suggestions: Array<{ subAreaName: string; memberIds: string[]; rationale: string }> } | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/knowledge/areas');
      const d = await r.json();
      setAreas(d.areas || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-400">
        <Loader2 className="animate-spin" size={20} />
      </div>
    );
  }

  const toggleArea = (id: string) =>
    setExpandedAreas((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  const toggleParent = (id: string) =>
    setExpandedParents((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const updateAreaStatus = async (areaId: string, status: string) => {
    await fetch(`/api/knowledge/areas/${areaId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressStatus: status }),
    });
    refresh();
  };

  const updateCatStatus = async (catId: string, status: string) => {
    await fetch(`/api/knowledge/categories/${catId}/progress`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progressStatus: status }),
    });
    refresh();
  };

  const askCluster = async (areaId: string) => {
    const r = await fetch('/api/knowledge/cluster-subareas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ areaId }),
    });
    const d = await r.json();
    setClusterSuggestions({ areaId, suggestions: d.suggestions || [] });
  };

  const applyClusters = async () => {
    if (!clusterSuggestions) return;
    await fetch('/api/knowledge/cluster-subareas/apply', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        areaId: clusterSuggestions.areaId,
        suggestions: clusterSuggestions.suggestions,
      }),
    });
    setClusterSuggestions(null);
    refresh();
  };

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-ink-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm text-ink-600 hover:bg-ink-100"
          >
            <ArrowLeft size={14} />返回
          </button>
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-accent-500" />
            <span className="font-semibold">我的知识层级</span>
          </div>
          <div className="text-xs text-ink-500">
            {areas.length} 个主干 · {areas.reduce((s, a) => s + a.totalCategories, 0)} 个分类 ·{' '}
            {areas.reduce((s, a) => s + a.totalNotes, 0)} 条笔记
          </div>
          <div className="flex-1" />
          <button
            onClick={() => router.push('/ai')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-purple-600 hover:bg-purple-50 transition"
          >
            <Sparkles size={14} />
            管理主干
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {areas.length === 0 ? (
          <div className="bg-white rounded-xl border border-ink-200 p-12 text-center">
            <h3 className="font-medium text-ink-700 mb-2">还没有知识层级</h3>
            <p className="text-sm text-ink-500 mb-4">去「AI 知识」里创建主干</p>
            <button
              onClick={() => router.push('/ai')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded-md hover:bg-accent-600 text-sm"
            >
              <Sparkles size={14} />去 AI 工作台
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map((area) => (
              <AreaCard
                key={area.id}
                area={area}
                expanded={expandedAreas.has(area.id)}
                expandedParents={expandedParents}
                onToggle={() => toggleArea(area.id)}
                onToggleParent={toggleParent}
                onUpdateAreaStatus={(s) => updateAreaStatus(area.id, s)}
                onUpdateCatStatus={updateCatStatus}
                onReparent={(cat) => setReparentTarget({ cat, area })}
                onAskCluster={() => askCluster(area.id)}
                onEnter={() => router.push(`/knowledge/areas/${area.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* 重构弹框 */}
      {reparentTarget && (
        <ReparentModal
          cat={reparentTarget.cat}
          area={reparentTarget.area}
          allAreas={areas}
          onClose={() => setReparentTarget(null)}
          onDone={() => {
            setReparentTarget(null);
            refresh();
          }}
        />
      )}

      {/* AI 子分类弹框 */}
      {clusterSuggestions && (
        <ClusterModal
          suggestions={clusterSuggestions.suggestions}
          onClose={() => setClusterSuggestions(null)}
          onApply={applyClusters}
        />
      )}
    </div>
  );
}

/* ==================== Area 卡片 ==================== */

function AreaCard({
  area,
  expanded,
  expandedParents,
  onToggle,
  onToggleParent,
  onUpdateAreaStatus,
  onUpdateCatStatus,
  onReparent,
  onAskCluster,
  onEnter,
}: {
  area: Area;
  expanded: boolean;
  expandedParents: Set<string>;
  onToggle: () => void;
  onToggleParent: (id: string) => void;
  onUpdateAreaStatus: (s: string) => void;
  onUpdateCatStatus: (catId: string, s: string) => void;
  onReparent: (cat: CatNode) => void;
  onAskCluster: () => void;
  onEnter: () => void;
}) {
  const areaSt = STATUS_LABELS[area.areaProgressStatus];
  const autoSummary =
    area.masteredCount + area.canUseCount + area.awareCount + area.unknownCount > 0
      ? `精通 ${area.masteredCount} · 会用 ${area.canUseCount} · 了解 ${area.awareCount}`
      : '';

  return (
    <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
      {/* Area header */}
      <div className="p-4 pb-3">
        <div className="flex items-start gap-3">
          <button
            onClick={onEnter}
            className="w-full text-left flex items-start gap-3 group cursor-pointer"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0 transition group-hover:scale-105"
              style={{ backgroundColor: `${area.color}15`, color: area.color }}
            >
              {area.icon || '📂'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-ink-800 truncate group-hover:text-accent-600">
                  {area.name}
                </h3>
                <span className="text-[10px] text-ink-400">{area.totalLeaves} 项内容</span>
              </div>
              {area.description && (
                <p className="text-xs text-ink-500 mt-0.5 line-clamp-1">{area.description}</p>
              )}
            </div>
          </button>
          <button
            onClick={onAskCluster}
            title="AI 自动聚成子分类"
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-purple-50 text-purple-500 flex-shrink-0"
          >
            <Layers size={14} />
          </button>
        </div>

        {/* 进度条 + 百分比 */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${area.progressPct}%`, backgroundColor: area.color }}
            />
          </div>
          <span className="text-[11px] font-medium text-ink-500 w-8 text-right">{area.progressPct}%</span>
        </div>

        {/* 掌握程度按钮（Area 自己的手动标记） */}
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-ink-400 mr-1">主干掌握:</span>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <button
              key={k}
              onClick={() => onUpdateAreaStatus(k)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition ${
                area.areaProgressStatus === k
                  ? `${v.color} ring-1 ring-current`
                  : 'bg-ink-50 text-ink-500 hover:bg-ink-100'
              }`}
            >
              {area.areaProgressStatus === k && <Check size={8} className="inline mr-0.5" />}
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* 展开按钮 */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 border-t border-ink-100 text-xs text-ink-500 hover:bg-ink-50"
      >
        <span>
          {area.categories.length} 个分类组 · {autoSummary || '暂无数据'}
        </span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* 分类树 */}
      {expanded && (
        <div className="border-t border-ink-100">
          {area.categories.length === 0 ? (
            <div className="p-6 text-sm text-ink-400 text-center">
              还没有分类挂到这个主干下<br />
              <span className="text-xs">点右上角 Layers 让 AI 帮你聚子分类</span>
            </div>
          ) : (
            area.categories.map((cat) => (
              <CatRow
                key={cat.id}
                cat={cat}
                areaColor={area.color}
                depth={0}
                expandedParents={expandedParents}
                onToggleParent={onToggleParent}
                onUpdateStatus={onUpdateCatStatus}
                onReparent={onReparent}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ==================== 分类行（递归两层） ==================== */

function CatRow({
  cat,
  areaColor,
  depth,
  expandedParents,
  onToggleParent,
  onUpdateStatus,
  onReparent,
}: {
  cat: CatNode;
  areaColor: string;
  depth: number; // 0 = 顶层, 1 = 叶子
  expandedParents: Set<string>;
  onToggleParent: (id: string) => void;
  onUpdateStatus: (catId: string, s: string) => void;
  onReparent: (cat: CatNode) => void;
}) {
  const isOpen = expandedParents.has(cat.id);
  const st = STATUS_LABELS[cat.progressStatus];
  const hasChildren = cat.isParent && cat.children.length > 0;

  return (
    <div className="divide-y divide-ink-100">
      <div className="group flex items-center gap-2 px-4 py-2 hover:bg-ink-50 transition">
        {/* 缩进 */}
        <div style={{ width: depth * 16 }} />

        {/* 展开箭头（只有父分类才显示） */}
        {hasChildren ? (
          <button
            onClick={() => onToggleParent(cat.id)}
            className="w-4 h-4 flex items-center justify-center text-ink-400 flex-shrink-0"
          >
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span className="w-4 h-4 flex items-center justify-center flex-shrink-0">
            {depth === 0 && !hasChildren ? <span className="w-2 h-0.5 bg-ink-200" /> : null}
          </span>
        )}

        {/* 图标 */}
        {hasChildren ? (
          isOpen ? (
            <FolderOpen size={13} style={{ color: areaColor }} className="flex-shrink-0" />
          ) : (
            <Folder size={13} style={{ color: areaColor }} className="flex-shrink-0" />
          )
        ) : (
          <Bookmark size={12} className="text-ink-300 flex-shrink-0" />
        )}

        {/* 名称 */}
        <span className="text-sm text-ink-700 flex-1 truncate">{cat.name}</span>

        {/* 子分类进度条 */}
        {hasChildren && (
          <div className="w-16 h-1 bg-ink-100 rounded-full overflow-hidden flex-shrink-0">
            <div
              className="h-full rounded-full"
              style={{ width: `${cat.progressPct}%`, backgroundColor: areaColor }}
            />
          </div>
        )}

        {/* 笔记数 */}
        <span className="text-[10px] text-ink-400 w-6 text-right flex-shrink-0">{cat.noteCount}</span>

        {/* 掌握程度（只有叶子或无子分类的顶层才显示按钮） */}
        {!hasChildren && (
          <StatusButtons
            current={cat.progressStatus}
            color={areaColor}
            onChange={(s) => onUpdateStatus(cat.id, s)}
          />
        )}

        {/* 重构按钮（hover 显示） */}
        <button
          onClick={() => onReparent(cat)}
          title="移动到其他父分类"
          className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-ink-400 hover:text-ink-600 flex-shrink-0 transition"
        >
          ↕
        </button>
      </div>

      {/* 子分类 children */}
      {hasChildren && isOpen && (
        <div>
          {cat.children.map((child) => (
            <CatRow
              key={child.id}
              cat={child}
              areaColor={areaColor}
              depth={1}
              expandedParents={expandedParents}
              onToggleParent={onToggleParent}
              onUpdateStatus={onUpdateStatus}
              onReparent={onReparent}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== 掌握程度按钮组 ==================== */

function StatusButtons({
  current,
  color,
  onChange,
}: {
  current: string;
  color: string;
  onChange: (s: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      {Object.entries(STATUS_LABELS).map(([k, v]) => {
        const active = current === k;
        return (
          <button
            key={k}
            onClick={() => onChange(k)}
            title={v.label}
            className={`w-4 h-4 rounded-full text-[8px] flex items-center justify-center transition ${
              active ? '' : 'bg-ink-50 hover:bg-ink-100'
            }`}
            style={active ? { backgroundColor: color, color: '#fff' } : {}}
          >
            {active && <Check size={8} />}
          </button>
        );
      })}
    </div>
  );
}

/* ==================== 重构弹框 ==================== */

function ReparentModal({
  cat,
  area,
  allAreas,
  onClose,
  onDone,
}: {
  cat: CatNode;
  area: Area;
  allAreas: Area[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [selectedArea, setSelectedArea] = useState(area.id);
  const [selectedParent, setSelectedParent] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 可用的父分类：目标 Area 下的顶层分类（排除自己和自己的 children）
  const targetArea = allAreas.find((a) => a.id === selectedArea);
  const possibleParents =
    targetArea?.categories.filter((c) => c.id !== cat.id && c.id !== cat.id && !isDescendant(cat, cat.id)) || [];

  const submit = async () => {
    setSubmitting(true);
    await fetch(`/api/knowledge/categories/${cat.id}/reparent`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentId: selectedParent,
        knowledgeAreaId: selectedArea,
      }),
    });
    setSubmitting(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-ink-800 mb-1">重构分类: {cat.name}</h3>
        <p className="text-xs text-ink-500 mb-4">把它移动到其他父分类或主干下</p>

        {/* 目标主干 */}
        <div className="mb-3">
          <div className="text-xs text-ink-500 mb-1">移动到主干</div>
          <select
            value={selectedArea}
            onChange={(e) => {
              setSelectedArea(e.target.value);
              setSelectedParent(null);
            }}
            className="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-md"
          >
            {allAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.icon} {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* 目标父分类 */}
        <div className="mb-4">
          <div className="text-xs text-ink-500 mb-1">父分类（可留空 = 作为顶层）</div>
          <select
            value={selectedParent || ''}
            onChange={(e) => setSelectedParent(e.target.value || null)}
            className="w-full px-2 py-1.5 text-sm border border-ink-200 rounded-md"
          >
            <option value="">— 无，作为顶层分类 —</option>
            {possibleParents.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.isParent ? `(已有 ${c.children.length} 个子分类)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-ink-500 hover:bg-ink-50 rounded-md"
          >
            取消
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="px-3 py-1.5 text-sm bg-accent-500 text-white rounded-md hover:bg-accent-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
            移动
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== AI 子分类弹框 ==================== */

function ClusterModal({
  suggestions,
  onClose,
  onApply,
}: {
  suggestions: Array<{ subAreaName: string; memberIds: string[]; rationale: string }>;
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-ink-800 mb-1">AI 建议的子分类</h3>
        <p className="text-xs text-ink-500 mb-4">以下是建议的分组，点"应用"后会自动创建子分类并把叶子挂进去</p>

        {suggestions.length === 0 ? (
          <div className="text-center py-8 text-sm text-ink-400">
            暂不需要子分类（当前分类数太少或 AI 没识别出有效分组）
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {suggestions.map((s, i) => (
              <div key={i} className="border border-ink-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Folder size={13} className="text-accent-500" />
                  <span className="font-medium text-sm text-ink-800">{s.subAreaName}</span>
                  <span className="text-[10px] text-ink-400">({s.memberIds.length} 项)</span>
                </div>
                <p className="text-[11px] text-ink-500">💡 {s.rationale}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-ink-500 hover:bg-ink-50 rounded-md"
          >
            关闭
          </button>
          {suggestions.length > 0 && (
            <button
              onClick={onApply}
              className="px-3 py-1.5 text-sm bg-purple-500 text-white rounded-md hover:bg-purple-600"
            >
              应用这些分组
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== 工具函数 ==================== */

function isDescendant(cat: CatNode, targetId: string): boolean {
  if (cat.id === targetId) return true;
  for (const child of cat.children) {
    if (isDescendant(child, targetId)) return true;
  }
  return false;
}
