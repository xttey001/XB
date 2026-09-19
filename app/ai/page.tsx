'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Database,
  GitBranch,
  Sparkles,
  Check,
  X,
  Play,
  Map,
  TreeDeciduous,
} from 'lucide-react';
import { llmAvailable } from '@/lib/llm';

interface Stats {
  llmAvailable: boolean;
  stats: {
    totalNotes: number;
    totalEntities: number;
    totalManualLinks: number;
    totalSuggestedLinks: number;
    totalAiAcceptedLinks: number;
    notesToProcess: number;
  };
}

interface SuggestedLink {
  id: string;
  sourceId: string;
  targetId: string;
  linkType: string | null;
  confidence: number | null;
  sourceSummary: string;
  targetSummary: string;
  createdAt: string;
}

interface EntityCount {
  id: string;
  name: string;
  noteCount: number;
  entityType: string | null;
}

interface KnowledgeMap {
  id: string;
  title: string;
  description: string | null;
  scopeType: string;
  createdAt: string;
}

export default function AIWorkbenchPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'extract' | 'topics' | 'links' | 'entities' | 'maps'>('extract');

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-ink-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm text-ink-600 hover:bg-ink-100"
          >
            <ArrowLeft size={14} />返回
          </button>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent-500" />
            <span className="font-semibold">AI 知识工作台</span>
          </div>
          <div className="flex-1" />
          <LLMStatusBadge />
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 flex gap-1">
          {[
            { k: 'extract', icon: <Database size={14} />, label: '实体抽取' },
            { k: 'topics', icon: <TreeDeciduous size={14} />, label: '主题树快选' },
            { k: 'links', icon: <GitBranch size={14} />, label: '链接审核' },
            { k: 'entities', icon: <Sparkles size={14} />, label: '实体词典' },
            { k: 'maps', icon: <Map size={14} />, label: '知识地图' },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k as any)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition ${
                tab === t.k
                  ? 'border-accent-500 text-accent-600'
                  : 'border-transparent text-ink-500 hover:text-ink-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {tab === 'extract' && <ExtractPanel />}
        {tab === 'topics' && <TopicsPanel />}
        {tab === 'links' && <LinksPanel />}
        {tab === 'entities' && <EntitiesPanel />}
        {tab === 'maps' && <MapsPanel />}
      </main>
    </div>
  );
}

/* ---------- LLM 状态 ---------- */
function LLMStatusBadge() {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    // 简单 ping 一下 batch-extract 的 GET 端点
    fetch('/api/ai/batch-extract')
      .then((r) => r.json())
      .then((d: Stats) => setAvailable(d.llmAvailable));
  }, []);

  if (available === null) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded ${
        available ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
      }`}
      title={
        available
          ? '已配置 LLM API Key，抽取质量更高'
          : '未配置 LLM API Key，使用确定性兜底策略（基于 tags/引号/行首关键词）'
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full ${available ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {available ? 'LLM 在线' : '无 LLM（兜底）'}
    </span>
  );
}

/* ---------- 主题树快选 Tab ---------- */

interface TopicSeed {
  id: string;
  summary: string;
  categoryName: string | null;
  importance: string | null;
  isFavorite: boolean;
  tags: string[];
  inCount: number;
  outCount: number;
  totalCount: number;
}

function TopicsPanel() {
  const router = useRouter();
  const [seeds, setSeeds] = useState<TopicSeed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai/topic-seeds')
      .then((r) => r.json())
      .then((d) => {
        setSeeds(d.seeds || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center py-12 text-ink-400"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div>
      <div className="mb-4">
        <h3 className="font-semibold text-ink-800">主题树快选</h3>
        <p className="text-sm text-ink-500">
          以下 {seeds.length} 条笔记通过 AI 自动关联 + 手动链接形成了主题树。点击任意一条即可查看它的知识脉络。
        </p>
      </div>

      {seeds.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-200 p-12 text-center text-ink-400">
          还没有有主题树的笔记，先去"实体抽取"跑一次
        </div>
      ) : (
        <div className="space-y-2">
          {seeds.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/topic/${s.id}`)}
              className="w-full text-left bg-white rounded-lg border border-ink-200 p-3 hover:border-accent-400 hover:bg-accent-50/30 transition group"
            >
              <div className="flex items-start gap-3">
                {/* 链接数徽标 */}
                <div className="flex-shrink-0 w-14 text-center py-1.5 rounded bg-purple-50 border border-purple-200">
                  <div className="text-lg font-bold text-purple-600 leading-none">{s.totalCount}</div>
                  <div className="text-[9px] text-purple-500 mt-0.5">链接</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-800 line-clamp-2">{s.summary || '(空笔记)'}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
                    {s.categoryName && <span className="bg-ink-100 px-1.5 rounded">{s.categoryName}</span>}
                    <span className="text-emerald-600">← {s.inCount} 条指向它</span>
                    <span className="text-accent-600">→ {s.outCount} 条它指向</span>
                    {s.importance === 'very_important' && <span className="bg-red-100 text-red-600 px-1.5 rounded">极重要</span>}
                  </div>
                </div>
                <GitBranch size={14} className="text-ink-300 group-hover:text-accent-500 flex-shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 实体抽取 Tab ---------- */

function ExtractPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const refresh = () => {
    fetch('/api/ai/batch-extract')
      .then((r) => r.json())
      .then(setStats);
  };

  useEffect(() => { refresh(); }, []);

  const runExtract = async (onlyMissing: boolean) => {
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch('/api/ai/batch-extract' + (onlyMissing ? '?onlyMissing=true' : ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxNotes: 0 }),
      });
      const data = await r.json();
      setResult(data);
      refresh();
    } finally {
      setRunning(false);
    }
  };

  const runDiscoverLinks = async () => {
    setRunning(true);
    setResult(null);
    try {
      const r = await fetch('/api/ai/discover-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minSharedEntities: 2, maxPairs: 100 }),
      });
      const data = await r.json();
      setResult(data);
      refresh();
    } finally {
      setRunning(false);
    }
  };

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="笔记总数" value={stats.stats.totalNotes} />
        <StatCard label="实体词典" value={stats.stats.totalEntities} />
        <StatCard label="手动链接" value={stats.stats.totalManualLinks} accent="emerald" />
        <StatCard label="AI 已接受" value={stats.stats.totalAiAcceptedLinks} accent="purple" />
        <StatCard label="AI 建议链接" value={stats.stats.totalSuggestedLinks} accent="amber" />
      </div>

      {/* 操作卡片 */}
      <div className="bg-white rounded-xl border border-ink-200 p-5">
        <h3 className="font-semibold text-ink-800 mb-1">① 批量实体抽取</h3>
        <p className="text-sm text-ink-500 mb-4">
          从每条笔记中抽取核心概念/术语，写入全局实体词典。
          {stats.stats.notesToProcess > 0 ? (
            <>还有 <span className="text-accent-600 font-medium">{stats.stats.notesToProcess}</span> 条笔记未抽取。</>
          ) : (
            <>所有笔记都已抽过。</>
          )}
        </p>

        <div className="flex gap-2">
          <button
            onClick={() => runExtract(true)}
            disabled={running || stats.stats.notesToProcess === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            只处理 {stats.stats.notesToProcess} 条未抽取
          </button>
          <button
            onClick={() => runExtract(false)}
            disabled={running}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-ink-200 rounded text-sm text-ink-600 hover:bg-ink-50 disabled:opacity-50"
          >
            全部重新抽取
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-ink-200 p-5">
        <h3 className="font-semibold text-ink-800 mb-1">② 跨笔记关联发现</h3>
        <p className="text-sm text-ink-500 mb-4">
          基于共享实体找候选笔记对，自动判断它们之间是否存在可建立的 NoteLink。
          新发现的链接会以「AI 建议」状态存储，你可以在"链接审核"里批量接受或拒绝。
        </p>
        <button
          onClick={runDiscoverLinks}
          disabled={running || stats.stats.totalEntities === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 text-sm"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <GitBranch size={14} />}
          发现关联
        </button>
        {stats.stats.totalEntities === 0 && (
          <p className="text-xs text-amber-600 mt-2">需要先做实体抽取才能发现关联</p>
        )}
      </div>

      {/* 结果显示 */}
      {result && (
        <div className="bg-ink-50 rounded-lg p-4 text-sm">
          <h4 className="font-medium text-ink-700 mb-2">运行结果</h4>
          <pre className="text-ink-600 whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-ink-200 p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${accent ? colors[accent] : 'text-ink-800'}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

/* ---------- 链接审核 Tab ---------- */

function LinksPanel() {
  const [links, setLinks] = useState<SuggestedLink[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const r = await fetch('/api/ai/suggested-links');
    const d = await r.json();
    setLinks(d.links || []);
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === links.length) setSelected(new Set());
    else setSelected(new Set(links.map((l) => l.id)));
  };

  const doAction = async (action: 'accept' | 'reject') => {
    if (selected.size === 0) return;
    await fetch('/api/ai/suggested-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ids: Array.from(selected) }),
    });
    refresh();
  };

  if (loading) {
    return <div className="text-center py-12 text-ink-400"><Loader2 className="animate-spin mx-auto" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-ink-800">待审核 AI 建议链接</h3>
          <p className="text-sm text-ink-500">共 {links.length} 条建议，勾选后批量接受或拒绝</p>
        </div>
        {links.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => doAction('reject')}
              disabled={selected.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50 text-sm"
            >
              <X size={14} /> 拒绝 {selected.size > 0 && `(${selected.size})`}
            </button>
            <button
              onClick={() => doAction('accept')}
              disabled={selected.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded hover:bg-emerald-600 disabled:opacity-50 text-sm"
            >
              <Check size={14} /> 接受 {selected.size > 0 && `(${selected.size})`}
            </button>
          </div>
        )}
      </div>

      {links.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-200 p-12 text-center text-ink-400">
          没有待审核的 AI 建议链接
        </div>
      ) : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-ink-500 px-2">
            <input
              type="checkbox"
              checked={selected.size === links.length}
              onChange={toggleAll}
              className="accent-accent-500"
            />
            全选 ({selected.size}/{links.length})
          </label>
          {links.map((l) => (
            <SuggestionRow key={l.id} link={l} selected={selected.has(l.id)} onToggle={() => toggle(l.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({
  link,
  selected,
  onToggle,
}: {
  link: SuggestedLink;
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const confPct = Math.round((link.confidence || 0) * 100);

  return (
    <div
      className={`bg-white rounded-lg border p-3 transition ${
        selected ? 'border-accent-400 ring-1 ring-accent-200' : 'border-ink-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="mt-1 accent-accent-500" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="inline-block px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium"
              title="AI 建议的关系类型"
            >
              {link.linkType || 'relates'}
            </span>
            <span className="text-[11px] text-ink-400">置信度 {confPct}%</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <button
              onClick={() => router.push(`/note/${link.sourceId}`)}
              className="text-ink-700 hover:text-accent-600 text-left line-clamp-1 flex-1"
            >
              {link.sourceSummary || '(空)'}
            </button>
            <GitBranch size={14} className="mt-1 text-ink-300 flex-shrink-0" />
            <button
              onClick={() => router.push(`/note/${link.targetId}`)}
              className="text-ink-700 hover:text-accent-600 text-left line-clamp-1 flex-1"
            >
              {link.targetSummary || '(空)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 实体词典 Tab ---------- */

function EntitiesPanel() {
  const [entities, setEntities] = useState<EntityCount[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then((d) => setEntities(d.entities || []));
  }, []);

  const filtered = entities.filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-ink-800">全局实体词典</h3>
          <p className="text-sm text-ink-500">{entities.length} 个实体 · 点击查看引用它们的笔记</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜索实体名..."
          className="text-sm border border-ink-200 rounded px-3 py-1.5 bg-white focus:outline-none focus:border-accent-400"
        />
      </div>

      {entities.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-200 p-12 text-center text-ink-400">
          还没有实体，先去"实体抽取"跑一次
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {filtered.map((e) => (
            <div
              key={e.id}
              className="bg-white rounded-lg border border-ink-200 p-2.5 hover:border-accent-400 transition cursor-pointer group"
              title={e.entityType || ''}
            >
              <div className="text-sm font-medium text-ink-800 truncate group-hover:text-accent-600">
                {e.name}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-ink-400">{e.entityType || 'other'}</span>
                <span className="text-[10px] bg-accent-100 text-accent-600 px-1.5 rounded font-medium">
                  {e.noteCount} 条笔记
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 知识地图 Tab ---------- */

function MapsPanel() {
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [maps, setMaps] = useState<KnowledgeMap[]>([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [generating, setGenerating] = useState(false);
  const [lastMermaid, setLastMermaid] = useState<string | null>(null);

  const refresh = async () => {
    const [cats, kmaps] = await Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/ai/knowledge-maps/list').then((r) => r.json()).catch(() => ({ maps: [] })),
    ]);
    setCategories(cats.categories || []);
    setMaps(kmaps.maps || []);
  };

  useEffect(() => { refresh(); }, []);

  const generate = async () => {
    if (!selectedCat) return;
    setGenerating(true);
    setLastMermaid(null);
    try {
      const catName = categories.find((c) => c.id === selectedCat)?.name || '知识地图';
      const r = await fetch('/api/ai/knowledge-maps/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: selectedCat, title: `${catName} · 知识地图` }),
      });
      const d = await r.json();
      if (d.mermaid) setLastMermaid(d.mermaid);
      refresh();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-ink-200 p-5">
        <h3 className="font-semibold text-ink-800 mb-1">生成主题知识地图</h3>
        <p className="text-sm text-ink-500 mb-4">选择一个分类，自动把该分类下所有笔记聚合成一张 Mermaid 思维导图。</p>
        <div className="flex items-center gap-2">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="text-sm border border-ink-200 rounded px-3 py-1.5 bg-white focus:outline-none focus:border-accent-400"
          >
            <option value="">选择分类...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={!selectedCat || generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 disabled:opacity-50 text-sm"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Map size={14} />}
            生成地图
          </button>
        </div>
      </div>

      {lastMermaid && (
        <div className="bg-white rounded-xl border border-ink-200 p-5">
          <h4 className="font-medium text-ink-700 mb-2">最近生成的 Mermaid 代码</h4>
          <pre className="text-xs bg-ink-50 rounded p-3 overflow-x-auto text-ink-600">{lastMermaid}</pre>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-ink-800 mb-2">历史知识地图</h3>
        {maps.length === 0 ? (
          <p className="text-sm text-ink-400">还没有生成过</p>
        ) : (
          <div className="space-y-2">
            {maps.map((m) => (
              <div key={m.id} className="bg-white rounded-lg border border-ink-200 p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-ink-800">{m.title}</div>
                  <div className="text-xs text-ink-400">{new Date(m.createdAt).toLocaleString()}</div>
                </div>
                <span className="text-xs bg-accent-100 text-accent-600 px-2 py-0.5 rounded">{m.scopeType}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
