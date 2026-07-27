---
name: "feishu-rich-text-editor"
description: "XB 笔记项目中实现飞书风格富文本编辑器的经验与可复用代码。当需要添加/修改 Tiptap 编辑器、高亮块、标题、列表、引用、文字颜色、Bubble Menu 等功能时调用。"
---

# 飞书风格富文本编辑器（Tiptap）

## 1. 触发场景

- 需要在 XB 笔记项目中增加或调整富文本编辑功能。
- 涉及：标题 H1/H2/H3、无序/有序/任务列表、引用块、文字颜色、加粗/斜体/下划线、对齐、分隔线、高亮块（Callout）、Bubble Menu 等。
- 需要排查编辑器样式不生效、高亮块交互异常、返回列表后格式丢失等问题。

## 2. 技术栈

- **编辑器框架**：Tiptap（基于 ProseMirror）+ `@tiptap/react`。
- **扩展清单**：
  - `StarterKit`：标题、列表、引用、分隔线等基础块。
  - `TextStyle` + `Color`：文字颜色。
  - `Underline`：下划线。
  - `TextAlign`：段落/标题对齐。
  - `TaskList` + `TaskItem`：任务列表。
  - `Link`：链接（点击不跳转）。
  - `Placeholder`：空状态占位。
  - 自定义 `Callout`：高亮块。
- **Markdown 兼容**：旧笔记非 HTML 时先用 `marked.parse` 转成 HTML 再交给编辑器。
- **渲染**：`RichTextRenderer` 用 `DOMPurify` 做安全过滤，`note-md` 类控制样式。

## 3. 核心文件

| 文件 | 作用 |
|------|------|
| `components/TiptapEditor.tsx` | 主编辑器组件、顶部固定工具栏、Bubble Menu。 |
| `lib/tiptap-callout.ts` | 高亮块 Tiptap 扩展定义（属性、命令、HTML 渲染、NodeView 注册）。 |
| `components/CalloutNodeView.tsx` | 高亮块 React NodeView，负责 emoji 点击切换类型。 |
| `components/RichTextRenderer.tsx` | 笔记内容的安全 HTML 渲染器。 |
| `components/NoteCard.tsx` | 列表卡片，决定是否显示摘要。 |
| `app/globals.css` | 编辑器与渲染共用样式。 |
| `components/ColorPopover.tsx` | 文字颜色选择器。 |

## 4. 功能清单

### 4.1 已验证可用的块级格式

- 一级/二级/三级标题
- 无序列表、有序列表、任务列表
- 引用块
- 水平分隔线
- 段落左对齐/居中对齐
- 高亮块（Callout）

### 4.2 已验证可用的行内格式

- 加粗、斜体、下划线、删除线
- 文字颜色（预设色板）
- 链接

### 4.3 交互

- 选中文本时浮出 Bubble Menu。
- 点击高亮块左侧 emoji 弹出类型选择器。
- 切换类型后背景色、边框色、emoji 同步变化。

## 5. 常见问题与解决方案

### 5.1 H1/H2/H3、列表、引用样式不生效

**原因**：编辑器内容区与预览区使用不同类名，且 Tailwind preflight 会重置默认样式。

**解决**：在 `app/globals.css` 中把样式同时写给 `.note-md` 和 `.ProseMirror`，并显式指定 `list-disc`、`list-decimal`、`border-l-2` 等：

```css
.note-md, .ProseMirror {
  @apply text-[15px] leading-[1.7] text-ink-800;
}
.note-md h1, .ProseMirror h1 { @apply text-2xl font-serif font-semibold mt-4 mb-2; }
.note-md h2, .ProseMirror h2 { @apply text-xl font-serif font-semibold mt-4 mb-2; }
.note-md h3, .ProseMirror h3 { @apply text-lg font-semibold mt-3 mb-1; }
.note-md ul:not([data-type="taskList"]), .ProseMirror ul:not([data-type="taskList"]) { @apply list-disc pl-5 my-2; }
.note-md ol, .ProseMirror ol { @apply list-decimal pl-5 my-2; }
.note-md blockquote, .ProseMirror blockquote {
  @apply border-l-2 border-accent-500 pl-3 text-ink-600 italic my-2;
}
```

### 5.2 高亮块 hover 按钮无法切换类型

**原因**：试图在编辑器外层监听 click 事件弹出选择器，被 ProseMirror 内部事件处理阻止或丢失焦点。

**解决**：使用 Tiptap 的 **React NodeView** 把高亮块渲染成独立 React 组件，交互封装在组件内部：

```ts
// lib/tiptap-callout.ts
addNodeView() {
  return ReactNodeViewRenderer(CalloutNodeView);
},
```

