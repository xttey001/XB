---
name: "xb-notes-experience"
description: "XB 笔记项目开发经验库。遇到类似 UI/数据/交互问题时调用，查看已验证的解决方案。"
---

# XB 笔记项目经验库

> **最后更新**：2026-08-16

## 1. 分类颜色未在左侧栏生效

**问题**：分类设置了颜色，但左侧栏分类名称仍显示灰色。
**根因**：`CategorySidebar.tsx` 中分类名 span 的 className 只根据激活态设置固定颜色，未读取 `category.color`。
**解决**：将分类名文字颜色直接绑定到 `category.color`：

```tsx
<span className="truncate font-medium" style={{ color: c.color }}>
  {c.name}
</span>
```

## 2. 置顶状态在不同视图互相干扰

**问题**：在分类 A 内置顶的笔记，会在「全部笔记」和「收藏」里也置顶；或者用户感觉修改后仍互相干扰。
**根因**：`Note` 表只有单个 `pinned` 字段，置顶是全局状态；或前端列表切换视图时缓存了旧的 `pinned` 计算值。
**解决**：
1. Prisma schema 中将置顶拆分为六个独立字段：
   - `pinnedGlobal`（全部笔记）
   - `pinnedFavorite`（收藏）
   - `pinnedImportant`（重要）
   - `pinnedCategory`（分类）
   - `pinnedLiked`（点赞）
   - `pinnedReposted`（转发）
   对应置顶排序字段：`globalPinOrder`、`favoritePinOrder`、`importantPinOrder`、`categoryPinOrder`、`likedPinOrder`、`repostedPinOrder`。
2. `GET /api/notes` 根据 `scope` 选择对应字段排序，并把该字段作为 `pinned` 返回。
3. `PUT /api/notes/[id]` 接收 `scope` 参数，只更新对应置顶字段。
4. `NoteCard` 组件通过 `scope` prop 决定点击置顶按钮时更新哪个字段；`page.tsx` 传入 `currentScope`。
5. 旧数据迁移：`scripts/migrate-pinned.js` 把旧 `pinned=true` 复制到 `pinnedGlobal=true`。

**支持的 scope 映射表**：

| 视图 | scope 参数 | 置顶字段 | 排序字段 |
|------|-----------|---------|---------|
| 全部笔记 | `all` | `pinnedGlobal` | `globalPinOrder` |
| 收藏 | `favorite` | `pinnedFavorite` | `favoritePinOrder` |
| 重要 | `important` | `pinnedImportant` | `importantPinOrder` |
| 分类 | `category` | `pinnedCategory` | `categoryPinOrder` |
| 点赞 | `liked` | `pinnedLiked` | `likedPinOrder` |
| 转发 | `reposted` | `pinnedReposted` | `repostedPinOrder` |

**注意**：同一笔记可以在多个视图分别置顶（比如在「全部笔记」置顶、同时又在「收藏」置顶），这是设计预期，不是 bug。

**新增视图的关键改动文件**：
- `prisma/schema.prisma`：新增 `pinnedLiked`、`pinnedReposted`、`likedPinOrder`、`repostedPinOrder` 字段及索引
- `lib/types.ts`：`NoteDTO` 添加新字段；`Scope` 类型添加 `'liked' | 'reposted'`
- `lib/api.ts`：`Scope` 类型扩展
- `app/api/notes/route.ts`：GET 接口支持 `liked`/`reposted` 查询参数，scope 处理逻辑
- `app/api/notes/[id]/route.ts`：PUT 接口的 scope 处理支持新视图
- `app/api/notes/reorder/route.ts`：排序逻辑支持新视图
- `app/api/notes/[id]/reposts/route.ts`：DTO 映射添加新字段，创建时初始化
- `components/NoteCard.tsx`：scope prop 类型扩展
- `components/CategorySidebar.tsx`：添加「点赞」「转发」菜单项及数量统计
- `app/page.tsx`：`Filter` 类型扩展、`currentScope` 映射、禁用新视图的自定义排序

**排查/验证**：
- 直接查库看字段：
  ```js
  const note = await prisma.note.findUnique({ where: { id } });
  console.log(note.pinnedLiked, note.pinnedReposted, note.likedPinOrder, note.repostedPinOrder);
  ```
- 或直接调 API 验证不同 scope 返回的 `pinned` 是否一致：
  ```bash
  curl -s "http://localhost:3300/api/notes?scope=liked&limit=5"
  curl -s "http://localhost:3300/api/notes?scope=reposted&limit=5"
  ```
