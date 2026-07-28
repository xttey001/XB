---
name: "xb-notes-rules"
description: "XB 笔记项目的开发规则与约定。在每次修改或新增 XB 笔记功能前调用，确保代码风格、数据模型、API 设计保持一致。"
---

# XB 笔记项目规则

## 1. 项目定位

- 单用户本地优先笔记应用，使用 Next.js 14 + React + TypeScript + Prisma + SQLite + Tailwind CSS。
- 核心数据存储在 `prisma/dev.db`，图片存储在 `public/uploads/YYYY/MM/`。
- 当前为本地桌面应用形态，通过 `npm run dev` 在 3300 端口运行。
- 启动入口统一使用 PowerShell + VBS 方案，禁止再使用中文 `.bat` 脚本（Windows cmd 对 UTF-8 without BOM 中文支持极差，会导致命令解析失败）。

## 2. 目录与文件约定

| 目录 | 用途 |
|------|------|
| `app/` | Next.js App Router 页面与 API Route |
| `app/api/` | REST API 端点 |
| `components/` | 可复用 React 组件 |
| `lib/` | 工具函数、API 客户端、Prisma 客户端、类型定义 |
| `prisma/` | Schema 与 SQLite 数据库文件 |
| `public/uploads/` | 图片按 `YYYY/MM` 分目录存储 |
| `scripts/` | 一次性脚本（如数据迁移、重置） |
| `start-xb-notes.ps1` | PowerShell 启动脚本：检测端口、启动 dev 服务、打开浏览器 |
| `start-xb-notes.vbs` | VBS 静默启动器：双击无黑窗，调用 ps1 |
| `create-shortcut.ps1` | 生成桌面快捷方式，目标指向 `start-xb-notes.vbs` |

## 3. 数据模型约定

- `Note.images` 和 `Note.tags` 在 SQLite 中以 **JSON 字符串** 存储，读写时必须使用 `stringifyJsonArray` / `parseJsonArray`。
- 笔记支持四视图独立排序与置顶（全部笔记 / 收藏 / 重要 / 分类）：
  - 排序字段：`globalOrder`、`favoriteOrder`、`importantOrder`、`categoryOrder`
  - 置顶字段：`pinnedGlobal`、`pinnedFavorite`、`pinnedImportant`、`pinnedCategory`
  - 置顶排序字段：`globalPinOrder`、`favoritePinOrder`、`importantPinOrder`、`categoryPinOrder`
  - API 返回的 `pinned` 字段由当前 `scope` 计算得出。
- 社交数据为独立表：`Like`（一对一）、`Comment`（支持嵌套 replies）、`Repost`。
- 分类 `Category` 支持 `color` 与 `icon`，左侧栏文字颜色应使用 `category.color`。

## 4. API 设计约定

- 列表查询使用 `GET /api/notes`，支持 `scope`、`sortBy`、`categoryId`、`favorite`、`startDate/endDate`、`withSocial`。
- 默认 `limit=50`，最大 `200`。
- 更新置顶时必须传入 `scope`，后端据此更新对应置顶字段。
- 批量排序使用 `POST /api/notes/reorder`，`scope` 决定更新哪个 `order` 与 `pinned` 字段。
- API 返回的 DTO 必须与 `lib/types.ts` 中的类型一致。

## 5. 前端组件约定

- 组件统一放在 `components/` 下，使用 `'use client'` 声明客户端组件。
- 时间显示优先使用 `lib/utils.ts` 中的 `formatTwitterTime`（如 `下午1:37 · 2026年7月26日`）。
- 评论/回复时间使用 `formatTwitterTime`，悬停显示完整时间。
- `NoteSocial` 组件通过 `defaultOpenComments` 控制在详情页默认展开评论。
- 详情页布局顺序：正文 → 转发引用 → 时间信息 → 社交互动区（点赞/评论/转发）→ 评论区。

## 6. 样式约定

- 使用 Tailwind CSS，颜色通过 `ink-*` 与 `accent-*` 主题类控制。
- 左侧栏激活态使用深色背景 `bg-ink-900 text-white`；分类项非激活态使用分类自身颜色。
- 卡片 hover 效果、过渡动画保持简洁一致。

## 7. 性能与可维护性

- 避免在列表接口中返回大字段全量；必要时使用分页或懒加载。
- 图片上传后按年月分目录保存，避免单目录文件过多。
- 新增字段需同步更新 `lib/types.ts`、Prisma schema、所有返回 NoteDTO 的 API 端点。
- 数据库结构变更后运行 `npx prisma db push`，并用 `scripts/` 下脚本迁移旧数据。

## 8. 启动与桌面集成约定

- 必须使用 `start-xb-notes.ps1` + `start-xb-notes.vbs` 作为用户启动入口。
- ps1 中启动 `npm run dev` 时，使用 `-WindowStyle Minimized` 并设置窗口标题为 `XB Notes Server`，方便用户识别和关闭。
- vbs 中调用 PowerShell 时必须携带 `-ExecutionPolicy Bypass`，避免用户机器默认执行策略阻止脚本。
- 桌面快捷方式目标必须是 `start-xb-notes.vbs`，不能是 bat 或 ps1（ps1 会被系统默认用记事本打开，bat 会乱码）。
- 禁止再创建任何包含中文的 `.bat` 启动脚本。

## 9. 禁止事项

- 不要为临时操作创建新工具函数或抽象。
- 不要添加未使用的类型字段或 backwards-compatibility shim。
- 不要在 API 中混合 scope 的置顶/排序字段。
- 不要在前端列表中默认展开 `NoteSocial` 评论面板。
- 不要使用中文 `.bat` 脚本作为用户启动入口。