### 5.3 点击左侧 emoji 无反应

**原因**：`onClick` 事件在 `contentEditable` 编辑器内部容易被 ProseMirror 拦截。

**解决**：改用 `onMouseDown` 并阻止默认行为和冒泡：

```tsx
<div
  contentEditable={false}
  onMouseDown={(e) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPicker(!showPicker);
  }}
>
  {emoji}
</div>
```

### 5.4 切换高亮块类型后 emoji 不变

**原因**：只更新了 `type` 属性，`emoji` 属性仍是旧值。

**解决**：切换类型时同时更新 `emoji` 为该类型的默认 emoji：

```tsx
const applyType = (newType: string) => {
  updateAttributes({
    type: newType,
    emoji: CALLOUT_TYPES[newType]?.emoji ?? emoji,
  });
  setShowPicker(false);
};
```

### 5.5 发布/详情页能看到高亮块，返回列表后高亮块消失/样式丢失

**原因**：列表接口 `GET /api/notes` 会生成纯文本 `summary`，卡片优先显示摘要；摘要剥离了 HTML 标签，导致高亮块、标题、列表等格式丢失。

**解决**：在 `NoteCard.tsx` 中检测内容是否包含富文本块，包含时直接渲染完整 HTML：

```tsx
const hasRichBlock = /data-callout|<h[1-6]\b|<ul\b|<ol\b|<blockquote\b|<pre\b|<code\b|<img\b/i.test(
  note.content
);
const displaySummary =
  note.summary && note.summary.length < note.content.length && !hasRichBlock;
```

这样列表卡片会保留高亮块、标题、列表、引用、代码块、图片的完整样式。

## 6. 可复用代码模板

### 6.1 编辑器扩展配置

```tsx
const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      codeBlock: false,
      bulletList: true,
      orderedList: true,
      blockquote: true,
    }),
    TextStyle,
    Color,
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Callout,
    Placeholder.configure({ placeholder }),
    Link.configure({ openOnClick: false }),
  ],
  // ...
});
```

### 6.2 高亮块类型定义

```ts
export const CALLOUT_TYPES: Record<string, { emoji: string; bg: string; border: string }> = {
  tip:     { emoji: '💡', bg: '#FFF7ED', border: '#FED7AA' },
  info:    { emoji: 'ℹ️', bg: '#EFF6FF', border: '#BFDBFE' },
  warning: { emoji: '⚠️', bg: '#FFFBEB', border: '#FDE68A' },
  danger:  { emoji: '🚫', bg: '#FEF2F2', border: '#FECACA' },
  success: { emoji: '✅', bg: '#F0FDF4', border: '#BBF7D0' },
  note:    { emoji: '📝', bg: '#F5F3FF', border: '#DDD6FE' },
};
```

### 6.3 高亮块 NodeView 核心结构

```tsx
'use client';
import { useState } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { CALLOUT_TYPES, CALLOUT_TYPE_KEYS } from '@/lib/tiptap-callout';

export default function CalloutNodeView({ node, updateAttributes }: any) {
  const { emoji, type } = node.attrs;
  const style = CALLOUT_TYPES[type] || CALLOUT_TYPES.tip;
  const [showPicker, setShowPicker] = useState(false);

  const applyType = (newType: string) => {
    updateAttributes({ type: newType, emoji: CALLOUT_TYPES[newType]?.emoji ?? emoji });
    setShowPicker(false);
  };

  return (
    <NodeViewWrapper>
      <div
        className="callout"
        style={{ backgroundColor: style.bg, borderColor: style.border }}
      >
        <div
          className="callout-emoji relative cursor-pointer select-none"
          contentEditable={false}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowPicker(!showPicker);
          }}
        >
          {emoji}
          {showPicker && (
            <div className="absolute z-50 left-0 top-full mt-1 p-2 rounded-lg border border-ink-200 bg-white shadow-lg grid grid-cols-3 gap-1.5 w-[150px]">
              {CALLOUT_TYPE_KEYS.map((t) => {
                const s = CALLOUT_TYPES[t];
                return (
                  <button
                    key={t}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      applyType(t);
                    }}
                    className="w-10 h-10 rounded-md border flex items-center justify-center text-lg"
                    style={{ backgroundColor: s.bg, borderColor: s.border }}
                    title={t}
                  >
                    {s.emoji}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <NodeViewContent className="callout-content" />
      </div>
    </NodeViewWrapper>
  );
}
```

### 6.4 Callout 扩展注册 NodeView

```ts
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CalloutNodeView from '@/components/CalloutNodeView';

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: { default: '💡' },
      type: { default: 'tip' },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },

  // parseHTML / renderHTML / addCommands 按项目实际补充
});
```

