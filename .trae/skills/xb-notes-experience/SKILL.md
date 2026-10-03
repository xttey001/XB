---
name: "xb-notes-experience"
description: "XB 笔记项目（Next.js + Prisma + SQLite + Tailwind）开发经验库。触发词：分类颜色、分类图标、侧边栏颜色、置顶、scope、多视图排序、Twitter图片、图片不显示、3图布局、aspect-square、拖拽排序、useRef异步、时区、日期统计不一致、分页total、双向链接、NoteLink、滚动恢复、anchor、scroll:false、buildFilterUrl、sessionStorage滚动、clash代理、git push、PowerShell启动、VBS静默、bat乱码、快捷方式、日历三级视图、defaultOpenComments、Obsidian导入、原生select、图片图标emoji、Next.js HMR、备份恢复、dev.db、uploads目录、Token优化、批量生成、SVG绘图、Repost表删除、repostOfId、DailyStats时区、handleNoteUpdated实时排序、loadingPrevRef、isFilterChanged、API DTO pinned字段、IconEditor、分类图标制作、圆形裁切、Canvas API、canvas ref陷阱、条件渲染ref、tag聚合、自动打标、关键词检测、SidebarItem、虚拟视图、tagName、f=tag、A类买点"
---

# XB 笔记项目经验库

> **最后更新**：2026-10-03（新增 #27 Tag 自动打标 + 侧边栏虚拟聚合视图）

## TOC 快速定位

```
[CATEGORY] 分类颜色/图标/侧边栏 → #1 #20 #23
[PIN-SCOPE] 置顶/排序 scope 机制 → #2 #19
[TIME] 时间显示/时区 → #3 #4 #15
[CALENDAR] 日历组件 → #5 #15 #16
[SOCIAL] 评论/转发/点赞 → #6 #13
[IMAGE] 图片显示/布局/图标/Canvas裁切 → #8 #12 #14 #20 #26
[DATA] 数据模型/存储/备份 → #9 #13 #17
[LINK] 双向链接 NoteLink → #18
[WINDOWS] 启动/Git/桌面集成 → #10 #11 #24
[APP-ROUTER] Next.js App Router → #25
[AI-TOOLS] AI 绘图/token → #21 #22
[DRAG] 拖拽排序 → #23
[TAG-VIEW] tag自动打标+侧边栏虚拟聚合 → #27
```

---

## 1. 分类颜色未在左侧栏生效 `[CATEGORY]`

**问题**：分类设置了颜色，但左侧栏分类名称仍显示灰色。
**根因**：`CategorySidebar.tsx` 中分类名 span 的 className 只根据激活态设置固定颜色，未读取 `category.color`。
**解决**：将分类名文字颜色直接绑定到 `category.color`：

```tsx
<span className="truncate font-medium" style={{ color: c.color }}>
  {c.name}
</span>
```

## 2. 置顶状态在不同视图互相干扰 `[PIN-SCOPE][DATA]`

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

## 3. 详情页时间显示不够具体 `[TIME]`

**问题**：创建/编辑时间只显示相对时间，没有具体年月日时分。
**解决**：在 `lib/utils.ts` 中新增 `formatTwitterTime`，使用 `date-fns` 格式化为：

```ts
export function formatTwitterTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, 'ah:mm · yyyy年M月d日', { locale: zhCN });
}
```

详情页和评论时间统一使用此函数。

## 4. 评论时间不具体 `[TIME][SOCIAL]`

**问题**：评论只显示「2 小时前」等相对时间。
**解决**：`NoteSocial.tsx` 中评论与回复时间从 `formatRelativeTime` 改为 `formatTwitterTime`，悬停仍显示完整时间。

## 5. 日历无法快速选择年月 `[CALENDAR]`

**问题**：选择 2025 年 1 月需要逐月切换，很不方便。
**解决**：`CalendarFilter.tsx` 增加三级视图：
- 点击头部 `yyyy年MM月` → 进入月份选择
- 点击头部 `yyyy年` → 进入年份选择
- 选择年份后进入月份，选择月份后返回日期视图

类型定义为 `type View = 'days' | 'months' | 'years'`。

## 6. 详情页需要点击评论按钮才能看到评论 `[SOCIAL]`

**问题**：打开笔记详情后评论区默认折叠，需要多点一次。
**解决**：`NoteSocial.tsx` 增加 `defaultOpenComments` prop；详情页传 `true`，列表页默认 `false`。

```tsx
const [activeTab, setActiveTab] = useState<'comments' | 'reposts' | null>(
  defaultOpenComments ? 'comments' : null
);
```

并在 `useEffect` 中自动加载评论。

