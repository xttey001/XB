---
name: "xb-static-site"
description: "XB 笔记 GitHub Pages 静态站开发与部署。处理 public-site 目录改动、gh-pages 分支推送、缓存版本号、手机 touch 手势、lightbox 图片预览等问题。当用户修改静态站、推送 GitHub Pages、调整图片预览、修复手机端交互时调用。"
---

# XB 静态站开发指南

## 📁 仓库结构（关键！）

```
d:\XB\                    ← Next.js 原版仓库（main 分支）
  ├── components/         ← Next.js React 组件（TypeScript + Tailwind）
  │   └── ImageLightbox.tsx
  ├── public-site/        ← 独立的 gh-pages git 仓库！
  │   ├── .git/           ← 有自己的 .git！不是主仓库子目录
  │   ├── index.html      ← 入口（含 CSS/JS 版本号）
  │   ├── app.js          ← 原生 JS（所有逻辑手写）
  │   ├── styles.css      ← 原生 CSS（不是 Tailwind！）
  │   ├── data/           ← JSON 数据文件
  │   └── assets/         ← 图片资源
  └── ...
```

**⚠️ 静态站改动必须 cd 到 `d:\XB\public-site` 里 commit + push！**
在 `d:\XB` 根目录 push 只会推 Next.js 代码到 main 分支，对静态站零影响。

---

## 🔄 数据同步流程（从 Next.js 数据库 → 静态站）

用户写新笔记后，需要把 Prisma dev.db 里的数据导出到静态站 JSON。**一键命令**：

```powershell
cd d:\XB

# ① 一键导出（读 Prisma → 写 JSON → 复制图片）
node scripts/export-static.js
# 输出：913 条 notes, 76 categories, 6 areas, 69 天 daily-stats, 699 张图片

# ② 推静态站（gh-pages 分支）
cd d:\XB\public-site

# bump 缓存版本号（每次都要！）
(Get-Content index.html) -replace '\.css\?v=(\d+)', { param($m) ".css?v=$([int]$m.Groups[1].Value + 1)" } `
                        -replace '\.js\?v=(\d+)', { param($m) ".js?v=$([int]$m.Groups[1].Value + 1)" } `
                        | Set-Content index.html -Encoding UTF8

# 清 lock + commit + push
Get-Process git* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Get-ChildItem .git\ -Recurse -Filter "*.lock" | Remove-Item -Force -ErrorAction SilentlyContinue

git add data/ assets/uploads/ index.html
git commit -m "sync data $(node -e "console.log(require('./data/notes.json').length)")条 + bump cache v$(node -e "const h=require('fs').readFileSync('index.html','utf8');console.log((h.match(/app\.js\?v=(\d+)/)||[])[1]||0)")"
git push origin gh-pages
```

### 完整的日常工作流

```
用户在 Next.js 里写新笔记
         ↓
   Prisma dev.db 自动存
         ↓
   【一键导出】node scripts/export-static.js
         ↓
   生成 5 个 JSON → public-site/data/
   增量复制图片 → public-site/assets/uploads/
         ↓
   【推 gh-pages】cd public-site && git add && commit && push
         ↓
   GitHub Pages 自动更新（30秒内生效）
```

### 导出脚本做了什么

| 步骤 | 做了什么 | 耗时 |
|---|---|---|
| 查 Prisma | Note + Category(include Area) + KnowledgeArea + Like | <1s |
| 格式化 | 扁平结构展开（categoryName, areaId, hasLiked 等） | <10ms |
| daily-stats | 按 createdAt 日期聚合 count/important/veryImportant | <10ms |
| 写 JSON | notes.json(913条) + categories.json + areas.json + daily-stats + export-meta | <50ms |
| 复制图片 | `public/uploads/` → `public-site/assets/uploads/`（**增量**，只复制新/改的） | 0~几秒 |

### 坑 #16：数据库没更新就导出了

**症状**：导出脚本跑完了，但静态站看不到新笔记。

**根因**：Next.js dev server 开着的时候它会持有 dev.db 的写锁。如果 Next.js 里写了笔记但没保存（或者 dev server 重启了），数据可能还在内存里没 flush 到 SQLite 文件。

**检查**：
```powershell
# 看 Prisma dev.db 的最后修改时间
Get-ChildItem prisma\dev.db | Select-Object LastWriteTime

# 对比 export-meta.json 的时间
Get-Content public-site\data\export-meta.json
```