- 如果数据正确但 UI 仍显示错误，**强制刷新浏览器**（Ctrl+F5 / Cmd+Shift+R）排除 React 状态/缓存影响。

## 3. 详情页时间显示不够具体

**问题**：创建/编辑时间只显示相对时间，没有具体年月日时分。
**解决**：在 `lib/utils.ts` 中新增 `formatTwitterTime`，使用 `date-fns` 格式化为：

```ts
export function formatTwitterTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'ah:mm · yyyy年M月d日', { locale: zhCN });
}
```

详情页和评论时间统一使用此函数。

## 4. 评论时间不具体

**问题**：评论只显示「2 小时前」等相对时间。
**解决**：`NoteSocial.tsx` 中评论与回复时间从 `formatRelativeTime` 改为 `formatTwitterTime`，悬停仍显示完整时间。

## 5. 日历无法快速选择年月

**问题**：选择 2025 年 1 月需要逐月切换，很不方便。
**解决**：`CalendarFilter.tsx` 增加三级视图：
- 点击头部 `yyyy年MM月` → 进入月份选择
- 点击头部 `yyyy年` → 进入年份选择
- 选择年份后进入月份，选择月份后返回日期视图

类型定义为 `type View = 'days' | 'months' | 'years'`。

## 6. 详情页需要点击评论按钮才能看到评论

**问题**：打开笔记详情后评论区默认折叠，需要多点一次。
**解决**：`NoteSocial.tsx` 增加 `defaultOpenComments` prop；详情页传 `true`，列表页默认 `false`。

```tsx
const [activeTab, setActiveTab] = useState<'comments' | 'reposts' | null>(
  defaultOpenComments ? 'comments' : null
);
```

并在 `useEffect` 中自动加载评论。

## 7. 详情页时间位置不符合推特布局

**问题**：创建/编辑时间在社交按钮下方，推特是在上方。
**解决**：在 `app/note/[id]/page.tsx` 中把时间信息块移到 `NoteSocial` 上方，调整 `mt-5` 间距。

## 8. Obsidian 导入图片不显示

**问题**：导入的笔记图片路径指向原 Obsidian 目录，页面加载失败。
**解决**：导入时将图片二进制复制到 `public/uploads/YYYY/MM/`，并在笔记内容中替换图片路径为新的相对路径。

## 9. 数据存储位置用户不清楚

**问题**：用户不知道笔记和图片分别存在哪里。
**澄清**：
- 笔记内容、分类、评论、点赞等结构化数据 → `prisma/dev.db`（SQLite）
- 图片、附件 → `public/uploads/YYYY/MM/`

## 10. 桌面快捷方式生成失败

**问题**：双击 `create-shortcut.bat` 没有生成桌面快捷方式。
**解决**：改用 `create-shortcut.ps1` PowerShell 脚本，生成桌面快捷方式指向 `start-xb-notes.vbs`。

## 11. 双击启动图标/脚本后服务没启动（中文 bat 乱码）

**问题**：双击 `start-xb-notes.bat` 或桌面「XB Notes」图标后，弹出的 cmd 窗口全是乱码（`'o' 不是内部或外部命令`、`'n' 不是内部或外部命令`），最终 `localhost:3300` 拒绝连接。

**根因**：`.bat` 文件以 UTF-8 without BOM 保存时，Windows cmd 会把中文字节错误拆成多个字符，导致 `echo`、`title`、`cd`、`npm run dev` 等命令被解析成乱码，服务根本没有启动。

**最终方案（已验证）**：
1. **启动脚本改用 PowerShell**：`start-xb-notes.ps1`
   - 检测 3300 端口是否已占用，避免重复启动
   - 使用 `Start-Process cmd.exe "/k title XB Notes Server && npm run dev" -WindowStyle Minimized` 启动服务
   - 轮询等待服务就绪后自动打开浏览器
2. **再加一层 VBS 静默启动器**：`start-xb-notes.vbs`
   - 双击无黑窗
   - 调用 `powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "d:\XB\start-xb-notes.ps1"`
   - `-ExecutionPolicy Bypass` 避免用户机器默认策略阻止脚本
3. **桌面快捷方式目标指向 vbs**：`create-shortcut.ps1` 生成 `XB Notes.lnk`，目标为 `d:\XB\start-xb-notes.vbs`

**停止服务**：关闭任务栏中标题为 `XB Notes Server` 的最小化 cmd 窗口即可。