## 7. 详情页时间位置不符合推特布局 `[TIME]`

**问题**：创建/编辑时间在社交按钮下方，推特是在上方。
**解决**：在 `app/note/[id]/page.tsx` 中把时间信息块移到 `NoteSocial` 上方，调整 `mt-5` 间距。

## 8. Obsidian 导入图片不显示 `[IMAGE]`

**问题**：导入的笔记图片路径指向原 Obsidian 目录，页面加载失败。
**解决**：导入时将图片二进制复制到 `public/uploads/YYYY/MM/`，并在笔记内容中替换图片路径为新的相对路径。

## 9. 数据存储位置用户不清楚 `[DATA]`

**问题**：用户不知道笔记和图片分别存在哪里。
**澄清**：
- 笔记内容、分类、评论、点赞等结构化数据 → `prisma/dev.db`（SQLite）
- 图片、附件 → `public/uploads/YYYY/MM/`

## 10. 桌面快捷方式生成失败 `[WINDOWS]`

**问题**：双击 `create-shortcut.bat` 没有生成桌面快捷方式。
**解决**：改用 `create-shortcut.ps1` PowerShell 脚本，生成桌面快捷方式指向 `start-xb-notes.vbs`。

## 11. 双击启动图标/脚本后服务没启动（中文 bat 乱码） `[WINDOWS]`

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

## 12. 列表/原文引用图片太大、太模糊，缺少 Twitter 风格大图查看 `[IMAGE]`

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

## 13. 转发应避免双份存储：不要单独 Repost 表，只生成一条新笔记 `[SOCIAL][DATA]`

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

## 14. 3 张图片在列表页/原文引用块不显示 `[IMAGE]`

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

## 15. 日历日期统计与列表筛选数量不一致 `[TIME][CALENDAR]`

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

## 16. 单日汇总显示数量与日历不一致（分页导致） `[CALENDAR]`

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

## 17. 项目备份与恢复方案（代码 + 数据分离） `[DATA][BACKUP]`

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

## 18. 笔记双向链接功能实现 `[LINK][DATA]`

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

## 19. 置顶按钮实时更新排序原理 `[PIN-SCOPE][DATA]`

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

## 20. 分类自定义图标（图片路径）在原生 select 中显示为文本 `[CATEGORY][IMAGE]`

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

## 21. Token 消耗过多的原因与优化方案 `[AI-TOOLS]`

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

## 22. AI 绘图工具选择指南 `[AI-TOOLS]`

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

**最后更新**：2026-08-30

## 23. 分类侧边栏拖拽排序（HTML5 原生 Drag & Drop） `[DRAG][CATEGORY]`

**功能**：左侧分类列表支持鼠标左键拖拽任意分类到其他位置，松手后自动保存排序到数据库。

### 前置条件（已存在，无需新建）

后端 API 和数据模型提前就绪，本次只需写前端：

| 已存在资源 | 说明 |
|-----------|------|
| `Category.order` 字段 | Prisma schema 已有 `order Int @default(0)` |
| `POST /api/categories/reorder` | `body: { items: [{ id, order }] }`，事务批量更新 |
| `api.reorderCategories()` | `lib/api.ts` 客户端方法已封装 |

### 实现原理

```
鼠标按下某分类
    ↓
handleDragStart: 记录 draggingId（useRef + useState 双写）
    ↓
鼠标移动经过各分类
    ↓
handleDragOver: 计算鼠标在目标上半部还是下半部
    ↓
               上半部 → 显示顶部插入线（插到目标前）
               下半部 → 显示底部插入线（插到目标后）
    ↓
鼠标松开
    ↓
handleDrop: 计算新位置 → splice 重排数组 → 重新分配 order 值 → 调用 API → 刷新
```

### 关键坑：React state 异步更新

**问题**：`handleDragStart` 里执行了 `setDraggingId(id)`，但紧接着浏览器触发 `handleDragOver` 时，读到的 `draggingId` state 仍然是 `null`（React 批量更新机制）。

**解决**：**同时维护一份 `useRef`**，ref 承担同步读写：

```tsx
const draggingIdRef = useRef<string | null>(null);

const handleDragStart = (e, catId) => {
  draggingIdRef.current = catId;  // 同步写入
  setDraggingId(catId);          // 用于渲染
};

const handleDragOver = (e, idx) => {
  if (draggingIdRef.current == null) return;  // 用 ref 读，不会丢
  // ...
};

const handleDrop = (e, targetIdx) => {
  const dragId = draggingIdRef.current;  // drop 里也从 ref 取
  draggingIdRef.current = null;          // 立即清空
  // ...
};
```

