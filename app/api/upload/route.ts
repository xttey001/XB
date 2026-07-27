import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import {
  MAX_IMAGE_SIZE,
  generateSafeFileName,
  getMonthSubdir,
} from '@/lib/utils';

/**
 * POST /api/upload
 * 接收 multipart/form-data 中的 file 字段，存到 public/uploads/YYYY/MM/
 * 返回可直接访问的 URL 路径，例如 "/uploads/2026/07/xxx.jpg"
 *
 * 自用场景：单文件 50MB 兜底限制，不限单条笔记图片数量
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll('files');

  if (files.length === 0) {
    return NextResponse.json({ error: '未收到文件' }, { status: 400 });
  }

  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
  ];

  const uploaded: string[] = [];

  for (const file of files) {
    if (!(file instanceof File)) continue;

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `不支持的文件类型：${file.type}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: `文件 ${file.name} 超过 50MB 限制` },
        { status: 400 }
      );
    }

    const subdir = getMonthSubdir();
    const relativeDir = path.join('uploads', subdir);
    const absoluteDir = path.join(process.cwd(), 'public', relativeDir);

    await mkdir(absoluteDir, { recursive: true });

    const safeName = generateSafeFileName(file.name);
    const absolutePath = path.join(absoluteDir, safeName);
    const relativeUrl = `/${relativeDir.split(path.sep).join('/')}/${safeName}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    uploaded.push(relativeUrl);
  }

  return NextResponse.json({ urls: uploaded }, { status: 201 });
}
