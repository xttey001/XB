import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notes/search?q=xxx
 * 搜索笔记标题/摘要（用于编辑器 @ 唤起链接搜索）
 * 返回结果简洁，只包含 id 和 content 摘要
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  if (!q) {
    return NextResponse.json({ notes: [] });
  }

  const notes = await prisma.note.findMany({
    where: {
      content: { contains: q },
    },
    select: {
      id: true,
      content: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const result = notes.map((n) => {
    // 提取纯文本摘要（去除 HTML 标签）
    const plain = n.content
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const summary = plain.length > 80 ? plain.slice(0, 80) + '…' : plain;
    return {
      id: n.id,
      title: summary,
    };
  });

  return NextResponse.json({ notes: result });
}