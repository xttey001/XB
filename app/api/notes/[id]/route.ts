import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseJsonArray, stringifyJsonArray } from '@/lib/utils';
import { syncNoteLinks } from '@/lib/link-parser';
import type { NoteDTO, NoteInput } from '@/lib/types';

interface RouteParams {
  params: { id: string };
}

function toDTO(note: any, scope: 'all' | 'favorite' | 'important' | 'veryImportant' | 'category' | 'liked' | 'reposted' | 'allPinned' = 'all'): NoteDTO {
  const pinnedField =
    scope === 'favorite'
      ? 'pinnedFavorite'
      : scope === 'important'
      ? 'pinnedImportant'
      : scope === 'veryImportant'
      ? 'pinnedVeryImportant'
      : scope === 'category'
      ? 'pinnedCategory'
      : scope === 'liked'
      ? 'pinnedLiked'
      : scope === 'reposted'
      ? 'pinnedReposted'
      : 'pinnedGlobal';

  // allPinned 视图：检查是否在任意视图中被置顶
  const isAnyPinned = (n: any) =>
    n.pinnedGlobal || n.pinnedFavorite || n.pinnedImportant ||
    n.pinnedVeryImportant || n.pinnedCategory || n.pinnedLiked || n.pinnedReposted;

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
          pinned: note.category.pinned,
          createdAt: note.category.createdAt.toISOString(),
        }
      : null,
    isFavorite: note.isFavorite,
    importance: (note.importance as 'important' | 'very_important' | null) || null,
    pinned: scope === 'allPinned' ? isAnyPinned(note) : note[pinnedField],
    pinnedGlobal: note.pinnedGlobal,
    pinnedFavorite: note.pinnedFavorite,
    pinnedImportant: note.pinnedImportant,
    pinnedVeryImportant: note.pinnedVeryImportant,
    pinnedCategory: note.pinnedCategory,
    pinnedLiked: note.pinnedLiked,
    pinnedReposted: note.pinnedReposted,
    globalPinOrder: note.globalPinOrder,
    favoritePinOrder: note.favoritePinOrder,
    importantPinOrder: note.importantPinOrder,
    veryImportantPinOrder: note.veryImportantPinOrder,
    categoryPinOrder: note.categoryPinOrder,
    likedPinOrder: note.likedPinOrder,
    repostedPinOrder: note.repostedPinOrder,
    globalOrder: note.globalOrder,
    favoriteOrder: note.favoriteOrder,
    importantOrder: note.importantOrder,
    categoryOrder: note.categoryOrder,
    repostOfId: note.repostOfId || null,
    repostOf: note.repostOf ? toDTO(note.repostOf, scope) : null,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    reviewAt: note.reviewAt?.toISOString() || null,
    reviewRepeat: note.reviewRepeat || null,
    reviewStep: note.reviewStep ?? 0,
    reviewLastSent: note.reviewLastSent?.toISOString() || null,
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
  const scope: 'all' | 'favorite' | 'important' | 'veryImportant' | 'category' | 'liked' | 'reposted' | 'allPinned' =
    body.scope || 'all';
  const pinnedField =
    scope === 'favorite'
      ? 'pinnedFavorite'
      : scope === 'important'
      ? 'pinnedImportant'
      : scope === 'veryImportant'
      ? 'pinnedVeryImportant'
      : scope === 'category'
      ? 'pinnedCategory'
      : scope === 'liked'
      ? 'pinnedLiked'
      : scope === 'reposted'
      ? 'pinnedReposted'
      : scope === 'allPinned'
      ? 'pinnedGlobal'
      : 'pinnedGlobal';
  const pinOrderField =
    scope === 'favorite'
      ? 'favoritePinOrder'
      : scope === 'important'
      ? 'importantPinOrder'
      : scope === 'veryImportant'
      ? 'veryImportantPinOrder'
      : scope === 'category'
      ? 'categoryPinOrder'
      : scope === 'liked'
      ? 'likedPinOrder'
      : scope === 'reposted'
      ? 'repostedPinOrder'
      : scope === 'allPinned'
      ? 'globalPinOrder'
      : 'globalPinOrder';

  // 如果要把笔记设为置顶，且 pinOrder 没传，自动取当前 scope 最大 pinOrder + 1
  let pinOrder = body.pinOrder;
  const currentlyPinnedInScope = (existing as any)[pinnedField];
  const forcePinToTop = body.forcePinToTop === true;
  
  // allPinned 视图的特殊处理：取消置顶时清除所有视图的置顶状态
  if (scope === 'allPinned' && body.pinned === false) {
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
        // 清除所有视图的置顶状态
        pinnedGlobal: false,
        pinnedFavorite: false,
        pinnedImportant: false,
        pinnedVeryImportant: false,
        pinnedCategory: false,
        pinnedLiked: false,
        pinnedReposted: false,
        // 重置所有 pinOrder
        globalPinOrder: 0,
        favoritePinOrder: 0,
        importantPinOrder: 0,
        veryImportantPinOrder: 0,
        categoryPinOrder: 0,
        likedPinOrder: 0,
        repostedPinOrder: 0,
        ...(body.reviewAt !== undefined && {
          reviewAt: body.reviewAt ? new Date(body.reviewAt) : null,
        }),
        ...(body.reviewRepeat !== undefined && {
          reviewRepeat: body.reviewRepeat || null,
        }),
        ...(body.reviewStep !== undefined && {
          reviewStep: body.reviewStep,
        }),
        ...(body.reviewLastSent !== undefined && {
          reviewLastSent: body.reviewLastSent ? new Date(body.reviewLastSent) : null,
        }),
      },
      include: { category: true },
    });

    // 同步链接关系（如果内容有更新）
    if (body.content !== undefined) {
      await syncNoteLinks(note.id, note.content);
    }

    return NextResponse.json({ note: toDTO(note, scope) });
  }
  
  // 强制置顶到顶部：无论当前是否置顶，都将 pinOrder 设置为最大值 + 1
  if (forcePinToTop) {
    const maxPin = await prisma.note.aggregate({ _max: { [pinOrderField]: true } });
    pinOrder = (maxPin._max[pinOrderField] ?? 0) + 1;
  } else if (body.pinned === true && pinOrder === undefined && !currentlyPinnedInScope) {
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
      ...(body.reviewAt !== undefined && {
        reviewAt: body.reviewAt ? new Date(body.reviewAt) : null,
      }),
      ...(body.reviewRepeat !== undefined && {
        reviewRepeat: body.reviewRepeat || null,
      }),
      ...(body.reviewStep !== undefined && {
        reviewStep: body.reviewStep,
      }),
      ...(body.reviewLastSent !== undefined && {
        reviewLastSent: body.reviewLastSent ? new Date(body.reviewLastSent) : null,
      }),
    },
    include: { category: true },
  });

  // 同步链接关系（如果内容有更新）
  if (body.content !== undefined) {
    await syncNoteLinks(note.id, note.content);
  }

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