## 12. 列表/原文引用图片太大、太模糊，缺少 Twitter 风格大图查看

**问题**：列表页和原文引用块的图片要么太大（接近点开尺寸）、要么太小太模糊；点击图片后直接跳转详情页，不能左右切换多张图。

**最终方案（已验证）**：

1. **统一使用 `TwitterImageGrid` 组件**（`components/TwitterImageGrid.tsx`）
   - 1 张图：撑满宽度，16:9，最大高度 500px（引用块内 360px）
   - 2 张图：左右并排正方形
   - 3 张图：Twitter 经典布局，左侧大图 + 右侧上下两图
   - 4 张图：2×2 网格
   - 5+ 图：3 列网格，最多显示 9 张，超出显示 `+N`
   - 所有多图间距 2px（`gap-0.5`）

2. **通用 `ImageLightbox` 组件**（`components/ImageLightbox.tsx`）
   - 黑色圆底白色箭头左右切换
   - 支持键盘 ← → 和 ESC 关闭
   - 底部指示点 + 顶部张数计数
   - 图片切换带淡入淡出/位移动画

3. **清晰度优化**
   - `quality={100}`：最高压缩质量
   - `unoptimized`：绕过 Next.js 自动转码/压缩，直接显示原图，避免文字边缘发虚
   - `sizes` 按实际布局宽度填写，避免浏览器请求过低分辨率图片后被硬拉大

**应用位置**：
- `NoteCard.tsx`：列表页自己发的图
- `RepostedOriginal.tsx`：原文引用块里的图
- `NoteSocial.tsx`：评论 / 转发里的图

## 13. 转发应避免双份存储：不要单独 Repost 表，只生成一条新笔记

**问题**：转发同时存在「Repost 记录（挂在原文下）」和「新 Note（时间线里）」两份数据，删除转发帖子后 Repost 记录还在，转发数也不变。

**最终方案（已验证）**：

1. **删除 `Repost` 模型**，只用 `Note.repostOfId` 表达转发关系
2. **转发接口** `/api/notes/[id]/reposts` 只负责创建一条 `repostOfId` 指向原文的新 `Note`
3. **原文转发数**通过 Prisma `_count.reposts`（即 `Note.repostOfId` 关联）实时统计
4. **原文下不再展示转发列表**，转发按钮只作为创建入口
5. **删除转发帖子时**，前端同时把原文的 `_social.repostCount` 减 1

**关键改动文件**：
- `prisma/schema.prisma`：移除 `Repost` 模型和 `repostRecords` 关系
- `app/api/notes/[id]/reposts/route.ts`：只保留 POST，返回 `{ note }`
- `app/api/notes/[id]/route.ts`、`app/api/notes/route.ts`：`_count` 从 `repostRecords` 改为 `reposts`
- `components/NoteSocial.tsx`：移除转发列表/标签页
- `app/page.tsx`：`handleNoteDeleted` 中判断 `repostOfId` 并同步减计数

## 14. 3 张图片在列表页/原文引用块不显示

**问题**：笔记包含 3 张图片时，在首页列表或转发原文引用块里看不到图片；但进入详情页后图片能正常显示。

**根因**：`components/TwitterImageGrid.tsx` 的 3 图布局虽然实现了「左侧大图 + 右侧上下两图」的 Twitter 经典结构，但存在两个问题：
1. **容器高度塌陷**：外层 grid 和子元素都没有固定宽高比。在详情页等较宽区域，`fill` 模式的图片可能还能撑开；但在列表页/引用块等较窄容器内，grid 行高无法确定，导致整个图片区域高度为 0。
2. **左侧大图缺少 `unoptimized`**：与其他布局不一致，本地图片可能受 Next.js 图片优化规则影响。

**解决**：在 `components/TwitterImageGrid.tsx` 的 3 图分支中：
1. 外层 grid 加 `aspect-square`，给整个 3 图区域固定宽高比。
2. 左侧大图的 `<button>` 加 `h-full`，配合 `row-span-2` 填满两行高度。
3. 右侧两张小图的 `<button>` 加 `aspect-square`，为 grid 行高提供基准。
4. 左侧大图的 `<Image>` 加 `unoptimized`，与其他布局保持一致。