**经验教训**：所有原生 DOM 事件回调（dragstart、dragover、drop 等）如果需要访问自身状态，必须用 `useRef` 同步读写，不能依赖 `useState`。

### 插入位置计算（上半部 vs 下半部）

核心逻辑在 `handleDragOver`：

```tsx
const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
const mid = rect.top + rect.height / 2;
const position = e.clientY < mid ? 'top' : 'bottom';
```

然后 `handleDrop` 里根据 `position` 计算新 index：

```tsx
let newIdx;
if (position === 'top') {
  newIdx = dragIdx < targetIdx ? targetIdx - 1 : targetIdx;
} else {
  newIdx = dragIdx < targetIdx ? targetIdx : targetIdx + 1;
}
```

**为什么要区分上/下半部**：这样用户能精准控制插到目标项"前面"还是"后面"，拖拽体验类似 Trello、Linear 等现代应用。

### order 值分配策略

API 排序是 `order DESC`（越大越靠前），所以新数组 `reordered` 重新赋值时：

```tsx
const items = reordered.map((c, i) => ({ id: c.id, order: (reordered.length - i) * 10 }));
```

间距用 **10** 而不是连续的 1、2、3…… 好处是以后如果需要在两个分类之间再插入一个，只需要 `中间值 = (前 + 后) / 2` 即可，不用整体重排。

### 视觉反馈清单

| 状态 | 视觉效果 |
|------|----------|
| 可拖拽 | 光标 `cursor-grab`（hover）、`cursor-grabbing`（active） |
| 正在拖动 | 当前项 `opacity: 0.4` + `scale-[0.98]` 微缩 |
| 悬停目标（上半部） | 目标顶部蓝色插入线 |
| 悬停目标（下半部） | 目标底部蓝色插入线 |
| 编辑/删除中 | `draggable={false}`，禁用拖拽避免冲突 |

### 改动文件清单

只改了一个文件：`components/CategorySidebar.tsx`

| 改动点 | 说明 |
|--------|------|
| 新增状态 | `draggingId`、`dragOverIdx`、`dragInsertPosition` |
| 新增 ref | `draggingIdRef`（解决异步问题） |
| 新增函数 | `handleDragStart`、`handleDragEnd`、`handleDragOver`、`handleDrop` |
| 分类项 div | 加 `draggable={canDrag}` 和 4 个拖拽事件 |
| 分类项 className | 加 `cursor-grab`、`opacity-40`、`scale-[0.98]` 等条件类 |
| 插入指示线 | `<span className="absolute h-0.5 bg-accent-500 ...">` 条件渲染 |

### 可复用代码模板

这套 HTML5 原生拖拽 + 上/下半部插入定位 + useRef 同步状态 的模式，可以直接套用到任何垂直列表排序场景（笔记自定义排序、标签排序等），只要把：

1. `categories` 换成目标数组
2. `api.reorderCategories({ items })` 换成对应的重排序 API
3. `order DESC` 的赋值逻辑适配目标表的排序字段

即可。**不需要引入 `react-dnd`、`dnd-kit` 等第三方库**，HTML5 原生 API 足够应对侧边栏级别的列表排序。

## 24. Windows Git 推送三件事：bat 乱码 + Clash 代理 + 快捷脚本 `[WINDOWS]`

**问题**：用户频繁需要推送代码到 GitHub，希望一键操作。但自建 `push.bat` 后遇到两个问题：双击乱码、push 连不上。

### bat 乱码根因

Windows CMD 默认代码页是 **CodePage 936（GB2312）**，如果 `.bat` 文件以 UTF-8 保存，CMD 启动时直接按 GB2312 解析字节，中文全部变成 mojibake。脚本开头写 `chcp 65001 >nul` 没用 —— **文件在被解析时编码就已经错了**，等执行到 `chcp` 时所有命令字符串已经被拆坏。

**解决方案（两层保险）**：

1. **所有提示和注释用英文**，彻底绕开编码问题
2. **文件以 GB2312 编码保存**。在 PowerShell 里写：
   ```powershell
   [System.IO.File]::WriteAllText("push.bat", $content, [System.Text.Encoding]::GetEncoding(936))
   ```

### push 连不上 GitHub（Clash 代理）

**根因**：Clash 开了，但 git 默认**不走代理**。`git push` 直接裸连 `github.com:443` 被墙挡住。

**排查步骤**：

1. 确认系统能否直接连：`Test-NetConnection github.com -Port 443`（TcpTestSucceeded = False 就是被墙）
2. 查本地代理端口：`Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 7890,7897,9090,10808,10809 }`
   - Clash 默认 HTTP 端口可能是 **7890、7897** 或用户自定义
