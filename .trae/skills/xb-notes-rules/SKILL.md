---
name: "xb-notes-rules"
description: "XB 笔记项目（Next.js + Prisma + SQLite + Tailwind）开发规则 + 跨项目前端陷阱库。规则篇：数据模型约定、API 设计、组件规范、样式约定、启动与桌面集成、禁止事项。经验篇附录（跨项目通用）：CSS 选择器父子依赖静默失效、移动端右滑抽屉触摸手势、React 搜索组件 Fuse.js 六大陷阱。触发词：搜索高亮不显示、右滑不出抽屉、pointer events 不触发、Touch vs Pointer、CSS 父类依赖、Fuse.js threshold、即搜没实现、Cannot read 'pinned'、displayNotes 越界、highlightQuery 漏传、push.bat 固定文件列表、git push 没推上、npm.ps1 装不上、bat 乱码、PowerShell 执行策略、scope 置顶不生效、多视图排序互扰、分类颜色不显示、数据模型改了要同步 types + Prisma + API DTO。"
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
- **笔记链接（NoteLink）**：实现双向链接功能
  - 模型字段：`sourceId`（来源笔记）、`targetId`（目标笔记）
  - 通过 `Note.outgoingLinks` 和 `Note.incomingLinks` 关联
  - 唯一约束：`@@unique([sourceId, targetId])`
  - 级联删除：删除笔记时自动删除关联的链接记录
  - 链接 HTML 格式：`<a href="/note/{id}" class="note-link" data-note-id="{id}">标题</a>`
  - 工具函数：`lib/link-parser.ts` 中的 `extractLinkedNoteIds()` 和 `syncNoteLinks()`

## 4. API 设计约定

- 列表查询使用 `GET /api/notes`，支持 `scope`、`sortBy`、`categoryId`、`favorite`、`startDate/endDate`、`withSocial`。
- 默认 `limit=50`，最大 `200`。
- 更新置顶时必须传入 `scope`，后端据此更新对应置顶字段。
- 批量排序使用 `POST /api/notes/reorder`，`scope` 决定更新哪个 `order` 与 `pinned` 字段。
- API 返回的 DTO 必须与 `lib/types.ts` 中的类型一致。
- **笔记链接 API**：
  - `GET /api/notes/search?q=xxx`：搜索笔记（用于编辑器链接对话框），返回 `{ notes: [{ id, title }] }`
  - `GET /api/notes/[id]/links`：查询笔记的链接关系，返回 `{ outgoing, incoming, relatedByTag }`
  - 保存笔记时（POST/PUT），后端自动调用 `syncNoteLinks()` 解析 content 中的链接并维护 NoteLink 表
  - API Client 方法：`api.searchNotes(q)` 和 `api.getNoteLinks(id)`

## 5. 前端组件约定

- 组件统一放在 `components/` 下，使用 `'use client'` 声明客户端组件。
- 时间显示优先使用 `lib/utils.ts` 中的 `formatTwitterTime`（如 `下午1:37 · 2026年7月26日`）。
- 评论/回复时间使用 `formatTwitterTime`，悬停显示完整时间。
- `NoteSocial` 组件通过 `defaultOpenComments` 控制在详情页默认展开评论。
- 详情页布局顺序：正文 → 转发引用 → 时间信息 → 社交互动区（点赞/评论/转发）→ 评论区 → 相关笔记。
- **笔记链接相关组件**：
  - `NoteLinkDialog.tsx`：编辑器中点击链接按钮时弹出的笔记搜索对话框，支持防抖搜索和键盘导航
  - `RelatedNotes.tsx`：详情页底部的相关笔记面板，展示出链、反链、同标签三类关联笔记
  - `TiptapEditor.tsx`：工具栏新增链接按钮，点击打开 `NoteLinkDialog`，选中后在光标位置插入链接 HTML

## 6. 样式约定