**解法**：确保 Next.js 里的笔记已经保存（点保存按钮），等几秒让 SQLite flush，再跑 export-static.js。

---

## 🚨 最核心：两套 Lightbox 必须同步改

**XB 有两套图片预览实现，改功能必须两边同步！**

| 版本 | 文件 | 技术栈 | 分支 |
|---|---|---|---|
| **原版 Next.js** | `d:\XB\components\ImageLightbox.tsx` | React + TypeScript + Tailwind | main |
| **静态站** | `d:\XB\public-site\app.js` 里 `openLightboxGallery()` + `styles.css` 里 `.lightbox-gallery` | 原生 JS + 原生 CSS | gh-pages |

**两边实现差异**：
- 原版用 `document.querySelector('.lightbox-root')` 找根元素 → 因为是 React 组件，根 div 加了 `lightbox-root` class
- 静态站直接用 `lb` 变量（openLightboxGallery 里自己创建的 DOM 元素）
- 原版用 Tailwind class（`touch-none` = `touch-action:none`）→ 静态站要写原生 CSS
- 原版手势变量用 `useRef` hook 存在 state 里 → 静态站用闭包变量

---

## 🚀 推送命令（固定流程）

### 推静态站（gh-pages 分支）

```powershell
# 1. 进入静态站目录
cd d:\XB\public-site

# 2. 清理 git lock files（坑 #6）
Get-Process git* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Get-ChildItem .git\ -Recurse -Filter "*.lock" | Remove-Item -Force -ErrorAction SilentlyContinue

# 3. 改了 HTML/JS/CSS 后，先 bump 缓存版本号（坑 #1 必须做！）
#    index.html 里 styles.css?v=N 和 app.js?v=N 每次 +1
(Get-Content index.html) -replace '\.css\?v=(\d+)', { param($m) ".css?v=$([int]$m.Groups[1].Value + 1)" } `
                        -replace '\.js\?v=(\d+)', { param($m) ".js?v=$([int]$m.Groups[1].Value + 1)" } `
                        | Set-Content index.html -Encoding UTF8

# 4. 只 add 你改的文件（坑 #9 绝对不能用 git add -A！）
git add index.html app.js styles.css

# 5. Commit + Push
git commit -m "描述"
git push origin gh-pages
```

### 推原版 Next.js（main 分支）

```powershell
cd d:\XB

# 清理 lock
Get-Process git* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Get-ChildItem .git\ -Recurse -Filter "*.lock" | Remove-Item -Force -ErrorAction SilentlyContinue

# 检查当前分支！必须在 main 上（坑 #10）
git branch --show-current  # 应该显示 "main"

# 只 add 你改的文件
git add components/ImageLightbox.tsx
git commit -m "描述"
git push origin main
```

### 遇到 push 被拒（rejected: fetch first）（坑 #11）

```powershell
# 有未提交改动先 stash
git stash --include-untracked

# pull 远端 + rebase 本地
git pull --rebase origin gh-pages   # 或 main

# 如果 rebase 有冲突 → 手动解决 + git add + git rebase --continue

# push
git push origin gh-pages   # 或 main

# 恢复 stash
git stash pop
```

---

## 🚨 踩坑记录（按发生顺序排列）

### 坑 #1：浏览器强缓存 —— 改了代码但用户看不到

**症状**：推了新代码，用户 Ctrl+R 刷新还是旧版，必须 Ctrl+Shift+R 硬刷新才行。

**根因**：GitHub Pages 的 HTML 被浏览器强缓存。HTML 里引用的 CSS/JS 用了 query string `?v=N`，如果版本号不变，浏览器直接用缓存，根本不发请求。

**解法**：每次改 CSS 或 JS，必须同步 bump index.html 里的版本号：
```html
<link rel="stylesheet" href="styles.css?v=4">   ← 改了就 +1
<script src="app.js?v=4"></script>                ← 改了就 +1
```

**验证**：`Invoke-WebRequest "https://xttey001.github.io/XB/styles.css"` 注意 URL 不要带版本号参数，不然又被缓存。

---

### 坑 #2：touch 手势不生效 —— 手机上左右滑动翻页完全没反应

**症状**：桌面 Chrome DevTools 的 Mobile Emulator 里滑动正常，真机上怎么滑都不翻页。

