'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  PenLine,
  Loader2,
  Inbox,
  Upload,
  Pin,
  Sparkles,
  GitBranch,
} from 'lucide-react';
import { format, getYear, getMonth } from 'date-fns';
import { api, type SortBy, type Scope } from '@/lib/api';
import type { NoteDTO, CategoryDTO, DailyStatsDTO } from '@/lib/types';
import NoteEditor from '@/components/NoteEditor';
import NoteCard from '@/components/NoteCard';
import CategorySidebar from '@/components/CategorySidebar';
import SearchBar from '@/components/SearchBar';
import SortToggle from '@/components/SortToggle';
import ObsidianImportDialog from '@/components/ObsidianImportDialog';
import CalendarFilter, { type DateSelection } from '@/components/CalendarFilter';
import WorldClock from '@/components/WorldClock';
import ReminderWidget from '@/components/ReminderWidget';
import ReminderModal from '@/components/ReminderModal';
import NoteReviewReminder from '@/components/NoteReviewReminder';
import { useReminders } from '@/hooks/useReminders';

type Filter =
  | { type: 'all' }
  | { type: 'favorite' }
  | { type: 'important' }
  | { type: 'veryImportant' }
  | { type: 'liked' }
  | { type: 'reposted' }
  | { type: 'allPinned' }
  | { type: 'reviewed' }
  | { type: 'category'; id: string; label: string };

