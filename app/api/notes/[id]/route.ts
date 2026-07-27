import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils';
import type { NoteDTO, NoteInput } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

function toDTO(note: any, scope: 'all' | 'favorite' | 'category' = 'all'): NoteDTO {
  const pinnedField =
    scope === 'favorite'
      ? 'pinnedFavorite'
      : scope === 'category'
      ? 'pinnedCategory'
      : 'pinnedGlobal';

  return {
    id: note.id,
    content: note.content,
    images: parseJsonArray<string>(note.images),
    tags: parseJsonArray<string>(note.tags),
    categoryId: note.categoryId,
    category: note.category
      ? {
          id: note.category.id,
          name: note.category.name,
          color: note.category.color,
          icon: note.category.icon,
          order: note.category.order,
          createdAt: note.category.createdAt.toISOString(),
        }
      : null,
    isFavorite: note.isFavorite,
    importance: (note.importance as 'important' | 'very_important' | null) || null,
    pinned: note[pinnedField],
    pinnedGlobal: note.pinnedGlobal,
    pinnedFavorite: note.pinnedFavorite,
    pinnedCategory: note.pinnedCategory,
    pinOrder: note.pinOrder,
    globalOrder: note.globalOrder,
    categoryOrder: note.categoryOrder,
    favoriteOrder: note.favoriteOrder,
    repostOfId: note.repostOfId || null,
    repostOf: note.repostOf ? toDTO(note.repostOf, scope) : null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
  };
}

/** GET /api/notes/[id] —— 获取单条笔记（含社交统计） */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const note = await prisma.note.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      repostOf: { include: { category: true } },
      _count: { select: { likes: true, comments: true, reposts: true } },
      likes: true,
    },
  });
  if (!note) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  }
  const dto = toDTO(note, 'all');
  (dto as any)._social = {
    likeCount: (note as any)._count.likes,
    commentCount: (note as any)._count.comments,
    repostCount: (note as any)._count.reposts,
    liked: note.likes.length > 0,
    comments: [],
    reposts: [],
  };
  return NextResponse.json({ note: dto });
}

/**
 * PUT /api/notes/[id] —— 改写笔记
 * updatedAt 由 Prisma @updatedAt 自动维护，无需手动设置
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const body = (await req.json()) as Partial<NoteInput>;

  const existing = await prisma.note.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: '笔记不存在' }, { status: 404 });
  }

  // scope 决定更新哪个置顶字段
  const scope = body.scope || 'all';
  const pinnedField =
    scope === 'favorite'
      ? 'pinnedFavorite'
      : scope === 'category'
      ? 'pinnedCategory'
      : 'pinnedGlobal';

  // 如果要把笔记设为置顶，且 pinOrder 没传，自动取当前最大 pinOrder + 1
  let pinOrder = body.pinOrder;
  const currentlyPinnedInScope = (existing as any)[pinnedField];
  if (body.pinned === true && pinOrder === undefined && !currentlyPinnedInScope) {
    const maxPin = await prisma.note.aggregate({ _max: { pinOrder: true } });
    pinOrder = (maxPin._max.pinOrder ?? 0) + 1;
  }
  if (body.pinned === false) {
    // 取消置顶时重置 pinOrder
    pinOrder = 0;
  }

  const note = await prisma.note.update({
    where: { id: params.id },
    data: {
      ...(body.content !== undefined && { content: body.content.trim() }),
      ...(body.images !== undefined && {
        images: stringifyJsonArray(body.images),
      }),
      ...(body.tags !== undefined && { tags: stringifyJsonArray(body.tags) }),
      ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
      ...(body.isFavorite !== undefined && { isFavorite: body.isFavorite }),
      ...(body.importance !== undefined && { importance: body.importance }),
      ...(body.pinned !== undefined && {
        pinned: body.pinned,
        [pinnedField]: body.pinned,
      }),
      ...(pinOrder !== undefined && { pinOrder }),
    },
    include: { category: true },
  });

  return NextResponse.json({ note: toDTO(note, scope) });
}

/** DELETE /api/notes/[id] —— 删除笔记 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    await prisma.note.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '笔记不存在或已删除' }, { status: 404 });
  }
}