**根因**：`touchstart/touchmove` 用了 `{ passive: true }` 或没阻止浏览器默认行为。MDN 文档明确说：
> By default, panning gestures are handled **exclusively by the browser**. Applications must use `preventDefault()` during `touchmove`, and **also** use CSS `touch-action: none` so the browser知道你的意图。

**解法（CSS + JS 双保险）**：

**CSS 层**（先声明意图）：
```css
.lightbox-gallery {
  touch-action: none;                    /* 告诉浏览器：这个元素的手势我自己处理 */
  overscroll-behavior: contain;          /* 防止滑动穿透到背景页面 */
  user-select: none;                     /* 防止长按选中图片 */
  -webkit-tap-highlight-color: transparent; /* iOS 点击不高亮 */
}
```

**JS 层**（运行时阻止）：
```js
// ❌ 错误：passive:true 下 preventDefault() 静默失败
lb.addEventListener('touchmove', (e) => { e.preventDefault(); }, { passive: true });

// ✅ 正确：touchmove 必须 passive:false
lb.addEventListener('touchmove', (e) => {
  e.preventDefault(); // 🔥 关键！阻止浏览器抢滚动
}, { passive: false });
```

---

### 坑 #3：左右翻页按钮不在中间 —— 跑到顶部或底部

**症状**：左右按钮水平位置对了，但垂直方向不在屏幕中间。

**根因**：删旧 CSS 时丢失了三件套中的某一个（特别是 `position: absolute` 和 `transform: translateY(-50%)`）。

**解法（CSS 垂直居中必须三件套）**：
```css
.lb-prev, .lb-next {
  position: absolute;           /* ① 绝对定位脱离文档流（缺了这个直接错位）*/
  top: 50%;                     /* ② 定位到父容器 50% 高度 */
  transform: translateY(-50%);  /* ③ 自身高度的 -50% 偏移，实现真正居中 */
}
```
**Tailwind 写法**：`absolute top-1/2 -translate-y-1/2`

---

### 坑 #4：手机上图片特别小 —— padding 太大

**症状**：手机竖屏打开图片，四周大片黑色，图片只占中间一小块。

**根因**：硬编码了桌面大 padding。`padding: 60px 80px 80px` 在手机上吃掉了大量屏幕空间。

**解法**：响应式 padding（CSS media query 或 Tailwind 断点）：
```css
/* 手机默认：左右只留 16px */
.lb-img-wrap { padding: 50px 16px 60px; }

/* 桌面：640px 以上恢复大 padding */
@media (min-width: 640px) {
  .lb-img-wrap { padding: 60px 80px 80px; }
}
```
**Tailwind**：`p-3 sm:p-6 lg:p-10 xl:p-20`

---

### 坑 #5：git 报 "Another git process seems to be running" / lock 文件

**症状**：commit/push 失败，报 `fatal: Unable to create '.git/index.lock': File exists` 或 `HEAD.lock` 或 `maintenance.lock`。

**根因**：Windows 上 git 进程偶尔 crash，遗留 `.git/*.lock` 文件。

**解法（每次 commit 前先跑）**：
```powershell
Get-Process git* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Get-ChildItem .git\ -Recurse -Filter "*.lock" | Remove-Item -Force -ErrorAction SilentlyContinue
```

---

### 坑 #6：两个独立 git 仓库 —— public-site 有自己的 .git

**症状**：在 `d:\XB` 根目录 commit + push 了，GitHub Pages 页面没变化。

**根因**：`d:\XB\public-site\` 是独立仓库（自己有 `.git`），gh-pages 分支就在里面。在主仓库根目录 push 只影响 main 分支的 Next.js 代码。而且 **gh-pages 分支内容是静态站代码，main 分支内容是 Next.js 代码，两个分支完全不相关！**

**排查**：
```powershell
Get-ChildItem .git -Force          # 当前目录有没有 .git
git branch --show-current          # 当前分支
git remote -v                      # remote 指到哪
git log --oneline -3               # 最近 commit 是什么
```

---

### 坑 #7：垂直下滑关闭手势与左右翻页冲突

**症状**：斜着滑时误触发关闭，或垂直滑动被当成翻页。

**解法（手势优先级 + 两指检测）**：
```
阈值逻辑（从上到下优先级递减）：
1. 两指触摸 → 忽略！让浏览器原生处理捏合缩放
2. 垂直下滑 dy > 80px 且 |dy| > |dx| → 关闭 ✅（最高优先级）
3. 快速下滑 dt < 300ms 且 dy > 40px 且 |dy| > |dx| → 关闭 ✅
4. 水平滑动 |dx| > 50px 且 |dx| > |dy| → 翻页
5. 快速滑动 dt < 300ms 且 |dx| > 30px 且 |dx| > |dy| → 翻页
6. 位移 < 10px → 忽略（是点击不是滑动）
```
**关键**：`|dy| > |dx|` 判断必须加，确保垂直位移为主才触发下滑关闭。

---

### 坑 #8：关闭按钮看不见 —— 背景色透明

**症状**：图片亮的地方，关闭按钮（`bg-white/10 text-white`）几乎看不见。

**根因**：半透明白底在亮色图片上对比度不够。

**解法**：统一用黑底白字 + shadow-lg（跟翻页按钮风格一致）：
```css
/* ❌ 看不见 */
.close-btn { background: rgba(255,255,255,.12); color: white; }

