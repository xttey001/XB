import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: { id: string };
}

/** DELETE /api/comments/[id] */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await prisma.comment.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '评论不存在或已删除' }, { status: 404 });
  }
}