### 6.5 高亮块 CSS

```css
.note-md .callout,
.ProseMirror .callout {
  @apply flex gap-3 p-3 rounded-lg border my-3;
}
.note-md .callout-emoji,
.ProseMirror .callout-emoji {
  @apply flex-shrink-0 select-none text-lg leading-none pt-0.5;
}
.note-md .callout-content,
.ProseMirror .callout-content {
  @apply flex-1 min-w-0;
}
```

## 7. 验证 checklist

新增或修改富文本功能后，至少验证：

- [ ] 编辑器内格式正常（H1/H2/H3、列表、引用、对齐、任务列表、高亮块）。
- [ ] Bubble Menu 内行内格式正常（加粗、斜体、下划线、删除线、颜色）。
- [ ] 高亮块点击左侧 emoji 可切换类型，背景/边框/emoji 同步变化。
- [ ] 保存后在列表卡片、详情页都能看到正确样式。
- [ ] 从详情页返回列表后，高亮块等富文本格式不丢失。
- [ ] 控制台没有新增报错。

## 8. 注意事项

- 高亮块交互必须用 React NodeView，不要试图在编辑器外层用全局 click 监听处理。
- 列表接口的 `summary` 是纯文本，任何依赖块级样式（高亮块、标题、列表、引用、代码块）的内容都不应走摘要逻辑。
- 编辑器样式必须同时写给 `.ProseMirror`（编辑态）和 `.note-md`（预览态）。
- 切换高亮块类型时要同时更新 `type` 和 `emoji`，否则 emoji 不会跟随变化。

## 9. 问题记录与统计

### 问题 1：飞书风格富文本编辑器实现与问题排查 【已解决】【优先级：8分】

**触发关键词**：富文本编辑器、Tiptap、高亮块、Callout、H1/H2/H3、无序列表、有序列表、引用、Bubble Menu、文字颜色、返回列表样式丢失

**问题描述**：
需要在 XB 笔记项目中实现类似飞书文档的富文本编辑器，包含标题、列表、引用、文字颜色、下划线、对齐、分隔线、高亮块（Callout）及 Bubble Menu。实现过程中依次遇到：
1. H1/H2/H3、无序列表、有序列表、引用块样式在编辑器或预览中不生效。
2. 高亮块左侧 emoji 点击无反应，无法切换类型。
3. 切换高亮块类型后背景色/边框变化，但 emoji 没有同步变化。
4. 发布笔记后列表页能看到高亮块，点击进入详情再返回列表，高亮块样式丢失。

**根因分析**：
1. Tailwind preflight 重置了默认样式，且编辑态（`.ProseMirror`）与预览态（`.note-md`）需要共用一套样式。
2. ProseMirror 编辑器内部会拦截普通 `onClick` 事件，外层监听无法稳定触发。
3. 高亮块扩展只更新了 `type` 属性，`emoji` 属性保持原值。
4. 列表接口 `GET /api/notes` 返回纯文本 `summary`，卡片优先使用摘要导致 HTML 块级格式被剥离。

**解决方案**：
1. 在 `app/globals.css` 中同时给 `.note-md` 和 `.ProseMirror` 写死标题、列表、引用等样式，显式使用 `list-disc`、`list-decimal`、`border-l-2` 等工具类。
2. 使用 Tiptap 的 React NodeView 渲染高亮块，交互封装在独立组件内，并用 `onMouseDown` + `preventDefault/stopPropagation` 触发选择器。
3. 切换类型时同时更新 `type` 和 `emoji`：
   ```tsx
   updateAttributes({ type: newType, emoji: CALLOUT_TYPES[newType]?.emoji ?? emoji });
   ```
4. 在 `NoteCard.tsx` 中检测内容是否包含 `data-callout`、`<h[1-6]`、`<ul`、`<ol`、`<blockquote`、`<pre`、`<code`、`<img` 等富文本块，包含时直接渲染完整 HTML，不走摘要逻辑。

**验证步骤**：
1. 编辑器内点击 H1/H2/H3、列表、引用按钮，文本样式正确。
2. 选中文本浮出 Bubble Menu，行内格式与颜色可正常设置。
3. 插入高亮块，点击左侧 emoji 弹出 6 种类型选择器，切换后背景、边框、emoji 同步变化。
4. 保存后在列表卡片和详情页均能看到正确样式。
5. 从详情页返回列表页，高亮块等富文本格式不丢失。
6. 浏览器控制台无新增报错。

**统计信息**：
- 出现次数：1 次
- 本次解决轮数：约 5 轮
- 最近解决时间：2026-07-26
- 优先级分数：8 分（1 × 5 × 1.6，今天解决时效系数取 1.6）
