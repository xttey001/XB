import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, stat } from 'fs/promises';
import path from 'path';
import {
  parseObsidianMarkdown,
  convertObsidianToStandard,
} from '@/lib/obsidian-parser';
import { stringifyJsonArray, getMonthSubdir } from '@/lib/utils';

/**
 * POST /api/import/obsidian
 * 接收 multipart/form-data:
 *   - files: 多个文件（.md 和图片），保留 webkitRelativePath 相对路径信息
 *
 * 流程：
 * 1. 分离 .md 文件和图片文件
 * 2. 先把所有图片复制到 public/uploads/YYYY/MM/，建立"原文件名 → URL"映射
 *    （如果有重名，按相对路径子目录区分；同名时加数字后缀）
 * 3. 逐个解析 .md 文件：
 *    - 提取 frontmatter（tags / created）
 *    - 转换 ![[image.png]] 为标准 Markdown（用图片 URL 映射）
 *    - 转换 [[wiki link]] 为加粗文本
 *    - 用 frontmatter.created 作为 createdAt，否则用当前时间
 * 4. 入库
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll('files');

  if (files.length === 0) {
    return NextResponse.json(
      { error: '未收到任何文件，请选择 Obsidian vault 文件夹' },
      { status: 400 }
    );
  }

  // 分类文件：.md 文件 / 图片文件 / 其他忽略
  // webkitRelativePath 是浏览器提供的相对路径，例如 "MyVault/Notes/test.md"
  const mdFiles: { file: File; relativePath: string }[] = [];
  const imageFiles: { file: File; relativePath: string }[] = [];
  const imageExtRegex = /\.(png|jpe?g|gif|webp|avif|svg|bmp)$/i;

  for (const entry of files) {
    if (!(entry instanceof File)) continue;
    // @ts-ignore - webkitRelativePath 是浏览器标准 API
    const relativePath: string = (entry as any).webkitRelativePath || entry.name;

    if (entry.name.toLowerCase().endsWith('.md')) {
      mdFiles.push({ file: entry, relativePath });
    } else if (imageExtRegex.test(entry.name)) {
      imageFiles.push({ file: entry, relativePath });
    }
  }

  if (mdFiles.length === 0) {
    return NextResponse.json({
      imported: 0,
      skipped: 0,
      errors: ['未在所选文件夹中找到任何 .md 文件'],
    });
  }

  // 准备图片复制目标目录
  const subdir = getMonthSubdir();
  const targetImageDir = path.join(process.cwd(), 'public', 'uploads', subdir);
  await mkdir(targetImageDir, { recursive: true });

  // 复制图片并建立映射
  // 映射键支持两种查找：完整相对路径和单 basename
  const imagePathToUrl = new Map<string, string>();
  const imageBasenameToUrl = new Map<string, string>();

  for (const { file, relativePath } of imageFiles) {
    // 用相对路径生成唯一文件名，避免不同子目录下同名图片冲突
    // "MyVault/Attachments/image.png" → "MyVault-Attachments-image.png"
    const safeName = relativePath
      .replace(/\//g, '-')
      .replace(/\\/g, '-')
      .replace(/\s+/g, '_');

    const targetPath = path.join(targetImageDir, safeName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(targetPath, buffer);

    const url = `/uploads/${subdir.split(path.sep).join('/')}/${safeName}`;

    // 完整相对路径（去掉第一层 vault 名）作为键
    const parts = relativePath.split(/[\\/]/);
    const pathWithoutRoot = parts.slice(1).join('/');
    if (pathWithoutRoot) {
      imagePathToUrl.set(pathWithoutRoot, url);
      imagePathToUrl.set(pathWithoutRoot.replace(/\\/g, '/'), url);
    }
    // basename 作为键（兜底，Obsidian 默认按 basename 引用）
    imagePathToUrl.set(file.name, url);
    imageBasenameToUrl.set(file.name, url);
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  // 当前最大 order
  const maxOrder = await prisma.note.aggregate({
    _max: { globalOrder: true },
  });
  let nextOrder = (maxOrder._max.globalOrder ?? 0) + 1;

  for (const { file, relativePath } of mdFiles) {
    try {
      const raw = await file.text();
      const parsed = parseObsidianMarkdown(raw);

      if (!parsed.content.trim() && parsed.images.length === 0) {
        skipped++;
        continue;
      }

      // 转换 Obsidian 语法为标准 Markdown
      // 自定义映射查找：先用完整路径，再用 basename
      const lookupImage = (ref: string): string | undefined => {
        return (
          imagePathToUrl.get(ref) ||
          imagePathToUrl.get(ref.replace(/\\/g, '/')) ||
          imageBasenameToUrl.get(ref) ||
          imageBasenameToUrl.get(path.basename(ref))
        );
      };

      const converted = convertObsidianToStandard(parsed.content, {
        get: (ref: string) => lookupImage(ref) || '',
      } as any);

      // 收集所有用到的图片 URL
      const usedImages: string[] = [];
      for (const imgRef of parsed.images) {
        const url = lookupImage(imgRef);
        if (url) usedImages.push(url);
      }

      // 决定 createdAt
      let createdAt: Date | undefined;
      const fmCreated =
        parsed.frontmatter?.created ||
        parsed.frontmatter?.date ||
        parsed.frontmatter?.publish;
      if (typeof fmCreated === 'string') {
        const d = new Date(fmCreated);
        if (!isNaN(d.getTime())) createdAt = d;
      } else if (fmCreated instanceof Date) {
        createdAt = fmCreated;
      }
      if (!createdAt) {
        // 浏览器上传的 File 没有 mtime，用当前时间兜底
        createdAt = new Date();
      }

      await prisma.note.create({
        data: {
          content: converted,
          images: stringifyJsonArray(usedImages),
          tags: stringifyJsonArray(parsed.tags),
          categoryId: null,
          globalOrder: nextOrder,
          categoryOrder: nextOrder,
          favoriteOrder: nextOrder,
          createdAt,
          updatedAt: createdAt,
        },
      });
      nextOrder++;
      imported++;
    } catch (e: any) {
      errors.push(`${file.name}: ${e.message || '导入失败'}`);
    }
  }

  return NextResponse.json({
    imported,
    skipped,
    imageCount: imageFiles.length,
    errors,
  });
}
