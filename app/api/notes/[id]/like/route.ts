import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/notes/[id]/like
 * 单用户场景：toggle 点赞。已赞则取消，未赞则点赞。
 */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  }

  const existing = await prisma.like.findUnique({
    where: { noteId: params.id },
  });

  if (existing) {
    await prisma.like.delete({ where: { id: existing.id } });
  } else {
    await prisma.like.create({ data: { noteId: params.id } });
  }

  const likeCount = await prisma.like.count({ where: { noteId: params.id } });
  return NextResponse.json({ liked: !existing, likeCount });
}