3. 确认 git 代理配置：`git config --global --get http.proxy`

**配置命令（用户手动在 CMD 里执行，Agent 沙箱会拦截全局 gitconfig 写入）**：

```bat
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
```

如果只想某个仓库走代理（不影响其他仓库），去掉 `--global` 即可：
```bat
git config http.proxy http://127.0.0.1:7897
git config https.proxy http://127.0.0.1:7897
```

**⚠️ 重要**：Clash 的 **HTTP 代理端口**（通常 7890/7897）和 **API 端口**（9090）不是同一个。git 需要连的是 HTTP 代理端口，不是 9090。

### push.bat 完整实现（已验证可直接用）

位置：项目根目录 `push.bat`

```bat
@echo off
setlocal

rem ====== Git Push Shortcut ======
rem Usage: push.bat "commit message"  or  push.bat (auto message)

cd /d "%~dp0"

rem Check if git repo
if not exist ".git" (
    echo [ERROR] Not a git repository
    pause
    exit /b 1
)

rem Check for changes
git status --porcelain | findstr /r ".*" >nul
if errorlevel 1 (
    echo [INFO] No changes to commit
    pause
    exit /b 0
)

rem Build commit message
if "%~1"=="" (
    for /f "delims=" %%c in ('git status --porcelain ^| find /c /v ""') do set COUNT=%%c
) else (
    set MSG=%~1
)

echo.
echo ============ Git Push ============
echo Message: %~1
echo.

rem Add all changes
git add -A
if errorlevel 1 (
    echo [ERROR] git add failed
    pause
    exit /b 1
)

rem Commit
if "%~1"=="" (
    git commit -m "sync: %COUNT% files updated"
) else (
    git commit -m "%~1"
)
if errorlevel 1 (
    echo [ERROR] git commit failed
    pause
    exit /b 1
)

rem Push
git push origin main
if errorlevel 1 (
    echo [ERROR] git push failed
    pause
    exit /b 1
)

echo.
echo [DONE] Push success!
pause
endlocal
```

### 经验教训

| 现象 | 真正原因 | 正确做法 |
|------|----------|----------|
| bat 乱码 | 文件以 UTF-8 保存，CMD 按 GB2312 解析 | 纯英文 + GB2312 编码保存 |
| `chcp 65001` 无效 | 解析在执行前完成，太迟了 | 不要依赖 chcp |
| `git push` 卡死 21 秒后失败 | 被墙 | 配 Clash 代理 |
| Agent 说已推成功但远程没更新 | Agent 沙箱环境可能走了不同网络路径 | 让用户在本机验证 |
| Agent 改不了全局 gitconfig | 沙箱限制 C:\Users\*\ .gitconfig | 提示用户手动在管理员 CMD 执行 |

### 快速诊断 Checklist

```powershell
# 1. 测试能否直连 GitHub
Test-NetConnection github.com -Port 443

# 2. 查代理端口（Clash 等）
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -gt 1024 }

# 3. 查 git 代理配置
git config --global --list | findstr proxy

# 4. 查当前仓库代理配置（覆盖全局）
git config --list | findstr proxy
```

**最后更新**：2026-09-23

## 25. Next.js App Router 滚动恢复三件事：URL anchor + scroll:false 显式重置 + filter 区分 `[APP-ROUTER]`

### 问题场景

1. **详情页返回列表页回到顶部**：点击子分类第 4 篇卡片进详情，点返回后直接回到列表顶部，不是第 4 篇卡片位置
2. **不同子分类滚动位置串页**：在 ICT 分类滚到中间，切到 MTM（从没看过），却还停在 ICT 的滚动位置

### 踩过的坑（三种方案都没解决）

| 方案 | 为什么不行 |
|------|-----------|
| **sessionStorage 存 scrollY** | 跟 Next.js App Router 内置 scroll 恢复打架；`window.scrollTo` 时机不确定；filterToQuery('all')=空串可能串 key |
| **简单 anchor（没保留 URL 非 filter 参数）** | `router.back()` 回来 URL 带着 `anchor=note_n4`，但主页 filter 同步 useEffect 立即 `router.replace("/?f=category&id=ict")` **把 anchor 整个干掉了** |
| **简单 anchor + scroll:false** | `router.replace(..., { scroll: false })` 就是"完全不碰滚动"，手动切分类时旧 scrollY 原样保留 |

### 最终方案（三件事缺一不可）

#### 1. URL anchor 参数实现"返回精准定位到卡片"

