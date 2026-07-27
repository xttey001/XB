---
name: "xb-notes-experience"
description: "XB 笔记项目开发经验库。遇到类似 UI/数据/交互问题时调用，查看已验证的解决方案。"
---

# XB 笔记项目经验库

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

**问题**：在分类 A 内置顶的笔记，会在「全部笔记」和「收藏」里也置顶。
**根因**：`Note` 表只有单个 `pinned` 字段，置顶是全局状态。
**解决**：
1. Prisma schema 中将置顶拆分为三个独立字段：
   - `pinnedGlobal`（全部笔记）
   - `pinnedFavorite`（收藏）
   - `pinnedCategory`（分类）
2. `GET /api/notes` 根据 `scope` 选择对应字段排序，并把该字段作为 `pinned` 返回。
3. `PUT /api/notes/[id]` 接收 `scope` 参数，只更新对应置顶字段。
4. 旧数据迁移：`scripts/migrate-pinned.js` 把 `pinned=true` 复制到 `pinnedGlobal=true`。

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
