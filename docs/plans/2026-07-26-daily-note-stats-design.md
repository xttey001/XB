# 每日笔记统计设计文档

## 背景

XB 笔记左侧的日历目前只用于日期筛选，用户无法直观看到：
- 某一天一共发了多少篇笔记
- 某一天是否有重要/极重要的笔记

市面上类似产品（印象笔记日历视图、Obsidian Calendar 插件、即我笔记的日历热力图）普遍会在日期格子上展示记录数量或重要标记，这是一种已经被验证的需求。

## 目标

1. 在日历上直观展示每天的笔记数量及重要程度分布。
2. 选中单日后，在右侧笔记列表顶部显示当天汇总。
3. 统计口径跟随当前视图（全部 / 收藏 / 分类）。

## 关键定义

- **重要笔记**：标签中包含 `#重要` 的笔记。
- **极重要笔记**：标签中包含 `#极重要` 的笔记。
- 一个笔记可以同时属于多个标签；如果同时带 `#重要` 和 `#极重要`，按「极重要」优先还是分别计数，由实现决定。本设计采用分别计数（important + veryImportant）。

## 方案选型

采用「专用统计 API」方案（方案 2）：
- 新增 `GET /api/notes/daily-stats` 按月返回聚合数据。
- 日历组件消费该接口渲染标记。
- 列表头部从当前已加载的笔记数组实时计算，保证与列表内容一致。

优点：
- 日历与列表职责清晰。
- 只拉取聚合数据，不传输正文，性能更好。
- 后续扩展（如年视图热力图）容易复用。

## API 设计

### `GET /api/notes/daily-stats`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| year | number | 是 | 年份，如 `2026` |
| month | number | 是 | 月份，1-12，如 `7` |
| scope | 'all' \| 'favorite' \| 'category' | 否 | 默认 `all` |
| categoryId | string | 否 | `scope=category` 时必填 |

返回：

```json
{
  "stats": [
    {
      "date": "2026-07-26",
      "count": 4,
      "important": 1,
      "veryImportant": 1
    }
  ]
}
```

类型定义（新增到 `lib/types.ts`）：

```typescript
export interface DailyStatsDTO {
  date: string;
  count: number;
  important: number;
  veryImportant: number;
}
```

## 后端实现

1. 在 `app/api/notes/daily-stats/route.ts` 新建路由。
2. 计算当月起始与结束时间：
   - `start = new Date(year, month - 1, 1, 0, 0, 0, 0)`
   - `end = new Date(year, month, 0, 23, 59, 59, 999)`
3. `where.createdAt` 范围过滤。
4. 根据 `scope` 过滤：
   - `favorite`：`isFavorite = true`
   - `category`：`categoryId = 指定值`
   - `all`：无额外过滤
5. 查询当月全部笔记（仅 `id`, `createdAt`, `tags`）。
6. 应用层用 `parseJsonArray` 解析 `tags`，按日期分组并统计 `count/important/veryImportant`。
7. 返回数组，只包含有数据的日期（零笔记日期不返回，前端用 Map 查找）。

## 前端实现

### 1. API 客户端

在 `lib/api.ts` 新增：

```typescript
getDailyStats(params: {
  year: number;
  month: number;
  scope?: Scope;
  categoryId?: string;
}): Promise<{ stats: DailyStatsDTO[] }>
```

### 2. CalendarFilter 改造

新增可选 props：

```typescript
interface CalendarFilterProps {
  value: DateSelection;
  onChange: (value: DateSelection) => void;
  stats?: DailyStatsDTO[];
  loadingStats?: boolean;
}
```

日视图每个日期格子渲染：
- 右上角小数字显示 `count`。
- 底部显示 1-2 个小圆点：
  - 蓝色点：当天有 `#重要` 笔记（`important > 0`）
  - 红色点：当天有 `#极重要` 笔记（`veryImportant > 0`）

样式约束：
- 不要挤占日期数字主体。
- 当月外日期（灰色）降低标记透明度。
- 选中态时保持可读性。

### 3. 列表头部汇总

在 `app/page.tsx` 的笔记列表区域，当 `dateFilter?.type === 'single'` 时显示：

> `2026年7月26日 · 共 4 条 · 重要 1 · 极重要 1`

数据从当前 `notes` 数组实时计算：

```typescript
const dailySummary = useMemo(() => {
  if (!dateFilter || dateFilter.type !== 'single') return null;
  const total = notes.length;
  const important = notes.filter((n) => n.tags.includes('重要')).length;
  const veryImportant = notes.filter((n) => n.tags.includes('极重要')).length;
  return { total, important, veryImportant };
}, [notes, dateFilter]);
```

注意：列表当前有分页（limit=20），头部统计的是已加载笔记。若当天笔记超过 20 条且未点「加载更多」，则显示的是当前页统计。考虑到本地应用单日笔记通常不超过 20 条，可接受。

### 4. 数据流

```
Sidebar (CalendarFilter)
  └─ 当前月份/scope/categoryId 变化
      └─ api.getDailyStats(...) → stats[]
          └─ CalendarFilter 渲染每日数量与重要标记

Main List
  └─ dateFilter 变化
      └─ api.listNotes({startDate, endDate}) → notes[]
          └─ DailySummary 从 notes 计算并展示
```

## 边界情况

- `tags` JSON 解析失败：视为空数组，不影响其他笔记。
- 某月无任何笔记：返回空数组，日历无额外标记。
- 切换分类/收藏视图：重新拉取对应 scope 的统计。
- 跨月边界（日历显示上下月灰色日期）：统计只包含当月实际数据，灰色日期按当月数据渲染即可。

## 兼容性

- 不改动 Prisma schema，无需 `npx prisma db push`。
- 不破坏现有 `CalendarFilter` 的筛选行为，新增 props 均为可选。

## 待实施文件清单

1. `app/api/notes/daily-stats/route.ts` —— 新建统计 API
2. `lib/types.ts` —— 新增 `DailyStatsDTO`
3. `lib/api.ts` —— 新增 `getDailyStats`
4. `components/CalendarFilter.tsx` —— 新增统计展示
5. `app/page.tsx` —— 拉取统计、新增列表头部汇总

## 后续可扩展

- 年视图热力图：复用 `daily-stats` 接口按年查询。
- 点击日历日期弹出当天笔记浮层。
- 支持自定义「重要」标签名配置。