**原理**：点击卡片进详情前，用 `replaceState` 给当前 history entry 加 `anchor=笔记ID`；详情页返回时，浏览器 history 栈里的主页 URL 带着 anchor，主页加载完读出来滚到对应元素。

**Step 1 - NoteCard 点进详情前写 anchor**（`components/NoteCard.tsx`）：

```tsx
const goToDetail = () => {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('anchor', note.id);
    window.history.replaceState(null, '', url.toString()); // 改当前 entry，不触发重渲染
  } catch {}
  router.push(`/note/${note.id}`);
};
```

**Step 2 - NoteCard 外层加 id**（`components/NoteCard.tsx`）：

```tsx
<article id={`note-${note.id}`} className={cn(...)}>
```

**Step 3 - 主页 loading 完成后滚到 anchor**（`app/page.tsx`）：

```tsx
const loadingPrevRef = useRef(true);
const anchorConsumedRef = useRef<string | null>(null);

useEffect(() => {
  if (loadingPrevRef.current && !loading) {
    const anchor = searchParams.get('anchor');
    if (anchor && anchor !== anchorConsumedRef.current) {
      anchorConsumedRef.current = anchor;
      requestAnimationFrame(() => {
        const el = document.getElementById(`note-${anchor}`);
        if (el) el.scrollIntoView({ behavior: 'auto', block: 'center' });
        // 消费完清掉 anchor，避免刷新又滚
        const url = new URL(window.location.href);
        url.searchParams.delete('anchor');
        window.history.replaceState(null, '', url.toString());
      });
    }
  }
  loadingPrevRef.current = loading;
}, [loading, searchParams]);
```

#### 2. buildFilterUrl 必须保留非 filter 参数（anchor 等）

**致命 bug 教训**：`filterToQuery(filter)` 只输出 `/?f=category&id=xxx`，**完全不管 URL 上已有的 anchor**。router.replace 一执行，anchor 参数就被干掉了，后面 anchor 恢复代码自然读不到。

**正确做法**：`buildFilterUrl(f, existingSp, filterChanged)` 接收当前 URL 的 `searchParams`，**先保留非 filter 参数**，再写 filter 参数；如果 filter 变了，anchor（绑定特定 filter）要清掉：

```tsx
const FILTER_PARAM_KEYS = new Set(['f', 'id']); // 只有这俩是 filter 控制的

const buildFilterUrl = (f, existingSp, filterChanged) => {
  const url = new URL(window.location.href);
  url.search = '';
  // 保留非 filter 参数，但若 filter 变了 → 清 anchor
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
  return url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
};
```

#### 3. filter 变化时分两种情况显式控制滚动

**关键认知**：`router.replace(..., { scroll: false })` 是"完全不碰滚动"——既不重置到顶部，也不恢复。所以：
- **手动切分类**（filterChanged=true）→ 必须显式 `window.scrollTo({ top: 0 })`
- **浏览器 back/forward**（filter 没变）→ **不碰滚动**（等 anchor 恢复逻辑滚到正确位置）

```tsx
useEffect(() => {
  const filterChanged = isFilterChanged(filter, searchParams);
  const expected = buildFilterUrl(filter, searchParams, filterChanged);
  const actual = searchParams.toString() ? `?${searchParams.toString()}` : '';
  if (expected !== actual) {
    urlSyncingRef.current = true;
    router.replace(expected, { scroll: false });
    // 手动切分类 → 显式重置滚动（scroll:false 不会帮我们滚）
    if (filterChanged) {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    }
  } else {
    urlSyncingRef.current = false;
  }
}, [filter, router, searchParams, buildFilterUrl, isFilterChanged]);
```

### 场景走查表

| 场景 | filterChanged | anchor 处理 | scroll 处理 | 结果 |
|------|--------------|------------|------------|------|
| ICT 滚中间 → 进详情 → 返回 | false（back，filter 没变） | **保留**（在 URL 上） | **不重置**（等 anchor 恢复） | ✅ 回到那篇卡片 |
| ICT → 切到 MTM（从没看过） | true | **清掉**（filter 变了） | **显式滚到顶部** | ✅ MTM 从顶部开始 |
| MTM → 切回 ICT | true | ICT anchor 已清 / 本次 buildFilterUrl 清 | **显式滚到顶部** | ✅ ICT 从顶部开始 |
| 同一分类内刷新 | 不触发 replace | — | — | ✅ 正常 |

### 关键改动文件

| 文件 | 改动 |
|------|------|
| `components/NoteCard.tsx` | 新增 `goToDetail()` + 外层 `<article id="note-{id}">` |
| `app/page.tsx` | `filterToQuery` → `isFilterChanged` + `buildFilterUrl` + anchor 恢复 useEffect + filterChanged 时显式滚顶 |

