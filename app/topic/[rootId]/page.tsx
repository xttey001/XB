'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ChevronRight, ChevronDown, GitBranch, MinusCircle, Bookmark, Sparkles } from 'lucide-react';
import { api, type TopicTreeNode } from '@/lib/api';

interface PageProps {
  params: { rootId: string };
}

export default function TopicPage({ params }: PageProps) {
  const router = useRouter();
  const { rootId } = params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tree, setTree] = useState<TopicTreeNode | null>(null);
  const [stats, setStats] = useState<{ totalNodes: number; totalManualLinks: number } | null>(null);

  const [depth, setDepth] = useState(2);
  const [direction, setDirection] = useState<'outgoing' | 'incoming' | 'both'>('outgoing');
  const [expanded, setExpanded] = useState<Set<string>>(new Set([rootId]));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTopicTree(rootId, { depth, direction });
      setTree(res.tree);
      setStats(res.stats);
      // 默认展开根节点
      setExpanded(new Set([rootId]));
    } catch (e: any) {
      setError(e.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [rootId, depth, direction]);

  useEffect(() => { load(); }, [load]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const walk = (n: TopicTreeNode) => {
      all.add(n.id);
      n.links.forEach(walk);
    };
    if (tree) walk(tree);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set([rootId]));

  if (loading) {
    return (
      <div className="min-h-screen bg-ink-50">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-ink-200">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
            <button onClick={() => router.push('/')} className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm text-ink-600 hover:bg-ink-100">
              <ArrowLeft size={14} />返回
            </button>
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-accent-500" />
              <span className="font-semibold">主题树</span>
            </div>
          </div>
        </header>
        <div className="flex items-center justify-center py-20 text-ink-400">
          <Loader2 className="animate-spin" size={18} />
        </div>
      </div>
    );
  }

  if (error || !tree) {
    return (
      <div className="min-h-screen bg-ink-50 flex flex-col items-center justify-center text-ink-500">
        <p className="mb-4">{error || '加载失败'}</p>
        <button onClick={load} className="text-sm text-accent-600">重试</button>
      </div>
    );
  }

  const hasLinks = tree.links.length > 0;

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-ink-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.push('/ai');
            }}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm text-ink-600 hover:bg-ink-100"
          >
            <ArrowLeft size={14} />
            返回
          </button>

          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-accent-500" />
            <span className="font-semibold">主题树</span>
          </div>

          {stats && (
            <div className="text-xs text-ink-500">
              {stats.totalNodes} 个笔记 · {stats.totalManualLinks} 条手动链接
            </div>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-2 text-xs">
            <span className="text-ink-500">深度</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`w-7 h-7 rounded transition ${
                    depth === d ? 'bg-accent-500 text-white' : 'text-ink-500 hover:bg-ink-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
            <span className="text-ink-500 ml-3">方向</span>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
              className="text-xs border border-ink-200 rounded px-2 py-1 bg-white"
            >
              <option value="outgoing">向下游</option>
              <option value="incoming">向上游</option>
              <option value="both">双向</option>
            </select>
            <button onClick={expandAll} className="text-accent-600 hover:text-accent-700 ml-2">全部展开</button>
            <button onClick={collapseAll} className="text-ink-400 hover:text-ink-600">全部折叠</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 空状态提示 */}
        {!hasLinks && (
          <div className="bg-white rounded-xl border border-ink-200 p-6 text-center">
            <div className="mb-3">
              <GitBranch size={32} className="mx-auto text-ink-300" />
            </div>
            <h3 className="text-ink-700 font-medium mb-2">这条笔记还没有手动链接到其他笔记</h3>
            <p className="text-sm text-ink-500 mb-4">
              主题树只展示你在编辑器里手动插入的链接（格式：<code className="text-xs bg-ink-100 px-1 rounded">{'<a href="/note/xxx">'}</code>）。
              没有自动推断的连接。
            </p>
            <p className="text-sm text-ink-400 mb-4">
              想看一个有连接的真实例子？试试：
              <button
                onClick={() => router.push('/topic/cmsu9ma0x00055vat55e64swv')}
                className="ml-1 text-accent-600 hover:text-accent-700 underline"
              >
                思维模型汇总
              </button>
            </p>
          </div>
        )}

        {/* 真正的树 */}
        {hasLinks && (
          <div className="bg-white rounded-xl border border-ink-200 p-4">
            <TreeNodeView
              node={tree}
              depth={0}
              isRoot={true}
              expanded={expanded}
              onToggle={toggle}
              onNavigate={(id) => router.push(`/note/${id}`)}
            />
          </div>
        )}
      </main>
    </div>
  );
}

/* ---------- 树节点 ---------- */

function TreeNodeView({
  node,
  depth,
  isRoot,
  isLastChild,
  siblingsCount,
  expanded,
  onToggle,
  onNavigate,
}: {
  node: TopicTreeNode;
  depth: number;
  isRoot?: boolean;
  isLastChild?: boolean;
  siblingsCount?: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const hasChildren = node.links.length > 0;
  const isOpen = expanded.has(node.id);

  return (
    <div className="relative">
      {/* 节点行 */}
      <div
        className={`group flex items-start gap-1 py-2 pr-2 rounded-lg hover:bg-ink-50 cursor-pointer transition-colors ${
          isRoot ? 'bg-accent-50 border border-accent-200 hover:bg-accent-50' : ''
        }`}
        style={{ paddingLeft: `${depth * 28}px` }}
        onClick={() => onNavigate(node.id)}
      >
        {/* 树形连接线区域（depth 0 根节点不画） */}
        {!isRoot && (
          <div className="w-6 h-5 flex items-center justify-center flex-shrink-0 relative">
            {/* 水平线（从垂直线到节点） */}
            <div className="absolute left-0 top-1/2 w-4 border-t border-ink-300" />
            {/* 连接点（小圆点） */}
            <div className="absolute left-[14px] top-1/2 w-1.5 h-1.5 -translate-y-1/2 rounded-full bg-ink-300 group-hover:bg-accent-500" />
          </div>
        )}

        {/* 展开/折叠按钮 */}
        <button
          className="mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0 text-ink-400 hover:text-accent-500"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.id);
          }}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
            <MinusCircle size={8} className="text-ink-200" />
          )}
        </button>

        {/* 节点主体 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm leading-relaxed line-clamp-2 ${isRoot ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
              {node.summary || '(空笔记)'}
            </span>
            {isRoot && (
              <span className="text-[10px] bg-accent-500 text-white px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                ROOT
              </span>
            )}
            {node.importance === 'very_important' && (
              <span className="text-[10px] text-red-500 font-semibold flex-shrink-0">● 极重要</span>
            )}
            {node.importance === 'important' && (
              <span className="text-[10px] text-blue-500 font-semibold flex-shrink-0">● 重要</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-400">
            {node.categoryName && (
              <span className="inline-flex items-center gap-0.5">
                <Bookmark size={10} />
                {node.categoryName}
              </span>
            )}
            {node.tags.slice(0, 2).map((t) => (
              <span key={t} className="bg-ink-100 text-ink-500 px-1 rounded">#{t}</span>
            ))}
            {node.tags.length > 2 && (
              <span className="text-ink-400">+{node.tags.length - 2}</span>
            )}
            {hasChildren && (
              <span className="ml-auto inline-flex items-center gap-0.5 text-accent-500">
                <Sparkles size={10} />
                {node.links.length} 子
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 子节点 + 垂直连接线 */}
      {hasChildren && isOpen && (
        <div>
          {/* 贯穿所有子节点的垂直线（画在兄弟层的 depth 上） */}
          {node.links.length > 0 && (
            <div
              className="absolute border-l border-ink-200"
              style={{
                left: `${depth * 28 + 24}px`,
                top: `${28 /* 根节点高度近似 */}px`,
                bottom: `${node.links[node.links.length - 1]?.links.length &&
                node.links[node.links.length - 1].links.length > 0
                  ? 16
                  : 2}px`,
              }}
            />
          )}

          {node.links.map((child, idx) => (
            <TreeNodeView
              key={child.id}
              node={child}
              depth={depth + 1}
              isLastChild={idx === node.links.length - 1}
              siblingsCount={node.links.length}
              expanded={expanded}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