- 使用 Tailwind CSS，颜色通过 `ink-*` 与 `accent-*` 主题类控制。
- 左侧栏激活态使用深色背景 `bg-ink-900 text-white`；分类项非激活态使用分类自身颜色。
- 卡片 hover 效果、过渡动画保持简洁一致。
- **笔记链接样式**：`.note-link` 类使用虚线边框 + 主题色文字，区别于普通超链接
  ```css
  .note-link {
    @apply text-accent-600 font-medium no-underline border-b border-dashed border-accent-100 hover:border-accent-600 hover:text-accent-700 cursor-pointer transition-colors;
  }
  ```

## 7. 性能与可维护性

- 避免在列表接口中返回大字段全量；必要时使用分页或懒加载。
- 图片上传后按年月分目录保存，避免单目录文件过多。
- 新增字段需同步更新 `lib/types.ts`、Prisma schema、所有返回 NoteDTO 的 API 端点。
- **笔记链接**：新增/修改/删除链接时，`lib/link-parser.ts` 的 `syncNoteLinks()` 通过解析 HTML content 中的 `<a href="/note/...">` 标签自动维护 `NoteLink` 表，无需手动调用。
- 数据库结构变更后运行 `npx prisma db push`，并用 `scripts/` 下脚本迁移旧数据。

## 8. 启动与桌面集成约定

- 必须使用 `start-xb-notes.ps1` + `start-xb-notes.vbs` 作为用户启动入口。
- ps1 中启动 `npm run dev` 时，使用 `-WindowStyle Minimized` 并设置窗口标题为 `XB Notes Server`，方便用户识别和关闭。
- vbs 中调用 PowerShell 时必须携带 `-ExecutionPolicy Bypass`，避免用户机器默认执行策略阻止脚本。
- 桌面快捷方式目标必须是 `start-xb-notes.vbs`，不能是 bat 或 ps1（ps1 会被系统默认用记事本打开，bat 会乱码）。
- 禁止再创建任何包含中文的 `.bat` 启动脚本。

## 10. 搜索功能约定

- **NoteCard 搜索高亮传递链**：搜索功能涉及 NoteCard 的页面（首页 page.tsx、搜索页 SearchPageContent.tsx），**必须传 highlightQuery prop**：
  - ✅ `<NoteCard note={note} highlightQuery={searchValue || undefined} />`
  - ❌ 漏传 highlightQuery → 搜索结果有黄底 mark 但详情页没边框高亮

- **高亮样式统一**：搜索命中关键词统一用 `.search-highlight` 类（琥珀色外描边 box-shadow + 黄底 #FEF08A），**禁止混用 Tailwind `<mark className="bg-yellow-200">`**，否则搜索结果和详情页高亮样式不一致。

- **渲染数组同步原则**：改了 displayNotes（搜索过滤后）后，所有辅助逻辑（置顶分隔线、pinned 检查等）**必须同步用 displayNotes 引用上一条**，不能还引用原始 notes 数组。否则 `displayNotes[idx-1]` 越界 undefined 导致崩溃。

- **详情页搜索定位**：从搜索结果点进详情时 NoteCard 必须带 `?q=关键词` query param，详情页 `searchParams.get('q')` 传给 RichTextRenderer，后者会安全注入 `<span class="search-highlight" data-search-highlight="true">` 并自动 scrollIntoView 到第一个匹配。

## 11. 版本发布约定

### 三大推送陷阱（本次会话实测全中）

| # | 陷阱 | 症状 | 根因 | 修复 |
|---|---|---|---|---|
| 1 | **push.bat 只 add 固定文件** | 改了 page.tsx / NoteCard.tsx / globals.css → 手机刷新没变化 | push.bat Step 3 硬编码了 6 个文件（app.js / styles.css / index.html / sw.js / manifest.json / static-site.md），其他文件被静默跳过 | **先 `git add -A && git commit && git push origin main`**，再跑 push.bat |
| 2 | **Node 脚本替换字符串匹配不上** | 跑了 `_quick_fixes.js` / `_patch.js` 等临时脚本，脚本输出"替换了 3 处"，但实际文件没改 | 用 `content.replace(old, new)` 做修改，但 **old 字符串和实际文件里的缩进/空格/换行不完全一致**（文件可能有 2 空格缩进，我写的 old_string 用了 4 空格），replace 返回原串但脚本没检查返回值就打印成功 | **禁止用 Node 脚本改代码**，改用 Edit 工具（它会精确匹配实际文件内容） |
| 3 | **口头宣称"推送成功"但没验证远端** | AI 打印"✅ 推送成功！"，但 `git push` 输出可能被截断，根本没推上去 | 只看命令的 exit code=0 就宣告成功，**没验证远端确实有这个 commit** | 推完必须 `git log origin/main -1 --oneline` 确认远端最新 commit hash 和本地一致 |

