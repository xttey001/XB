# Obsidian 导入目录

把你的 Obsidian vault 文件夹（或子目录）的内容拷贝到这里，然后在网页上点击"导入 Obsidian"按钮。

## 步骤

1. 把 Obsidian vault 中的 `.md` 文件和图片文件夹拷贝到本目录
   （不需要拷贝 `.obsidian/` 配置目录，系统会自动忽略）
2. 打开 http://localhost:3300
3. 点击右上角"导入 Obsidian"按钮
4. 输入或确认路径：`d:\XB\obsidian-import`
5. 点击"开始导入"

## 导入规则

- ✅ YAML frontmatter（提取 tags / created 等元数据）
- ✅ `![[image.png]]` 嵌入图片 → 自动复制到 `public/uploads/` 并转换为标准 Markdown
- ✅ `[[wiki link]]` → 加粗保留为文本（无对应笔记可链接）
- ✅ `#标签` 内联标签 → 自动提取
- ✅ 使用 frontmatter.created 作为创建时间，否则用文件修改时间
- ⚠️ 同名图片会自动加数字后缀避免覆盖
- ⚠️ Obsidian 的画板（.canvas）、Excalidraw（.excalidraw）等非 Markdown 文件不导入