export default function HomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<NoteDTO[]>([]);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);

  // ===== Filter ↔ URL query 同步 =====
  const FILTER_PARAM_KEYS = new Set(['f', 'id']); // 只有这俩是 filter 控制的
  const parseFilterFromUrl = (sp: URLSearchParams): Filter => {
    const f = sp.get('f');
    const id = sp.get('id') || undefined;
    if (f === 'category' && id) return { type: 'category', id, label: '' };
    if (f === 'favorite') return { type: 'favorite' };
    if (f === 'important') return { type: 'important' };
    if (f === 'veryImportant') return { type: 'veryImportant' };
    if (f === 'liked') return { type: 'liked' };
    if (f === 'reposted') return { type: 'reposted' };
    if (f === 'allPinned') return { type: 'allPinned' };
    if (f === 'reviewed') return { type: 'reviewed' };
    return { type: 'all' };
  };

  /** 判断 filter 是否真的变了（用 URL 上的当前 filter 参数对比目标 filter） */
  const isFilterChanged = useCallback(
    (f: Filter, existingSp: URLSearchParams): boolean => {
      const oldF = existingSp.get('f');
      const oldId = existingSp.get('id');
      const newF =
        f.type === 'all'
          ? null
          : f.type === 'category'
          ? 'category'
          : f.type;
      const newId = f.type === 'category' ? f.id : null;
      return oldF !== newF || oldId !== newId;
    },
    []
  );

  /** 用 filter 值 + 当前 URL 上已有的非 filter 参数，构造新的 query string */
  const buildFilterUrl = useCallback(
    (f: Filter, existingSp: URLSearchParams, filterChanged: boolean): string => {
      const url = new URL(window.location.href);
      url.search = ''; // 清空

      // 保留非 filter 参数，但若 filter 变了 → 清掉 anchor（它绑定特定 filter）
      existingSp.forEach((v, k) => {
        if (FILTER_PARAM_KEYS.has(k)) return;
        if (k === 'anchor' && filterChanged) return;
        url.searchParams.set(k, v);
      });

      // 写 filter 参数
      if (f.type !== 'all') {
        if (f.type === 'category') {
          url.searchParams.set('f', 'category');
          url.searchParams.set('id', f.id);
        } else {
          url.searchParams.set('f', f.type);
        }
      }
      const qs = url.searchParams.toString();
      return qs ? `?${qs}` : '';
    },
    []
  );

  const [filter, setFilter] = useState<Filter>(() => parseFilterFromUrl(searchParams));
  const urlSyncingRef = useRef(false); // 防止自己写 URL 又触发自己 setState

  // filter 变化 → 写 URL（保留 anchor 等非 filter 参数）
  useEffect(() => {
    const filterChanged = isFilterChanged(filter, searchParams);
    const expected = buildFilterUrl(filter, searchParams, filterChanged);
    const actual = searchParams.toString() ? `?${searchParams.toString()}` : '';
    if (expected !== actual) {
      urlSyncingRef.current = true;
      router.replace(expected, { scroll: false });
      // 手动切分类（不是浏览器 back/forward）→ 显式重置滚动
      // 因为我们传了 scroll: false，Next.js 不会帮我们滚
      if (filterChanged) {
        requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      }
    } else {
      urlSyncingRef.current = false;
    }
  }, [filter, router, searchParams, buildFilterUrl, isFilterChanged]);

  // URL 变化 → 读 filter（浏览器前进/后退）
  useEffect(() => {
    if (urlSyncingRef.current) return; // 自己刚写的，跳过
    const next = parseFilterFromUrl(searchParams);
    setFilter((prev) => {
      // 深比较，避免无意义更新
      if (prev.type !== next.type) return next;
      if (prev.type === 'category' && next.type === 'category') {
        if (prev.id !== next.id) return next;
      }
      return prev;
    });
  }, [searchParams]);

  // categories 加载完后，补全 category filter 的 label
  useEffect(() => {
    setFilter((prev) => {
      if (prev.type === 'category' && prev.id && (!prev.label || prev.label === '')) {
        const cat = categories.find((c) => c.id === prev.id);
        if (cat) return { ...prev, label: cat.name };
      }
      return prev;
    });
  }, [categories]);
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateSelection>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [dailyStats, setDailyStats] = useState<DailyStatsDTO[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);

  // ===== Anchor 恢复：URL 带 anchor=noteId 时，加载完滚到那个卡片 =====
  // 这是"从详情页返回"的核心机制：详情页返回时，浏览器 history 栈里的主页 URL
  // 会带着 anchor 参数（NoteCard 点击进详情前用 replaceState 写入的）
  const loadingPrevRef = useRef(true);
  const anchorConsumedRef = useRef<string | null>(null); // 避免同一 anchor 被重复消费

  useEffect(() => {
    if (loadingPrevRef.current && !loading) {
      const anchor = searchParams.get('anchor');
      if (anchor && anchor !== anchorConsumedRef.current) {
        anchorConsumedRef.current = anchor;
        requestAnimationFrame(() => {
          const el = document.getElementById(`note-${anchor}`);
          if (el) {
            el.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
          // 消费完清掉 URL 里的 anchor，避免刷新又滚
          const url = new URL(window.location.href);
          url.searchParams.delete('anchor');
          window.history.replaceState(null, '', url.toString());
        });
      }
    }
    loadingPrevRef.current = loading;
  }, [loading, searchParams]);

  const {
    reminders,
    dueReminders,
    showModal: showReminderModal,
    closeModal: closeReminderModal,
    completeReminder,
    snoozeReminder,
    dismissReminder,
    addReminder,
    removeReminder,
    refresh: refreshReminders,

    reviewNotes,
    showReviewModal,
    closeReviewModal,
    markNoteReviewed,
    reviewAllNotes,
    snoozeReviewNotes,
  } = useReminders();

  // 当前 scope，用于 API 调用和 reorder
  const currentScope: Scope =
    filter.type === 'favorite'
      ? 'favorite'
      : filter.type === 'important'
      ? 'important'
      : filter.type === 'veryImportant'
      ? 'veryImportant'
      : filter.type === 'category'
      ? 'category'
      : filter.type === 'liked'
      ? 'liked'
      : filter.type === 'reposted'
      ? 'reposted'
      : filter.type === 'allPinned'
      ? 'allPinned'
      : filter.type === 'reviewed'
      ? 'reviewed'
      : 'all';

  // 重要/极重要筛选：按视图分别筛选，不再合并
  const importanceFilter =
    filter.type === 'important'
      ? 'important'
      : filter.type === 'veryImportant'
      ? 'very_important'
      : undefined;

  const loadCategories = useCallback(async () => {
    try {
      const { categories: cats } = await api.listCategories();
      setCategories(cats);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadNotes = useCallback(
    async (append = false, currentOffset = 0) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params: Parameters<typeof api.listNotes>[0] = {
          sortBy,
          scope: currentScope,
          withSocial: true,
          limit: 20,
          offset: currentOffset,
        };
        if (filter.type === 'favorite') params.favorite = true;
        if (filter.type === 'important' || filter.type === 'veryImportant') params.importance = importanceFilter;
        if (filter.type === 'liked') params.liked = true;
        if (filter.type === 'reposted') params.reposted = true;
        if (filter.type === 'category') { params.categoryId = filter.id; params.includeDescendants = true; }
        if (dateFilter?.type === 'single') {
          params.startDate = dateFilter.date;
          params.endDate = dateFilter.date;
        }
        if (dateFilter?.type === 'range') {
          params.startDate = dateFilter.start;
          params.endDate = dateFilter.end;
        }
        const { notes, total, hasMore } = await api.listNotes(params);
        setTotal(total);
        setHasMore(hasMore);
        setNotes((prev) => (append ? [...prev, ...notes] : notes));
      } catch (e) {
        console.error(e);
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [filter, sortBy, currentScope, importanceFilter, dateFilter]
  );

  const loadDailyStats = useCallback(async () => {
    try {
      const params: Parameters<typeof api.getDailyStats>[0] = {
        year: getYear(calendarMonth),
        month: getMonth(calendarMonth) + 1,
        scope: currentScope,
      };
      if (filter.type === 'category') params.categoryId = filter.id;
      const { stats } = await api.getDailyStats(params);
      setDailyStats(stats);
    } catch (e) {
      console.error(e);
    }
  }, [calendarMonth, currentScope, filter]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // 筛选/排序/日期变化时重置分页并加载
  useEffect(() => {
    setOffset(0);
    loadNotes(false, 0);
  }, [loadNotes]);

  // 日历月份或筛选变化时加载每日统计
  useEffect(() => {
    loadDailyStats();
  }, [loadDailyStats]);

  const handleNoteCreated = (note: NoteDTO) => {
    setNotes((prev) => [note, ...prev]);
    loadCategories();
    setSidebarRefreshKey((k) => k + 1);
  };

  const handleNoteUpdated = (note: NoteDTO) => {
    setNotes((prev) => {
      const updated = prev.map((n) => (n.id === note.id ? note : n));
      
      // allPinned 视图中，按 globalPinOrder 降序 + createdAt 降序重新排序
      if (currentScope === 'allPinned') {
        return updated.sort((a, b) => {
          // globalPinOrder 降序（置顶到顶部的排最前）
          if (b.globalPinOrder !== a.globalPinOrder) {
            return b.globalPinOrder - a.globalPinOrder;
          }
          // createdAt 降序（最新创建的排最前）
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }

      // reviewed 视图：按 reviewAt 升序（最紧急的排最前）
      if (currentScope === 'reviewed') {
        return updated.sort((a, b) => {
          const aAt = a.reviewAt ? new Date(a.reviewAt).getTime() : Infinity;
          const bAt = b.reviewAt ? new Date(b.reviewAt).getTime() : Infinity;
          return aAt - bAt;
        });
      }
      
      // 其他视图：按 API 相同的排序规则实时排序
      // 1. 先按对应置顶字段降序
      // 2. 再按对应 pinOrder 降序
      // 3. 最后按对应 order 或 createdAt 降序
      const pinnedFieldMap: Record<string, keyof NoteDTO> = {
        all: 'pinnedGlobal',
        favorite: 'pinnedFavorite',
        important: 'pinnedImportant',
        veryImportant: 'pinnedVeryImportant',
        category: 'pinnedCategory',
        liked: 'pinnedLiked',
        reposted: 'pinnedReposted',
      };
      const pinOrderFieldMap: Record<string, keyof NoteDTO> = {
        all: 'globalPinOrder',
        favorite: 'favoritePinOrder',
        important: 'importantPinOrder',
        veryImportant: 'veryImportantPinOrder',
        category: 'categoryPinOrder',
        liked: 'likedPinOrder',
        reposted: 'repostedPinOrder',
      };
      const orderFieldMap: Record<string, keyof NoteDTO> = {
        all: 'globalOrder',
        favorite: 'favoriteOrder',
        important: 'importantOrder',
        veryImportant: 'importantOrder',
        category: 'categoryOrder',
        liked: 'globalOrder',
        reposted: 'globalOrder',
      };
      
      const pinnedField = pinnedFieldMap[currentScope];
      const pinOrderField = pinOrderFieldMap[currentScope];
      const orderField = orderFieldMap[currentScope];
      
      if (pinnedField && pinOrderField && orderField) {
        return updated.sort((a, b) => {
          const aPinned = a[pinnedField] as boolean;
          const bPinned = b[pinnedField] as boolean;
          if (aPinned !== bPinned) {
            return bPinned ? 1 : -1;
          }
          
          const aPinOrder = a[pinOrderField] as number;
          const bPinOrder = b[pinOrderField] as number;
          if (aPinOrder !== bPinOrder) {
            return bPinOrder - aPinOrder;
          }
          
          // 按 order 或 createdAt 降序
          const aOrder = a[orderField] as number;
          const bOrder = b[orderField] as number;
          if (aOrder !== undefined && bOrder !== undefined && aOrder !== bOrder) {
            return bOrder - aOrder;
          }
          
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }
      
      return updated;
    });
    loadCategories();
    setSidebarRefreshKey((k) => k + 1);
  };

  const handleNoteDeleted = (id: string) => {
    setNotes((prev) => {
      const deleted = prev.find((n) => n.id === id);
      if (deleted?.repostOfId) {
        // 删除的是转发帖子，同步减少原文的转发计数
        return prev
          .filter((n) => n.id !== id)
          .map((n) =>
            n.id === deleted.repostOfId && n._social
              ? {
                  ...n,
                  _social: {
                    ...n._social,
                    repostCount: Math.max(0, n._social.repostCount - 1),
                  },
                }
              : n
          );
      }
      return prev.filter((n) => n.id !== id);
    });
    loadCategories();
    setSidebarRefreshKey((k) => k + 1);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    const nextOffset = offset + 20;
    setOffset(nextOffset);
    loadNotes(true, nextOffset);
  };

  const handleSearchSubmit = (v: string) => {
    if (v.trim()) {
      router.push(`/search?q=${encodeURIComponent(v.trim())}`);
    }
  };

  /**
   * 自定义排序模式下的"上移/下移"操作
   * 由于 API 排序是 desc（order 大的在前），上移=增大 order，下移=减小 order
   * 交换相邻笔记的位置和 order 值
   */
  const handleMove = async (noteId: string, direction: 'up' | 'down') => {
    // liked 和 reposted 视图不支持自定义排序
    if (currentScope === 'liked' || currentScope === 'reposted') return;

    const idx = notes.findIndex((n) => n.id === noteId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= notes.length) return;

    const a = notes[idx];
    const b = notes[swapIdx];

    // 获取对应的 order 字段
    const orderField =
      currentScope === 'favorite'
        ? 'favoriteOrder'
        : currentScope === 'important' || currentScope === 'veryImportant'
        ? 'importantOrder'
        : currentScope === 'category'
        ? 'categoryOrder'
        : currentScope === 'allPinned'
        ? 'globalOrder'
        : 'globalOrder';

    // 在前端交换笔记位置和 order 值，让 UI 立即响应
    const newNotes = [...notes];
    const aOrder = (a as any)[orderField];
    const bOrder = (b as any)[orderField];
    
    // 交换笔记位置（将 b 放到 idx 位置，a 放到 swapIdx 位置）
    newNotes[idx] = { ...b, [orderField]: aOrder };
    newNotes[swapIdx] = { ...a, [orderField]: bOrder };
    setNotes(newNotes);

    // 后端持久化
    try {
      await api.reorderNotes({
        scope: currentScope,
        items: [
          { id: a.id, order: bOrder },
          { id: b.id, order: aOrder },
        ],
      });
    } catch (e: any) {
      alert(e.message || '调整顺序失败');
      loadNotes(); // 失败时重新加载
    }
  };

  const title =
    filter.type === 'all'
      ? '全部笔记'
      : filter.type === 'reviewed'
      ? '回顾'
      : filter.type === 'allPinned'
      ? '置顶'
      : filter.type === 'favorite'
      ? '收藏'
      : filter.type === 'important'
      ? '重要'
      : filter.type === 'veryImportant'
      ? '极重要'
      : filter.type === 'liked'
      ? '点赞'
      : filter.type === 'reposted'
      ? '转发'
      : '分类';

  const showOrderControls = sortBy === 'custom' && currentScope !== 'liked' && currentScope !== 'reposted';

  // 统计置顶数量（用于UI分隔提示）
  const pinnedCount = notes.filter((n) => n.pinned).length;

  // 单日选择时的列表头部汇总（用 total 而不是 notes.length，避免分页导致数字对不上日历）
  const dailySummary = useMemo(() => {
    if (!dateFilter || dateFilter.type !== 'single') return null;
    const important = notes.filter((n) => n.importance === 'important').length;
    const veryImportant = notes.filter((n) => n.importance === 'very_important').length;
    return { date: dateFilter.date, total, important, veryImportant };
  }, [notes, dateFilter, total]);

  return (
    <div className="min-h-screen">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-md bg-ink-900 flex items-center justify-center">
              <PenLine size={15} className="text-white" />
            </div>
            <span className="font-serif text-lg font-semibold text-ink-900 hidden sm:block">
              XB · 笔记
            </span>
          </div>

          <SearchBar
            value={searchValue}
            onChange={setSearchValue}
            onSubmit={handleSearchSubmit}
          />

          <ReminderWidget
            reminders={reminders}
            onCreated={addReminder}
            onDeleted={removeReminder}
            onCompleted={completeReminder}
            onRefresh={refreshReminders}
          />

          <button
            onClick={() => router.push('/knowledge')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-accent-600 hover:bg-accent-50 transition-colors flex-shrink-0"
            title="知识层级"
          >
            <GitBranch size={14} />
            <span className="hidden md:inline">知识层级</span>
          </button>

          <button
            onClick={() => router.push('/ai')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-purple-600 hover:bg-purple-50 transition-colors flex-shrink-0"
            title="AI 知识工作台"
          >
            <Sparkles size={14} />
            <span className="hidden md:inline">AI 知识</span>
          </button>

          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-ink-600 hover:bg-ink-100 hover:text-ink-800 transition-colors flex-shrink-0"
            title="从 Obsidian 导入笔记"
          >
            <Upload size={14} />
            <span className="hidden md:inline">导入 Obsidian</span>
          </button>
        </div>
      </header>

      {/* 主体：左侧分类 + 中间内容 + 右侧信息 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-64 space-y-4 lg:sticky lg:top-24 lg:self-start lg:h-[calc(100vh-7rem)] lg:overflow-y-auto lg:overflow-x-hidden">
          <CalendarFilter
            value={dateFilter}
            onChange={setDateFilter}
            onMonthChange={setCalendarMonth}
            stats={dailyStats}
          />
          <CategorySidebar
            categories={categories}
            selected={filter}
            onSelect={(sel) => setFilter(sel as Filter)}
            onCategoriesChange={loadCategories}
            refreshKey={sidebarRefreshKey}
          />
        </div>

        <div className="flex-1 min-w-0 max-w-2xl mx-auto w-full space-y-4">
          {/* 顶部编辑器 */}
          <NoteEditor
            categories={categories}
            onSaved={(_n, isEdit) => {
              if (!isEdit) handleNoteCreated(_n);
            }}
          />

          {/* 列表标题 + 排序切换 */}
          <div className="flex items-center justify-between pt-2 gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-ink-600">{title}</h2>
              <span className="text-xs text-ink-400">{total} 条</span>
            </div>
            <SortToggle value={sortBy} onChange={setSortBy} />
          </div>

          {/* 单日汇总 */}
          {dailySummary && (
            <div className="text-sm text-ink-500 px-1">
              {format(new Date(dailySummary.date), 'yyyy年M月d日')} · 共 {dailySummary.total} 条
              {dailySummary.important > 0 && ` · 重要 ${dailySummary.important}`}
              {dailySummary.veryImportant > 0 && ` · 极重要 ${dailySummary.veryImportant}`}
            </div>
          )}

          {/* 笔记列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-ink-400">
              <Loader2 className="animate-spin" size={18} />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-ink-400">
              <Inbox size={40} strokeWidth={1.2} />
              <p className="mt-3 text-sm">
                {filter.type === 'allPinned'
                  ? '还没有置顶的笔记'
                  : filter.type === 'favorite'
                  ? '还没有收藏的笔记'
                  : filter.type === 'important'
                  ? '还没有标记为重要的笔记'
                  : filter.type === 'veryImportant'
                  ? '还没有标记为极重要的笔记'
                  : filter.type === 'liked'
                  ? '还没有点赞的笔记'
                  : filter.type === 'reposted'
                  ? '还没有转发的笔记'
                  : filter.type === 'category'
                  ? '这个分类下还没有笔记'
                  : '开始记录你的第一条笔记吧'}
              </p>
              {filter.type === 'all' && (
                <button
                  onClick={() => setImportOpen(true)}
                  className="mt-3 inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700"
                >
                  <Upload size={11} />
                  或从 Obsidian 导入已有笔记
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {showOrderControls && pinnedCount > 0 && (
                <div className="text-[11px] text-ink-400 px-1 flex items-center gap-1">
                  <Pin size={9} fill="currentColor" className="text-accent-500" />
                  置顶 ({pinnedCount})
                </div>
              )}
              {notes.map((note, idx) => {
                const isFirstPinned = note.pinned && idx === 0;
                const isLastPinned =
                  note.pinned && idx === pinnedCount - 1;
                const isFirstNormal = !note.pinned && idx === pinnedCount;
                const isLast = idx === notes.length - 1;

                return (
                  <div key={note.id}>
                    {/* 置顶与普通笔记之间的分隔线 */}
                    {showOrderControls &&
                      idx > 0 &&
                      !notes[idx - 1].pinned &&
                      note.pinned && (
                        <div className="text-[11px] text-ink-400 px-1 py-2 flex items-center gap-1">
                          <Pin size={9} fill="currentColor" className="text-accent-500" />
                          置顶
                        </div>
                      )}
                    {showOrderControls &&
                      idx > 0 &&
                      notes[idx - 1].pinned &&
                      !note.pinned && (
                        <div className="text-[11px] text-ink-400 px-1 py-2">
                          其他笔记
                        </div>
                      )}
                    <NoteCard
                      note={note}
                      categories={categories}
                      onUpdated={handleNoteUpdated}
                      onDeleted={handleNoteDeleted}
                      onReposted={handleNoteCreated}
                      scope={currentScope}
                      showOrderControls={showOrderControls}
                      onMove={handleMove}
                      isFirst={
                        showOrderControls &&
                        (note.pinned ? isFirstPinned : isFirstNormal)
                      }
                      isLast={showOrderControls && isLast}
                    />
                  </div>
                );
              })}

              {showOrderControls && notes.length > 0 && (
                <p className="text-[11px] text-ink-400 text-center pt-2">
                  提示：用笔记右上角的 ↑↓ 按钮调整顺序
                </p>
              )}

              {/* 加载更多 */}
              {!loading && notes.length > 0 && (
                <div className="pt-4 flex flex-col items-center gap-1">
                  {hasMore ? (
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="text-xs text-ink-500 hover:text-accent-600 disabled:text-ink-300 flex items-center gap-1"
                    >
                      {loadingMore ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <span>加载更多</span>
                      )}
                    </button>
                  ) : (
                    <span className="text-[11px] text-ink-300">
                      已加载全部 {total} 条笔记
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 右侧边栏 */}
        <div className="w-full lg:w-56 lg:sticky lg:top-24 lg:self-start lg:h-[calc(100vh-7rem)] lg:overflow-y-auto hidden lg:block">
          <WorldClock />
        </div>
      </main>

      <ObsidianImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setOffset(0);
          loadNotes(false, 0);
          loadCategories();
          setSidebarRefreshKey((k) => k + 1);
        }}
      />

      {showReminderModal && dueReminders.length > 0 && (
        <ReminderModal
          reminders={dueReminders}
          onClose={closeReminderModal}
          onComplete={completeReminder}
          onSnooze={snoozeReminder}
          onDismiss={dismissReminder}
        />
      )}

      {showReviewModal && reviewNotes.length > 0 && (
        <NoteReviewReminder
          notes={reviewNotes}
          onClose={closeReviewModal}
          onReviewed={markNoteReviewed}
          onNavigate={(id) => router.push(`/note/${id}`)}
          onReviewAll={reviewAllNotes}
          onSnooze={snoozeReviewNotes}
        />
      )}
    </div>
  );
}

