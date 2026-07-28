import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils';
import type { NoteDTO, NoteInput } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

function toDTO(note: any, scope: 'all' | 'favorite' | 'important' | 'category' = 'all'): NoteDTO {
  const pinnedField =
    scope === 'favorite'
      ? 'pinnedFavorite'
      : scope === 'important'
      ? 'pinnedImportant'
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
    pinnedImportant: note.pinnedImportant,
    pinnedCategory: note.pinnedCategory,
    globalPinOrder: note.globalPinOrder,
    favoritePinOrder: note.favoritePinOrder,
    importantPinOrder: note.importantPinOrder,
    categoryPinOrder: note.categoryPinOrder,
    globalOrder: note.globalOrder,
    favoriteOrder: note.favoriteOrder,
    importantOrder: note.importantOrder,
    categoryOrder: note.categoryOrder,
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

  // scope 决定更新哪个置顶字段和置顶排序字段
  const scope: 'all' | 'favorite' | 'important' | 'category' =
    body.scope || 'all';
  const pinnedField =
    scope === 'favorite'
      ? 'pinnedFavorite'
      : scope === 'important'
      ? 'pinnedImportant'
      : scope === 'category'
      ? 'pinnedCategory'
      : 'pinnedGlobal';
  const pinOrderField =
    scope === 'favorite'
      ? 'favoritePinOrder'
      : scope === 'important'
      ? 'importantPinOrder'
      : scope === 'category'
      ? 'categoryPinOrder'
      : 'globalPinOrder';

  // 如果要把笔记设为置顶，且 pinOrder 没传，自动取当前 scope 最大 pinOrder + 1
  let pinOrder = body.pinOrder;
  const currentlyPinnedInScope = (existing as any)[pinnedField];
  if (body.pinned === true && pinOrder === undefined && !currentlyPinnedInScope) {
    const maxPin = await prisma.note.aggregate({ _max: { [pinOrderField]: true } });
    pinOrder = (maxPin._max[pinOrderField] ?? 0) + 1;
  }
  if (body.pinned === false) {
    // 取消置顶时重置当前 scope 的 pinOrder
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
        [pinnedField]: body.pinned,
      }),
      ...(pinOrder !== undefined && { [pinOrderField]: pinOrder }),
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