### 经验教训总结

1. **anchor > sessionStorage**：URL 参数天然跟随浏览器 history，不存在串页问题
2. **buildFilterUrl 不能丢参数**：任何 router.replace 构造的 URL 必须从当前 URL searchParams 出发，手动保留非 filter 参数
3. **scroll:false 不是"保持当前位置"**：是"完全不管"——手动切 filter 时必须自己滚
4. **anchor 绑定 filter**：ICT 分类的 anchor 在 MTM 分类没意义，filter 变了必须清 anchor
5. **loadingPrevRef 用 true→false 当触发条件**：App Router 缓存组件，不要依赖"组件重新挂载"

---

## 26. 分类图标制作功能实现（Canvas 自动圆形裁切）+ 条件渲染 ref 致命陷阱 `[IMAGE][CATEGORY]`

**触发词**：IconEditor、分类图标制作、圆形裁切、Canvas API、canvas ref 陷阱、条件渲染 ref
**根因**：用 `condition ? <canvas ref={canvasRef} /> : <其他>` 条件渲染 canvas，导致初始渲染时 ref.current === null，事件回调静默退出
**解决**：canvas / file input **无条件渲染在 DOM 顶层**，CSS（w-0 h-0 opacity-0）控制可见性
**改动文件**：新建 IconEditor.tsx、/api/icon/upload/route.ts、修改 CategorySidebar.tsx

### 功能描述

在分类设置弹窗里粘贴/拖入/选择任意图片 → 纯前端 Canvas 自动居中裁圆形 200×200 → 上传到 `public/icons/` → 更新 `Category.icon` 字段。

### 技术方案（零 npm 依赖）

**后端 API**：`POST /api/icon/upload` 接收前端裁切好的 PNG blob，存 `public/icons/category_时间戳_随机串.png`，返回路径（URL 不以 `/icons/xxx.png` 格式 → `renderIcon()` 里 `startsWith('/')` 自动走 `<img>` 渲染路径，与 #20 经验一致，无需改任何现有组件）。

**前端 Canvas 裁切核心代码**：

```tsx
const processImage = (file: File) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;  // ← 关键：canvas 必须已经在 DOM 里
      const size = 200;
      canvas.width = size;      // 绘图缓冲（高清）
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // 圆形 mask
      ctx.save();
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
      ctx.clip();

      // 居中正方形裁切
      const srcSize = Math.min(img.width, img.height);
      const srcX = (img.width - srcSize)/2;
      const srcY = (img.height - srcSize)/2;
      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, size, size);
      ctx.restore();

      setHasImage(true);  // → CSS 切换 canvas 可见性
    };
    img.src = e.target.result as string;
  };
  reader.readAsDataURL(file);
};
```

### 致命 Bug：条件渲染 + ref = 静默失败 🔴

**症状**：粘贴图片、拖入文件、点选择文件——三种入口全部没反应，控制台零报错。

**根因**：第一次写 IconEditor 时，把 canvas 和 file input 都放进了 `hasImage ? A : B` 的条件分支里：

```tsx
// ❌ 有 bug 的写法：
{!hasImage ? (
  <div>
    <input ref={fileInputRef} />    // ← 只在 hasImage=false 存在
    <提示文字 />
  </div>
) : (
  <div>
    <canvas ref={canvasRef} />      // ← 只在 hasImage=true 存在
  </div>
)}

// 用户粘贴图片 → processImage(file) 执行 →
const canvas = canvasRef.current;  // ← null！因为 canvas 只在 hasImage=true 才渲染
if (!canvas) return;               // ← 静默退出，用户什么都看不到
```

**修复**：canvas 和 file input **必须无条件渲染在 DOM 顶层**，用 CSS 控制可见性：

```tsx
// ✅ 正确写法：
return (
  <div>
    {/* canvas 无条件渲染，第一次 render 就在 DOM 中 */}
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className={hasImage ? 'w-24 h-24 opacity-100' : 'w-0 h-0 opacity-0 overflow-hidden'}
    />
    {/* file input 也无条件渲染 */}
    <input ref={fileInputRef} className="hidden" />
    {/* 只有文字/按钮区做条件渲染 */}
    {!hasImage ? <提示文字 /> : <已选提示 />}
  </div>
);
```

### 经验教训总结