```tsx
// 3 图：Twitter 经典布局，左侧大图 + 右侧上下两图
if (count === 3) {
  return (
    <>
      <div className={cn('grid grid-cols-2 grid-rows-2 gap-0.5 aspect-square', className)}>
        <button
          type="button"
          onClick={(e) => handleClick(e, 0)}
          className="relative row-span-2 h-full overflow-hidden rounded-lg bg-ink-50 hover:opacity-95 transition-opacity"
        >
          <Image
            src={visibleImages[0]}
            alt=""
            fill
            sizes={compact ? '(max-width: 768px) 42vw, 250px' : '(max-width: 768px) 50vw, 350px'}
            quality={90}
            unoptimized
            className="object-cover"
          />
        </button>
        {visibleImages.slice(1).map((url, idx) => (
          <button
            key={url + idx}
            type="button"
            onClick={(e) => handleClick(e, idx + 1)}
            className="relative aspect-square overflow-hidden rounded-lg bg-ink-50 hover:opacity-95 transition-opacity"
          >
            <Image
              src={url}
              alt=""
              fill
              sizes={compact ? '(max-width: 768px) 42vw, 250px' : '(max-width: 768px) 50vw, 350px'}
              quality={100}
              unoptimized
              className="object-cover"
            />
          </button>
        ))}
      </div>
      ...
    </>
  );
}
```

## 15. 日历日期统计与列表筛选数量不一致

**问题**：日历上某日期显示的数量和右侧列表实际数量对不上。例如 7 月 27 日日历显示 33 条但列表只有 27 条；7 月 28 日日历和列表都显示 0 条，但实际有 6 条。

**根因**：两个 API 处理日期时区的方式不统一：
1. `daily-stats` 查询用**本地时间**范围，但分组时用了 `note.createdAt.toISOString().slice(0, 10)`，得到的是 **UTC 日期**。
2. 列表 API 用 `new Date(startDate)` 解析日期字符串，ISO 日期字符串会被解析为 **UTC**，所以查询范围也是 UTC。

数据库里 `createdAt` 存的是 UTC。北京时间 7 月 28 日 01:00 创建的笔记，UTC 时间是 7 月 27 日 17:00，结果被 daily-stats 算进 27 日，而列表筛选 28 日时又用 UTC 范围把它排除。

**解决**：统一按**本地日期**处理。

1. `app/api/notes/daily-stats/route.ts` 分组改用本地日期：
   ```ts
   import { format } from 'date-fns';
   const dateStr = format(note.createdAt, 'yyyy-MM-dd');
   ```

2. `app/api/notes/route.ts` 把日期字符串解析成本地时间：
   ```ts
   function parseLocalDate(dateStr: string, endOfDay = false) {
     const [y, m, d] = dateStr.split('-').map(Number);
     return endOfDay
       ? new Date(y, m - 1, d, 23, 59, 59, 999)
       : new Date(y, m - 1, d);
   }

   if (startDate) where.createdAt.gte = parseLocalDate(startDate);
   if (endDate) where.createdAt.lte = parseLocalDate(endDate, true);
   ```

## 16. 单日汇总显示数量与日历不一致（分页导致）

**问题**：日历显示 7 月 27 日有 28 条，点击后右侧面板标题显示「全部笔记 28 条」，但单日汇总显示「2026年7月27日 · 共 20 条」，用户肉眼数列表也是 20 条。

**根因**：列表 API 默认 `limit=20` 分页返回。`app/page.tsx` 里的 `dailySummary` 之前用 `notes.length`（当前页可见数量）作为单日总数，而不是用接口返回的 `total`。

**解决**：单日汇总改用 `total`：

```tsx
const dailySummary = useMemo(() => {
  if (!dateFilter || dateFilter.type !== 'single') return null;
  const important = notes.filter((n) => n.importance === 'important').length;
  const veryImportant = notes.filter((n) => n.importance === 'very_important').length;
  return { date: dateFilter.date, total, important, veryImportant };
}, [notes, dateFilter, total]);
```

**注意**：日历数字 28 是对的；列表只是按 20 条一页展示，下方应有「加载更多」按钮可查看剩余 8 条。

## 17. 项目备份与恢复方案（代码 + 数据分离）

**场景**：用户每天写 10 条笔记、10 多张图片，一年数据量很大，不能把数据库和图片都塞进 GitHub 仓库。

**数据位置**：
- 代码、组件、配置 → GitHub 仓库
- 笔记内容、分类、评论、点赞等结构化数据 → `prisma/dev.db`（SQLite）
- 图片、附件 → `public/uploads/YYYY/MM/`