### 反模式清单
❌ 用 Node/PowerShell 临时脚本改代码 → 缩进/换行不一致导致静默失败
❌ 跑完 push.bat 就以为改的都推上了 → 它只同步静态站那 6 个文件
❌ 推完不验证远端 → exit code=0 不代表文件真的到了 GitHub

### 标准流程（3 步）

```bash
# Step 1: 改完代码 → 先推 main（包含所有改动）
git add -A
git commit -m "fix: 具体改了什么"
git push origin main

# Step 2: 验证远端（必须做！）
git log origin/main -1 --oneline
# 应该看到刚才的 commit hash

# Step 3: 再同步静态站（只涉及 public-site 那 6 个固定文件）
.\push.bat
```

### 附加：PowerShell 执行策略陷阱

Windows PowerShell 默认执行策略为 Restricted，会拦截 `npm.ps1`、自写 `.ps1` 脚本。三种绕过方式按推荐顺序：
1. **直接调用真实 exe**：`& "C:\Program Files\nodejs\npm.cmd" install fuse.js`
2. **一次性绕过**：`powershell -ExecutionPolicy Bypass -Command "..."`
3. **永久改策略**（有风险）：`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

## 9. 禁止事项

- 不要为临时操作创建新工具函数或抽象。
- 不要添加未使用的类型字段或 backwards-compatibility shim。
- 不要在 API 中混合 scope 的置顶/排序字段。
- 不要在前端列表中默认展开 `NoteSocial` 评论面板。
- 不要使用中文 `.bat` 脚本作为用户启动入口。

---

# 附录：跨项目通用经验（前端陷阱集合）

> 以下模块来自 XB 笔记开发过程中踩到的跨项目通用陷阱，任何 React/Next.js/移动端项目都可能遇到。
> 触发词：搜索高亮不显示、右滑不出抽屉、pointer events 不触发、Touch vs Pointer、CSS 选择器父子依赖、Fuse.js threshold、即搜没实现、Cannot read property 'pinned' of undefined

---

## 附录模块 A：CSS 选择器父子依赖静默失效

### AI 快速索引
| 用户反馈关键词 | 推荐查阅 | 优先级 |
|--------------|---------|--------|
| 搜索高亮不显示 | 核心方案：避免父子依赖 | 最高 |
| Tailwind 没生效 | 选择器层级陷阱 | 高 |
| 自定义类名加了但样式没应用 | 全局选择器修复 | 高 |

### 核心问题
**症状**：CSS 写了 `.note-md span.search-highlight { background: red }` 但页面 span 显示默认样式。F12 检查发现 computed style 里根本没有这条规则。

**根因**：CSS 选择器里的父类（`.note-md`）在目标元素的真实 DOM 树里**不存在**——可能是组件重构时删了父容器的 class、或者不同页面用了不同容器。

### 核心方案
❌ **反模式**（依赖父类的层级选择器）：
```css
.note-md span.search-highlight { ... }   /* 只有在 .note-md 里才生效 */
.card .search-highlight { ... }          /* 依赖 .card 父类 */
```

✅ **正确模式**（让可复用样式类**不依赖父类**）：
```css
span.search-highlight { ... }            /* 全局生效，谁用都能匹配 */
.search-highlight { ... }                /* 连标签名都省了，更通用 */
```

### 最佳实践
1. 写 CSS 前，先确认目标元素的 DOM 层级（F12 看元素面板）
2. 通用高亮/状态类（如 `.search-highlight`、`.active`）**禁止加父类前缀**
3. 只有页面独有的、且确实需要限定范围的样式才加父类
4. 改组件结构（如换容器 div）时，要全局 grep 这个类名的 CSS 选择器

### 本次案例
NoteCard 正文容器没 `.note-md` 类但 CSS 选了 `.note-md span.search-highlight`，结果搜索结果卡片高亮是纯 Tailwind 黄底（没边框），详情页（有 `.note-md` 容器）高亮正常（黄底+琥珀外描边）。**两套样式不一致**。修复：改 CSS 选择器为全局 `span.search-highlight`。

---

## 附录模块 B：移动端触摸手势实现（右滑抽屉/下拉刷新）

### AI 快速索引
| 用户反馈关键词 | 推荐查阅 | 优先级 |
|--------------|---------|--------|
| 右滑不出抽屉 | Touch Events 稳过 Pointer Events | 最高 |
| 手势不稳定 | touch-action 配合 | 最高 |
| pointer events 不触发 | 改回 touchstart/touchend | 高 |
| Edge detection 太严 | 全屏放开 + scrollTop 守卫 | 高 |

### 核心根因（按概率排序）
1. **用了 Pointer Events**（`pointerdown`/`pointerup`）—— iOS Safari 对 pointer events 的 passiveness 处理不如 touch events 稳定
2. **没设 touch-action CSS** —— 浏览器默认拦截水平手势做"页面水平滚动/后退导航"
3. **边缘检测太窄**（如 EDGE_WIDTH=20-30px）—— 用户手指比这宽、或第一次触不在边缘
4. **没 scrollTop 守卫** —— 列表滚中间时右滑也触发，用户想滚回去却开了抽屉，反直觉

### 标准方案

**Step 1：CSS 先铺路**
```css
body { touch-action: pan-y; }       /* 垂直滚动归浏览器，水平手势归 JS */
#drawer-area { touch-action: none; } /* 抽屉区域完全禁用，让 JS 接管 */
```

**Step 2：用 Touch Events（别用 Pointer Events）**
```js
let startX = 0, startY = 0, canSwipe = true;

