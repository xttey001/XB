import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * POST /api/icon/upload
 * 接收前端 Canvas 处理好的圆形图标 PNG blob，存到 public/icons/
 * 返回可直接用于 Category.icon 字段的路径，例如 "/icons/category_abc123.png"
 *
 * 与 /api/upload 的区别：
 * - 存到 public/icons/（扁平目录），不是 public/uploads/YYYY/MM/
 * - 只接受前端处理后的单文件（通常已经是 200x200 PNG）
 * - 返回 url 而非 urls 数组（单文件）
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '未收到文件' }, { status: 400 });
  }

  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: `不支持的文件类型：${file.type}，请使用 PNG/JPEG/WebP` },
      { status: 400 }
    );
  }

  // 图标体积小，限制 5MB 足够（前端已经 resize 过）
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: '图标超过 5MB 限制' },
      { status: 400 }
    );
  }

  const absoluteDir = path.join(process.cwd(), 'public', 'icons');
  await mkdir(absoluteDir, { recursive: true });

  // 生成文件名：category_时间戳_随机串.png
  // 前端 Canvas 导出的是 PNG，统一用 png 扩展名
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const safeName = `category_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const absolutePath = path.join(absoluteDir, safeName);
  const relativeUrl = `/icons/${safeName}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return NextResponse.json({ url: relativeUrl }, { status: 201 });
}
