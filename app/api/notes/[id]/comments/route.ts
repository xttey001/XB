import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray } from '@/lib/utils';
import type { CommentDTO } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

function toCommentDTO(c: any, includeReplies = false): CommentDTO {
  return {
    id: c.id,
    noteId: c.noteId,
    parentId: c.parentId,
    content: c.content,
    images: parseJsonArray<string>(c.images),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    ...(includeReplies && c.replies
      ? { replies: c.replies.map((r: any) => toCommentDTO(r, false)) }
      : {}),
  };
}

/**
 * GET /api/notes/[id]/comments
 * 返回顶层评论，并附带 replies（二级回复）
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { noteId: params.id, parentId: null },
    include: {
      replies: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({
    comments: comments.map((c) => toCommentDTO(c, true)),
  });
}

/**
 * POST /api/notes/[id]/comments
 * body: { content: string, parentId?: string }
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const note = await prisma.note.findUnique({ where: { id: params.id } });
  if (!note) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  }

  const body = (await req.json()) as { content?: string; parentId?: string; images?: string[] };
  const content = body.content?.trim() || '';
  const images = body.images ?? [];
  if (!content && images.length === 0) {
    return NextResponse.json({ error: '评论内容或图片不能同时为空' }, { status: 400 });
  }

  if (body.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: body.parentId },
    });
    if (!parent || parent.noteId !== params.id) {
      return NextResponse.json({ error: '回复的评论不存在' }, { status: 400 });
    }
  }

  const comment = await prisma.comment.create({
    data: {
      noteId: params.id,
      parentId: body.parentId || null,
      content,
      images: JSON.stringify(images),
    },
  });

  return NextResponse.json({ comment: toCommentDTO(comment) }, { status: 201 });
}