**备份策略（方案 B：代码与数据分离）**：
1. `.gitignore` 中忽略数据文件：
   ```gitignore
   /prisma/dev.db
   /public/uploads/*
   !/public/uploads/.gitkeep
   ```
2. 代码用 Git 提交到 GitHub。
3. `prisma/dev.db` 和图片目录 `public/uploads/` 单独备份到网盘/移动硬盘。

**恢复步骤（换电脑或重装系统后）**：
1. 从 GitHub 克隆/拉取代码；
2. 安装依赖：`npm install`；
3. 运行 `npx prisma generate` 生成 Prisma 客户端；
4. 从网盘下载 `dev.db` 放到 `prisma/dev.db`；
5. 从网盘下载 `public/uploads/` 里的所有图片，按原目录结构放回；
6. 启动服务：`npm run dev`。

**注意**：`dev.db` 只存图片路径，不存图片文件本身，所以必须同时备份 `public/uploads/` 目录，否则笔记里图片会显示不出来。

## 常用验证路径

- 首页列表：http://localhost:3300
- 详情页：`/note/{id}`
- 开发服务：`npm run dev`（端口 3300）
- 数据库同步：`npx prisma db push`
- 类型检查：`npx tsc --noEmit`

## 18. 笔记双向链接功能实现

**功能**：支持在笔记中链接到其他笔记，点击可跳转；详情页显示出链、反链、同标签关联笔记。

**架构设计**：

```
编辑器输入 → 点击🔗按钮 → NoteLinkDialog 搜索 → 选择笔记 → 插入链接 HTML
                                                              ↓
                                                     <a href="/note/{id}" class="note-link">标题</a>
                                                              ↓
                                              保存时 syncNoteLinks() 自动解析
                                                              ↓
                                              更新 NoteLink 表（sourceId + targetId）
                                                              ↓
                                              详情页 RelatedNotes 读取展示
```

**新增文件清单**：

| 文件 | 说明 |
|------|------|
| `lib/link-parser.ts` | 链接解析工具：`extractLinkedNoteIds()` 从 HTML 提取链接 ID，`syncNoteLinks()` 同步维护 NoteLink 表 |
| `app/api/notes/search/route.ts` | 搜索 API：`GET /api/notes/search?q=xxx` |
| `app/api/notes/[id]/links/route.ts` | 链接查询 API：`GET /api/notes/[id]/links` |
| `components/NoteLinkDialog.tsx` | 编辑器内笔记搜索弹窗，支持防抖搜索 + 键盘导航 |
| `components/RelatedNotes.tsx` | 详情页相关笔记面板（出链/反链/同标签） |

**修改文件清单**：

| 文件 | 修改内容 |
|------|----------|
| `prisma/schema.prisma` | 新增 `NoteLink` 模型，Note 模型新增 `outgoingLinks`/`incomingLinks` 关系 |
| `app/api/notes/route.ts` | POST 创建笔记后调用 `syncNoteLinks()` |
| `app/api/notes/[id]/route.ts` | PUT 更新笔记后调用 `syncNoteLinks()`（当 content 有变更时） |
| `lib/api.ts` | 新增 `api.searchNotes()` 和 `api.getNoteLinks()` 方法及类型定义 |
| `components/TiptapEditor.tsx` | 工具栏新增链接按钮，集成 NoteLinkDialog |
| `app/note/[id]/page.tsx` | 详情页底部集成 RelatedNotes |
| `app/globals.css` | 新增 `.note-link` 样式类 |

**关键设计决策**：

1. **链接格式**：使用标准 `<a>` 标签 + `class="note-link"` + `data-note-id` 属性，保证兼容性
2. **自动维护**：保存时自动解析，无需用户手动管理链接关系；删除笔记时级联删除链接记录
3. **同标签推荐**：当笔记有标签时，自动推荐相同标签的笔记（排除已链接的和自身），限制 6 条
4. **链接文本策略**：有选中文字时用选中文字作为链接文本，否则使用目标笔记标题
5. **分类 Category DTO 缺少 `pinned` 字段问题**：修复了多个 API 文件中 CategoryDTO 映射遗漏 `pinned` 字段的问题（`categories/route.ts`、`notes/route.ts`、`notes/[id]/route.ts`、`notes/[id]/reposts/route.ts`）

**样式说明**：

```css
.note-link {
  @apply text-accent-600 font-medium no-underline border-b border-dashed 
         border-accent-100 hover:border-accent-600 hover:text-accent-700 
         cursor-pointer transition-colors;
}
```

使用虚线边框区分笔记链接与普通超链接。