el.addEventListener('touchstart', (e) => {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
  canSwipe = el.scrollTop <= 5;  // 只在列表顶部允许右滑
}, { passive: true });

el.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - startX;
  const dy = e.changedTouches[0].clientY - startY;
  // 水平位移 > 50px 且 > 垂直位移 且 在顶部
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && canSwipe) {
    openDrawer();
  }
}, { passive: true });

el.addEventListener('touchcancel', cleanup, { passive: true }); // 手指滑到屏幕边缘会触发
```

**Step 3：阈值设计**
| 参数 | 推荐值 | 理由 |
|------|--------|------|
| 边缘限制 | **不限制**（全屏任意位置） | 用户体验最好，手指放哪都能开 |
| OPEN_DX | 40-55px | 手机宽度的 10-15%，够明显但不费力 |
| VERTICAL_SLOPE | `Math.abs(dx) > Math.abs(dy)` | 防止竖滑误触发 |
| scrollTop 守卫 | `scrollTop <= 5` | 只在顶部允许，滚中间时用户可能想滚回去 |

### 反模式清单
❌ `pointerdown` / `pointerup` —— 移动端稳定性不如 touch events（尤其是 iOS Safari）
❌ 边缘检测 EDGE_WIDTH=20-30px —— 太窄，手指稍偏就 miss
❌ 没 scrollTop 守卫 —— 列表滚到一半右滑开抽屉，反直觉
❌ 不设 touch-action —— 浏览器拦截水平手势做页面导航

### 最佳实践清单
✅ 优先 Touch Events，Pointer Events 作为兜底
✅ CSS `touch-action: pan-y` 告诉浏览器"我管水平"
✅ `{ passive: true }` 不阻塞滚动性能
✅ `touchcancel` 事件也清理状态（手指滑到屏幕边缘被系统拦截时触发）
✅ 右滑过程中加抽屉阴影预览反馈（translateX 跟随手指位移）

---

## 附录模块 C：React 搜索组件陷阱集合

### AI 快速索引
| 用户反馈关键词 | 推荐查阅 | 优先级 |
|--------------|---------|--------|
| 即搜没实现 | searchValue 只 setState 没参与过滤 | 最高 |
| 搜索后点击崩溃 Cannot read 'pinned' | 渲染数组改了辅助逻辑没同步 | 最高 |
| 某页搜索高亮不显示 | props 传递断链 highlightQuery 漏传 | 高 |
| Fuse.js 第一次搜慢 | 索引懒构建 → init 后立即构建 | 高 |
| Fuse.js threshold 调多少 | 中文推荐 0.4 + ignoreLocation | 高 |

### 六大陷阱

| # | 症状 | 根因 | 修复 |
|---|---|---|---|
| 1 | 输入搜索词列表没变化 | `searchValue` 只 setState，`displayNotes` **完全没引用它** | filter 逻辑引用 searchValue 重新计算 displayNotes |
| 2 | 搜索后点击崩溃 `Cannot read 'pinned' of undefined` | 渲染用 `displayNotes`，但辅助逻辑 `notes[idx-1]` 还引用**原始 notes 数组** | 全改成 `displayNotes[idx-1]` |
| 3 | 某页面搜索高亮 mark 不存在 | SearchPageContent 传了 `highlightQuery`，**首页 page.tsx 忘了传** | grep 所有 NoteCard 调用，统一加上 |
| 4 | 第一次搜索明显卡一下 | Fuse 索引在 filterNotes 里**懒构建**（搜了才建） | init 后立即构建，缓存到 `window._fuseIndex` |
| 5 | 中文搜索一堆不相关结果 | threshold 太高 + 没设 ignoreLocation | threshold=0.4, ignoreLocation=true, minMatchCharLength=2 |
| 6 | 清空搜索后结果不变 | displayNotes memo 依赖数组**漏了 searchValue** | `useMemo(..., [searchValue, allNotes])` |

### 标准代码模板（Fuse.js 即搜 + debounce）

```jsx
// 1. init 时拉全量 + 构建索引（不要懒）
useEffect(() => {
  api.listAllNotes().then(all => {
    window._fuseIndex = new Fuse(all, {
      keys: ['title', 'content', 'tags', 'category'],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
    setAllNotes(all);
  });
}, []);

// 2. debounce 的过滤
const handleSearchChange = useCallback(debounce((q) => {
  if (!q.trim() || !window._fuseIndex) {
    setDisplayNotes(allNotes);  // 空搜索 → 还原全量
    return;
  }
  const results = window._fuseIndex.search(q);
  setDisplayNotes(results.map(r => r.item));
}, 250), [allNotes]);

// 3. input onChange 触发
const onInputChange = (e) => {
  setSearchValue(e.target.value);
  handleSearchChange(e.target.value);
};

// 4. 渲染时**全用 displayNotes**（包括辅助逻辑）
displayNotes.map((note, idx) => {
  const prevPinned = displayNotes[idx - 1]?.pinned;  // ✅ displayNotes
  return <NoteCard note={note} highlightQuery={searchValue} />;
});
```

### Fuse.js 中文搜索配置对照表
| 场景 | threshold | ignoreLocation | minMatchCharLength | includeScore |
|------|-----------|----------------|-------------------|-------------|
| 中文笔记模糊搜 | 0.4 | true | 2 | true（排序用） |
| 英文技术文档 | 0.3 | true | 3 | true |
| 用户名/ID 精确搜 | 0.1 | false | 1 | false |

### 反模式清单
❌ `threshold: 0.6+` —— 中文结果会乱，一堆不相关的
❌ 索引懒构建 —— 第一次搜索才建，用户体感延迟
❌ 渲染数组（displayNotes）和辅助逻辑（notes）混用 —— 越界 undefined 崩溃
❌ highlightQuery 只在部分页面传 —— 搜索高亮样式断链
