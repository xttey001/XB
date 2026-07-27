# 每日笔记统计 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 XB 笔记的日历上展示每日笔记数量及重要/极重要标记，并在选中单日时于列表顶部显示当天汇总。

**Architecture:** 新增专用统计 API `GET /api/notes/daily-stats`，前端 `CalendarFilter` 消费该数据渲染日期标记，`app/page.tsx` 在选中单日后从当前笔记数组计算列表头部汇总。不改动数据库 schema。

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + SQLite, Tailwind CSS, date-fns

---

## 前置依赖

- 项目路径：`d:\XB`
- 开发服务：`npm run dev`（端口 3300）
- 设计文档：[docs/plans/2026-07-26-daily-note-stats-design.md](file:///d:/XB/docs/plans/2026-07-26-daily-note-stats-design.md)
- 已有约定：参考 [xb-notes-rules](file:///d:/XB/.trae/skills/xb-notes-rules/SKILL.md)

---

## Task 1: 新增 DailyStatsDTO 类型

**Files:**
- Modify: `lib/types.ts`

**Step 1: 在类型文件末尾添加 DTO**

在 `lib/types.ts` 中 `NoteInput` 接口之后新增：

```typescript
export interface DailyStatsDTO {
  date: string;
  count: number;
  important: number;
  veryImportant: number;
}
```

**Step 2: 验证类型无语法错误**

Run: `npx tsc --noEmit`
Expected: 无新增错误（允许项目已有错误，但不应由本次修改引入）。

---

## Task 2: API 客户端新增 getDailyStats

**Files:**
- Modify: `lib/api.ts`

**Step 1: 导入 DailyStatsDTO**

```typescript
import type { NoteDTO, NoteInput, CategoryDTO, NoteReorderInput, CategoryReorderInput, DailyStatsDTO } from '@/lib/types';
```

**Step 2: 在 api 对象中新增方法**

在 `listNotes` 之后、`getNote` 之前插入：

```typescript
  getDailyStats(params: {
    year: number;
    month: number;
    scope?: Scope;
    categoryId?: string;
  }): Promise<{ stats: DailyStatsDTO[] }> {
    const sp = new URLSearchParams();
    sp.set('year', String(params.year));
    sp.set('month', String(params.month));
    if (params.scope) sp.set('scope', params.scope);
    if (params.categoryId) sp.set('categoryId', params.categoryId);
    return request(`/api/notes/daily-stats?${sp.toString()}`);
  },
```

**Step 3: 验证类型检查通过**

Run: `npx tsc --noEmit`

---

## Task 3: 创建 daily-stats API 路由

**Files:**
- Create: `app/api/notes/daily-stats/route.ts`

**Step 1: 创建路由文件并写入实现**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray } from '@/lib/utils';
import type { DailyStatsDTO } from '@/lib/types';

type Scope = 'all' | 'favorite' | 'category';

/**
 * GET /api/notes/daily-stats
 * 查询参数：
 *   - year: 年份（必填）
 *   - month: 月份 1-12（必填）
 *   - scope: all | favorite | category（默认 all）
 *   - categoryId: scope=category 时必填
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get('year'));
  const month = Number(searchParams.get('month'));
  const scope = (searchParams.get('scope') as Scope) || 'all';
  const categoryId = searchParams.get('categoryId') || undefined;

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'year 和 month 参数无效' }, { status: 400 });
  }

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  const where: any = {
    createdAt: {
      gte: start,
      lte: end,
    },
  };

  if (scope === 'favorite') {
    where.isFavorite = true;
  } else if (scope === 'category') {
    if (!categoryId) {
      return NextResponse.json({ error: 'scope=category 时必须提供 categoryId' }, { status: 400 });
    }
    where.categoryId = categoryId;
  }

  const notes = await prisma.note.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      tags: true,
    },
  });

  const map = new Map<string, DailyStatsDTO>();

  for (const note of notes) {
    const dateStr = note.createdAt.toISOString().slice(0, 10);
    const tags = parseJsonArray<string>(note.tags);

    if (!map.has(dateStr)) {
      map.set(dateStr, {
        date: dateStr,
        count: 0,
        important: 0,
        veryImportant: 0,
      });
    }

    const stat = map.get(dateStr)!;
    stat.count += 1;
    if (tags.includes('极重要')) {
      stat.veryImportant += 1;
    }
    if (tags.includes('重要')) {
      stat.important += 1;
    }
  }

  const stats = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({ stats });
}
```

**Step 2: 手动验证 API**

先确保有测试数据。如果没有，创建一条带 `#重要` 标签和一条带 `#极重要` 标签的笔记。

Run (PowerShell):
```powershell
$base = 'http://localhost:3300'
Invoke-RestMethod -Uri "$base/api/notes/daily-stats?year=2026&month=7&scope=all" -Method GET
```

Expected: 返回当月有笔记的日期及其 count/important/veryImportant。

---

## Task 4: CalendarFilter 展示每日统计

**Files:**
- Modify: `components/CalendarFilter.tsx`

**Step 1: 导入 DailyStatsDTO**

```typescript
import type { DailyStatsDTO } from '@/lib/types';
```

**Step 2: 扩展 props**

```typescript
interface CalendarFilterProps {
  value: DateSelection;
  onChange: (value: DateSelection) => void;
  stats?: DailyStatsDTO[];
}
```

**Step 3: 构建 stats Map**

在组件内部添加：

```typescript
const statsMap = useMemo(() => {
  const map = new Map<string, DailyStatsDTO>();
  stats?.forEach((s) => map.set(s.date, s));
  return map;
}, [stats]);
```

**Step 4: 修改日期格子渲染**

在 `week.map((date) => { ... })` 内部，在 return 之前获取当天统计：

```typescript
const dateStr = format(date, 'yyyy-MM-dd');
const dayStat = statsMap.get(dateStr);
```

然后在 button 的 className 和 children 中增加标记。保留原有 className 逻辑，只在 children 处改为：

```tsx
<span className="relative z-10">{format(date, 'd')}</span>
{dayStat && dayStat.count > 0 && (
  <span className="absolute top-0 right-0.5 text-[8px] leading-none text-ink-400 font-medium">
    {dayStat.count}
  </span>
)}
{dayStat && (
  <span className="absolute bottom-0 left-0 right-0 flex justify-center gap-0.5">
    {dayStat.important > 0 && (
      <span className="w-1 h-1 rounded-full bg-blue-500" />
    )}
    {dayStat.veryImportant > 0 && (
      <span className="w-1 h-1 rounded-full bg-red-500" />
    )}
  </span>
)}
```

button 需要加 `relative`：在原有 className 中确认已包含 `relative`（当前代码第 316 行已有 `relative`）。

**Step 5: 验证日历渲染**

启动开发服务，切换月份，观察：
- 有笔记的日期右上角出现数字。
- 有 `#重要` 的日期底部出现蓝点。
- 有 `#极重要` 的日期底部出现红点。

---

## Task 5: page.tsx 拉取统计并展示列表头部汇总

**Files:**
- Modify: `app/page.tsx`

**Step 1: 导入 api 与类型**

已导入 `api` 和 `NoteDTO, CategoryDTO`，无需额外导入 DailyStatsDTO（仅在 API 返回类型推断中使用）。

**Step 2: 新增 stats 状态**

在 HomePage 的 state 区域添加：

```typescript
const [dailyStats, setDailyStats] = useState<DailyStatsDTO[]>([]);
```

同时导入 `DailyStatsDTO`：

```typescript
import type { NoteDTO, CategoryDTO, DailyStatsDTO } from '@/lib/types';
```

**Step 3: 新增加载统计函数**

在 `loadNotes` 附近添加：

```typescript
const loadDailyStats = useCallback(async () => {
  try {
    const params: Parameters<typeof api.getDailyStats>[0] = {
      year: getYear(currentMonthForStats), // 需要维护当前日历显示月份
      month: getMonth(currentMonthForStats) + 1,
      scope: currentScope,
    };
    if (filter.type === 'category') params.categoryId = filter.id;
    const { stats } = await api.getDailyStats(params);
    setDailyStats(stats);
  } catch (e) {
    console.error(e);
  }
}, [currentMonthForStats, currentScope, filter]);
```

需要引入 `getYear`, `getMonth` from `date-fns`，并新增 state：

```typescript
const [calendarMonth, setCalendarMonth] = useState(new Date());
```

将 `CalendarFilter` 的 `currentMonth` 状态提升到 page.tsx，通过 props 传入，并在月份切换时更新 `calendarMonth`。

简化做法：给 `CalendarFilter` 增加 `onMonthChange` prop：

```typescript
interface CalendarFilterProps {
  value: DateSelection;
  onChange: (value: DateSelection) => void;
  onMonthChange?: (date: Date) => void;
  stats?: DailyStatsDTO[];
}
```

在 `CalendarFilter` 中所有 `setCurrentMonth` 调用后同步调用 `onMonthChange?.(next)`。

**Step 4: page.tsx 中调用 loadDailyStats**

添加 useEffect：

```typescript
useEffect(() => {
  loadDailyStats();
}, [loadDailyStats]);
```

**Step 5: 列表头部显示 DailySummary**

在笔记列表区域（渲染 notes 之前）添加：

```typescript
const dailySummary = useMemo(() => {
  if (!dateFilter || dateFilter.type !== 'single') return null;
  const total = notes.length;
  const important = notes.filter((n) => n.tags.includes('重要')).length;
  const veryImportant = notes.filter((n) => n.tags.includes('极重要')).length;
  return { total, important, veryImportant };
}, [notes, dateFilter]);
```

需要导入 `useMemo`（已导入）。

渲染：

```tsx
{dailySummary && (
  <div className="text-sm text-ink-500 mb-3 px-1">
    {format(new Date(dateFilter.date), 'yyyy年M月d日')} · 共 {dailySummary.total} 条
    {dailySummary.important > 0 && ` · 重要 ${dailySummary.important}`}
    {dailySummary.veryImportant > 0 && ` · 极重要 ${dailySummary.veryImportant}`}
  </div>
)}
```

需要导入 `format` from `date-fns`。

**Step 6: 将 stats 和 onMonthChange 传给 CalendarFilter**

```tsx
<CalendarFilter
  value={dateFilter}
  onChange={setDateFilter}
  onMonthChange={setCalendarMonth}
  stats={dailyStats}
/>
```

**Step 7: 验证完整流程**

- 切换月份：Sidebar 请求新月份统计。
- 切换分类/收藏：统计重新按 scope 拉取。
- 选择单日：列表头部显示当天汇总。
- 清除日期筛选：头部汇总消失。

---

## Task 6: 边界测试与清理

**Files:**
- Modify: 以上所有文件

**Step 1: 空月测试**

切换到一个没有任何笔记的月份，确认日历没有异常标记。

**Step 2: 标签边界测试**

创建以下笔记并检查统计：
- 无标签笔记：count +1
- 仅 `#重要`：count +1，important +1
- 仅 `#极重要`：count +1，veryImportant +1
- 同时带 `#重要` 和 `#极重要`：count +1，important +1，veryImportant +1

**Step 3: 分类视图测试**

在分类 A 和分类 B 各创建笔记，切换到分类 A，确认日历只显示分类 A 的统计。

**Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无新增类型错误。

---

## 交付标准

- [ ] 日历日期格子显示当天笔记总数。
- [ ] 日历日期格子用蓝点/红点标识重要/极重要。
- [ ] 选中单日后列表顶部显示当天汇总。
- [ ] 统计跟随当前 scope（全部/收藏/分类）。
- [ ] `npx tsc --noEmit` 无新增错误。