**注意事项**：

- `api/notes/route.ts` 中的 NoteDTO 映射需确保 category 对象包含 `pinned` 字段（本次修复了遗漏）
- `syncNoteLinks()` 使用 `Promise.all` 并行处理新增和删除，性能较好
- 搜索 API 的摘要字段使用纯文本（去除 HTML 标签），最大 80 字符

## 19. 置顶按钮实时更新排序原理

**问题**：在「置顶」视图或其他分类视图中点击置顶/取消置顶按钮后，笔记位置不会实时更新，需要刷新页面才能看到变化。

**根因**：`handleNoteUpdated` 函数只更新了笔记数据（`map` 替换），但没有重新排序数组。排序逻辑完全依赖后端 API 返回的顺序，但前端状态没有同步排序。

**解决**：在 `handleNoteUpdated` 中添加实时排序逻辑，与后端 API 的排序规则保持一致。

### 实时更新原理

```
用户点击置顶按钮
    ↓
API 更新笔记的置顶状态和排序值
    ↓
返回更新后的 NoteDTO
    ↓
handleNoteUpdated 接收更新后的笔记
    ↓
setNotes 更新状态：map 替换该笔记 + sort 重新排序
    ↓
React 重新渲染列表（无需刷新页面）
```

### 排序规则（与 API 保持一致）

1. **allPinned 视图**：按 `globalPinOrder` 降序 → `createdAt` 降序
2. **其他视图**：按对应 `pinnedField` 降序 → `pinOrderField` 降序 → `orderField`/`createdAt` 降序

### Scope 字段映射表

| Scope | 置顶字段 (pinnedField) | 排序字段 (pinOrderField) | 自定义排序 (orderField) |
|-------|----------------------|------------------------|----------------------|
| `all` | `pinnedGlobal` | `globalPinOrder` | `globalOrder` |
| `favorite` | `pinnedFavorite` | `favoritePinOrder` | `favoriteOrder` |
| `important` | `pinnedImportant` | `importantPinOrder` | `importantOrder` |
| `veryImportant` | `pinnedVeryImportant` | `veryImportantPinOrder` | `importantOrder` |
| `category` | `pinnedCategory` | `categoryPinOrder` | `categoryOrder` |
| `liked` | `pinnedLiked` | `likedPinOrder` | `globalOrder` |
| `reposted` | `pinnedReposted` | `repostedPinOrder` | `globalOrder` |

### 关键代码实现

**`app/page.tsx`** 中的 `handleNoteUpdated`：

```tsx
const handleNoteUpdated = (note: NoteDTO) => {
  setNotes((prev) => {
    const updated = prev.map((n) => (n.id === note.id ? note : n));
    
    // allPinned 视图特殊处理
    if (currentScope === 'allPinned') {
      return updated.sort((a, b) => {
        if (b.globalPinOrder !== a.globalPinOrder) {
          return b.globalPinOrder - a.globalPinOrder;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    }
    
    // 其他视图：按映射表排序
    const pinnedFieldMap = { all: 'pinnedGlobal', favorite: 'pinnedFavorite', ... };
    const pinOrderFieldMap = { all: 'globalPinOrder', ... };
    const orderFieldMap = { all: 'globalOrder', ... };
    
    const pinnedField = pinnedFieldMap[currentScope];
    const pinOrderField = pinOrderFieldMap[currentScope];
    const orderField = orderFieldMap[currentScope];
    
    return updated.sort((a, b) => {
      // 1. 先按置顶状态排序
      if (a[pinnedField] !== b[pinnedField]) {
        return b[pinnedField] ? 1 : -1;
      }
      // 2. 再按 pinOrder 排序
      if (a[pinOrderField] !== b[pinOrderField]) {
        return b[pinOrderField] - a[pinOrderField];
      }
      // 3. 最后按 order 或 createdAt 排序
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });
};
```

### 扩展视图注意事项

新增视图时需要同步更新：
1. `lib/types.ts` - `NoteDTO` 添加新字段、`Scope` 类型扩展
2. `app/api/notes/route.ts` - GET 接口添加新 scope 的排序逻辑
3. `app/api/notes/[id]/route.ts` - PUT 接口添加新 scope 的置顶字段处理
4. `app/page.tsx` - `handleNoteUpdated` 的三个映射表添加新字段
5. `components/NoteCard.tsx` - 按钮显示逻辑适配新 scope

### 已实现实时更新的功能列表