/* ✅ 清晰可见 */
.close-btn { background: black; color: white; box-shadow: 0 4px 16px rgba(0,0,0,.4); }
```
**Tailwind**：`bg-black text-white shadow-lg`

---

### 坑 #9：`git add -A` 把别人的大改动也加进来了

**症状**：commit 后发现 commit 内容包含大量你没改的文件（比如 public/→assets/ 重命名、一堆组件删除等）。

**根因**：`git add -A` 会把仓库里**所有**未提交的改动都加进来。这个仓库 main 分支和 gh-pages 分支本来就是两个完全独立的代码树，很容易误操作。

**解法（固定工作流）**：
```powershell
# ❌ 绝对不能用！
git add -A

# ✅ 只 add 你改的特定文件
git add components/ImageLightbox.tsx
git add app.js styles.css index.html

# commit 前先检查
git diff --cached --stat
```

---

### 坑 #10：在错误分支上改代码 —— main vs gh-pages 内容完全不同

**症状**：在 gh-pages 分支上改了 Next.js 的 `ImageLightbox.tsx`，commit 成功了，但 Next.js 跑起来没变。

**根因**：main 分支是 Next.js 项目（有 `components/` 目录），gh-pages 分支是静态站代码（根目录就是 HTML/CSS/JS）。两个分支完全不相关！在 gh-pages 分支上你看到的 `components/` 目录可能是残留或其他东西。

**改代码前必须确认**：
```powershell
# ✅ 改 Next.js 组件前
cd d:\XB
git checkout main
git branch --show-current   # 必须显示 "main"

# ✅ 改静态站前
cd d:\XB\public-site
git branch --show-current   # 必须显示 "gh-pages"
```

---

### 坑 #11：push 被拒 —— 远端有新 commit

**症状**：`git push` 报 `[rejected] gh-pages -> gh-pages (fetch first)` 或 `error: failed to push some refs`。

**根因**：远端被别处推了新 commit（比如 GitHub Pages 自动更新、或者你在别的电脑推过）。

**解法**：
```powershell
# 有本地未提交改动 → 先 stash
git stash --include-untracked

# 拉远端 rebase 本地
git pull --rebase origin gh-pages   # 或 main

# 如果有冲突 → 解决后
git add <冲突文件>
git rebase --continue

# push
git push origin gh-pages

# 恢复本地改动
git stash pop
```

---

### 坑 #12：rebase 卡住 —— "You must edit all merge conflicts"

**症状**：`git pull --rebase` 后无法 commit，报 `fatal: cannot lock ref 'HEAD': Unable to create 'D:/XB/.git/HEAD.lock'` 或 `You must edit all merge conflicts`。

**根因**：Windows 上 git 进程 crash 留下 lock 文件，或 rebase 过程中有冲突没解决完。

**解法**：
```powershell
# 先 abort rebase 回干净状态
git rebase --abort

# 清理所有 lock
Get-Process git* -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Get-ChildItem .git\ -Recurse -Filter "*.lock" | Remove-Item -Force -ErrorAction SilentlyContinue