| 反模式 | 后果 | 正确做法 |
|--------|------|----------|
| ref 元素放在 `condition ? A : B` 里 | ref.current 可能为 null → 事件回调静默退出 | 无条件渲染 + CSS 控制可见性（`w-0 h-0 opacity-0`） |
| 两个 `<canvas ref={同一个ref}>` | 后者覆盖前者，ref 指向最后渲染的那个 | 一个 ref 对应一个 DOM 元素 |
| React 状态改 canvas.width/height 后不手动清空 | 残留图像叠加、预览错误 | 每次处理前 `ctx.clearRect(0, 0, size, size)` |
| 剪贴板事件依赖焦点 | 用户没聚焦就 paste 不到 | `document.addEventListener('paste', ...)` 全局监听 |
| 拖拽事件不 `stopPropagation()` | 浏览器默认打开文件，drop 事件丢失 | `handleDragOver/DragLeave/Drop` 全加 `e.stopPropagation()` |

### 通用模板（可复用到其他图片处理场景）

这套「**前端 Canvas 裁切 → /api/*/upload API → 返回路径 → 更新数据库**」模式可以直接套用到：
- 笔记封面图自动裁切
- 用户头像圆形裁切
- 博客缩略图正方形裁切

只需替换：
1. `public/icons/` → 目标目录
2. `Category.icon` → 目标字段
3. `drawImage` 的裁切参数 → 目标尺寸/比例（如 16:9 封面）

---

## 27. 侧边栏虚拟聚合视图实现（Tag 自动打标 + SidebarItem 入口） `[TAG-VIEW][AUTO-TAG][SIDEBAR]`

**触发词**：tag聚合、自动打标、关键词检测、SidebarItem、虚拟视图、A类买点、tagName、f=tag

### 需求场景

用户希望：笔记内容提到"A类买点"/"A级机会" → 自动归入"技术总结-A类买点"分类中。但 Note 只有单一 `categoryId`，无法自动"归属"到另一个分类。

### 最终方案

**复用已有的 tag 系统 + 侧边栏虚拟入口**，跟收藏/点赞完全同一套模式：

```
笔记提到关键词 → 后端自动检测追加 tag → 侧边栏 SidebarItem 按 tag 聚合展示
```

### 三组件实现

#### 组件 1：后端自动关键词检测 → Tag

`lib/utils.ts` 配置化规则表：

```ts
const AUTO_TAG_RULES = [
  { keywords: ['A类', 'A级'], tag: 'A类买点' },
  // 以后扩展加一行即可：
  // { keywords: ['B类', 'B级'], tag: 'B类买点' },
];

export function autoDetectTags(content: string, existingTags: string[]): string[] {
  const plain = stripHtml(content || '');
  const tags = new Set(existingTags || []);
  for (const rule of AUTO_TAG_RULES) {
    if (tags.has(rule.tag)) continue;
    if (rule.keywords.some(kw => plain.includes(kw))) tags.add(rule.tag);
  }
  return Array.from(tags);
}
```

**调用点**（两处）：
- `POST /api/notes` 创建笔记时 → `autoTags = autoDetectTags(body.content ?? '', body.tags ?? [])`
- `PUT /api/notes/[id]` 更新笔记时 → content 或 tags 有变化就检测

**只追加不删除**：用户手动加的 tag 不会被清掉，自动检测只做加法。

#### 组件 2：侧边栏 SidebarItem 入口

`CategorySidebar.tsx` 加一行：

```tsx
<SidebarItem
  active={selected.type === 'tag' && selected.tagName === 'A类买点'}
  onClick={() => onSelect({ type: 'tag', tagName: 'A类买点', label: 'A类买点' })}
  icon={<span className="text-xs font-bold text-emerald-500">A</span>}
  label="A类买点"
  count={countValues.aClassBuyPoint}
/>
```

计数加一行：`aClassBuyPoint: getCount({ tag: 'A类买点' })`

#### 组件 3：前端 Filter ↔ URL ↔ API 全链路

`app/page.tsx` 需要在所有用到 Filter 的地方加 `{ type: 'tag'; tagName; label }` 分支：

| 位置 | 要改什么 |
|------|----------|
| `Filter` 类型定义 | 加 `tag` 分支 |
| `parseFilterFromUrl` | 读 `f=tag&tagName=xxx` |
| `isFilterChanged` | 深比较加 `tagName` |
| `buildFilterUrl` | 写 `f=tag` + `tagName=xxx` |
| `loadNotes` | `if (filter.type === 'tag') params.tag = filter.tagName` |
| URL 变化 useEffect | 深比较加 `tag` 分支 |
| 排序映射表 | tag 视图用 global 排序 |
| title / 空状态文案 | 加 tag 分支 |

后端已原生支持 `GET /api/notes?tag=xxx`（SQLite `tags contains "\"xxx\""`），零改动。

### 避免了什么坑

| 踩坑路径 | 问题 | 最终方案 |
|---------|------|---------|
| 手动汇总笔记 + NoteLink 链接 | 手动维护，新增笔记不会自动加入 | ❌ 放弃 |
| 给 Note 加 hasAClassSignal 布尔字段 | 改 Prisma schema + 所有前后端 + migration | ❌ 太重 |
| Note 加多分类关联表 | 完全超出当前需求 | ❌ 杀鸡用牛刀 |
| 复用 tag + 虚拟视图 | 后端零 schema 改动，前端加 SidebarItem 即可 | ✅ 通过 |

### 核心原则

> **收藏/点赞 = 布尔字段 + 虚拟视图，tag 聚合 = tag 字符串 + 虚拟视图。** 两种模式完全对称，后端都不需要特殊处理聚合逻辑，过滤全在 SQL/JSON contains 完成。

### 改动文件清单

| 文件 | 行数 | 内容 |
|------|------|------|
| `lib/utils.ts` | +28 | `autoDetectTags()` + `AUTO_TAG_RULES` |
| `app/api/notes/route.ts` | +3,-1 | POST 创建时调用 |
| `app/api/notes/[id]/route.ts` | +8,-2 | PUT 更新时调用（两处 update 路径） |
| `app/page.tsx` | +多处 | Filter/URL/排序/文案 全链路 |
| `components/CategorySidebar.tsx` | +2 | 计数 + SidebarItem 入口 |

---

### 三层流动

```
修复 bug → 追加本条经验 [待分类]
    │
    │ 同一标签出现 ≥ 3 次
    ▼
提炼为「模块」（加二级标题 + 通用模板 + 可复用代码）
    │
    │ 未来该模块条目 ≥ 15 条 且 跨技术栈
    ▼
独立成专项 skill（参考 A-stock Home MOC 8 专项架构）
```

### 记录模板（新增经验时使用）

```markdown
## X. [问题简述] `[标签1][标签2]`

**触发词**：3-5 个关键词
**根因**：一句话说清楚为什么
**解决**：关键代码 + 改动文件清单
**通用度**：✅跨项目 / ⚠️ Next.js 特有 / ❌ 本项目独有
```

### 当前标签使用情况

| 标签 | 条目数 | 是否具备模块雏形 |
|------|--------|------------------|
| `[IMAGE]` | 6 (#8 #12 #14 #20 #26) | ✅ 是（Canvas 裁切加入，通用图片处理模块） |
| `[PIN-SCOPE]` | 3 (#2 #19) | ⚠️ 接近 |
| `[WINDOWS]` | 3 (#10 #11 #24) | ⚠️ 接近 |
| `[CATEGORY]` | 4 (#1 #20 #23 #26) | ⚠️ 接近 |
| `[SIDEBAR]` | 2 (#1 #27) | ⚠️ 接近（侧边栏组件扩展已 2 条） |
| `[APP-ROUTER]` | 1 (#25) | ❌ 单条 |
| `[TAG-VIEW]` | 1 (#27) | ❌ 单条（tag 自动打标 + 虚拟视图，未来加更多自动规则时会涨） |
| `[AUTO-TAG]` | 1 (#27) | ❌ 单条 |
| `[REF]` | 1 (#26) | ❌ 单条 |
| 其他标签 | 1-2 | ❌ 单条/零散 |

**观察**：
- `[IMAGE]` 已 6 条，#26 加入了 Canvas 前端裁切这个通用能力——未来如果新增 Next.js Image Optimization、Lazy Loading、响应式 srcset，很可能成为第一个独立的 skill
- `[REF]` 是 #26 贡献的新标签——React ref 与条件渲染的冲突是跨场景陷阱，未来遇到 input ref / video ref / iframe ref 类似问题时可以继续往这里加
- `[TAG-VIEW]` `[AUTO-TAG]` `[SIDEBAR]` 是 #27 贡献的新标签——未来如果加 B类买点、缠论三买等更多自动规则，tag 聚合模式会持续扩展，`[TAG-VIEW]` 有望成为新模块

### 跳过记录的场景

| 类型 | 记录？ | 理由 |
|------|--------|------|
| Next.js API 路由新坑 | ✅ | 跨页面复用 |
| Prisma schema 字段设计 | ✅ | 数据模型影响全链路 |
| Tailwind CSS 类组合踩坑 | ✅ | 样式复用 |
| "category 表第 3 行数据写错" | ❌ | 本项目数据问题 |
| import 遗漏、拼写错误 | ❌ | 一次性失误 |
| AI prompt 微调 | ❌ | 高度个人化 |