| 功能 | 触发方式 | 实时更新逻辑 |
|------|----------|-------------|
| 置顶/取消置顶 | `handleTogglePin` → `onUpdated` | `handleNoteUpdated` 重新排序 |
| 置顶到顶部 | `handlePinToTop` → `onUpdated` | `handleNoteUpdated` 重新排序（allPinned 特殊逻辑） |
| 收藏/取消收藏 | `handleToggleFav` → `onUpdated` | `handleNoteUpdated` 仅更新状态，不改变位置 |
| 重要等级更新 | `handleUpdateImportance` → `onUpdated` | `handleNoteUpdated` 重新排序 |
| 自定义排序上下移 | `handleMove` | 直接交换数组位置 + 更新 order 值 |
| 点赞 | `NoteSocial.handleToggleLike` → `onUpdate` | `handleNoteUpdated` 仅更新状态 |
| 删除 | `handleDelete` → `onDeleted` | `handleNoteDeleted` 过滤掉已删除的笔记 |

**注意**：自定义排序模式下，`handleMove` 会直接交换数组中笔记的位置，而不仅仅交换 `order` 值。

## 20. 分类自定义图标（图片路径）在原生 select 中显示为文本

**问题**：分类 `icon` 字段存储了图片路径（如 `/icons/naruto/kakashi.jpg`），在页面某些位置能正常渲染为图片，但在**笔记编辑器的分类下拉选择器**中显示为纯文本路径。

**第一性原理分析**：
- emoji/文字图标能显示：因为它是合法 React 字符串子节点，`<span>🐱</span>` 浏览器直接渲染为 emoji 图形
- 图片路径显示为文本：HTML 原生 `<option>` 标签**只能包含纯文本**，无法嵌入 `<img>` 标签。`<option>{"/icons/naruto/kakashi.jpg"}</option>` 会原样输出字符串

**排查路径**：
1. 数据库 icon 值正确（用 `node scripts/check-icons.js` 查）
2. 前端渲染逻辑（`isImageIcon` 判断是否以 `/` 开头）
3. **关键定位**：哪些组件用了原生 `<select>` / `<option>`

**解决方案**：将原生 `<select>` 替换为**自定义下拉组件**。

### 实现方式（NoteEditor.tsx 示例）

```tsx
import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
const categoryRef = useRef<HTMLDivElement>(null);

// 点击外部关闭
useEffect(() => {
  const handler = (e: MouseEvent) => {
    if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
      setCategoryDropdownOpen(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, []);

const selectedCategory = categories.find((c) => c.id === categoryId);

// 自定义触发器 + 下拉面板
<div ref={categoryRef} className="relative">
  <button onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}>
    {selectedCategory ? (
      <span className="flex items-center gap-1">
        {(selectedCategory.icon || '').trim().startsWith('/') ? (
          <img src={selectedCategory.icon!.trim()} className="w-3.5 h-3.5 rounded-full object-cover" />
        ) : (
          <span>{selectedCategory.icon}</span>  // emoji
        )}
        {selectedCategory.name}
      </span>
    ) : '未分类'}
    <ChevronDown size={12} />
  </button>
  {categoryDropdownOpen && (
    <div className="absolute top-full mt-1 z-50 ...">
      {categories.map((c) => (
        <button key={c.id} onClick={() => setCategoryId(c.id)}>
          {c.icon && (c.icon || '').trim().startsWith('/') ? (
            <img src={c.icon.trim()} className="w-4 h-4 rounded-full object-cover" />
          ) : (
            <span>{c.icon}</span>
          )}
          {c.name}
        </button>
      ))}
    </div>
  )}
</div>
```

### 渲染工具函数（可复用）

在 `CategorySidebar.tsx` 等多处需要渲染图标时，统一使用内联判断而非外部工具函数（避免 Next.js HMR 对工具函数新导出不生效）：

```tsx
function renderIcon(icon: string, size: string = 'w-6 h-6 text-sm') {
  const v = (icon || '').trim();
  const isImg = v.startsWith('/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(v);
  if (isImg) {
    return (
      <span className={`${size} inline-flex items-center justify-center overflow-hidden rounded-full`}>
        <img src={v} alt="" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </span>
    );
  }
  return <span className={size}>{icon}</span>;
}
```

### 图片资源规范

- 存放在 `public/icons/<theme>/` 目录
- 分类图标建议 100×100 ~ 200×200px，圆形裁切
- 数据库存储路径为 `/icons/<theme>/<name>.jpg`（以 `/` 开头标识为图片）
- emoji 分类保持原样（如 `🐱` `⭐`）