# 再 rebase
git pull --rebase origin gh-pages
```

---

### 坑 #13：PowerShell ExecutionPolicy 禁脚本

**症状**：很多 git 输出被截断，报 `File ...\snapshots.ps1 cannot be loaded because running scripts is disabled on this system`。

**影响**：git 命令可能其实成功了，但输出丢失，导致你误判结果。

**解法**：遇到 git 相关命令尽量用 `Select-Object -Last 5` 取尾部关键信息：
```powershell
git commit -m "xxx" 2>&1 | Select-Object -Last 5   # 只看最后几行
git push origin gh-pages 2>&1 | Select-Object -Last 3
```
**别用** `echo` 或额外的 PowerShell 语法包裹 git 命令，直接跑 git 原生命令。

---

### 坑 #14：改原版后 Next.js 没热更新

**症状**：改了 `ImageLightbox.tsx`，`npm run dev` 跑着，但浏览器没变。

**排查**：
1. 确认你改的是 **main 分支** 的 `d:\XB\components\ImageLightbox.tsx`（不是 gh-pages 分支）
2. 看 Next.js dev server 终端有没有编译错误
3. 手动 `Ctrl+Shift+R` 硬刷新

---

### 坑 #15：两指捏合不能拦截 —— 让浏览器原生缩放

**症状**：两指捏合时不缩放，被当成水平/垂直滑动了。

**根因**：touch 手势代码里没区分单指和两指。

**解法**：
```js
if (e.touches.length >= 2) {
  touchRef.current = { ..., twoFinger: true };
  return;  // 直接退出，让浏览器原生处理缩放
}
// 后续所有 touch 逻辑都要先 if (twoFinger) return
```

---

## 📋 大厂图片预览交互规范

| 操作 | 触发方式 | 来源 |
|---|---|---|
| 关闭 | ⬇️ 垂直下滑 > 80px | Instagram / Facebook Story |
| 关闭 | 点击背景（light dismiss） | MDN `<dialog>` |
| 关闭 | 点 ✕ 按钮 | 所有平台通用 |
| 翻页 | ← → 水平滑动 > 50px | 所有平台 |
| 翻页 | 键盘 ← → | 桌面端 |
| 捏合缩放 | 两指（浏览器原生） | MDN touch-action |

**手势优先级（防止冲突）**：两指 → 垂直下滑关闭 → 水平翻页 → 点击

---

## 📝 验证新功能的标准流程

### 验证静态站远端

```powershell
# 本地 server
cd d:\XB\public-site
python -m http.server 8765

# 验证 GitHub Pages 上的 CSS 是最新的（直接 fetch URL，不要带 ?v=N ）
$css = (Invoke-WebRequest "https://xttey001.github.io/XB/styles.css" -UseBasicParsing -TimeoutSec 15).Content
$css -match "touch-action:\s*none"              # ✅ 验证 touch-action
$css -match "top:\s*50%"                         # ✅ 验证按钮垂直居中
$css -match "@media.*640"                        # ✅ 验证响应式

# 验证 JS
$js = (Invoke-WebRequest "https://xttey001.github.io/XB/app.js" -UseBasicParsing -TimeoutSec 15).Content
$js -match "dy > 80"                             # ✅ 验证下滑关闭
$js -match "touchStartX"                         # ✅ 验证 touch 变量
```

### 验证原版 Next.js

```powershell
cd d:\XB
npm run dev   # 或 start-xb-notes-dev.bat

# 手机访问 http://电脑IP:3000
# 打开图片预览 → 下滑关闭 / 左右滑动翻页 / 点按钮关闭
```

### 两边同步 checklist

改了图片预览功能后，对照这个清单确保两边都改了：

- [ ] `public-site/app.js` — touch 手势逻辑（下滑关闭 + 左右翻页）
- [ ] `public-site/styles.css` — `.lightbox-gallery` 响应式 padding + 按钮垂直居中 + `touch-action:none`
- [ ] `public-site/index.html` — 缓存版本号 `?v=N` 已 bump
- [ ] `components/ImageLightbox.tsx` — 同上功能（React 写法 + Tailwind class）

---

## 🔧 快速恢复手册

### 仓库乱了（commit 到错误分支、stash 丢了）

```powershell
# 查看所有分支状态
cd d:\XB
git branch -a
git log --oneline --all -20

# 回到 main 分支，放弃本地乱改
git checkout main
git fetch origin
git reset --hard origin/main
```

### lock 文件清不干净

```powershell
# 杀所有 git 进程 + 删除所有 lock
Get-Process git*, git-* -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 3
Get-ChildItem d:\XB\.git -Recurse -Filter "*.lock" | ForEach-Object {
  Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
  echo "Deleted: $($_.FullName)"
}
```

### 撤回最近一次 commit 保留改动

```powershell
git reset HEAD~1 --soft      # 保留 staged，改 commit message 重新 commit
# 或
git reset HEAD~1 --mixed     # 取消 staged，改动留在 working copy
```
