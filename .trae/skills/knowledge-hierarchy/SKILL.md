---
name: "knowledge-hierarchy"
description: "XB 笔记知识层级系统开发与维护。处理 KnowledgeArea 主干、Category 两层树、进度标记、AI 子分类聚类、Area 详情两栏页。当用户修改 /knowledge 页面或询问知识层级相关功能时调用。"
---

# XB Notes · 知识层级 Skill

## 系统总览

```
KnowledgeArea (一级主干，6 个固定)
  ├── Category (顶层分类，parentId = null)
  │   ├── Category (子分类，parentId = 父 Category.id)
  │   └── ...
  └── ...
```

两层限制（Schema 允许无限嵌套，但 UI 只渲染两层）。

## 关键文件速查

| 层 | 路径 | 作用 |
|---|---|---|
| Schema | `prisma/schema.prisma` | KnowledgeArea + Category(自引用 parentId + progressStatus) |
| Areas API | `app/api/knowledge/areas/route.ts` | GET 返回嵌套树 + 进度汇总 |
| Area Progress | `app/api/knowledge/areas/[id]/progress/route.ts` | PATCH 更新 KnowledgeArea.progressStatus |
| Cat Progress | `app/api/knowledge/categories/[id]/progress/route.ts` | PATCH 更新 Category.progressStatus |
| Cat Reparent | `app/api/knowledge/categories/[id]/reparent/route.ts` | PATCH 移动 Category 到新父分类/Area |
| Cat Notes | `app/api/knowledge/categories/[id]/notes/route.ts` | GET 分类笔记，`includeDescendants=true` 拉子孙 |
| AI 子分类 | `app/api/knowledge/cluster-subareas/route.ts` | POST 建议分组，PUT 应用分组 |
| 概览页 | `app/knowledge/page.tsx` | 6 Area 卡片网格，头部点击跳转 Area 详情 |
| Area 详情页 | `app/knowledge/areas/[id]/page.tsx` | 两栏布局：左=分类树，右=笔记列表 |
| 聚类引擎 | `lib/knowledge-cluster.ts` | 关键词确定性聚类 + LLM 语义聚类 |
| 迁移脚本 | `scripts/migrate-hierarchy.js` | 初始化两层结构 |

## 数据模型

```prisma
model KnowledgeArea {
  id String @id @default(cuid())
  name String @unique
  icon String?
  color String @default("#654ACB")
  description String?
  order Int @default(0)
  progressStatus String @default("unknown") // unknown/aware/can_use/mastered
  categories Category[]
}

model Category {
  id String @id @default(cuid())
  name String @unique
  knowledgeAreaId String?
  parentId String?
  progressStatus String @default("unknown") // 叶子分类可标记
  // ... 其他字段
}
```

## 进度计算规则

**STATUS_WEIGHT**: unknown=0, aware=30, can_use=70, mastered=100

1. **叶子 Category** 的 `progressPct` = `STATUS_WEIGHT[progressStatus]`
2. **父 Category** 的 `progressPct` = 所有直接 children 的加权平均
3. **KnowledgeArea** 的 `progressPct`:
   - 如果 `progressStatus !== "unknown"` → 优先用手动值
   - 否则 = 所有叶子 Category 的加权平均

只有叶子计入 Area 的 masteredCount/canUseCount/awareCount/unknownCount。

## 三层导航流

```
/knowledge (概览)
  → 点 Area 卡片头部 → /knowledge/areas/[areaId]
    → 点分类 → 右栏显示笔记（父分类含子孙汇总）
      → 点笔记 → /note/[noteId]?from=knowledge&areaId=xxx
        → header 条件显示「返回知识层级」
```

笔记详情页的返回按钮通过 `useSearchParams().get('from') === 'knowledge'` 判断，带 `areaId` 可回到原 Area。

## 创建新分类的两种方式

### 1. 手动重构（已有）
悬停分类行 → 最右 ↕ 按钮 → 选目标 Area + 目标父分类

### 2. AI 聚类（Area 卡片右上角 Layers 图标）
`POST /api/knowledge/cluster-subareas` → 建议分组 → `PUT /api/knowledge/cluster-subareas/apply` 自动创建子分类容器并移动叶子。没 LLM 时走关键词兜底。

## 常见操作指南

### 新增一个 KnowledgeArea
在 `/api/knowledge/areas` POST body 传 `{name, icon, color, description}`，或在 `/ai` 页面操作。

### 把某分类移到某个子分类下
```js
fetch(`/api/knowledge/categories/${catId}/reparent`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ parentId: subCatId, knowledgeAreaId: areaId }),
});
```

### 给 Area 下所有未归类分类自动分配
```js
// 1. 自动聚类拿建议
const r = await fetch('/api/knowledge/cluster-subareas', {
  method: 'POST', body: JSON.stringify({ areaId }),
});
const { suggestions } = await r.json();
// 2. 应用
await fetch('/api/knowledge/cluster-subareas/apply', {
  method: 'PUT', body: JSON.stringify({ areaId, suggestions }),
});
```

## 诊断脚本

```bash
node scripts/check-hierarchy.js    # 查当前所有 Area + Category 状态
node scripts/verify-hierarchy.js    # 两层结构验证 + 未归类报告
node scripts/migrate-hierarchy.js    # 初始化/重建两层结构
```

## 开发注意事项

- **路由契约**：概览页固定 `/knowledge`，Area 详情固定 `/knowledge/areas/[id]`，不要改 URL 结构
- **后代拉取**：`/api/knowledge/categories/[id]/notes` 必须支持 `includeDescendants=true`（用 DFS 递归 collect）
- **避免循环**：reparent API 要防止 `parentId === self.id`，前端弹框也要过滤掉自己及其后代
- **tsc 先过**：改动后 `npx tsc --noEmit` 必须 0 错误，dev server 启动无 error

## 触发场景

当用户提到以下关键词时调用此 Skill：
- 知识层级、KnowledgeArea、主干、子分类
- 进度标记、掌握程度、未接触/了解/会用/精通
- 重构分类、移动分类、reparent
- AI 聚子分类、cluster subareas
- `/knowledge` 页面、Area 详情页