### 渲染位置汇总（三处统一）

| 位置 | 文件 | 渲染方式 |
|------|------|----------|
| 侧边栏分类列表 | `CategorySidebar.tsx` | `renderIcon()` 函数 |
| 笔记卡片分类标签 | `NoteCard.tsx` | 内联判断 `startsWith('/')` |
| 笔记详情页分类 | `app/note/[id]/page.tsx` | 内联判断 `startsWith('/')` |
| 编辑器分类下拉 | `NoteEditor.tsx` | 自定义下拉组件 |

### 常见坑

1. **Next.js HMR 不刷新工具函数**：新增到 `lib/utils.ts` 的导出函数，前端 HMR 有时不生效，建议**内联判断**或**重启 dev server**
2. **原生 `<select>` 无法嵌入 `<img>`**：必须用自定义组件
3. **数据库 icon 值含空格**：存/取时都要 `trim()`
4. **图片路径错误**：用 `onError` 回调隐藏破图，避免布局错乱
5. **侧边栏列表图片被撑大**：容器必须加 `w-5 h-5 overflow-hidden rounded-full`，`<img>` 加 `w-full h-full object-cover`

## 21. Token 消耗过多的原因与优化方案

**问题**：在使用 AI 生成功能（如批量图片生成）时，token 消耗异常大。

**原因分析**：

1. **对话上下文累积**：
   - 每轮对话都会携带完整的历史消息（包括代码读取、编辑、工具调用结果）
   - 多轮迭代修改（如修复图标显示、调试下拉组件）会导致上下文越来越长
   - 解决方案：**任务完成后开新对话**，让新任务有干净的上下文

2. **批量操作过多**：
   - 一次性批量生成 7+ 张图片 / 调用多个工具
   - 解决方案：**分批处理**，每批 3-4 个，分多轮完成

3. **Prompt 描述过于详细**：
   - 每张图片的 prompt 写了 150+ 字符，包含冗余描述
   - 解决方案：**简化 prompt**，只写核心特征

**优化建议**：

| 优化项 | 说明 | 示例 |
|--------|------|------|
| **减少批量数量** | 每批 3-4 张，分多轮生成 | 火影 6 张图标 → 分 2 轮，每轮 3 张 |
| **简化 prompt** | 只写核心特征，去掉冗余词 | 去掉 "clean style, high quality" 等 |
| **开新对话** | 任务完成后立即开新对话 | 图标完成 → 新建对话处理下一个功能 |
| **SVG 替代** | 简约图标用 SVG 代码生成，零 token 消耗 | 分类小图标改用内联 SVG |

**触发警告**：当遇到以下情况时，应提示用户开新对话：
- 对话历史超过 10 轮
- 单次任务涉及 5+ 个文件的修改
- 批量生成超过 5 张图片
- 执行大型重构任务

**示例 Prompt 优化**：

```xml
<!-- 之前（冗余） -->
"Naruto anime character icon: Kurama the Nine-Tailed Fox minimalist circular avatar. Orange-red fur with dark stripes, nine flowing tails behind, glowing golden eyes, fierce expression, chakra energy aura, head and upper body only, white background, clean vector style, high quality"

<!-- 之后（精简） -->
"Kurama nine-tailed fox circular avatar, orange-red fur, golden eyes, white background"
```

## 22. AI 绘图工具选择指南

### 何时使用 GenerateImage（Seedream）

**适用场景**：
- 需要生成人物插画、艺术风格图标
- 要求高保真度（如火影人物特征还原）
- 需要复杂的光影、色彩效果
- 一次性生成 1-3 张图片

**特点**：
- 生成质量高，适合艺术作品
- 支持 square_hd（1024x1024）高清输出
- 消耗 token 较多，建议单次不超过 4 张

### 何时选择 SVG 方案

**适用场景**：
- 简约几何图标（圆形、线条、色块）
- 需要无限缩放不失真
- 加载速度要求高
- 需要动态修改颜色/大小

**优点**：
- 零 token 消耗
- 加载快（矢量图）
- 可通过 CSS 动态调整样式
- 可通过代码批量生成

### 混合使用策略

1. **人物/动物头像** → 用 GenerateImage（Seedream）
2. **装饰性小图标** → 用 SVG 或 emoji
3. **需要频繁更新的图标** → 用 SVG（便于代码修改）

**最后更新**：2026-08-16
